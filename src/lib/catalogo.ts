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

export async function getProdutosCatalogo(empresaId: string): Promise<ProdutoCatalogo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_produtos_publico")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("destaque", { ascending: false })
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao buscar produtos do catálogo:", error.message);
    return [];
  }
  return data ?? [];
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
