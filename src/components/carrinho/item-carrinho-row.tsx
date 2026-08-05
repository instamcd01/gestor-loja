"use client";

import { ProdutoImagem } from "@/components/produto-imagem";
import type { ItemCarrinho } from "@/lib/types";
import { formatarPreco } from "@/lib/utils";

export function ItemCarrinhoRow({
  item,
  onAlterarQuantidade,
}: {
  item: ItemCarrinho;
  onAlterarQuantidade: (itemId: string, novaQuantidade: number) => void;
}) {
  return (
    <div className="flex items-center gap-4 py-4">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-black/5 dark:bg-white/5">
        <ProdutoImagem
          src={item.produto?.imagem_url ?? null}
          alt={item.produto?.nome ?? "Produto"}
          categoria={item.produto?.categoria ?? null}
          className="object-cover"
        />
      </div>

      <div className="flex-1">
        <p className="text-sm font-medium">{item.produto?.nome ?? "Produto"}</p>
        <p className="text-xs text-black/50 dark:text-white/50">
          {formatarPreco(item.preco_unitario)} cada
        </p>
      </div>

      <div className="flex items-center rounded-full border border-black/10 dark:border-white/10">
        <button
          type="button"
          onClick={() => onAlterarQuantidade(item.id, item.quantidade - 1)}
          className="px-3 py-1.5 text-lg leading-none"
          aria-label="Diminuir quantidade"
        >
          −
        </button>
        <span className="w-6 text-center text-sm">{item.quantidade}</span>
        <button
          type="button"
          onClick={() => onAlterarQuantidade(item.id, item.quantidade + 1)}
          disabled={item.quantidade >= (item.produto?.estoque_disponivel ?? item.quantidade)}
          className="px-3 py-1.5 text-lg leading-none disabled:opacity-30"
          aria-label="Aumentar quantidade"
        >
          +
        </button>
      </div>

      <span className="w-20 text-right text-sm font-semibold">{formatarPreco(item.subtotal)}</span>
    </div>
  );
}
