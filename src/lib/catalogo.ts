import { createClient } from "@/lib/supabase/server";
import type { CategoriaCatalogo, EmpresaCatalogo, ProdutoCatalogo } from "@/lib/types";

export async function getEmpresaPorSlug(slug: string): Promise<EmpresaCatalogo | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_empresas_publico")
    .select("*")
    .eq("catalogo_slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar empresa por slug:", error.message);
    return null;
  }
  return data;
}

export async function getProdutosCatalogo(
  empresaId: string,
  filtros?: { busca?: string; categoria?: string },
): Promise<ProdutoCatalogo[]> {
  const supabase = await createClient();
  let query = supabase.from("catalogo_produtos_publico").select("*").eq("empresa_id", empresaId);

  if (filtros?.busca) {
    query = query.ilike("nome", `%${filtros.busca}%`);
  }
  if (filtros?.categoria) {
    // "Outros" é o rótulo pra categoria vazia (ver getCategoriasComContagem)
    // — precisa de IS NULL, não IGUAL A 'Outros' (que nunca bate com null).
    query =
      filtros.categoria === "Outros"
        ? query.is("categoria", null)
        : query.eq("categoria", filtros.categoria);
  }

  const { data, error } = await query
    .order("destaque", { ascending: false })
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao buscar produtos do catálogo:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Categorias com contagem, derivadas de `produtos.categoria` (texto
 * livre, com dado real) — não da tabela `categorias` dedicada, que
 * existe mas está praticamente vazia nesse projeto. Usado pra montar
 * os filtros; busca só a coluna categoria (leve, sem trazer os
 * produtos inteiros).
 */
export async function getCategoriasComContagem(
  empresaId: string,
): Promise<{ categoria: string; total: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_produtos_publico")
    .select("categoria")
    .eq("empresa_id", empresaId);

  if (error) {
    console.error("Erro ao buscar categorias com contagem:", error.message);
    return [];
  }

  const contagem = new Map<string, number>();
  for (const { categoria } of data ?? []) {
    const chave = categoria ?? "Outros";
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }

  return [...contagem.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);
}

export async function getProdutoCatalogo(
  empresaId: string,
  produtoId: string,
): Promise<ProdutoCatalogo | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_produtos_publico")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("id", produtoId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar produto do catálogo:", error.message);
    return null;
  }
  return data;
}

export async function getCategoriasCatalogo(empresaId: string): Promise<CategoriaCatalogo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_categorias_publico")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("ordem", { ascending: true });

  if (error) {
    console.error("Erro ao buscar categorias do catálogo:", error.message);
    return [];
  }
  return data ?? [];
}
