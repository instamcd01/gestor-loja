import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RedefinirSenhaForm } from "@/components/auth/redefinir-senha-form";
import { Card } from "@/components/ui/card";
import { getEmpresaPorSlug } from "@/lib/catalogo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  return { title: empresa ? `Redefinir senha — ${empresa.nome}` : "Redefinir senha" };
}

/** Destino do link mandado por `supabase.auth.resetPasswordForEmail` (ver
 * "Esqueci minha senha" em `login-form.tsx`). O token de recuperação vem no
 * fragmento da URL (#access_token=...&type=recovery) — nunca chega ao
 * servidor, só o Supabase client no navegador consegue lê-lo e estabelecer
 * a sessão temporária de recuperação. Por isso esta página só monta o
 * layout; toda a lógica fica em `RedefinirSenhaForm` (Client Component). */
export default async function RedefinirSenhaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) notFound();

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Redefinir senha</h1>
        <p className="text-sm text-black/50 dark:text-white/50">{empresa.nome}</p>
      </div>
      <Card className="p-6">
        <RedefinirSenhaForm slug={slug} />
      </Card>
    </div>
  );
}
