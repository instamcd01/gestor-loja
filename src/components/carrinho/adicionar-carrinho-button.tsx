"use client";

import { useEffect, useState } from "react";
import { MiniCarrinhoDrawer } from "@/components/carrinho/mini-carrinho-drawer";
import { Button } from "@/components/ui/button";
import { adicionarAoCarrinho } from "@/lib/carrinho";
import { adicionarItemConvidado } from "@/lib/carrinho-convidado";
import { createClient } from "@/lib/supabase/client";

export function AdicionarCarrinhoButton({
  slug,
  empresaId,
  produtoId,
  produto,
}: {
  slug: string;
  empresaId: string;
  produtoId: string;
  produto: { nome: string; imagemUrl: string | null; categoria: string | null; preco: number };
}) {
  const [quantidade, setQuantidade] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const [drawerAberto, setDrawerAberto] = useState(false);

  // Mesmo motivo do AccountLink: a página de produto é ISR compartilhada
  // entre visitantes, então o estado de login é resolvido no browser, não
  // no servidor — senão perderia o cache.
  const [logado, setLogado] = useState<boolean | null>(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setLogado(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLogado(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function adicionar() {
    setCarregando(true);
    setErro(false);

    // Sem login, o carrinho fica só no navegador — login só é pedido na
    // hora de finalizar o pedido (ver mesclarCarrinhoConvidado).
    if (!logado) {
      adicionarItemConvidado(empresaId, {
        produtoId,
        nome: produto.nome,
        imagemUrl: produto.imagemUrl,
        categoria: produto.categoria,
        preco: produto.preco,
        quantidade,
      });
      setCarregando(false);
      setDrawerAberto(true);
      return;
    }

    const resultado = await adicionarAoCarrinho(slug, empresaId, produtoId, quantidade);
    setCarregando(false);
    if (resultado.ok) {
      setDrawerAberto(true);
    } else {
      setErro(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-full border border-black/10 dark:border-white/10">
          <button
            type="button"
            onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
            className="px-3 py-2 text-lg leading-none"
            aria-label="Diminuir quantidade"
          >
            −
          </button>
          <span className="w-8 text-center text-sm">{quantidade}</span>
          <button
            type="button"
            onClick={() => setQuantidade((q) => q + 1)}
            className="px-3 py-2 text-lg leading-none"
            aria-label="Aumentar quantidade"
          >
            +
          </button>
        </div>

        <Button
          onClick={adicionar}
          disabled={carregando || logado === null}
          className="flex-1 py-3 text-base"
        >
          {carregando ? "Adicionando..." : "Adicionar ao carrinho"}
        </Button>
      </div>

      {erro && (
        <p className="text-sm text-red-600 dark:text-red-400">Não foi possível adicionar. Tente de novo.</p>
      )}

      {drawerAberto && (
        <MiniCarrinhoDrawer
          slug={slug}
          item={{ ...produto, quantidade }}
          onFechar={() => setDrawerAberto(false)}
        />
      )}
    </div>
  );
}
