"use client";

import { useEffect, useState } from "react";
import { ProdutoImagem } from "@/components/produto-imagem";
import { buscarProdutosComplementares } from "@/lib/produtos-sugeridos";
import type { ProdutoCatalogo } from "@/lib/types";
import { formatarPreco } from "@/lib/utils";

const TAMANHO_PAGINA = 10;

/**
 * Carrossel horizontal de produtos COMPLEMENTARES ao carrinho (categorias
 * diferentes, nunca "mais do mesmo" — ver buscarProdutosComplementares),
 * pra aumentar o ticket ou ajudar a fechar a venda quando o frete é
 * objeção. Preço não entra na escolha (nem precisa ser perto do valor
 * faltante pro frete grátis). Card "Ver mais" no fim busca a próxima
 * leva em vez de carregar tudo de uma vez. Cada tela do carrinho passa
 * sua PRÓPRIA função de adicionar (`onAdicionar`) — não usa o hook de
 * adicionar-rápido do catálogo de propósito, porque esse hook devolve o
 * carrinho pra uma gaveta separada em vez de atualizar a lista que já está
 * na tela (mesma classe de bug de "duas fontes de verdade" já corrigida
 * nesta sessão, ver memória do projeto).
 */
export function SugestaoCompletaFrete({
  empresaId,
  categorias,
  idsNoCarrinho,
  onAdicionar,
}: {
  empresaId: string;
  categorias: string[];
  idsNoCarrinho: string[];
  onAdicionar: (produto: ProdutoCatalogo) => void | Promise<void>;
}) {
  const [produtos, setProdutos] = useState<ProdutoCatalogo[]>([]);
  const [temMais, setTemMais] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [adicionandoId, setAdicionandoId] = useState<string | null>(null);
  const [adicionadosIds, setAdicionadosIds] = useState<Set<string>>(new Set());

  const chaveCategorias = categorias.join(",");
  const chaveExcluir = idsNoCarrinho.join(",");

  useEffect(() => {
    let cancelado = false;
    buscarProdutosComplementares(empresaId, categorias, idsNoCarrinho, 0, TAMANHO_PAGINA).then((resultado) => {
      if (cancelado) return;
      setProdutos(resultado.produtos);
      setTemMais(resultado.temMais);
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, chaveCategorias, chaveExcluir]);

  async function carregarMais() {
    setCarregandoMais(true);
    const resultado = await buscarProdutosComplementares(
      empresaId,
      categorias,
      idsNoCarrinho,
      produtos.length,
      TAMANHO_PAGINA,
    );
    setProdutos((atual) => [...atual, ...resultado.produtos]);
    setTemMais(resultado.temMais);
    setCarregandoMais(false);
  }

  // Não reseta `adicionadosIds` de propósito: uma vez aceita, uma sugestão
  // não volta a aparecer só porque a lista mudou.
  const visiveis = produtos.filter((produto) => !adicionadosIds.has(produto.id));
  if (visiveis.length === 0) return null;

  async function adicionar(produto: ProdutoCatalogo) {
    setAdicionandoId(produto.id);
    await onAdicionar(produto);
    setAdicionandoId(null);
    setAdicionadosIds((atual) => new Set(atual).add(produto.id));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-black/60 dark:text-white/60">Combina com o que você já pediu</p>
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

        {temMais && (
          <button
            type="button"
            onClick={carregarMais}
            disabled={carregandoMais}
            className="flex w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border border-dashed border-black/15 text-xs font-medium text-black/60 disabled:opacity-60 dark:border-white/15 dark:text-white/60"
          >
            <span className="text-lg leading-none">→</span>
            {carregandoMais ? "..." : "Ver mais"}
          </button>
        )}
      </div>
    </div>
  );
}
