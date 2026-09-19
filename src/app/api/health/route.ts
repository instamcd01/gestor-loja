import { NextResponse } from "next/server";

/**
 * Alvo do uptime-check externo (n8n, a cada 5min) — antes apontava pra
 * `/loja/delivery-pet` (home real da loja), o que forçava um render
 * dinâmico completo (RPC de catálogo + ~15 outras queries no Supabase)
 * 288x/dia só pra confirmar que o site está no ar. Não toca no Supabase.
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}
