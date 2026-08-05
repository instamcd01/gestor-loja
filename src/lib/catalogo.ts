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
    especie?: string;
    fase?: string;
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
    // "Marca" aqui é a marca/fabricante de verdade (Vetnil, Ourofino,
    // Agener União...), coluna `fabricante` — não `produtos.marca`, que
    // nesse banco historicamente guarda o FORNECEDOR/distribuidora
    // (Tecnew, Seropec...), não a marca reconhecida pelo cliente.
    query = query.eq("fabricante", filtros.marca);
  }
  if (filtros?.especie) {
    // ilike substring: "Cães e Gatos" precisa bater tanto no filtro
    // "Cães" quanto no "Gatos", não só em correspondência exata.
    query = query.ilike("especie", `%${filtros.especie}%`);
  }
  if (filtros?.fase) {
    query = query.ilike("fase", `%${filtros.fase}%`);
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
 * Pra cada produto pedido (pai OU filho — a grade de busca mostra os dois
 * soltos, ver getProdutosCatalogo), devolve as OUTRAS opções da mesma
 * família (nunca inclui ele mesmo). Bug real corrigido aqui: a versão
 * antiga só agrupava filhos por `produto_pai_id`, então um card de FILHO
 * nunca sabia quem eram os irmãos dele (nem o próprio pai) — só o card do
 * pai mostrava as pills. Ex. real: busca por "Quatree Gourmet" trazia 3
 * pesos soltos, só o de 3kg (o pai) mostrava as outras opções.
 *
 * Busca em duas etapas pra continuar sem `.in(paiIds)` no catálogo inteiro
 * (List muito grande já estourou o limite de tamanho de URL antes, ver
 * commit anterior): 1) todos os filhos da empresa sem filtro de id (só
 * essa lista é potencialmente grande, mas não tem outro jeito de saber
 * quem é filho de quem sem trazer todos); 2) só as âncoras realmente
 * referenciadas por eles, que é uma lista pequena (uma por família).
 */
export async function getVariantesEmLote(
  empresaId: string,
  produtos: Pick<ProdutoCatalogo, "id" | "produto_pai_id">[],
): Promise<Map<string, VarianteProduto[]>> {
  const resultado = new Map<string, VarianteProduto[]>();
  if (produtos.length === 0) return resultado;

  const familiaDoProduto = new Map<string, string>();
  for (const p of produtos) {
    familiaDoProduto.set(p.id, p.produto_pai_id ?? p.id);
  }
  const familiasPedidas = new Set(familiaDoProduto.values());

  const supabase = await createClient();
  const { data: filhos, error: erroFilhos } = await supabase
    .from("catalogo_produtos_publico")
    .select("id, nome, preco, preco_promocional, produto_pai_id, variante_label, estoque_disponivel")
    .eq("empresa_id", empresaId)
    .not("produto_pai_id", "is", null);

  if (erroFilhos) {
    console.error("Erro ao buscar variantes:", erroFilhos.message);
    return resultado;
  }

  const ancorasReferenciadas = [
    ...new Set((filhos ?? []).map((f) => f.produto_pai_id).filter((id): id is string => !!id)),
  ].filter((id) => familiasPedidas.has(id));

  const { data: ancoras, error: erroAncoras } =
    ancorasReferenciadas.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("catalogo_produtos_publico")
          .select("id, nome, preco, preco_promocional, produto_pai_id, variante_label, estoque_disponivel")
          .in("id", ancorasReferenciadas);

  if (erroAncoras) {
    console.error("Erro ao buscar âncoras de variante:", erroAncoras.message);
    return resultado;
  }

  const membrosPorFamilia = new Map<string, { rotulo: string; chave: number; variante: VarianteProduto }[]>();
  for (const linha of [...(ancoras ?? []), ...(filhos ?? [])]) {
    const familiaId = linha.produto_pai_id ?? linha.id;
    if (!familiasPedidas.has(familiaId)) continue;
    const { rotulo, chave } = rotuloEChaveVariante(linha);
    const item = {
      rotulo,
      chave,
      variante: {
        id: linha.id,
        nome: linha.nome,
        rotulo,
        preco: linha.preco,
        preco_promocional: linha.preco_promocional,
        estoque_disponivel: linha.estoque_disponivel,
      },
    };
    const lista = membrosPorFamilia.get(familiaId) ?? [];
    lista.push(item);
    membrosPorFamilia.set(familiaId, lista);
  }
  for (const membros of membrosPorFamilia.values()) {
    membros.sort((a, b) => a.chave - b.chave || a.rotulo.localeCompare(b.rotulo));
  }

  for (const p of produtos) {
    const familiaId = familiaDoProduto.get(p.id)!;
    const membros = membrosPorFamilia.get(familiaId);
    if (!membros) continue;
    resultado.set(
      p.id,
      membros.filter((m) => m.variante.id !== p.id).map((m) => m.variante),
    );
  }

  return resultado;
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
    .select("id, nome, preco, preco_promocional, variante_label, estoque_disponivel")
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
          nome: linha.nome,
          rotulo,
          preco: linha.preco,
          preco_promocional: linha.preco_promocional,
          estoque_disponivel: linha.estoque_disponivel,
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

/**
 * "Marca" pro cliente é a marca/fabricante de verdade (Vetnil, Ourofino,
 * Agener União...) — lê `fabricante`, não `produtos.marca`, que nesse
 * banco historicamente guarda o FORNECEDOR/distribuidora (Tecnew,
 * Seropec, Pet2Pet...), não uma marca que o cliente reconheceria (ver
 * [[gestor_padrao_nome_produto]]). Mantém o nome da função/formato de
 * retorno (`marca`) porque é assim que a UI já trata o conceito.
 */
export async function getMarcasComContagem(
  empresaId: string,
): Promise<{ marca: string; total: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_produtos_publico")
    .select("fabricante")
    .eq("empresa_id", empresaId)
    .is("produto_pai_id", null)
    .not("fabricante", "is", null);

  if (error) {
    console.error("Erro ao buscar marcas com contagem:", error.message);
    return [];
  }

  const contagem = new Map<string, number>();
  for (const { fabricante } of data ?? []) {
    if (!fabricante) continue;
    contagem.set(fabricante, (contagem.get(fabricante) ?? 0) + 1);
  }

  return [...contagem.entries()]
    .map(([marca, total]) => ({ marca, total }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Espécie/fase são texto livre no banco ("Cães", "Cães e Gatos", "Cães
 * Geriátricos", "Adultos", "Sênior +7"...) — em vez de listar cada
 * variação como filtro próprio (péssima UX, dezenas de opções quase
 * iguais), usa um conjunto fixo de rótulos que o cliente reconhece e
 * conta via substring (ilike), a mesma lógica do filtro em getProdutosCatalogo.
 */
const ESPECIES_FILTRO = ["Cães", "Gatos"];
const FASES_FILTRO = ["Filhotes", "Adultos", "Sênior", "Castrados"];

export async function getEspeciesComContagem(
  empresaId: string,
): Promise<{ especie: string; total: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_produtos_publico")
    .select("especie")
    .eq("empresa_id", empresaId)
    .is("produto_pai_id", null)
    .not("especie", "is", null);

  if (error) {
    console.error("Erro ao buscar espécies com contagem:", error.message);
    return [];
  }

  const valores = (data ?? []).map((linha) => linha.especie ?? "");
  return ESPECIES_FILTRO.map((especie) => ({
    especie,
    total: valores.filter((v) => v.toLowerCase().includes(especie.toLowerCase())).length,
  })).filter((linha) => linha.total > 0);
}

export async function getFasesComContagem(
  empresaId: string,
): Promise<{ fase: string; total: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_produtos_publico")
    .select("fase")
    .eq("empresa_id", empresaId)
    .is("produto_pai_id", null)
    .not("fase", "is", null);

  if (error) {
    console.error("Erro ao buscar fases com contagem:", error.message);
    return [];
  }

  const valores = (data ?? []).map((linha) => linha.fase ?? "");
  return FASES_FILTRO.map((fase) => ({
    fase,
    total: valores.filter((v) => v.toLowerCase().includes(fase.toLowerCase())).length,
  })).filter((linha) => linha.total > 0);
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
