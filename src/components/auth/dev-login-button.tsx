"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mesclarCarrinhoConvidado } from "@/lib/carrinho";
import { lerCarrinhoConvidado, limparCarrinhoConvidado } from "@/lib/carrinho-convidado";
import { createClient } from "@/lib/supabase/client";

/**
 * SÓ existe em `npm run dev` (NODE_ENV inlined em build time — em
 * `next build`/`next start` esse componente inteiro é eliminado do
 * bundle). Loga como o "Cliente de Teste" fixo (telefone
 * 5521999990000, criado via SQL/pgcrypto) via signInWithPassword,
 * contornando o envio real de WhatsApp — só pra testar carrinho/
 * checkout/entrega sem esperar a verificação de negócio da Meta.
 */
export function DevLoginButton({
  slug,
  empresaId,
  rotaPosLogin = "conta",
}: {
  slug: string;
  empresaId: string;
  rotaPosLogin?: string;
}) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (process.env.NODE_ENV !== "development") return null;

  async function entrar() {
    setCarregando(true);
    setErro(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      phone: "+5521999990000",
      password: "teste123456",
    });

    if (error) {
      setCarregando(false);
      setErro(error.message);
      return;
    }

    const itensConvidado = lerCarrinhoConvidado(empresaId);
    if (itensConvidado.length > 0) {
      await mesclarCarrinhoConvidado(
        slug,
        empresaId,
        itensConvidado.map((item) => ({ produtoId: item.produtoId, quantidade: item.quantidade })),
      );
      limparCarrinhoConvidado(empresaId);
    }

    setCarregando(false);
    router.push(`/loja/${slug}/${rotaPosLogin}`);
    router.refresh();
  }

  return (
    <div className="mt-4 rounded-[var(--radius-sm)] border border-dashed border-[var(--color-warning)]/50 bg-[var(--color-warning)]/5 p-3">
      <p className="mb-2 text-xs text-[var(--color-warning)]">
        Só aparece em desenvolvimento — atalho pra testar sem WhatsApp.
      </p>
      <button
        type="button"
        onClick={entrar}
        disabled={carregando}
        className="text-sm font-medium text-[var(--color-warning)] underline"
      >
        {carregando ? "Entrando..." : "Entrar como cliente de teste"}
      </button>
      {erro && <p className="mt-1 text-xs text-[var(--color-danger)]">{erro}</p>}
    </div>
  );
}
