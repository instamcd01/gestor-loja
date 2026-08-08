import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para uso em Client Components.
 * Usa apenas a chave publicável (anon) — nunca a service role aqui.
 *
 * Memoizado num singleton de propósito: cada chamador (`AccountLink`,
 * `CarrinhoLink`, `Sidebar`, `FavoritosProvider`, `useCarrinhoRapido`, ...)
 * chama `createClient()` no seu próprio efeito, e sem esse cache cada um
 * criava sua PRÓPRIA instância de `GoTrueClient` — várias instâncias
 * competindo pela mesma sessão no localStorage entram num ping-pong de
 * auto-refresh (uma escreve o token renovado, a escrita dispara o listener
 * de storage das outras, que renovam de novo, e assim por diante). Achado
 * ao vivo em produção: um único clique de navegação disparava ~90
 * requisições/segundo pra `auth/v1/user`, sem nunca parar sozinho — a causa
 * raiz real do "site lento" reportado, não as imagens/rede em si.
 */
let client: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}
