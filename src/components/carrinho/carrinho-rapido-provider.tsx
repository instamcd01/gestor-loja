"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import { CarrinhoMiniBarra } from "@/components/carrinho/carrinho-mini-barra";
import { MiniCarrinhoDrawer } from "@/components/carrinho/mini-carrinho-drawer";
import { useCarrinhoRapido } from "@/lib/use-carrinho-rapido";

type CarrinhoRapidoContextValue = ReturnType<typeof useCarrinhoRapido>;

const CarrinhoRapidoContext = createContext<CarrinhoRapidoContextValue | null>(
  null,
);

/**
 * Estado da gaveta/barra de "adicionado ao carrinho" resolvido UMA VEZ pra
 * página inteira (mesmo motivo do SessaoProvider/FavoritosProvider) — antes
 * cada ProdutoCard/AdicionarCarrinhoButton chamava useCarrinhoRapido() por
 * conta própria, um estado independente por instância. Isso "funcionava"
 * por acidente enquanto só existia aberto/fechado (só uma gaveta por vez
 * era visualmente relevante), mas quebra de vez com o modo minimizado: a
 * barrinha minimizada de um card ficaria presa ali, sem saber que outro
 * card acabou de abrir uma gaveta cheia por cima. Centralizado aqui, só
 * esta instância existe por página, e a gaveta/barra é renderizada UMA VEZ,
 * fora de qualquer card específico — por isso os componentes que consomem
 * o contexto (ProdutoCard, AdicionarCarrinhoButton) não renderizam mais o
 * próprio MiniCarrinhoDrawer, só chamam `adicionar`.
 */
export function CarrinhoRapidoProvider({
  slug,
  empresaId,
  enderecoEmpresa,
  children,
}: {
  slug: string;
  empresaId: string;
  enderecoEmpresa: {
    endereco: string | null;
    cidade: string | null;
    estado: string | null;
    cep: string | null;
  };
  children: ReactNode;
}) {
  const carrinhoRapido = useCarrinhoRapido(slug, empresaId);
  // Nunca aparece nas próprias páginas de carrinho/checkout — o cliente já
  // está vendo o carrinho ali, uma gaveta ou barra por cima seria
  // redundante (e, no caso da gaveta cheia, esconderia a página de baixo
  // por completo). Verificado aqui, não só dentro de cada peça, porque
  // controla as duas: gaveta cheia E barra minimizada.
  const pathname = usePathname();
  const naTelaDeCarrinho = pathname?.includes("/carrinho") ?? false;

  return (
    <CarrinhoRapidoContext.Provider value={carrinhoRapido}>
      {children}

      {!naTelaDeCarrinho &&
        carrinhoRapido.drawer &&
        (carrinhoRapido.minimizado ? (
          <CarrinhoMiniBarra
            quantidadeItens={carrinhoRapido.drawer.itens.length}
            onExpandir={carrinhoRapido.expandirDrawer}
          />
        ) : (
          <MiniCarrinhoDrawer
            slug={slug}
            empresaId={empresaId}
            enderecoEmpresa={enderecoEmpresa}
            itens={carrinhoRapido.drawer.itens}
            valorTotal={carrinhoRapido.drawer.valorTotal}
            idRecemAdicionado={carrinhoRapido.drawer.idRecemAdicionado}
            onAlterarQuantidade={carrinhoRapido.alterarQuantidade}
            onAntesDeNavegar={carrinhoRapido.flushTudo}
            onFechar={carrinhoRapido.minimizarDrawer}
          />
        ))}
    </CarrinhoRapidoContext.Provider>
  );
}

export function useCarrinhoRapidoContext() {
  const contexto = useContext(CarrinhoRapidoContext);
  if (!contexto) {
    throw new Error(
      "useCarrinhoRapidoContext precisa estar dentro de um CarrinhoRapidoProvider",
    );
  }
  return contexto;
}
