import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com a service role key — ignora RLS por completo.
 * Só pra rotas server-side sem sessão de usuário (webhook do Mercado
 * Pago, troca de token OAuth): não tem cookie/sessão pra autenticar
 * como o dono da loja, e as tabelas que ele precisa escrever
 * (empresa_mercadopago, status de pagamento em pedidos) são travadas
 * pra qualquer papel que não seja service_role de propósito (ver
 * migração mercadopago_conta_por_loja). NUNCA importar isso em código
 * que roda no browser — a env var não tem prefixo NEXT_PUBLIC_ de
 * propósito, mas o cuidado é escopo (só Route Handlers/Server Actions).
 */
export function createServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
