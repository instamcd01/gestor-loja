"use server";

import { createClient } from "@/lib/supabase/server";
import type { ProdutoCatalogo } from "@/lib/types";

/**
 * Sugere 1 produto barato o suficiente pra fechar a faixa que falta pro
 * frete grátis — motiva completar o carrinho em vez de só avisar o valor
 * que falta (mesmo padrão de UX já usado em marketplaces grandes).
 * Faixa de até 60% acima do valor faltante pra não sugerir algo caro
 * demais só porque é o próximo preço disponível.
 */
export async function buscarProdutoParaFreteGratis(
  empresaId: string,
  valorFaltante: number,
): Promise<ProdutoCatalogo | null> {
  if (valorFaltante <= 0) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("catalogo_produtos_publico")
    .select("*")
    .eq("empresa_id", empresaId)
    .is("produto_pai_id", null)
    .gte("preco", valorFaltante)
    .lte("preco", valorFaltante * 1.6)
    .order("preco", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data;
}
