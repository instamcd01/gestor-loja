"use client";

import { useState } from "react";
import { IconeLixeira } from "@/components/icone-lixeira";
import { ProdutoImagem } from "@/components/produto-imagem";
import type { ItemCarrinho } from "@/lib/types";
import { formatarPreco, precoExibicao } from "@/lib/utils";

export function ItemCarrinhoRow({
  item,
  onAlterarQuantidade,
  usarPrecoAncoraMarketplace = false,
}: {
  item: ItemCarrinho;
  onAlterarQuantidade: (itemId: string, novaQuantidade: number) => void;
  usarPrecoAncoraMarketplace?: boolean;
}) {
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const exibicao = item.produto ? precoExibicao(item.produto, usarPrecoAncoraMarketplace) : null;

  return (
    <div className="flex gap-3 py-4">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-black/5 dark:bg-white/5">
        <ProdutoImagem
          src={item.produto?.imagem_url ?? null}
          alt={item.produto?.nome ?? "Produto"}
          categoria={item.produto?.categoria ?? null}
          className="object-cover"
        />
      </div>

      {/* Nome em cima, ocupando a largura toda (quebra em quantas linhas
          precisar) — quantidade e subtotal numa segunda linha embaixo, em
          vez de tudo numa única linha flex, que apertava/desalinhava a
          quantidade e o preço quando o nome do produto era grande. */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <p className="text-sm leading-snug font-medium">{item.produto?.nome ?? "Produto"}</p>
          <p className="flex items-baseline gap-1.5 text-xs text-black/50 dark:text-white/50">
            {formatarPreco(item.preco_unitario)} cada
            {exibicao?.temComparativo && (
              <span className="text-black/40 line-through dark:text-white/40">{formatarPreco(exibicao.precoDe)}</span>
            )}
          </p>
        </div>

        {confirmandoRemocao ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-black/60 dark:text-white/60">Remover item?</span>
            <button
              type="button"
              onClick={() => {
                setConfirmandoRemocao(false);
                onAlterarQuantidade(item.id, 0);
              }}
              className="rounded-full bg-[var(--color-danger)] px-2.5 py-1 font-medium text-white"
            >
              Sim
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoRemocao(false)}
              className="rounded-full border border-black/10 px-2.5 py-1 font-medium dark:border-white/10"
            >
              Não
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center rounded-full border border-black/10 dark:border-white/10">
              <button
                type="button"
                onClick={() =>
                  item.quantidade === 1
                    ? setConfirmandoRemocao(true)
                    : onAlterarQuantidade(item.id, item.quantidade - 1)
                }
                className="flex h-7 w-7 items-center justify-center text-lg leading-none"
                aria-label={item.quantidade === 1 ? "Remover item" : "Diminuir quantidade"}
              >
                {item.quantidade === 1 ? <IconeLixeira /> : "−"}
              </button>
              <span className="w-6 text-center text-sm">{item.quantidade}</span>
              <button
                type="button"
                onClick={() => onAlterarQuantidade(item.id, item.quantidade + 1)}
                disabled={item.quantidade >= (item.produto?.estoque_disponivel ?? item.quantidade)}
                className="flex h-7 w-7 items-center justify-center text-lg leading-none disabled:opacity-30"
                aria-label="Aumentar quantidade"
              >
                +
              </button>
            </div>

            <span className="text-sm font-semibold">{formatarPreco(item.subtotal)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
