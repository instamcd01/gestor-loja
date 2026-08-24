import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { horarioFechamentoNoDia } from "@/lib/agendamento";
import { AutoAtualizarPedido } from "@/components/pedido/auto-atualizar-pedido";
import { MudarFormaPagamentoButton } from "@/components/pedido/mudar-forma-pagamento-button";
import { PixPagamento } from "@/components/pedido/pix-pagamento";
import { ResumoTotais } from "@/components/carrinho/resumo-totais";
import { ButtonLink } from "@/components/ui/button";
import { getEmpresaPorSlug } from "@/lib/catalogo";
import { getExtratoPetCash } from "@/lib/cliente";
import { gerarPixCopiaECola } from "@/lib/pix";
import { createClient } from "@/lib/supabase/server";
import type { EmpresaCatalogo } from "@/lib/types";
import { formatarHora, formatarPreco } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  return { title: empresa ? `Pedido — ${empresa.nome}` : "Pedido" };
}

/**
 * "sexta-feira, 14 de agosto às 21:00" — mesmo formato usado na tela de
 * escolha de entrega (ver formatarDataPrevista em agendamento.ts), com
 * hora junto, pra previsão de entrega econômica (que pode ser dias no
 * futuro, diferente da hora-hora usada pros outros métodos). Usa o
 * horário de FECHAMENTO da loja nesse dia (`horarioFechamentoNoDia`,
 * mesma função usada na tela de escolha), não a hora crua de
 * `previsao_entrega_fim` — esse timestamp guarda a mesma hora-do-dia em
 * que o pedido foi feito (ex: 18:37), não o fechamento, e mostrar isso
 * aqui destoaria do que a tela de escolha já prometeu antes de confirmar.
 */
function formatarDataHoraPrevista(iso: string, horarioFuncionamento: EmpresaCatalogo["horario_funcionamento"]): string {
  const data = new Date(iso);
  const dataFormatada = data.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo",
  });
  const fechamento = horarioFechamentoNoDia(data, horarioFuncionamento) ?? formatarHora(iso);
  return `${dataFormatada} às ${fechamento}`;
}

const STATUS_LABEL: Record<string, string> = {
  aguardando_pagamento: "Aguardando confirmação do pagamento",
  pendente: "Aguardando confirmação da loja",
  preparando: "Em preparo",
  saiu_para_entrega: "Saiu para entrega",
  entregue: "Entregue",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export default async function PedidoPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/loja/${slug}/entrar`);

  const { data: pedido } = await supabase
    .from("pedidos")
    .select(
      "id, numero_sequencial, status, tipo_pagamento, status_pagamento, gateway_pagamento, valor_produtos, valor_entrega, desconto, valor_total, observacoes, created_at, metadata, previsao_entrega_inicio, previsao_entrega_fim",
    )
    .eq("id", id)
    .eq("empresa_id", empresa.id)
    .maybeSingle();

  if (!pedido) notFound();

  const metadata = (pedido.metadata ?? {}) as {
    saldoAplicado?: number;
    petcashAplicado?: number;
    trocoPara?: number;
    entregaSelecionada?: string;
    modalidadeEntrega?: "expressa" | "economica";
    mercadoPagoPixQrCode?: string;
    mercadoPagoPixQrCodeBase64?: string;
  };
  // Só mostra a prévia enquanto o crédito ainda não existe de verdade
  // (concedido só quando o pedido é marcado como entregue, ver
  // gerar_petcash_pedido) — depois disso vira duplicidade confusa.
  const petcashPrevisto =
    empresa.petcash_ativo && empresa.petcash_percentual && pedido.status !== "entregue" && pedido.status !== "cancelado"
      ? Math.round((pedido.valor_produtos ?? 0) * empresa.petcash_percentual) / 100
      : 0;

  // Uma vez entregue, o crédito real já existe em `petcash_creditos` — a
  // tabela não tem policy nenhuma pra leitura direta (ver
  // gestor_loja_petcash_cashback na memória), então reaproveita a mesma RPC
  // já usada no extrato (`meu_extrato_petcash`) em vez de duplicar a regra
  // de segurança aqui. Casamento por `pedidoOrigemNumero`, não pedido.id,
  // porque é o que a RPC devolve.
  let petcashRecebido = 0;
  let petcashValidadeEm: string | null = null;
  if (pedido.status === "entregue") {
    const extrato = await getExtratoPetCash(empresa.id);
    const credito = extrato.find((c) => c.pedidoOrigemNumero === pedido.numero_sequencial);
    if (credito) {
      petcashRecebido = credito.valorTotal;
      petcashValidadeEm = credito.expiraEm;
    }
  }
  const troco =
    metadata.trocoPara != null ? metadata.trocoPara - (pedido.valor_total ?? 0) : null;
  // entregaSelecionada só existe em pedidos de entrega (ver finalizar_pedido_site) —
  // sem ela, é retirada, e valor_entrega=0 não deve aparecer como "frete grátis".
  const temEntrega = !!metadata.entregaSelecionada;

  const { data: itens } = await supabase
    .from("itens_pedido")
    .select("id, produto_id, quantidade, preco_unitario, subtotal")
    .eq("pedido_id", pedido.id);

  const produtoIds = (itens ?? []).map((i) => i.produto_id);
  const { data: produtos } =
    produtoIds.length > 0
      ? await supabase.from("catalogo_produtos_publico").select("id, nome").in("id", produtoIds)
      : { data: [] };
  const nomesPorId = new Map((produtos ?? []).map((p) => [p.id, p.nome]));

  // Pagamento online (Mercado Pago) ainda não confirmado — o Payment
  // Brick já cobrou (ou mostrou o QR do Pix), mas a confirmação de
  // verdade só chega depois, pelo webhook (ver mercadopago.ts). Estado
  // visual mais chamativo que o normal porque o cliente acabou de sair
  // de um fluxo de pagamento, diferente de "pendente" nos métodos na
  // entrega (onde pendente é só o estado default, sem nada de errado).
  const aguardandoPagamentoOnline = pedido.gateway_pagamento === "mercado_pago" && pedido.status_pagamento !== "pago";

  const mostrarPix =
    pedido.tipo_pagamento === "Pix" && pedido.status_pagamento !== "pago" && !!empresa.chave_pix;

  // Pix pago pelo Payment Brick do Mercado Pago — QR/copia-e-cola vêm
  // prontos da API do MP (ver `cobrarPagamentoOnline`), diferente do Pix
  // manual acima (chave estática, QR gerado aqui). Confirmação é
  // automática via webhook, não manual pelo lojista.
  const mostrarPixMercadoPago =
    pedido.gateway_pagamento === "mercado_pago" &&
    pedido.status_pagamento !== "pago" &&
    !!metadata.mercadoPagoPixQrCodeBase64;

  let qrCodeDataUrl: string | null = null;
  let copiaECola: string | null = null;
  if (mostrarPixMercadoPago) {
    qrCodeDataUrl = `data:image/png;base64,${metadata.mercadoPagoPixQrCodeBase64}`;
    copiaECola = metadata.mercadoPagoPixQrCode ?? null;
  } else if (mostrarPix) {
    copiaECola = gerarPixCopiaECola({
      chavePix: empresa.chave_pix!,
      nomeRecebedor: empresa.nome,
      cidade: empresa.cidade ?? "BRASIL",
      valor: pedido.valor_total ?? 0,
      txid: `PED${pedido.numero_sequencial}`,
    });
    qrCodeDataUrl = await QRCode.toDataURL(copiaECola, { margin: 1, width: 384 });
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 py-8">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Pedido #{pedido.numero_sequencial}</h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          {STATUS_LABEL[pedido.status] ?? pedido.status}
        </p>
        {aguardandoPagamentoOnline && (
          <>
            <p className="mt-2 text-sm font-medium text-[var(--color-warning)]">
              ⏳ Aguardando confirmação do pagamento — atualiza sozinho, sem precisar recarregar a página.
            </p>
            <AutoAtualizarPedido />
          </>
        )}
        {temEntrega &&
          pedido.status !== "cancelado" &&
          pedido.previsao_entrega_inicio &&
          pedido.previsao_entrega_fim &&
          (metadata.modalidadeEntrega === "economica" ? (
            // Econômica pode ser dias depois de hoje (previsao_entrega_inicio
            // fica em "agora", só previsao_entrega_fim avança) — mostrar as
            // duas como hora-hora ("14:32–17:00") fica enganoso quando na
            // real são dias de diferença. Mostra só a data+hora final, no
            // mesmo formato já usado na tela de escolha de entrega.
            <p className="mt-1 text-sm font-medium text-[var(--brand-primary)]">
              🕐 Previsão de entrega: até {formatarDataHoraPrevista(pedido.previsao_entrega_fim, empresa.horario_funcionamento)}
            </p>
          ) : (
            <p className="mt-1 text-sm font-medium text-[var(--brand-primary)]">
              🕐 Previsão de entrega: {formatarHora(pedido.previsao_entrega_inicio)}–
              {formatarHora(pedido.previsao_entrega_fim)}
            </p>
          ))}
      </div>

      <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-black/5 p-4 dark:border-white/10">
        {(itens ?? []).map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span>
              {item.quantidade}x {nomesPorId.get(item.produto_id) ?? "Produto"}
            </span>
            <span>{formatarPreco(item.subtotal ?? 0)}</span>
          </div>
        ))}

        <div className="mt-2 border-t border-black/10 pt-2 dark:border-white/10">
          <ResumoTotais
            subtotal={pedido.valor_produtos ?? 0}
            entregaLabel={temEntrega ? `Entrega (${metadata.entregaSelecionada})` : "Retirada na loja"}
            entregaValor={temEntrega ? (pedido.valor_entrega ?? 0) : null}
            descontoCupom={pedido.desconto ?? 0}
            saldoAplicado={metadata.saldoAplicado}
            petcashAplicado={metadata.petcashAplicado}
            petcashPrevisto={petcashPrevisto}
            petcashRecebido={petcashRecebido}
            petcashValidadeEm={petcashValidadeEm}
            total={pedido.valor_total ?? 0}
          />
        </div>

        <p className="mt-1 text-xs text-black/50 dark:text-white/50">
          Pagamento: {pedido.tipo_pagamento}
          {pedido.status_pagamento === "pago" ? " — pago" : ""}
        </p>
        {troco != null && troco > 0 && (
          <p className="text-xs text-black/50 dark:text-white/50">
            Pagará com {formatarPreco(metadata.trocoPara!)} — troco de {formatarPreco(troco)}
          </p>
        )}
      </div>

      {(mostrarPix || mostrarPixMercadoPago) && qrCodeDataUrl && copiaECola && (
        <PixPagamento
          qrCodeDataUrl={qrCodeDataUrl}
          copiaECola={copiaECola}
          mensagemRodape={
            mostrarPixMercadoPago
              ? "Escaneie o QR Code ou copie o código no app do seu banco. Assim que o pagamento cair, a página atualiza sozinha."
              : undefined
          }
        />
      )}

      {aguardandoPagamentoOnline && (
        <div className="mx-auto">
          <MudarFormaPagamentoButton slug={slug} pedidoId={pedido.id} />
        </div>
      )}

      <ButtonLink href={`/loja/${slug}`} variant="secondary" className="mx-auto w-fit">
        Voltar ao catálogo
      </ButtonLink>
    </div>
  );
}
