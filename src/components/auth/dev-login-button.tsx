"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * SÓ existe em `npm run dev` (NODE_ENV inlined em build time — em
 * `next build`/`next start` esse componente inteiro é eliminado do
 * bundle). Loga como o "Cliente de Teste" fixo (telefone
 * 5521999990000, criado via SQL/pgcrypto) via signInWithPassword,
 * contornando o envio real de WhatsApp — só pra testar carrinho/
 * checkout/entrega sem esperar a verificação de negócio da Meta.
 */
export function DevLoginButton({ slug }: { slug: string }) {
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
    setCarregando(false);

    if (error) {
      setErro(error.message);
      return;
    }
    router.push(`/loja/${slug}/conta`);
    router.refresh();
  }

  return (
    <div className="mt-4 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 p-3">
      <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">
        Só aparece em desenvolvimento — atalho pra testar sem WhatsApp.
      </p>
      <button
        type="button"
        onClick={entrar}
        disabled={carregando}
        className="text-sm font-medium text-amber-700 underline dark:text-amber-400"
      >
        {carregando ? "Entrando..." : "Entrar como cliente de teste"}
      </button>
      {erro && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{erro}</p>}
    </div>
  );
}
