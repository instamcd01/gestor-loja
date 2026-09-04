import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Wrapper de `supabase.auth.getUser()` que nunca lança. Um cookie de sessão
 * com refresh token inválido/expirado/revogado faz o SDK LANÇAR AuthApiError
 * em vez de devolver `{ error }` (bug conhecido do @supabase/ssr, ver
 * github.com/supabase/ssr/issues/68 — acontece até dentro do middleware).
 * Sem captura, essa exceção não tratada derruba o processo Node inteiro
 * (self-hosted, sem sandboxing por requisição) — confirmado nos logs de
 * produção do Easypanel: um único visitante com cookie ruim gerava
 * "AuthApiError: Invalid Refresh Token" e, junto dele, 503 intermitente em
 * requisições de OUTROS visitantes concorrentes até o container reiniciar.
 * Trata qualquer falha aqui como "não logado", igual ao caso já tratado de
 * usuário nulo.
 */
export async function getUsuarioSeguro(
  supabase: SupabaseClient,
): Promise<User | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}
