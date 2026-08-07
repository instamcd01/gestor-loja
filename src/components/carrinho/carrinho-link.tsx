"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getContagemCarrinho } from "@/lib/carrinho";
import { assinarCarrinhoAtualizado } from "@/lib/carrinho-eventos";
import { lerCarrinhoConvidado } from "@/lib/carrinho-convidado";
import { createClient } from "@/lib/supabase/client";

/**
 * Client component pelo mesmo motivo do AccountLink (layout ISR, ver
 * comentário lá). Mostra quantos itens tem no carrinho — sem isso, depois
 * que a gaveta de confirmação fecha, não sobra nenhum lembrete visual do
 * que já foi adicionado até a pessoa entrar na página do carrinho (foi
 * uma causa real da confusão "não consigo adicionar outros produtos").
 */
export function CarrinhoLink({ slug, empresaId }: { slug: string; empresaId: string }) {
  const [logado, setLogado] = useState<boolean | null>(null);
  const [contagem, setContagem] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setLogado(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLogado(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function atualizar() {
      if (logado === null) return;
      const total = logado
        ? await getContagemCarrinho(empresaId)
        : lerCarrinhoConvidado(empresaId).reduce((soma, item) => soma + item.quantidade, 0);
      if (!cancelado) setContagem(total);
    }

    atualizar();
    const cancelarAssinatura = assinarCarrinhoAtualizado(atualizar);
    return () => {
      cancelado = true;
      cancelarAssinatura();
    };
  }, [empresaId, logado]);

  return (
    <Link
      href={`/loja/${slug}/carrinho`}
      aria-label="Carrinho"
      title="Carrinho"
      className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M3 4h2l1 3m0 0 2.2 8.4a2 2 0 0 0 1.94 1.6h7.32a2 2 0 0 0 1.94-1.52L21 8H6" />
        <circle cx="9.5" cy="20" r="1.4" />
        <circle cx="17.5" cy="20" r="1.4" />
      </svg>
      {contagem > 0 && (
        <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand-primary)] px-1 text-[10px] font-semibold text-white">
          {contagem}
        </span>
      )}
    </Link>
  );
}
