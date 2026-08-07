"use server";

import { createClient } from "@/lib/supabase/server";
import type { ProdutoCatalogo } from "@/lib/types";

async function getClienteId(empresaId: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("clientes")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return data?.id ?? null;
}

/** IDs dos produtos favoritados pelo cliente logado — [] se não logado ou sem favoritos. */
export async function getFavoritosIds(empresaId: string): Promise<string[]> {
  const supabase = await createClient();
  const clienteId = await getClienteId(empresaId);
  if (!clienteId) return [];

  const { data } = await supabase
    .from("favoritos")
    .select("produto_id")
    .eq("cliente_id", clienteId);

  return (data ?? []).map((f) => f.produto_id);
}

export type ResultadoToggleFavorito =
  | { ok: true; favorito: boolean }
  | { ok: false; erro: "not_logged" | string };

/** Alterna o favorito do produto pro cliente logado — cria se não existe, remove se existe. */
export async function toggleFavorito(empresaId: string, produtoId: string): Promise<ResultadoToggleFavorito> {
  const supabase = await createClient();
  const clienteId = await getClienteId(empresaId);
  if (!clienteId) return { ok: false, erro: "not_logged" };

  const { data: existente } = await supabase
    .from("favoritos")
    .select("id")
    .eq("cliente_id", clienteId)
    .eq("produto_id", produtoId)
    .maybeSingle();

  if (existente) {
    const { error } = await supabase.from("favoritos").delete().eq("id", existente.id);
    if (error) return { ok: false, erro: error.message };
    return { ok: true, favorito: false };
  }

  const { error } = await supabase
    .from("favoritos")
    .insert({ empresa_id: empresaId, cliente_id: clienteId, produto_id: produtoId });
  if (error) return { ok: false, erro: error.message };
  return { ok: true, favorito: true };
}

/** Produtos favoritados do cliente logado, já com dados do catálogo público — [] se não logado. */
export async function getProdutosFavoritos(empresaId: string): Promise<ProdutoCatalogo[]> {
  const supabase = await createClient();
  const clienteId = await getClienteId(empresaId);
  if (!clienteId) return [];

  const { data: favoritos } = await supabase
    .from("favoritos")
    .select("produto_id, created_at")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });

  const produtoIds = (favoritos ?? []).map((f) => f.produto_id);
  if (produtoIds.length === 0) return [];

  const { data: produtos } = await supabase
    .from("catalogo_produtos_publico")
    .select("*")
    .eq("empresa_id", empresaId)
    .in("id", produtoIds);

  // A ordem vem de `favoritos` (mais recente primeiro) — o `.in()` do
  // Supabase não preserva a ordem da lista de IDs.
  const produtosPorId = new Map((produtos ?? []).map((p) => [p.id, p]));
  return produtoIds.map((id) => produtosPorId.get(id)).filter((p): p is ProdutoCatalogo => !!p);
}
