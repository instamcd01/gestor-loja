import { notFound, redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { getEmpresaPorSlug } from "@/lib/catalogo";
import { createClient } from "@/lib/supabase/server";

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
    .select("nome, telefone")
    .eq("empresa_id", empresa.id)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-10">
      <h1 className="text-xl font-semibold">Minha conta</h1>

      <div className="rounded-2xl border border-black/5 p-4 dark:border-white/10">
        <p className="text-sm text-black/50 dark:text-white/50">Nome</p>
        <p className="mb-3 font-medium">{cliente?.nome ?? "—"}</p>
        <p className="text-sm text-black/50 dark:text-white/50">Telefone</p>
        <p className="font-medium">{cliente?.telefone ?? user.phone}</p>
      </div>

      {/* TODO: pedidos do cliente (depende do carrinho/checkout, próximo passo) */}

      <LogoutButton slug={slug} />
    </div>
  );
}
