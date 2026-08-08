"use client";

import Link from "next/link";
import { useSessao } from "@/components/auth/sessao-provider";

/**
 * Client component de propósito: o layout de /loja/[slug] é ISR (cacheado
 * entre visitantes, revalidate=300s) — não dá pra ler cookies/sessão ali
 * sem forçar a rota inteira a virar dinâmica e perder esse cache. Aqui o
 * estado de login é resolvido no browser de cada visitante, não assado no
 * HTML compartilhado. `useSessao` (SessaoProvider, ver comentário lá)
 * resolve isso UMA VEZ pra página inteira, compartilhado com todo mundo
 * que precisa saber se o cliente está logado.
 */
export function AccountLink({ slug }: { slug: string }) {
  const logado = useSessao();

  if (logado === null) {
    return <span className="h-9 w-9 animate-pulse rounded-full bg-black/5 dark:bg-white/10" />;
  }

  return (
    <Link
      href={`/loja/${slug}/${logado ? "conta" : "entrar"}`}
      aria-label={logado ? "Minha conta" : "Entrar"}
      title={logado ? "Minha conta" : "Entrar"}
      className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4.5 20c1.5-4 4.5-6 7.5-6s6 2 7.5 6" />
      </svg>
    </Link>
  );
}
