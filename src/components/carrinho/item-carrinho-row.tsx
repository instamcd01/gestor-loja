"use client";

import Image from "next/image";
import { useTransition } from "react";
import type { ItemCarrinho } from "@/lib/types";
import { atualizarQuantidade } from "@/lib/carrinho";
import { formatarPreco } from "@/lib/utils";

export function ItemCarrinhoRow({
  slug,
  carrinhoId,
  item,
}: {
  slug: string;
  carrinhoId: string;
  item: ItemCarrinho;
}) {
  const [pending, startTransition] = useTransition();

  function mudar(novaQuantidade: number) {
    startTransition(() => {
      atualizarQuantidade(slug, carrinhoId, item.id, novaQuantidade);
    });
  }

  return (
    <div className={`flex items-center gap-4 py-4 ${pending ? "opacity-50" : ""}`}>
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-black/5 dark:bg-white/5">
        {item.produto?.imagem_url ? (
          <Image src={item.produto.imagem_url} alt={item.produto.nome} fill className="object-cover" />
        ) : null}
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
          onClick={() => mudar(item.quantidade - 1)}
          disabled={pending}
          className="px-3 py-1.5 text-lg leading-none"
          aria-label="Diminuir quantidade"
        >
          −
        </button>
        <span className="w-6 text-center text-sm">{item.quantidade}</span>
        <button
          type="button"
          onClick={() => mudar(item.quantidade + 1)}
          disabled={pending}
          className="px-3 py-1.5 text-lg leading-none"
          aria-label="Aumentar quantidade"
        >
          +
        </button>
      </div>

      <span className="w-20 text-right text-sm font-semibold">{formatarPreco(item.subtotal)}</span>
    </div>
  );
}
