import "server-only";
import crypto from "node:crypto";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Integração com o Mercado Pago (split marketplace — cada loja conecta a
 * própria conta via OAuth, o dinheiro cai direto pra ela). Tudo aqui roda
 * só no servidor: usa `client_secret` da aplicação da plataforma e o
 * `access_token` de cada vendedor, nenhum dos dois pode vazar pro
 * browser. Ver migração `mercadopago_conta_por_loja` (tabela
 * `empresa_mercadopago`, sem policy nenhuma de RLS — só service_role
 * mexe aqui).
 */

interface RespostaTokenMercadoPago {
  access_token: string;
  refresh_token: string;
  public_key: string;
  user_id: number;
  expires_in: number;
}

function redirectUriPadrao(): string {
  return `${process.env.SITE_URL}/mp/callback`;
}

/**
 * Troca o `code` recebido no callback OAuth pelo access_token/refresh_token
 * do vendedor e grava em `empresa_mercadopago` (upsert — reconectar
 * substitui o token antigo). `empresaId` vem do parâmetro `state` da URL
 * de autorização (ver mercado_pago_conectar_screen.dart no app).
 */
export async function trocarCodigoPorToken(
  codigo: string,
  empresaId: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const resposta = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.MERCADO_PAGO_CLIENT_ID,
      client_secret: process.env.MERCADO_PAGO_CLIENT_SECRET,
      code: codigo,
      grant_type: "authorization_code",
      redirect_uri: redirectUriPadrao(),
    }),
  });

  if (!resposta.ok) {
    return { ok: false, erro: "O Mercado Pago recusou a conexão. Volte ao app e tente conectar de novo." };
  }

  const dados = (await resposta.json()) as RespostaTokenMercadoPago;
  const supabase = createServiceClient();
  const { error } = await supabase.from("empresa_mercadopago").upsert({
    empresa_id: empresaId,
    mp_user_id: String(dados.user_id),
    access_token: dados.access_token,
    refresh_token: dados.refresh_token,
    public_key: dados.public_key,
    expires_at: new Date(Date.now() + dados.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return { ok: false, erro: "Conectou no Mercado Pago, mas houve um erro ao salvar aqui. Tente de novo." };
  }
  return { ok: true };
}

/**
 * Access_token válido do vendedor, renovando primeiro se estiver perto de
 * vencer (folga de 1 dia — token dura 180 dias, então isso raramente
 * dispara). `null` = loja nunca conectou o Mercado Pago.
 */
export async function obterAccessTokenValido(empresaId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("empresa_mercadopago")
    .select("access_token, refresh_token, expires_at")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!data) return null;

  const folgaUmDia = 24 * 60 * 60 * 1000;
  if (new Date(data.expires_at).getTime() - Date.now() > folgaUmDia) {
    return data.access_token;
  }

  const resposta = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.MERCADO_PAGO_CLIENT_ID,
      client_secret: process.env.MERCADO_PAGO_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: data.refresh_token,
    }),
  });
  // Se a renovação falhar, segue com o token antigo — se ele já tiver
  // vencido de vez, a chamada seguinte (criar pagamento) falha de forma
  // visível, em vez de travar aqui sem processar o pedido.
  if (!resposta.ok) return data.access_token;

  const novo = (await resposta.json()) as RespostaTokenMercadoPago;
  await supabase
    .from("empresa_mercadopago")
    .update({
      access_token: novo.access_token,
      refresh_token: novo.refresh_token,
      expires_at: new Date(Date.now() + novo.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("empresa_id", empresaId);
  return novo.access_token;
}

/** Campos do Payment Brick (`formData` do onSubmit) que repassamos pra API de pagamento do Mercado Pago — ver `@mercadopago/sdk-react`, tipo `IPaymentFormData`. */
export interface DadosPagamentoOnline {
  token?: string;
  issuer_id?: string;
  payment_method_id: string;
  transaction_amount: number;
  installments?: number;
  payer: {
    email: string;
    identification?: { type: string; number: string };
  };
}

/**
 * `pedidos.status_pagamento` só usa dois valores hoje (ver `pagoPeloMarketplace`
 * no app Gestor, `lib/models/venda.dart`, e `pedido/[id]/page.tsx` no
 * site) — "pago" (já cobrado, ex: marketplace) ou "pendente" (cobrar
 * ainda, o default). Não existe um terceiro estado "recusado" no
 * modelo atual — um pagamento online rejeitado/cancelado simplesmente
 * fica "pendente" igual qualquer outro pedido ainda não pago, e o
 * lojista decide (pedir novo pagamento, cancelar) exatamente como já
 * faria hoje com qualquer forma de pagamento não confirmada.
 */
function mapearStatusMercadoPago(status?: string): "pendente" | "pago" {
  return status === "approved" ? "pago" : "pendente";
}

/**
 * Cria o pagamento na API do Mercado Pago usando o access_token DO
 * VENDEDOR (split — nunca o token da plataforma), sem `application_fee`
 * (comissão da plataforma = 0 por enquanto). Chamada DEPOIS que o pedido
 * já existe em `pedidos` (ver `finalizarPedidoOnline` em checkout.ts) —
 * `external_reference` é o próprio id do pedido, é assim que o webhook
 * encontra de volta qual pedido atualizar.
 */
export async function cobrarPagamentoOnline(
  empresaId: string,
  pedidoId: string,
  dados: DadosPagamentoOnline,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const accessToken = await obterAccessTokenValido(empresaId);
  if (!accessToken) {
    return { ok: false, erro: "Essa loja ainda não conectou o Mercado Pago." };
  }

  const client = new MercadoPagoConfig({ accessToken });
  let pagamento;
  try {
    pagamento = await new Payment(client).create({
      body: {
        ...dados,
        // O SDK espera number; o Payment Brick devolve string no formData.
        issuer_id: dados.issuer_id != null ? Number(dados.issuer_id) : undefined,
        external_reference: pedidoId,
        notification_url: `${process.env.SITE_URL}/api/mercadopago/webhook`,
      },
    });
  } catch (erro) {
    console.error("Erro ao criar pagamento no Mercado Pago:", erro);
    return { ok: false, erro: "Não foi possível processar o pagamento. Tente de novo." };
  }

  const supabase = createServiceClient();
  // Merge manual em vez de sobrescrever `metadata` — o RPC já grava
  // outras chaves ali (entregaSelecionada, modalidadeEntrega, cupom...)
  // e um .update() direto substituiria o objeto inteiro.
  const { data: pedidoAtual } = await supabase.from("pedidos").select("metadata").eq("id", pedidoId).maybeSingle();
  const statusPagamento = mapearStatusMercadoPago(pagamento.status);
  // Pix (e outros meios via QR) só vêm com isso preenchido — sem gravar
  // aqui, a página de confirmação não tem como mostrar o QR/copia-e-cola
  // pro cliente pagar (o Payment Brick não mostra a própria tela de QR
  // nesse fluxo, já que a gente navega pra /pedido/[id] assim que o
  // pagamento é criado).
  const dadosPix = pagamento.point_of_interaction?.transaction_data;
  await supabase
    .from("pedidos")
    .update({
      gateway_pagamento: "mercado_pago",
      status_pagamento: statusPagamento,
      // Aprovação síncrona (comum em cartão) já libera o pedido pra fila
      // do lojista agora — sem isso ficaria preso em "aguardando_pagamento"
      // até o webhook chegar, mesmo já sabendo que foi aprovado. Pix/outros
      // meios assíncronos ficam mesmo em "aguardando_pagamento" até o
      // webhook confirmar (ver `atualizarStatusPagamento`).
      ...(statusPagamento === "pago" ? { status: "pendente" } : {}),
      metadata: {
        ...(pedidoAtual?.metadata ?? {}),
        mercadoPagoPaymentId: String(pagamento.id),
        ...(dadosPix?.qr_code
          ? { mercadoPagoPixQrCode: dadosPix.qr_code, mercadoPagoPixQrCodeBase64: dadosPix.qr_code_base64 }
          : {}),
      },
    })
    .eq("id", pedidoId);

  return { ok: true };
}

/**
 * Chamada pelo webhook quando o Mercado Pago notifica atualização de um
 * pagamento — busca o pedido pelo id do pagamento (gravado em
 * `cobrarPagamentoOnline`), confirma o status de verdade na API do MP
 * (nunca confia no corpo da notificação em si) e atualiza
 * `status_pagamento`. Silenciosamente não faz nada se o pagamento não
 * corresponder a nenhum pedido nosso — evita erro 500 pra notificação
 * de um payment_id desconhecido.
 */
export async function atualizarStatusPagamento(paymentId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, empresa_id")
    .eq("metadata->>mercadoPagoPaymentId", paymentId)
    .maybeSingle();
  if (!pedido) return;

  const accessToken = await obterAccessTokenValido(pedido.empresa_id);
  if (!accessToken) return;

  const client = new MercadoPagoConfig({ accessToken });
  const pagamento = await new Payment(client).get({ id: paymentId });
  const statusPagamento = mapearStatusMercadoPago(pagamento.status);

  if (statusPagamento === "pago") {
    // Libera pra fila do lojista só agora que o pagamento foi confirmado de
    // verdade — comum em Pix, onde a criação do pagamento
    // (`cobrarPagamentoOnline`) só devolve "pendente", e é esse webhook que
    // avisa quando o cliente efetivamente pagou. O `.eq("status", ...)`
    // evita reabrir um pedido que o lojista já cancelou manualmente
    // enquanto esperava.
    await supabase
      .from("pedidos")
      .update({ status_pagamento: statusPagamento, status: "pendente" })
      .eq("id", pedido.id)
      .eq("status", "aguardando_pagamento");
  } else {
    await supabase.from("pedidos").update({ status_pagamento: statusPagamento }).eq("id", pedido.id);
  }
}

/**
 * Confirma que a notificação do webhook veio mesmo do Mercado Pago —
 * HMAC-SHA256 do manifest `id:{data.id};request-id:{x-request-id};ts:{ts};`
 * com o segredo do webhook, comparado em tempo constante. Sem isso,
 * qualquer um poderia POSTar pro nosso webhook fingindo que um pagamento
 * foi aprovado.
 */
export function verificarAssinaturaWebhook(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string,
): boolean {
  if (!xSignature || !xRequestId) return false;

  const partes = Object.fromEntries(
    xSignature.split(",").map((parte) => {
      const i = parte.indexOf("=");
      return [parte.slice(0, i).trim(), parte.slice(i + 1).trim()];
    }),
  );
  if (!partes.ts || !partes.v1) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${partes.ts};`;
  const esperado = crypto.createHmac("sha256", process.env.MERCADO_PAGO_WEBHOOK_SECRET!).update(manifest).digest("hex");

  const bufferEsperado = Buffer.from(esperado);
  const bufferRecebido = Buffer.from(partes.v1);
  return bufferEsperado.length === bufferRecebido.length && crypto.timingSafeEqual(bufferEsperado, bufferRecebido);
}
