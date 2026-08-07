"use client";

import { useFavoritos } from "@/components/favoritos/favoritos-provider";
import { cn } from "@/lib/utils";

/** Coração de favoritar — lê/altera o estado compartilhado do FavoritosProvider. */
export function FavoritoButton({ produtoId, className }: { produtoId: string; className?: string }) {
  const { ids, alternar } = useFavoritos();
  const favorito = ids.has(produtoId);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        alternar(produtoId);
      }}
      aria-label={favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      aria-pressed={favorito}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-black shadow transition-colors hover:bg-white dark:bg-black/50 dark:text-white dark:hover:bg-black/70",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill={favorito ? "var(--color-danger)" : "none"}
        stroke={favorito ? "var(--color-danger)" : "currentColor"}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4.5 w-4.5"
      >
        <path d="M12 20.5s-7.5-4.6-10-9.3C.5 7.8 2.3 4.5 5.6 4c2.1-.3 4 .7 6.4 3.2C14.4 4.7 16.3 3.7 18.4 4c3.3.5 5.1 3.8 3.6 7.2-2.5 4.7-10 9.3-10 9.3Z" />
      </svg>
    </button>
  );
}
