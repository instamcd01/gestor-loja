import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { getEmpresaPorSlug } from "@/lib/catalogo";
import { createClient } from "@/lib/supabase/server";
import { formatarData, formatarPreco } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  return { title: empresa ? `Meus pedidos — ${empresa.nome}` : "Meus pedidos" };
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

export default async function PedidosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/loja/${slug}/entrar`);

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id")
    .eq("empresa_id", empresa.id)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // Autenticado sem linha em `clientes` = cadastro pendente (ver
  // conta/page.tsx pro caso real que motivou essa checagem) — sem isso,
  // mostraria "você ainda não fez nenhum pedido" pra quem na verdade nunca
  // completou o cadastro, dando a entender que é só esperar em vez de agir.
  if (!cliente) redirect(`/loja/${slug}/pos-login`);

  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("id, numero_sequencial, status, valor_total, created_at")
    .eq("empresa_id", empresa.id)
    .eq("cliente_id", cliente.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 py-8">
      <h1 className="text-xl font-semibold">Meus pedidos</h1>

      {!pedidos || pedidos.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-black/50 dark:text-white/50">Você ainda não fez nenhum pedido.</p>
          <ButtonLink href={`/loja/${slug}`}>Ver catálogo</ButtonLink>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {pedidos.map((pedido) => (
            <Link
              key={pedido.id}
              href={`/loja/${slug}/pedido/${pedido.id}`}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-black/5 p-4 shadow-[var(--shadow-card)] transition-colors hover:border-[var(--brand-primary)]/40 dark:border-white/10"
            >
              <div className="min-w-0">
                <p className="font-medium">Pedido #{pedido.numero_sequencial}</p>
                <p className="text-xs text-black/50 dark:text-white/50">
                  {formatarData(pedido.created_at)} · {STATUS_LABEL[pedido.status] ?? pedido.status}
                </p>
              </div>
              <span className="shrink-0 font-semibold">{formatarPreco(pedido.valor_total ?? 0)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
