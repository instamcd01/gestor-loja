"use server";

import { createClient } from "@/lib/supabase/server";
import type { ProdutoCatalogo } from "@/lib/types";

/**
 * Sugere produtos pra fechar a faixa que falta pro frete grátis — motiva
 * completar o carrinho em vez de só avisar o valor que falta (mesmo padrão
 * de UX já usado em marketplaces grandes). Prioriza as MESMAS categorias
 * dos produtos que já estão no carrinho (quem já está levando ração,
 * provavelmente aceita mais ração/petisco da mesma categoria do que uma
 * sugestão aleatória do catálogo inteiro) — só cai pro catálogo geral
 * quando essa busca não traz opções suficientes pra formar um carrossel.
 */
export async function buscarProdutosParaFreteGratis(
  empresaId: string,
  valorFaltante: number,
  categoriasCarrinho: string[],
  idsNoCarrinho: string[],
): Promise<ProdutoCatalogo[]> {
  if (valorFaltante <= 0) return [];

  const supabase = await createClient();
  const exclusao = idsNoCarrinho.length > 0 ? `(${idsNoCarrinho.join(",")})` : null;

  async function buscar(categorias: string[]) {
    let query = supabase
      .from("catalogo_produtos_publico")
      .select("*")
      .eq("empresa_id", empresaId)
      .is("produto_pai_id", null)
      .gt("estoque_disponivel", 0);
    if (exclusao) query = query.not("id", "in", exclusao);
    if (categorias.length > 0) query = query.in("categoria", categorias);
    const { data } = await query.order("preco", { ascending: true }).limit(20);
    return data ?? [];
  }

  const mesmaCategoria = categoriasCarrinho.length > 0 ? await buscar(categoriasCarrinho) : [];
  const lista = mesmaCategoria.length >= 6 ? mesmaCategoria : [...mesmaCategoria, ...(await buscar([]))];

  const vistos = new Set<string>();
  const unicos = lista.filter((produto) => {
    if (vistos.has(produto.id)) return false;
    vistos.add(produto.id);
    return true;
  });

  // Entre os que fecham a conta sozinhos, o mais barato primeiro (sobra
  // menos "troco" gasto à toa); entre os que não fecham sozinhos (vai
  // precisar combinar mais de um), o mais caro primeiro, pra precisar
  // combinar menos itens.
  unicos.sort((a, b) => {
    const aFecha = a.preco >= valorFaltante;
    const bFecha = b.preco >= valorFaltante;
    if (aFecha !== bFecha) return aFecha ? -1 : 1;
    return aFecha ? a.preco - b.preco : b.preco - a.preco;
  });

  return unicos.slice(0, 10);
}
