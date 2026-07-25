import { notFound, redirect } from "next/navigation";
import { DevLoginButton } from "@/components/auth/dev-login-button";
import { LoginForm } from "@/components/auth/login-form";
import { getEmpresaPorSlug } from "@/lib/catalogo";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EntrarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { slug } = await params;
  const { redirect: destino } = await searchParams;
  const rotaPosLogin = destino === "carrinho" ? "carrinho" : "conta";

  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(`/loja/${slug}/${rotaPosLogin}`);

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-10">
      <div>
        <h1 className="text-xl font-semibold">Entrar</h1>
        <p className="text-sm text-black/50 dark:text-white/50">{empresa.nome}</p>
      </div>
      <LoginForm empresaId={empresa.id} slug={slug} rotaPosLogin={rotaPosLogin} />
      <DevLoginButton slug={slug} empresaId={empresa.id} rotaPosLogin={rotaPosLogin} />
    </div>
  );
}
