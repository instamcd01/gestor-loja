import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PosLoginCliente } from "@/components/auth/pos-login-cliente";
import { Card } from "@/components/ui/card";
import { getEmpresaPorSlug } from "@/lib/catalogo";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  return { title: empresa ? `Entrando — ${empresa.nome}` : "Entrando" };
}

/** Destino do `redirectTo` do `signInWithOAuth` (login com Google, ver
 * "Entrar com Google" em `login-form.tsx`). Diferente de telefone/email,
 * OAuth é um redirect de página inteira — quando o navegador chega aqui, o
 * middleware (`updateSession`) já rodou e a sessão do Google já está
 * disponível via cookie, então dá pra decidir aqui no servidor se falta
 * completar o cadastro (mesma RPC `entrar_ou_criar_cliente` que
 * telefone/email usam) antes de precisar de qualquer JS no cliente. */
export default async function PosLoginPage({
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
  // Sem sessão aqui significa que o OAuth não completou (cancelado, erro) —
  // volta pro login em vez de mostrar uma tela de "completar cadastro" pra
  // ninguém.
  if (!user) redirect(`/loja/${slug}/entrar`);

  const { data: clienteId, error } = await supabase.rpc("entrar_ou_criar_cliente", {
    p_empresa_id: empresa.id,
    p_nome: null,
    p_aceita_lembrete_whatsapp: null,
  });

  let precisaCompletarCadastro = true;
  if (!error && clienteId) {
    const { data: cliente } = await supabase
      .from("clientes")
      .select("termos_aceitos_em")
      .eq("id", clienteId as string)
      .maybeSingle();
    precisaCompletarCadastro = !cliente?.termos_aceitos_em;
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold">{precisaCompletarCadastro ? "Complete seu cadastro" : "Entrar"}</h1>
        <p className="text-sm text-black/50 dark:text-white/50">{empresa.nome}</p>
      </div>
      <Card className="p-6">
        <PosLoginCliente
          empresaId={empresa.id}
          slug={slug}
          rotaPosLogin={rotaPosLogin}
          precisaCompletarCadastro={precisaCompletarCadastro}
        />
      </Card>
    </div>
  );
}
