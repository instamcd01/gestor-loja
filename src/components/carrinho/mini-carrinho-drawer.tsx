"use client";

import { ProdutoImagem } from "@/components/produto-imagem";
import { ButtonLink } from "@/components/ui/button";
import { formatarPreco } from "@/lib/utils";

export function MiniCarrinhoDrawer({
  slug,
  item,
  onFechar,
}: {
  slug: string;
  item: {
    nome: string;
    imagemUrl: string | null;
    categoria: string | null;
    preco: number;
    quantidade: number;
  };
  onFechar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative flex h-full w-full max-w-sm flex-col gap-4 bg-[var(--surface)] p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Adicionado ao carrinho</h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="text-lg text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
          >
            ×
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-black/5 p-3 dark:border-white/10">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black/5 dark:bg-white/5">
            <ProdutoImagem
              src={item.imagemUrl}
              alt={item.nome}
              categoria={item.categoria}
              className="object-cover"
            />
          </div>
          <div className="flex-1">
            <p className="line-clamp-2 text-sm font-medium">{item.nome}</p>
            <p className="text-xs text-black/50 dark:text-white/50">
              {item.quantidade}x {formatarPreco(item.preco)}
            </p>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <ButtonLink href={`/loja/${slug}/carrinho`} className="w-full">
            Ir para o carrinho
          </ButtonLink>
          <button
            type="button"
            onClick={onFechar}
            className="text-center text-sm text-black/50 hover:underline dark:text-white/50"
          >
            Continuar comprando
          </button>
        </div>
      </div>
    </div>
  );
}
