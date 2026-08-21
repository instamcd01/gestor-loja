import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getEmpresaPorSlug } from "@/lib/catalogo";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Destino do link mandado por `solicitar_confirmacao_email` (RPC) — cobre
 * o cliente que perdeu acesso ao celular e só consegue confirmar pelo
 * email. Confirma direto no servidor, sem precisar de sessão nem de JS no
 * cliente — ver [[gestor_loja_cadastro_unificado_auth]]. */
export default async function ConfirmarEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { slug } = await params;
  const { token } = await searchParams;
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) notFound();

  const supabase = await createClient();
  const { data: confirmado } = token
    ? await supabase.rpc("confirmar_email_por_token", { p_token: token })
    : { data: false };

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-6 py-16 text-center">
      <Card className="flex flex-col items-center gap-4 p-8">
        {confirmado ? (
          <>
            <p className="text-3xl">✅</p>
            <h1 className="text-xl font-semibold">Email confirmado!</h1>
            <p className="text-sm text-black/60 dark:text-white/60">
              Agora você já pode entrar com email e senha na {empresa.nome}, mesmo sem o celular por perto.
            </p>
          </>
        ) : (
          <>
            <p className="text-3xl">⚠️</p>
            <h1 className="text-xl font-semibold">Link inválido ou expirado</h1>
            <p className="text-sm text-black/60 dark:text-white/60">
              Esse link já foi usado, expirou (validade de 1 hora) ou não é válido. Tente entrar com email e senha
              de novo para receber um novo link.
            </p>
          </>
        )}
        <ButtonLink href={`/loja/${slug}/entrar`} className="mt-2 w-full">
          Ir para o login
        </ButtonLink>
      </Card>
    </div>
  );
}
