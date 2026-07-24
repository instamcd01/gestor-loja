import { notFound, redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getEmpresaPorSlug } from "@/lib/catalogo";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EntrarPage({
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
  if (user) redirect(`/loja/${slug}/conta`);

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-10">
      <div>
        <h1 className="text-xl font-semibold">Entrar</h1>
        <p className="text-sm text-black/50 dark:text-white/50">{empresa.nome}</p>
      </div>
      <LoginForm empresaId={empresa.id} slug={slug} />
    </div>
  );
}
