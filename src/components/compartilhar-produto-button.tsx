"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Compartilhar o produto: no celular abre o menu nativo (WhatsApp,
 * Instagram...) via Web Share API; no computador, sem esse menu, copia o
 * link e avisa. `caminho` é o path canônico do produto — o domínio vem do
 * próprio navegador, então funciona em qualquer domínio de loja.
 */
export function CompartilharProdutoButton({
  caminho,
  nome,
  className,
}: {
  caminho: string;
  nome: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  async function compartilhar() {
    const url = `${window.location.origin}${caminho}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: nome, text: `Olha esse produto: ${nome}`, url });
      } catch {
        // Cancelado pelo usuário — nada a fazer.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${nome} ${url}`)}`, "_blank", "noopener");
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={compartilhar}
        aria-label="Compartilhar produto"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-black shadow transition-colors hover:bg-white dark:bg-black/50 dark:text-white dark:hover:bg-black/70",
          className,
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4.5 w-4.5"
        >
          <circle cx="18" cy="5" r="2.5" />
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="19" r="2.5" />
          <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
        </svg>
      </button>
      {copiado && (
        <span
          role="status"
          className="absolute top-full right-0 mt-1 rounded-md bg-black/80 px-2 py-1 text-xs whitespace-nowrap text-white"
        >
          Link copiado
        </span>
      )}
    </span>
  );
}
