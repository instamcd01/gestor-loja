import { createClient } from "@/lib/supabase/server";
import type { CategoriaCatalogo, EmpresaCatalogo, ProdutoCatalogo, VarianteProduto } from "@/lib/types";
import { extrairPeso } from "@/lib/variantes";

export type Ordenacao =
  | "relevancia"
  | "menor_preco"
  | "maior_preco"
  | "nome_az"
  | "nome_za"
  | "maior_desconto";

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
  filtros?: {
    busca?: string;
    categoria?: string;
    marca?: string;
    precoMin?: number;
    precoMax?: number;
    ordenar?: Ordenacao;
  },
): Promise<ProdutoCatalogo[]> {
  const supabase = await createClient();
  let query = supabase
    .from("catalogo_produtos_publico")
    .select("*")
    .eq("empresa_id", empresaId)
    // Só pai/avulso na grade — variantes (peso/tamanho) do mesmo produto-base
    // aparecem como pills dentro do card, não como cards separados.
    .is("produto_pai_id", null);

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
  if (filtros?.marca) {
    query = query.eq("marca", filtros.marca);
  }
  if (filtros?.precoMin != null) {
    query = query.gte("preco", filtros.precoMin);
  }
  if (filtros?.precoMax != null) {
    query = query.lte("preco", filtros.precoMax);
  }

  switch (filtros?.ordenar) {
    case "menor_preco":
      query = query.order("preco", { ascending: true });
      break;
    case "maior_preco":
      query = query.order("preco", { ascending: false });
      break;
    case "nome_az":
      query = query.order("nome", { ascending: true });
      break;
    case "nome_za":
      query = query.order("nome", { ascending: false });
      break;
    default:
      // "relevancia" e "maior_desconto" (esse último precisa do cálculo
      // de desconto em memória, feito abaixo) partem da mesma ordem-base.
      query = query.order("destaque", { ascending: false }).order("nome", { ascending: true });
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar produtos do catálogo:", error.message);
    return [];
  }

  if (filtros?.ordenar === "maior_desconto") {
    return [...(data ?? [])].sort((a, b) => descontoPercentual(b) - descontoPercentual(a));
  }

  return data ?? [];
}

function descontoPercentual(produto: ProdutoCatalogo): number {
  if (produto.preco_promocional == null || produto.preco_promocional >= produto.preco) return 0;
  return (produto.preco - produto.preco_promocional) / produto.preco;
}

/**
 * Variantes (peso/tamanho) de todos os produtos-pai da empresa, pra montar
 * as pills sem N+1. Deliberadamente NÃO filtra por `.in("produto_pai_id",
 * paiIds)` — com o catálogo inteiro sem filtro (500+ produtos), a lista de
 * ids nesse IN estourava o limite de tamanho da URL da requisição e a busca
 * falhava com "TypeError: fetch failed" (visto ao testar de verdade no
 * navegador, não no build). Como só existem variantes mesmo (linhas com
 * produto_pai_id preenchido) pra uma fração do catálogo, trazer todas de
 * uma vez pra empresa e filtrar em memória é mais barato e não tem esse
 * limite.
 */
export async function getVariantesEmLote(
  empresaId: string,
  paiIds: string[],
): Promise<Map<string, VarianteProduto[]>> {
  const porPai = new Map<string, VarianteProduto[]>();
  if (paiIds.length === 0) return porPai;
  const paiIdsSet = new Set(paiIds);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_produtos_publico")
    .select("id, nome, preco, preco_promocional, produto_pai_id")
    .eq("empresa_id", empresaId)
    .not("produto_pai_id", "is", null);

  if (error) {
    console.error("Erro ao buscar variantes:", error.message);
    return porPai;
  }

  // gramas guardado à parte pra ordenar — extrairPeso() exige um espaço
  // antes do número, então não dá pra re-extrair de um rótulo já cortado
  // tipo "20kg" (sem espaço); precisa vir do nome completo, uma vez só.
  const comGramas: { paiId: string; variante: VarianteProduto; gramas: number }[] = [];
  for (const linha of data ?? []) {
    if (!linha.produto_pai_id || !paiIdsSet.has(linha.produto_pai_id)) continue;
    const peso = extrairPeso(linha.nome);
    comGramas.push({
      paiId: linha.produto_pai_id,
      gramas: peso?.gramas ?? 0,
      variante: {
        id: linha.id,
        rotulo: peso?.rotulo ?? linha.nome,
        preco: linha.preco,
        preco_promocional: linha.preco_promocional,
      },
    });
  }

  comGramas.sort((a, b) => a.gramas - b.gramas);
  for (const { paiId, variante } of comGramas) {
    const lista = porPai.get(paiId) ?? [];
    lista.push(variante);
    porPai.set(paiId, lista);
  }

  return porPai;
}

/**
 * Variantes de UM produto (usado na página de detalhe) — resolve o pai
 * primeiro (o próprio produto pode ser o pai ou um filho) e traz todos
 * os irmãos, incluindo o próprio pai como uma das opções.
 */
export async function getVariantesDoProduto(
  empresaId: string,
  produto: Pick<ProdutoCatalogo, "id" | "nome" | "preco" | "preco_promocional" | "produto_pai_id">,
): Promise<VarianteProduto[]> {
  const paiId = produto.produto_pai_id ?? produto.id;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_produtos_publico")
    .select("id, nome, preco, preco_promocional")
    .eq("empresa_id", empresaId)
    .or(`id.eq.${paiId},produto_pai_id.eq.${paiId}`);

  if (error) {
    console.error("Erro ao buscar variantes do produto:", error.message);
    return [];
  }
  if (!data || data.length < 2) return [];

  return data
    .map((linha) => {
      const peso = extrairPeso(linha.nome);
      return {
        gramas: peso?.gramas ?? 0,
        variante: {
          id: linha.id,
          rotulo: peso?.rotulo ?? linha.nome,
          preco: linha.preco,
          preco_promocional: linha.preco_promocional,
        } satisfies VarianteProduto,
      };
    })
    .sort((a, b) => a.gramas - b.gramas)
    .map(({ variante }) => variante);
}

/**
 * Faixas fixas, calibradas pela distribuição real de preço deste catálogo
 * (mín R$2,49, máx R$349,90, mediana R$44,90) — não são um chute genérico.
 */
const FAIXAS_PRECO_BASE: { min: number; max?: number }[] = [
  { min: 0, max: 25 },
  { min: 25, max: 50 },
  { min: 50, max: 100 },
  { min: 100, max: 200 },
  { min: 200 },
];

export interface FaixaPreco {
  min: number;
  max?: number;
  total: number;
}

export async function getFaixasPrecoComContagem(empresaId: string): Promise<FaixaPreco[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_produtos_publico")
    .select("preco")
    .eq("empresa_id", empresaId)
    .is("produto_pai_id", null);

  if (error) {
    console.error("Erro ao buscar faixas de preço:", error.message);
    return [];
  }

  return FAIXAS_PRECO_BASE.map((faixa) => ({
    ...faixa,
    total: (data ?? []).filter(
      ({ preco }) => preco >= faixa.min && (faixa.max == null || preco < faixa.max),
    ).length,
  })).filter((faixa) => faixa.total > 0);
}

export async function getMarcasComContagem(
  empresaId: string,
): Promise<{ marca: string; total: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_produtos_publico")
    .select("marca")
    .eq("empresa_id", empresaId)
    .is("produto_pai_id", null)
    .not("marca", "is", null);

  if (error) {
    console.error("Erro ao buscar marcas com contagem:", error.message);
    return [];
  }

  const contagem = new Map<string, number>();
  for (const { marca } of data ?? []) {
    if (!marca) continue;
    contagem.set(marca, (contagem.get(marca) ?? 0) + 1);
  }

  return [...contagem.entries()]
    .map(([marca, total]) => ({ marca, total }))
    .sort((a, b) => b.total - a.total);
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

/**
 * Menor `valor_minimo_frete_gratis` entre as zonas ativas da empresa — usado
 * no selo "Frete grátis acima de X" na home. Só mostra o selo se existir
 * mesmo (nem toda empresa tem zona de entrega configurada ainda).
 */
export async function getMenorValorFreteGratis(empresaId: string): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_frete_gratis_publico")
    .select("valor_minimo_frete_gratis")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar frete grátis:", error.message);
    return null;
  }
  return data?.valor_minimo_frete_gratis ?? null;
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
