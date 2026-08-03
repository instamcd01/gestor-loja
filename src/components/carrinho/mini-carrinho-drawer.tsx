"use client";

import { ProdutoImagem } from "@/components/produto-imagem";
import { ButtonLink } from "@/components/ui/button";
import { useDrawerA11y } from "@/lib/use-drawer-a11y";
import { formatarPreco } from "@/lib/utils";

export interface ItemMiniCarrinho {
  id: string;
  nome: string;
  imagemUrl: string | null;
  categoria: string | null;
  preco: number;
  quantidade: number;
}

/**
 * Mostra o carrinho INTEIRO (não só o item que acabou de ser adicionado) —
 * antes só mostrava o item novo, dando a falsa impressão de que os outros
 * produtos tinham sumido a cada vez que algo era adicionado (relatado
 * como "não consigo adicionar outros produtos", mas o carrinho de verdade
 * sempre acumulou certo — só a confirmação visual escondia isso).
 */
export function MiniCarrinhoDrawer({
  slug,
  itens,
  valorTotal,
  idRecemAdicionado,
  onFechar,
}: {
  slug: string;
  itens: ItemMiniCarrinho[];
  valorTotal: number;
  idRecemAdicionado: string;
  onFechar: () => void;
}) {
  const painelRef = useDrawerA11y(true, onFechar);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 bg-black/40"
      />
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Adicionado ao carrinho"
        className="relative flex h-full w-full max-w-sm flex-col gap-4 bg-[var(--surface)] p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            Adicionado ao carrinho ({itens.length} {itens.length === 1 ? "item" : "itens"})
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="text-lg text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
          >
            ×
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {itens.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 rounded-[var(--radius-md)] border p-3 ${
                item.id === idRecemAdicionado
                  ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5"
                  : "border-black/5 dark:border-white/10"
              }`}
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-black/5 dark:bg-white/5">
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
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-black/5 pt-3 text-sm font-medium dark:border-white/10">
          <span>Total</span>
          <span>{formatarPreco(valorTotal)}</span>
        </div>

        <div className="flex flex-col gap-2">
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
