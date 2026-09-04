"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

const SessaoContext = createContext<{ logado: boolean | null } | undefined>(undefined);

/**
 * Resolve "está logado?" UMA VEZ por página e compartilha via contexto —
 * antes, cada consumidor (`AccountLink`, `CarrinhoLink`, `Sidebar`,
 * `useCarrinhoRapido`) tinha seu PRÓPRIO `useEffect` chamando
 * `supabase.auth.getUser()` independentemente. `useCarrinhoRapido` roda uma
 * vez POR CARD DE PRODUTO — num catálogo com centenas de produtos, isso
 * virava centenas de chamadas simultâneas a `auth/v1/user` toda vez que a
 * grade de produtos mudava (troca de departamento/filtro), congestionando
 * a rede e deixando a navegação lenta. Confirmado ao vivo em produção via
 * stack trace (`read_network_requests` + patch de `window.fetch`).
 */
export function SessaoProvider({ children }: { children: ReactNode }) {
  const [logado, setLogado] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    // .catch: mesmo bug do server (AuthApiError lançado, não devolvido em
    // `error`, quando o refresh token do cookie é inválido) — aqui só
    // evita um unhandled rejection no console do navegador, sem risco de
    // derrubar processo nenhum (client-side).
    supabase.auth
      .getUser()
      .then(({ data }) => setLogado(!!data.user))
      .catch(() => setLogado(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLogado(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return <SessaoContext.Provider value={{ logado }}>{children}</SessaoContext.Provider>;
}

/** `null` enquanto ainda não resolveu (primeira checagem no browser ainda em voo). */
export function useSessao(): boolean | null {
  const contexto = useContext(SessaoContext);
  if (contexto === undefined) {
    throw new Error("useSessao precisa estar dentro de um SessaoProvider");
  }
  return contexto.logado;
}
