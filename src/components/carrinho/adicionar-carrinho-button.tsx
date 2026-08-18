"use client";

import { useState } from "react";
import { useCarrinhoRapidoContext } from "@/components/carrinho/carrinho-rapido-provider";
import { Button } from "@/components/ui/button";

export function AdicionarCarrinhoButton({
  produtoId,
  mostrarEstoqueBaixo,
  produto,
}: {
  produtoId: string;
  /** Configurável em Configurações > Catálogo Online no app — desligado por padrão, revelar estoque baixo de cada item pode passar imagem de loja pequena. */
  mostrarEstoqueBaixo: boolean;
  produto: {
    nome: string;
    imagemUrl: string | null;
    categoria: string | null;
    preco: number;
    /** Preço de catálogo original quando `preco` já é o promocional — null = não está em promoção. */
    precoOriginal: number | null;
    estoqueDisponivel: number;
  };
}) {
  const [quantidade, setQuantidade] = useState(1);
  const { carregando, erro, logado, adicionar } = useCarrinhoRapidoContext();

  async function aoClicarAdicionar() {
    await adicionar(produtoId, quantidade, produto);
    setQuantidade(1);
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
            disabled={quantidade >= produto.estoqueDisponivel}
            onClick={() =>
              setQuantidade((q) => Math.min(produto.estoqueDisponivel, q + 1))
            }
            className="px-3 py-2 text-lg leading-none disabled:opacity-30"
            aria-label="Aumentar quantidade"
          >
            +
          </button>
        </div>

        <Button
          onClick={aoClicarAdicionar}
          disabled={
            carregando || logado === null || produto.estoqueDisponivel === 0
          }
          className="flex-1 py-3 text-base"
        >
          {produto.estoqueDisponivel === 0
            ? "Sem estoque"
            : carregando
              ? "Adicionando..."
              : "Adicionar ao carrinho"}
        </Button>
      </div>

      {mostrarEstoqueBaixo &&
        produto.estoqueDisponivel > 0 &&
        produto.estoqueDisponivel <= 5 && (
          <p className="text-xs text-black/50 dark:text-white/50">
            Só restam {produto.estoqueDisponivel} em estoque.
          </p>
        )}

      {erro && <p className="text-sm text-[var(--color-danger)]">{erro}</p>}
    </div>
  );
}
