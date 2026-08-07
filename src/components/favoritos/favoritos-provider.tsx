"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getFavoritosIds, toggleFavorito } from "@/lib/favoritos";

interface FavoritosContextValue {
  ids: Set<string>;
  alternar: (produtoId: string) => void;
}

const FavoritosContext = createContext<FavoritosContextValue | null>(null);

/**
 * Estado de favoritos resolvido no browser, não no servidor — mesmo motivo
 * do AccountLink/CarrinhoLink (ver comentário lá): páginas como a de
 * produto são ISR (revalidate=60), e ler a sessão ali pra saber o que o
 * cliente favoritou forçaria a rota inteira a virar dinâmica, perdendo o
 * cache pra todo mundo. Um único fetch aqui, compartilhado via contexto
 * por todos os corações da página, também evita N requisições
 * independentes (uma por card) que N botões cada um resolvendo sozinho
 * geraria numa grade de produtos.
 */
export function FavoritosProvider({
  slug,
  empresaId,
  children,
}: {
  slug: string;
  empresaId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelado = false;
    getFavoritosIds(empresaId).then((lista) => {
      if (!cancelado) setIds(new Set(lista));
    });
    return () => {
      cancelado = true;
    };
  }, [empresaId]);

  const alternar = useCallback(
    (produtoId: string) => {
      const eraFavorito = ids.has(produtoId);
      setIds((atual) => {
        const proximo = new Set(atual);
        if (eraFavorito) proximo.delete(produtoId);
        else proximo.add(produtoId);
        return proximo;
      });

      toggleFavorito(empresaId, produtoId).then((resultado) => {
        if (!resultado.ok) {
          // Reverte pro estado de antes do clique — inclui o caso
          // "not_logged", onde o toggle nem chegou a rodar no servidor.
          setIds((atual) => {
            const proximo = new Set(atual);
            if (eraFavorito) proximo.add(produtoId);
            else proximo.delete(produtoId);
            return proximo;
          });
          if (resultado.erro === "not_logged") {
            router.push(`/loja/${slug}/entrar`);
          }
        }
      });
    },
    [ids, empresaId, slug, router],
  );

  return <FavoritosContext.Provider value={{ ids, alternar }}>{children}</FavoritosContext.Provider>;
}

export function useFavoritos(): FavoritosContextValue {
  const contexto = useContext(FavoritosContext);
  if (!contexto) {
    throw new Error("useFavoritos precisa estar dentro de um FavoritosProvider");
  }
  return contexto;
}
