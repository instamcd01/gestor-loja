import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PosLoginCliente } from "@/components/auth/pos-login-cliente";
import { Card } from "@/components/ui/card";
import { getEmpresaPorSlug } from "@/lib/catalogo";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioSeguro } from "@/lib/supabase/auth";

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

/** "Resolvedor" de pós-autenticação, com dois pontos de entrada:
 * 1. Destino do `redirectTo` do `signInWithOAuth` (login com Google, ver
 *    "Entrar com Google" em `login-form.tsx`) — diferente de telefone/
 *    email, OAuth é um redirect de página inteira, então não dá pra
 *    continuar no state do `LoginForm`; quando o navegador chega aqui, o
 *    middleware (`updateSession`) já rodou e a sessão já está disponível
 *    via cookie.
 * 2. Página de conta (`conta/page.tsx`) redireciona pra cá quando encontra
 *    um usuário autenticado sem nenhuma linha em `clientes` — achado ao
 *    vivo em 2026-08-23: alguém saiu da tela "Complete seu cadastro" (ex:
 *    clicando no ícone de conta no header) antes de enviar o formulário, e
 *    a página de conta simplesmente renderizava vazia em vez de cobrar o
 *    cadastro pendente.
 * Nos dois casos, a decisão é a mesma RPC `entrar_ou_criar_cliente` que
 * telefone/email já usam. */
export default async function PosLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { slug } = await params;
  const { redirect: destino } = await searchParams;
  // "" = tela principal (catálogo) — mesmo destino padrão de entrar/page.tsx.
  const rotaPosLogin = destino === "carrinho" ? "carrinho" : "";

  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) notFound();

  const supabase = await createClient();
  const user = await getUsuarioSeguro(supabase);
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
