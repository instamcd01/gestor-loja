"use server";

import { createClient } from "@/lib/supabase/server";
import type { ProdutoCatalogo } from "@/lib/types";

/**
 * Categorias complementares por categoria do carrinho, curadas à mão a
 * partir da distribuição real do catálogo (ver `SELECT categoria, count(*)`
 * rodado antes de escrever isso). Objetivo é cross-sell de verdade — "quem
 * leva areia de gato também costuma precisar de sachê/petisco/antipulgas
 * de gato", não "mais do mesmo que já está no carrinho". Categorias
 * específicas de espécie (Cães/Gatos) priorizam a mesma espécie primeiro;
 * categorias genéricas (Farmácia, Brinquedos, Shampoo...) entram como
 * complemento de várias. Curadoria manual, não aprendida de dados de
 * venda — não existe pipeline de "quem comprou X também comprou Y" nesse
 * projeto ainda; revisar/ajustar aqui se o padrão real de venda discordar.
 */
const CATEGORIAS_COMPLEMENTARES: Record<string, string[]> = {
  "Ração para Cães": [
    "Petiscos para Cães",
    "Sachês para Cães",
    "Antipulgas Cães",
    "Vermífugos",
    "Brinquedos e Acessórios",
    "Shampoos e Perfumes",
    "Camas e Colchonetes",
    "Farmácia",
  ],
  "Ração para Gatos": [
    "Petiscos para Gatos",
    "Sachês para Gatos",
    "Areia Sanitária",
    "Antipulgas Gatos",
    "Vermífugos",
    "Brinquedos e Acessórios",
    "Shampoos e Perfumes",
    "Farmácia",
  ],
  "Petiscos para Cães": [
    "Ração para Cães",
    "Brinquedos e Acessórios",
    "Antipulgas Cães",
    "Sachês para Cães",
    "Shampoos e Perfumes",
    "Vermífugos",
    "Camas e Colchonetes",
    "Farmácia",
  ],
  "Petiscos para Gatos": [
    "Ração para Gatos",
    "Sachês para Gatos",
    "Areia Sanitária",
    "Brinquedos e Acessórios",
    "Antipulgas Gatos",
    "Shampoos e Perfumes",
    "Vermífugos",
    "Farmácia",
  ],
  "Sachês para Cães": [
    "Ração para Cães",
    "Petiscos para Cães",
    "Antipulgas Cães",
    "Brinquedos e Acessórios",
    "Vermífugos",
    "Farmácia",
  ],
  "Sachês para Gatos": [
    "Ração para Gatos",
    "Petiscos para Gatos",
    "Areia Sanitária",
    "Antipulgas Gatos",
    "Brinquedos e Acessórios",
    "Vermífugos",
    "Farmácia",
  ],
  "Areia Sanitária": [
    "Sachês para Gatos",
    "Petiscos para Gatos",
    "Ração para Gatos",
    "Antipulgas Gatos",
    "Limpeza da Casa",
    "Brinquedos e Acessórios",
    "Tapetes Higiênicos",
    "Farmácia",
  ],
  "Antipulgas Cães": [
    "Vermífugos",
    "Shampoos e Perfumes",
    "Dermatológicos",
    "Ração para Cães",
    "Petiscos para Cães",
    "Farmácia",
    "Brinquedos e Acessórios",
  ],
  "Antipulgas Gatos": [
    "Vermífugos",
    "Shampoos e Perfumes",
    "Dermatológicos",
    "Ração para Gatos",
    "Petiscos para Gatos",
    "Areia Sanitária",
    "Farmácia",
    "Brinquedos e Acessórios",
  ],
  Vermífugos: [
    "Antipulgas Cães",
    "Antipulgas Gatos",
    "Farmácia",
    "Dermatológicos",
    "Ração para Cães",
    "Ração para Gatos",
  ],
  Dermatológicos: ["Shampoos e Perfumes", "Antipulgas Cães", "Antipulgas Gatos", "Farmácia", "Vermífugos"],
  Farmácia: [
    "Vermífugos",
    "Antipulgas Cães",
    "Antipulgas Gatos",
    "Dermatológicos",
    "Shampoos e Perfumes",
    "Ração para Cães",
    "Ração para Gatos",
  ],
  "Tapetes Higiênicos": [
    "Areia Sanitária",
    "Limpeza da Casa",
    "Petiscos para Cães",
    "Ração para Cães",
    "Farmácia",
    "Brinquedos e Acessórios",
  ],
  "Brinquedos e Acessórios": [
    "Petiscos para Cães",
    "Petiscos para Gatos",
    "Camas e Colchonetes",
    "Shampoos e Perfumes",
    "Ração para Cães",
    "Ração para Gatos",
    "Farmácia",
  ],
  "Shampoos e Perfumes": ["Antipulgas Cães", "Antipulgas Gatos", "Dermatológicos", "Brinquedos e Acessórios", "Farmácia"],
  "Camas e Colchonetes": [
    "Brinquedos e Acessórios",
    "Tapetes Higiênicos",
    "Petiscos para Cães",
    "Petiscos para Gatos",
    "Farmácia",
  ],
  "Limpeza da Casa": ["Areia Sanitária", "Tapetes Higiênicos", "Controle de Pragas", "Farmácia"],
  "Controle de Pragas": ["Limpeza da Casa", "Antipulgas Cães", "Antipulgas Gatos", "Farmácia"],
  Conveniência: ["Petiscos para Cães", "Petiscos para Gatos", "Farmácia", "Brinquedos e Acessórios"],
  "Alimento Terapêutico": ["Farmácia", "Ração para Cães", "Ração para Gatos", "Vermífugos"],
  Pássaros: ["Farmácia", "Brinquedos e Acessórios", "Limpeza da Casa"],
  Roedores: ["Farmácia", "Brinquedos e Acessórios", "Limpeza da Casa"],
  Peixes: ["Farmácia", "Limpeza da Casa"],
};

/** Sem categoria reconhecida no carrinho (ou categoria fora do mapa) — cai pras categorias mais "de impulso", gancho genérico melhor que nada específico. */
const CATEGORIAS_FALLBACK = ["Petiscos para Cães", "Petiscos para Gatos", "Brinquedos e Acessórios", "Farmácia"];

export interface ResultadoSugestoes {
  produtos: ProdutoCatalogo[];
  temMais: boolean;
}

/**
 * Sugere produtos COMPLEMENTARES ao que já está no carrinho — nunca da
 * mesma categoria (o objetivo é aumentar o ticket/fechar a venda quando o
 * frete é objeção, não empurrar "mais do mesmo"). Ex: carrinho com areia
 * de gato sugere sachê/petisco/ração/antipulgas de gato, acessórios,
 * farmácia — nunca outra areia. Preço não entra na escolha (antes filtrava
 * por faixa perto do valor faltante pro frete grátis — descontinuado a
 * pedido do usuário, o objetivo é ticket, não fechar uma conta exata).
 * Retorna paginado (`offset`/`limite`) pro carrossel poder ter um card
 * "Ver mais" no fim em vez de carregar tudo de uma vez.
 */
export async function buscarProdutosComplementares(
  empresaId: string,
  categoriasCarrinho: string[],
  idsNoCarrinho: string[],
  offset: number = 0,
  limite: number = 10,
): Promise<ResultadoSugestoes> {
  const categoriasCarrinhoSet = new Set(categoriasCarrinho);

  const categoriasAlvo: string[] = [];
  const vistas = new Set<string>();
  for (const categoria of categoriasCarrinho) {
    for (const complementar of CATEGORIAS_COMPLEMENTARES[categoria] ?? []) {
      if (categoriasCarrinhoSet.has(complementar) || vistas.has(complementar)) continue;
      vistas.add(complementar);
      categoriasAlvo.push(complementar);
    }
  }
  if (categoriasAlvo.length === 0) {
    for (const categoria of CATEGORIAS_FALLBACK) {
      if (!categoriasCarrinhoSet.has(categoria)) categoriasAlvo.push(categoria);
    }
  }
  if (categoriasAlvo.length === 0) return { produtos: [], temMais: false };

  const supabase = await createClient();
  let query = supabase
    .from("catalogo_produtos_publico")
    .select("*")
    .eq("empresa_id", empresaId)
    .is("produto_pai_id", null)
    .gt("estoque_disponivel", 0)
    .in("categoria", categoriasAlvo);
  if (idsNoCarrinho.length > 0) query = query.not("id", "in", `(${idsNoCarrinho.join(",")})`);
  const { data } = await query.order("destaque", { ascending: false }).order("nome", { ascending: true });

  const candidatosPorCategoria = new Map<string, ProdutoCatalogo[]>(categoriasAlvo.map((c) => [c, []]));
  for (const produto of data ?? []) {
    candidatosPorCategoria.get(produto.categoria ?? "")?.push(produto);
  }

  // Round-robin entre categorias (1 produto de cada por vez) — garante que
  // os primeiros resultados venham de categorias DIFERENTES em vez de
  // esgotar uma categoria só antes de passar pra próxima.
  const ordenados: ProdutoCatalogo[] = [];
  for (let rodada = 0; ; rodada++) {
    let adicionouAlgum = false;
    for (const categoria of categoriasAlvo) {
      const produto = candidatosPorCategoria.get(categoria)?.[rodada];
      if (produto) {
        ordenados.push(produto);
        adicionouAlgum = true;
      }
    }
    if (!adicionouAlgum) break;
  }

  return {
    produtos: ordenados.slice(offset, offset + limite),
    temMais: ordenados.length > offset + limite,
  };
}
