"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CompletarCadastroForm } from "@/components/auth/completar-cadastro-form";
import { concluirLoginEIrPara } from "@/lib/pos-login";

/** Metade client de `pos-login/page.tsx` — o Server Component já decidiu
 * se falta completar o cadastro (RPC roda lá, com a sessão que o Google já
 * deixou pronta via cookie). Aqui só o que exige navegador de verdade:
 * `CompletarCadastroForm` (se faltar) e o merge do carrinho de convidado +
 * navegação final (sempre, local-only via localStorage). */
export function PosLoginCliente({
  empresaId,
  slug,
  rotaPosLogin,
  precisaCompletarCadastro,
}: {
  empresaId: string;
  slug: string;
  rotaPosLogin: string;
  precisaCompletarCadastro: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!precisaCompletarCadastro) {
      concluirLoginEIrPara(router, { slug, empresaId, rotaPosLogin });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precisaCompletarCadastro]);

  if (precisaCompletarCadastro) {
    return (
      <CompletarCadastroForm
        empresaId={empresaId}
        slug={slug}
        pedirEmailSenha={false}
        onCompleto={() => concluirLoginEIrPara(router, { slug, empresaId, rotaPosLogin })}
      />
    );
  }

  return <p className="text-center text-sm text-black/60 dark:text-white/60">Entrando...</p>;
}
