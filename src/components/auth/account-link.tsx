"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Client component de propósito: o layout de /loja/[slug] é ISR (cacheado
 * entre visitantes, revalidate=300s) — não dá pra ler cookies/sessão ali
 * sem forçar a rota inteira a virar dinâmica e perder esse cache. Aqui o
 * estado de login é resolvido no browser de cada visitante, não assado no
 * HTML compartilhado.
 */
export function AccountLink({ slug }: { slug: string }) {
  const [logado, setLogado] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setLogado(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLogado(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

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
