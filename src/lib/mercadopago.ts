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

  // Só pra identificação na tela de conexão (qual conta está conectada,
  // ver mercado_pago_conectar_screen.dart) — achado direto nesta sessão:
  // sem isso a tela só mostra "Conta conectada" sem dizer qual, o que já
  // causou confusão real entre a conta de teste e a conta de produção.
  // Best-effort: se essa chamada falhar, segue sem email em vez de
  // travar a conexão em si.
  let email: string | null = null;
  try {
    const respostaUsuario = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${dados.access_token}` },
    });
    if (respostaUsuario.ok) {
      const usuario = (await respostaUsuario.json()) as { email?: string };
      email = usuario.email ?? null;
    }
  } catch {
    // Segue sem email — não é crítico pra conexão funcionar.
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("empresa_mercadopago").upsert({
    empresa_id: empresaId,
    mp_user_id: String(dados.user_id),
    access_token: dados.access_token,
    refresh_token: dados.refresh_token,
    public_key: dados.public_key,
    mp_email: email,
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
 * `status_detail` da API do Mercado Pago pra recusa de cartão, traduzido
 * pro cliente entender o que fazer — sem isso a mensagem genérica
 * ("não foi possível processar") não diferencia "seu cartão não tem
 * saldo" de "CVV errado" de "essa loja não pode receber esse cartão",
 * cada um pede uma ação diferente do cliente. Lista oficial:
 * https://www.mercadopago.com.br/developers/pt/docs/checkout-api/response-handling/collection-results
 */
function mapearMotivoRecusa(statusDetail?: string): string {
  const mensagens: Record<string, string> = {
    cc_rejected_insufficient_amount: "Saldo insuficiente no cartão.",
    cc_rejected_bad_filled_security_code: "Código de segurança (CVV) incorreto.",
    cc_rejected_bad_filled_date: "Data de validade incorreta.",
    cc_rejected_bad_filled_card_number: "Número do cartão incorreto.",
    cc_rejected_bad_filled_other: "Dados do cartão incorretos.",
    cc_rejected_call_for_authorize: "Cartão recusado — ligue pra sua operadora pra autorizar essa compra.",
    cc_rejected_card_disabled: "Cartão desabilitado — ligue pra sua operadora ou tente outro cartão.",
    cc_rejected_duplicated_payment: "Já existe um pagamento igual em andamento — aguarde alguns minutos antes de tentar de novo.",
    cc_rejected_invalid_installments: "Número de parcelas não permitido pra esse cartão.",
    cc_rejected_max_attempts: "Muitas tentativas com esse cartão. Tente outro cartão ou pague com Pix.",
    cc_rejected_card_type_not_allowed: "Essa loja não aceita esse tipo de cartão.",
  };
  return mensagens[statusDetail ?? ""] ?? "Pagamento recusado pela operadora do cartão. Tente outro cartão ou pague com Pix.";
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

  const supabase = createServiceClient();
  // Nunca confia no `transaction_amount` que vem do Brick — mesma
  // regra já aplicada a preço/frete/cupom em todo o resto do checkout
  // (ver finalizar_pedido_site). Achado testando: o Brick com
  // `locale: "pt-BR"` devolve o valor formatado (vírgula decimal), que a
  // API do MP rejeita com "Invalid transaction_amount" (causa 4037) — o
  // valor real e já validado é o `valor_total` que o RPC gravou no pedido.
  const { data: pedidoAtual } = await supabase
    .from("pedidos")
    .select("metadata, valor_total, numero_sequencial, cliente_id")
    .eq("id", pedidoId)
    .maybeSingle();
  if (!pedidoAtual?.valor_total) {
    return { ok: false, erro: "Não foi possível confirmar o valor do pedido. Tente de novo." };
  }

  // Só pra aparecer algo legível no extrato/painel do Mercado Pago
  // (por padrão o `description` vem vazio e a transação lá só mostra o
  // valor) — não afeta nada da lógica de cobrança em si.
  const { data: itens } = await supabase
    .from("itens_pedido")
    .select("quantidade, produtos(nome)")
    .eq("pedido_id", pedidoId);
  const resumoItens = (itens ?? [])
    .map((item) => `${item.quantidade}x ${(item.produtos as unknown as { nome: string } | null)?.nome ?? "item"}`)
    .join(", ")
    .slice(0, 200);
  const description = `Pedido #${pedidoAtual.numero_sequencial}${resumoItens ? ` - ${resumoItens}` : ""}`;

  const client = new MercadoPagoConfig({ accessToken });
  let pagamento;
  try {
    pagamento = await new Payment(client).create({
      body: {
        ...dados,
        transaction_amount: pedidoAtual.valor_total,
        // O SDK espera number; o Payment Brick devolve string no formData.
        issuer_id: dados.issuer_id != null ? Number(dados.issuer_id) : undefined,
        external_reference: pedidoId,
        notification_url: `${process.env.SITE_URL}/api/mercadopago/webhook`,
        description,
      },
    });
  } catch (erro) {
    console.error("Erro ao criar pagamento no Mercado Pago:", erro);
    return { ok: false, erro: "Não foi possível processar o pagamento. Tente de novo." };
  }

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
        // payment_type_id (credit_card/debit_card/bank_transfer) + installments
        // é o que dá pra mostrar "Cartão de crédito parcelado em 3x" em vez de
        // só "Pagamento Online" genérico no detalhe da venda (app Gestor).
        mercadoPagoPaymentTypeId: pagamento.payment_type_id ?? null,
        mercadoPagoInstallments: pagamento.installments ?? null,
        ...(dadosPix?.qr_code
          ? { mercadoPagoPixQrCode: dadosPix.qr_code, mercadoPagoPixQrCodeBase64: dadosPix.qr_code_base64 }
          : {}),
      },
    })
    .eq("id", pedidoId);

  // Pix não tem cartão pra salvar (`dados.token` só existe em pagamento com
  // cartão). Best-effort de propósito — cliente salvo é uma conveniência
  // (evita digitar o cartão de novo na próxima compra), nunca deve
  // derrubar um pagamento que já foi cobrado com sucesso.
  if (dados.token) {
    try {
      await salvarCartaoDoCliente(empresaId, pedidoAtual.cliente_id, accessToken, dados.token, dados.payer.email, pagamento.card);
    } catch (erro) {
      console.error("Erro ao salvar cartão do cliente no Mercado Pago:", erro);
    }
  }

  // Recusado é diferente de "pendente" (Pix, análise) — sem isso o cliente
  // era jogado pra tela de confirmação achando que só falta confirmar,
  // quando na real a cobrança já falhou de vez e ele precisa tentar outro
  // cartão/meio agora. O pedido em si continua existindo em
  // aguardando_pagamento (o lojista/job de expiração cuidam de limpar se o
  // cliente não tentar de novo — ver cancelar_pedidos_pagamento_abandonado).
  if (pagamento.status === "rejected") {
    return { ok: false, erro: mapearMotivoRecusa(pagamento.status_detail) };
  }

  return { ok: true };
}

/**
 * Cria (ou reaproveita) o Customer do cliente no Mercado Pago DESSA loja —
 * split por conta, então o mesmo cliente comprando em duas lojas diferentes
 * tem um `mp_customer_id` diferente em cada uma (cada uma é um vendedor MP
 * separado). Salva o token do cartão recém-usado nesse Customer pra
 * aparecer como opção pronta no próximo checkout (Payment Brick com
 * `initialization.payer.customerId/cardsIds` — ver pagamento-form.tsx).
 * Deduplica pelos últimos 4 dígitos + validade (vêm no retorno do próprio
 * pagamento) pra não empilhar o mesmo cartão físico a cada compra.
 */
async function salvarCartaoDoCliente(
  empresaId: string,
  clienteId: string,
  accessToken: string,
  token: string,
  email: string,
  cartaoCobrado: { last_four_digits?: string; expiration_month?: number; expiration_year?: number } | undefined,
): Promise<void> {
  if (!cartaoCobrado?.last_four_digits) return;

  const supabase = createServiceClient();
  const { data: cliente } = await supabase.from("clientes").select("nome, mp_customer_id").eq("id", clienteId).single();
  if (!cliente) return;

  let customerId = cliente.mp_customer_id;
  if (!customerId) {
    const [primeiroNome, ...resto] = cliente.nome.trim().split(/\s+/);
    const resposta = await fetch("https://api.mercadopago.com/v1/customers", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, first_name: primeiroNome, last_name: resto.join(" ") || primeiroNome }),
    });
    if (!resposta.ok) return;
    const novoCustomer = (await resposta.json()) as { id: string };
    customerId = novoCustomer.id;
    await supabase.from("clientes").update({ mp_customer_id: customerId }).eq("id", clienteId);
  }

  const respostaCartoes = await fetch(`https://api.mercadopago.com/v1/customers/${customerId}/cards`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (respostaCartoes.ok) {
    const cartoesExistentes = (await respostaCartoes.json()) as Array<{
      last_four_digits: string;
      expiration_month: number;
      expiration_year: number;
    }>;
    const jaSalvo = cartoesExistentes.some(
      (c) =>
        c.last_four_digits === cartaoCobrado.last_four_digits &&
        c.expiration_month === cartaoCobrado.expiration_month &&
        c.expiration_year === cartaoCobrado.expiration_year,
    );
    if (jaSalvo) return;
  }

  await fetch(`https://api.mercadopago.com/v1/customers/${customerId}/cards`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

/**
 * IDs dos cartões salvos do cliente nessa loja (empresaId — split, ver
 * `salvarCartaoDoCliente`) — repassados pro Payment Brick mostrar como
 * opção pronta (`initialization.payer.cardsIds`). `null`/`[]` = cliente
 * não tem cartão salvo ainda, Brick renderiza o formulário normal.
 */
export async function listarCartoesSalvos(empresaId: string, mpCustomerId: string): Promise<string[]> {
  const accessToken = await obterAccessTokenValido(empresaId);
  if (!accessToken) return [];

  try {
    const resposta = await fetch(`https://api.mercadopago.com/v1/customers/${mpCustomerId}/cards`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resposta.ok) return [];
    const cartoes = (await resposta.json()) as Array<{ id: string }>;
    return cartoes.map((c) => c.id);
  } catch {
    return [];
  }
}

/**
 * Estorna um pagamento online já confirmado — chamado pelo botão "Estornar
 * pagamento" no app Gestor (ver `/api/mercadopago/estornar`, que valida
 * dono/gerente antes de chegar aqui). Só grava o resultado no metadata do
 * pedido; quem marca como cancelado + repõe estoque + estorna saldo é o
 * próprio app, via RPC `cancelar_pedido` já existente e testada (não
 * reinventada aqui) — essa função só fala com o Mercado Pago.
 */
export async function estornarPagamentoOnline(
  empresaId: string,
  pedidoId: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const accessToken = await obterAccessTokenValido(empresaId);
  if (!accessToken) return { ok: false, erro: "Essa loja não está conectada ao Mercado Pago." };

  const supabase = createServiceClient();
  const { data: pedido } = await supabase
    .from("pedidos")
    .select("metadata, gateway_pagamento, status_pagamento")
    .eq("id", pedidoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  const metadata = (pedido?.metadata ?? {}) as Record<string, unknown>;
  const paymentId = metadata.mercadoPagoPaymentId as string | undefined;
  if (!pedido || pedido.gateway_pagamento !== "mercado_pago" || pedido.status_pagamento !== "pago" || !paymentId) {
    return { ok: false, erro: "Esse pedido não tem um pagamento online confirmado pra estornar." };
  }

  const resposta = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resposta.ok) {
    const erroResposta = await resposta.json().catch(() => null);
    console.error("Erro ao estornar pagamento no Mercado Pago:", erroResposta);
    return { ok: false, erro: "O Mercado Pago recusou o estorno. Tente de novo ou estorne manualmente pelo painel deles." };
  }

  const estorno = (await resposta.json()) as { id: number };
  await supabase
    .from("pedidos")
    .update({ metadata: { ...metadata, mercadoPagoRefundId: estorno.id, estornadoEm: new Date().toISOString() } })
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
