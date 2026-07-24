import { notFound, redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { getEmpresaPorSlug } from "@/lib/catalogo";
import { createClient } from "@/lib/supabase/server";
import { formatarPreco } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
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
      "id, numero_sequencial, status, tipo_pagamento, status_pagamento, valor_produtos, valor_entrega, valor_total, observacoes, created_at",
    )
    .eq("id", id)
    .eq("empresa_id", empresa.id)
    .maybeSingle();

  if (!pedido) notFound();

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

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 py-8">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Pedido #{pedido.numero_sequencial}</h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          {STATUS_LABEL[pedido.status] ?? pedido.status}
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-black/5 p-4 dark:border-white/10">
        {(itens ?? []).map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span>
              {item.quantidade}x {nomesPorId.get(item.produto_id) ?? "Produto"}
            </span>
            <span>{formatarPreco(item.subtotal ?? 0)}</span>
          </div>
        ))}

        <div className="mt-2 flex justify-between border-t border-black/10 pt-2 text-sm font-semibold dark:border-white/10">
          <span>Total</span>
          <span>{formatarPreco(pedido.valor_total ?? 0)}</span>
        </div>

        <p className="mt-1 text-xs text-black/50 dark:text-white/50">
          Pagamento: {pedido.tipo_pagamento} — na retirada
        </p>
      </div>

      <ButtonLink href={`/loja/${slug}`} variant="secondary" className="mx-auto w-fit">
        Voltar ao catálogo
      </ButtonLink>
    </div>
  );
}
