"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function BuscaCatalogo({ valorInicial }: { valorInicial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [valor, setValor] = useState(valorInicial);
  const primeiraRenderizacao = useRef(true);

  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }

    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (valor.trim()) {
        params.set("q", valor.trim());
      } else {
        params.delete("q");
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 350);

    return () => clearTimeout(timeout);
    // searchParams/pathname/router deliberadamente fora das deps: só a
    // mudança em `valor` (o que o usuário digita) deve disparar o debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  return (
    <div className="relative">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-black/30 dark:text-white/30"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="Buscar produtos..."
        className="w-full rounded-full border border-black/10 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[var(--brand-primary)] dark:border-white/10 dark:bg-white/5"
      />
    </div>
  );
}
