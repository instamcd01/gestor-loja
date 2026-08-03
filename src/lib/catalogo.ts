import { createClient } from "@/lib/supabase/server";
import type { CategoriaCatalogo, EmpresaCatalogo, ProdutoCatalogo, VarianteProduto } from "@/lib/types";
import { chaveOrdenacaoRotulo, extrairPeso } from "@/lib/variantes";

/**
 * Rótulo + chave de ordenação de uma variante — prefere `variante_label`
 * (preenchido via aprovação de sugestão no app Gestor, cobre qualquer eixo:
 * peso/dose/sabor/apresentação) e cai pro `extrairPeso` heurístico só pra
 * variantes legadas que ainda não passaram por essa aprovação (só cobre peso).
 */
function rotuloEChaveVariante(linha: { nome: string; variante_label?: string | null }): {
  rotulo: string;
  chave: number;
} {
  const rotulo = linha.variante_label || extrairPeso(linha.nome)?.rotulo || linha.nome;
  return { rotulo, chave: chaveOrdenacaoRotulo(rotulo) };
}

/** Remove acentos e caixa, espelhando `unaccent(lower(...))` usado em `nome_busca` na view. */
function normalizarBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

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
    departamento?: string;
    categoria?: string;
    marca?: string;
    precoMin?: number;
    precoMax?: number;
    ordenar?: Ordenacao;
  },
): Promise<ProdutoCatalogo[]> {
  const supabase = await createClient();
  let query = supabase.from("catalogo_produtos_publico").select("*").eq("empresa_id", empresaId);

  if (filtros?.busca) {
    // Em busca, mostra cada variante que bater como card próprio — se a
    // pessoa está procurando/vendo por foto, agrupar dentro de "a partir de"
    // esconderia justamente a opção que ela procurou. Fora de busca, mantém
    // só pai/avulso na grade (variantes viram pills dentro do card).
  } else {
    query = query.is("produto_pai_id", null);
  }

  if (filtros?.departamento) {
    // Departamento é um agrupamento de categorias mantido no banco (tabela
    // departamentos, editável no app Gestor), não uma coluna própria de
    // produtos — resolve as categorias daquele departamento primeiro. Se
    // nada for encontrado, não filtra (degrada pra "todos" em vez de
    // silenciosamente devolver zero produtos).
    const categoriasDoDept = await getCategoriasDoDepartamento(empresaId, filtros.departamento);
    if (categoriasDoDept.length > 0) {
      query = query.in("categoria", categoriasDoDept);
    }
  }
  if (filtros?.busca) {
    // Cada palavra vira um ilike separado (AND implícito do PostgREST) — assim
    // "racao salmao" bate em "Ração ... Sabor Salmão" mesmo fora de ordem/adjacência.
    const palavras = normalizarBusca(filtros.busca).split(/\s+/).filter(Boolean);
    for (const palavra of palavras) {
      query = query.ilike("nome_busca", `%${palavra}%`);
    }
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
    .select("id, nome, preco, preco_promocional, produto_pai_id, variante_label")
    .eq("empresa_id", empresaId)
    .not("produto_pai_id", "is", null);

  if (error) {
    console.error("Erro ao buscar variantes:", error.message);
    return porPai;
  }

  const comChave: { paiId: string; variante: VarianteProduto; chave: number }[] = [];
  for (const linha of data ?? []) {
    if (!linha.produto_pai_id || !paiIdsSet.has(linha.produto_pai_id)) continue;
    const { rotulo, chave } = rotuloEChaveVariante(linha);
    comChave.push({
      paiId: linha.produto_pai_id,
      chave,
      variante: {
        id: linha.id,
        rotulo,
        preco: linha.preco,
        preco_promocional: linha.preco_promocional,
      },
    });
  }

  comChave.sort((a, b) => a.chave - b.chave || a.variante.rotulo.localeCompare(b.variante.rotulo));
  for (const { paiId, variante } of comChave) {
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
    .select("id, nome, preco, preco_promocional, variante_label")
    .eq("empresa_id", empresaId)
    .or(`id.eq.${paiId},produto_pai_id.eq.${paiId}`);

  if (error) {
    console.error("Erro ao buscar variantes do produto:", error.message);
    return [];
  }
  if (!data || data.length < 2) return [];

  return data
    .map((linha) => {
      const { rotulo, chave } = rotuloEChaveVariante(linha);
      return {
        chave,
        variante: {
          id: linha.id,
          rotulo,
          preco: linha.preco,
          preco_promocional: linha.preco_promocional,
        } satisfies VarianteProduto,
      };
    })
    .sort((a, b) => a.chave - b.chave || a.variante.rotulo.localeCompare(b.variante.rotulo))
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

export interface DepartamentoComContagem {
  nome: string;
  total: number;
  categorias: { categoria: string; total: number }[];
}

interface LinhaDepartamentoPublico {
  departamento_nome: string | null;
  departamento_ordem: number | null;
  categoria_nome: string;
  categoria_ordem: number | null;
}

/**
 * Mapa departamento -> categorias vindo da view `catalogo_departamentos_publico`
 * (banco, editável via app Gestor — telas de Categorias/Departamentos). Uma
 * categoria sem departamento ainda atribuído volta com `departamento_nome:
 * null`; quem consome isso deve tratar como "Outros", nunca descartar.
 */
async function getMapaDepartamentos(empresaId: string): Promise<LinhaDepartamentoPublico[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_departamentos_publico")
    .select("departamento_nome, departamento_ordem, categoria_nome, categoria_ordem")
    .eq("empresa_id", empresaId)
    .order("departamento_ordem", { ascending: true, nullsFirst: false })
    .order("categoria_ordem", { ascending: true });

  if (error) {
    console.error("Erro ao buscar mapa de departamentos:", error.message);
    return [];
  }
  return data ?? [];
}

async function getCategoriasDoDepartamento(empresaId: string, departamento: string): Promise<string[]> {
  const mapa = await getMapaDepartamentos(empresaId);
  return mapa.filter((l) => l.departamento_nome === departamento).map((l) => l.categoria_nome);
}

/**
 * Agrupa getCategoriasComContagem (contagem real de produtos visíveis) pelo
 * mapa de departamentos do banco — é o que alimenta o menu de 2 níveis do
 * site (departamento na linha principal, subcategoria como refinamento).
 * Categoria sem departamento cai num "Outros" sintético, pra nunca sumir do
 * menu enquanto ninguém atribuir um departamento a ela no Gestor.
 */
export async function getDepartamentosComContagem(
  empresaId: string,
): Promise<DepartamentoComContagem[]> {
  const [mapa, categorias] = await Promise.all([
    getMapaDepartamentos(empresaId),
    getCategoriasComContagem(empresaId),
  ]);

  const contagemPorCategoria = new Map(categorias.map((c) => [c.categoria, c.total]));

  const ordemDepartamentos: string[] = [];
  const porDepartamento = new Map<string, { categoria: string; total: number }[]>();
  for (const linha of mapa) {
    const total = contagemPorCategoria.get(linha.categoria_nome) ?? 0;
    if (total === 0) continue; // categoria mapeada mas sem produto visível agora
    const nome = linha.departamento_nome ?? "Outros";
    if (!porDepartamento.has(nome)) {
      porDepartamento.set(nome, []);
      ordemDepartamentos.push(nome);
    }
    porDepartamento.get(nome)!.push({ categoria: linha.categoria_nome, total });
  }

  return ordemDepartamentos.map((nome) => {
    const itens = porDepartamento.get(nome)!;
    return { nome, total: itens.reduce((s, i) => s + i.total, 0), categorias: itens };
  });
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
