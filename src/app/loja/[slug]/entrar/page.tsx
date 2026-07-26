import { notFound, redirect } from "next/navigation";
import { DevLoginButton } from "@/components/auth/dev-login-button";
import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";
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
    <div className="mx-auto grid max-w-4xl gap-8 py-10 md:grid-cols-2 md:items-center">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Entrar</h1>
          <p className="text-sm text-black/50 dark:text-white/50">{empresa.nome}</p>
        </div>
        <Card className="p-6">
          <LoginForm empresaId={empresa.id} slug={slug} rotaPosLogin={rotaPosLogin} />
        </Card>
        <DevLoginButton slug={slug} empresaId={empresa.id} rotaPosLogin={rotaPosLogin} />
      </div>

      <div className="relative hidden overflow-hidden rounded-[var(--radius-xl)] bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-secondary)] p-8 text-white md:flex md:flex-col md:justify-center md:gap-5">
        <div className="pointer-events-none absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-black/10 blur-3xl" />
        <h2 className="relative text-xl font-bold">Sua conta na {empresa.nome}</h2>
        <ul className="relative flex flex-col gap-3 text-sm text-white/90">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
            Acompanhe seus pedidos do início ao fim
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
            Endereço salvo, sem digitar tudo de novo
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
            Use seu saldo direto na próxima compra
          </li>
        </ul>
      </div>
    </div>
  );
}
