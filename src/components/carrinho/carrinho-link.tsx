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
    <Link href={`/loja/${slug}/carrinho`} className="flex items-center gap-1.5 text-sm font-medium hover:underline">
      Carrinho
      {contagem > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand-primary)] px-1 text-xs font-semibold text-white">
          {contagem}
        </span>
      )}
    </Link>
  );
}
