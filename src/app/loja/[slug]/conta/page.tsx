import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { getEmpresaPorSlug } from "@/lib/catalogo";
import { createClient } from "@/lib/supabase/server";
import { formatarPreco } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ContaPage({
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

  // RLS (clientes_cliente_le_proprio) já garante que só a própria linha volta.
  const { data: cliente } = await supabase
    .from("clientes")
    .select("nome, telefone, saldo_petcash")
    .eq("empresa_id", empresa.id)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-10">
      <h1 className="text-xl font-semibold">Minha conta</h1>

      <div className="rounded-[var(--radius-lg)] border border-black/5 p-4 dark:border-white/10">
        <p className="text-sm text-black/50 dark:text-white/50">Nome</p>
        <p className="mb-3 font-medium">{cliente?.nome ?? "—"}</p>
        <p className="text-sm text-black/50 dark:text-white/50">Telefone</p>
        <p className="font-medium">{cliente?.telefone ?? user.phone}</p>
      </div>

      {!!cliente?.saldo_petcash && cliente.saldo_petcash > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--brand-primary)]/40 bg-[var(--brand-primary)]/5 p-4">
          <p className="text-sm text-black/50 dark:text-white/50">🐾 Seu PetCash</p>
          <p className="text-2xl font-semibold text-[var(--brand-primary)]">
            {formatarPreco(cliente.saldo_petcash)}
          </p>
          <p className="mt-0.5 text-xs text-black/50 dark:text-white/50">Use no seu próximo pedido pelo site</p>
        </div>
      )}

      <Link
        href={`/loja/${slug}/pedidos`}
        className="rounded-[var(--radius-lg)] border border-black/5 p-4 text-sm font-medium hover:border-[var(--brand-primary)]/40 dark:border-white/10"
      >
        Meus pedidos
      </Link>

      <LogoutButton slug={slug} />
    </div>
  );
}
