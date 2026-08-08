"use client";

import { useEffect, useState } from "react";
import { ProdutoImagem } from "@/components/produto-imagem";
import { buscarProdutosParaFreteGratis } from "@/lib/produtos-sugeridos";
import type { ProdutoCatalogo } from "@/lib/types";
import { formatarPreco } from "@/lib/utils";

/**
 * Carrossel horizontal (desliza pro lado) em vez de um produto único fixo —
 * dá mais opções pro cliente escolher o que combina, em vez de aceitar ou
 * ignorar uma sugestão só. Prioriza produtos das mesmas categorias já no
 * carrinho (ver buscarProdutosParaFreteGratis). Cada tela do carrinho passa
 * sua PRÓPRIA função de adicionar (`onAdicionar`) — não usa o hook de
 * adicionar-rápido do catálogo de propósito, porque esse hook devolve o
 * carrinho pra uma gaveta separada em vez de atualizar a lista que já está
 * na tela (mesma classe de bug de "duas fontes de verdade" já corrigida
 * nesta sessão, ver memória do projeto).
 */
export function SugestaoCompletaFrete({
  empresaId,
  falta,
  categorias,
  idsNoCarrinho,
  onAdicionar,
}: {
  empresaId: string;
  falta: number;
  categorias: string[];
  idsNoCarrinho: string[];
  onAdicionar: (produto: ProdutoCatalogo) => void | Promise<void>;
}) {
  const [produtos, setProdutos] = useState<ProdutoCatalogo[] | null>(null);
  const [adicionandoId, setAdicionandoId] = useState<string | null>(null);
  const [adicionadosIds, setAdicionadosIds] = useState<Set<string>>(new Set());

  // Arredonda a faixa (múltiplos de R$5) antes de refazer a busca — sem
  // isso, cada centavo que o "falta" muda (ex: cliente mexeu na
  // quantidade de outro item) disparava uma busca nova.
  const faixaFalta = Math.ceil(falta / 5) * 5;
  const chaveCategorias = categorias.join(",");
  const chaveExcluir = idsNoCarrinho.join(",");

  useEffect(() => {
    let cancelado = false;
    buscarProdutosParaFreteGratis(empresaId, faixaFalta, categorias, idsNoCarrinho).then((encontrados) => {
      if (!cancelado) setProdutos(encontrados);
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, faixaFalta, chaveCategorias, chaveExcluir]);

  // Não reseta `adicionadosIds` de propósito: uma vez aceita, uma sugestão
  // não volta a aparecer só porque o valor que falta mudou de novo.
  const visiveis = (produtos ?? []).filter((produto) => !adicionadosIds.has(produto.id));
  if (visiveis.length === 0) return null;

  async function adicionar(produto: ProdutoCatalogo) {
    setAdicionandoId(produto.id);
    await onAdicionar(produto);
    setAdicionandoId(null);
    setAdicionadosIds((atual) => new Set(atual).add(produto.id));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-black/60 dark:text-white/60">Complete e ganhe frete grátis</p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visiveis.map((produto) => {
          const preco = produto.preco_promocional ?? produto.preco;
          return (
            <div
              key={produto.id}
              className="flex w-28 shrink-0 flex-col gap-1.5 rounded-[var(--radius-md)] border border-dashed border-[var(--brand-primary)]/40 bg-[var(--brand-primary)]/5 p-2"
            >
              <div className="relative h-16 w-full overflow-hidden rounded-[var(--radius-sm)] bg-black/5 dark:bg-white/5">
                <ProdutoImagem
                  src={produto.imagem_url}
                  alt={produto.nome}
                  categoria={produto.categoria}
                  className="object-cover"
                />
              </div>
              <p className="line-clamp-2 text-[11px] leading-tight font-medium">{produto.nome}</p>
              <p className="text-[11px] font-semibold">{formatarPreco(preco)}</p>
              <button
                type="button"
                onClick={() => adicionar(produto)}
                disabled={adicionandoId === produto.id}
                className="rounded-full bg-[var(--brand-primary)] px-2 py-1 text-[11px] font-medium text-white disabled:opacity-60"
              >
                {adicionandoId === produto.id ? "..." : "Adicionar"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
