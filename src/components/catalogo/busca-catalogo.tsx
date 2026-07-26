"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Vive no header (visível em toda página, não só no catálogo) — por isso
 * sempre navega pra `/loja/${slug}`, mesmo se digitado a partir da página
 * de um produto. Se já estiver no catálogo, preserva os outros filtros
 * ativos (categoria/marca/preço) e só mexe em `q`.
 */
export function BuscaCatalogo({ slug }: { slug: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const destino = `/loja/${slug}`;
  const qAtual = searchParams.get("q") ?? "";

  const [valor, setValor] = useState(qAtual);
  const primeiraRenderizacao = useRef(true);

  // Ajusta o campo quando `q` muda por fora (ex: limpar busca ao trocar de
  // categoria pelo nav) — durante a renderização, não num efeito, seguindo
  // o padrão recomendado pelo React pra "resetar estado quando uma prop
  // muda" (evita o cascading-render que um useEffect com setState causaria).
  const [qSincronizado, setQSincronizado] = useState(qAtual);
  if (qAtual !== qSincronizado) {
    setQSincronizado(qAtual);
    setValor(qAtual);
  }

  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }

    const timeout = setTimeout(() => {
      const params = new URLSearchParams(pathname === destino ? searchParams : undefined);
      if (valor.trim()) {
        params.set("q", valor.trim());
      } else {
        params.delete("q");
      }
      router.replace(`${destino}?${params.toString()}`, { scroll: false });
    }, 350);

    return () => clearTimeout(timeout);
    // searchParams/pathname/router deliberadamente fora das deps: só a
    // mudança em `valor` (o que o usuário digita) deve disparar o debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  return (
    <div className="relative w-full">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-black/30 dark:text-white/30"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="O que seu pet precisa?"
        className="w-full rounded-full border border-black/10 bg-[var(--surface)] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[var(--brand-primary)] dark:border-white/10"
      />
    </div>
  );
}
