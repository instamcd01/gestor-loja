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
    return <span className="h-4 w-16 animate-pulse rounded bg-black/5 dark:bg-white/10" />;
  }

  return (
    <Link
      href={`/loja/${slug}/${logado ? "conta" : "entrar"}`}
      className="text-sm font-medium hover:underline"
    >
      {logado ? "Minha conta" : "Entrar"}
    </Link>
  );
}
