import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente Supabase para uso em Server Components / Route Handlers.
 * Lê/escreve cookies de sessão — necessário assim que o login de cliente
 * (checkout) existir. Para as páginas públicas de catálogo (sem sessão),
 * funciona igual a um cliente anônimo comum.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado a partir de um Server Component sem permissão de escrita
            // (ex: durante render estático) — seguro ignorar, o middleware
            // de refresh de sessão cobre esse caso quando ele existir.
          }
        },
      },
    },
  );
}
