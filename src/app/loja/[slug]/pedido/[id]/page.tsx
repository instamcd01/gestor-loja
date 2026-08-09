import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { AutoAtualizarPedido } from "@/components/pedido/auto-atualizar-pedido";
import { PixPagamento } from "@/components/pedido/pix-pagamento";
import { ResumoTotais } from "@/components/carrinho/resumo-totais";
import { ButtonLink } from "@/components/ui/button";
import { getEmpresaPorSlug } from "@/lib/catalogo";
import { gerarPixCopiaECola } from "@/lib/pix";
import { createClient } from "@/lib/supabase/server";
import { formatarHora, formatarPreco } from "@/lib/utils";

export const dynamic = "force-dynamic";

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
    trocoPara?: number;
    entregaSelecionada?: string;
  };
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

  let qrCodeDataUrl: string | null = null;
  let copiaECola: string | null = null;
  if (mostrarPix) {
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
          pedido.previsao_entrega_fim && (
            <p className="mt-1 text-sm font-medium text-[var(--brand-primary)]">
              🕐 Previsão de entrega: {formatarHora(pedido.previsao_entrega_inicio)}–
              {formatarHora(pedido.previsao_entrega_fim)}
            </p>
          )}
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

      {mostrarPix && qrCodeDataUrl && copiaECola && (
        <PixPagamento qrCodeDataUrl={qrCodeDataUrl} copiaECola={copiaECola} />
      )}

      <ButtonLink href={`/loja/${slug}`} variant="secondary" className="mx-auto w-fit">
        Voltar ao catálogo
      </ButtonLink>
    </div>
  );
}
