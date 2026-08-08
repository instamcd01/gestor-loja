import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  BannerCatalogo,
  CategoriaCatalogo,
  EmpresaCatalogo,
  MarcaPosicaoCatalogo,
  ProdutoCatalogo,
  VarianteProduto,
} from "@/lib/types";
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

/**
 * `cache()` do React (dedup só DENTRO da mesma requisição, nunca entre
 * requisições diferentes — sem risco de dado desatualizado) — toda página
 * dentro de `/loja/[slug]` chama isso pelo menos 2x (`layout.tsx` +
 * `generateMetadata`/o próprio componente da página), sempre buscando
 * exatamente o mesmo registro. Sem esse cache, cada carregamento de
 * página fazia 2-3 idas idênticas ao Postgres só pra dados da empresa —
 * achado investigando TTFB de ~1,4s reportado como "site ainda lento"
 * mesmo depois de zerar o loop de auth e unificar os filtros da home.
 */
export const getEmpresaPorSlug = cache(async (slug: string): Promise<EmpresaCatalogo | null> => {
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
});

export async function getBannersCatalogo(empresaId: string): Promise<BannerCatalogo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_banners_publico")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("ordem");

  if (error) {
    console.error("Erro ao buscar banners:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * O que mostrar em cada posição de marca do site (header/sidebar) — kit de
 * marca configurado no app Gestor (Configurações > Kit de Marca, só dono).
 * `catalogo_marca_publico` já resolve o join posição→ativo; posição sem
 * linha configurada (empresa nunca abriu a tela) cai no default abaixo.
 */
export async function getMarcaCatalogo(
  empresaId: string,
): Promise<Record<"site_header" | "site_sidebar", MarcaPosicaoCatalogo>> {
  const padrao: Record<"site_header" | "site_sidebar", MarcaPosicaoCatalogo> = {
    site_header: { modo: "texto", url: null },
    site_sidebar: { modo: "texto", url: null },
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_marca_publico")
    .select("posicao, modo, url")
    .eq("empresa_id", empresaId);

  if (error) {
    console.error("Erro ao buscar kit de marca:", error.message);
    return padrao;
  }

  for (const linha of data ?? []) {
    const posicao: string = linha.posicao;
    if (posicao === "site_header" || posicao === "site_sidebar") {
      padrao[posicao] = { modo: linha.modo, url: linha.url };
    }
  }
  return padrao;
}

/**
 * Só a contagem (head:true, zero linhas trafegadas) — usada no resumo
 * "X produtos" da home/tela de espécie SEM outro filtro, onde
 * `getProdutosHomeAgrupados` já traz uma amostra por categoria, não o
 * catálogo inteiro (ver comentário lá). `especie` opcional restringe a
 * mesma contagem pras telas de Cães/Gatos/Pássaros/Outros. Com filtro de
 * categoria/departamento/busca ativo, o componente usa `produtos.length`
 * direto, não esta função.
 */
export async function getContagemProdutosCatalogo(empresaId: string, especie?: string): Promise<number> {
  const supabase = await createClient();
  let query = supabase
    .from("catalogo_produtos_publico")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .is("produto_pai_id", null);

  if (especie) {
    query = query.ilike("especie", `%${especie}%`);
  }

  const { count, error } = await query;

  if (error) {
    console.error("Erro ao contar produtos do catálogo:", error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Home do catálogo (ou tela de espécie Cães/Gatos/Pássaros/Outros) SEM
 * outro filtro: em vez de trazer os ~424 produtos-pai da empresa inteira
 * pra montar as seções por categoria (o que a página fazia antes — todo o
 * catálogo renderizado de uma vez, achado como a causa real de lentidão
 * persistente mesmo depois de otimizar as demais consultas), traz só as
 * `limitePorCategoria` primeiras opções de CADA categoria (ordenadas por
 * destaque/nome, mesmo critério do catálogo completo) numa única ida ao
 * banco — RPC `catalogo_produtos_home` usa `row_number() over (partition
 * by categoria ...)` no Postgres em vez de N consultas (uma por
 * categoria) ou trazer tudo pra filtrar em JS. `especie` opcional (mesmo
 * `ilike` de substring já usado em `getProdutosCatalogo`) restringe as
 * linhas às espécies daquele animal. Categoria inteira só é buscada por
 * completo quando o cliente clica em "Ver mais" (cai no fluxo já
 * existente de `?categoria=`, preservando `?especie=` quando presente).
 */
export async function getProdutosHomeAgrupados(
  empresaId: string,
  limitePorCategoria = 10,
  especie?: string,
): Promise<ProdutoCatalogo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("catalogo_produtos_home", {
    p_empresa_id: empresaId,
    p_limite_por_categoria: limitePorCategoria,
    p_especie: especie ?? null,
  });

  if (error) {
    console.error("Erro ao buscar produtos da home:", error.message);
    return [];
  }
  return data ?? [];
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

/**
 * Espécie/fase são texto livre no banco ("Cães", "Cães e Gatos", "Cães
 * Geriátricos", "Adultos", "Sênior +7"...) — em vez de listar cada
 * variação como filtro próprio (péssima UX, dezenas de opções quase
 * iguais), usa um conjunto fixo de rótulos que o cliente reconhece e
 * conta via substring (ilike), a mesma lógica do filtro em getProdutosCatalogo.
 */
const ESPECIES_FILTRO = ["Cães", "Gatos", "Pássaros"];
const FASES_FILTRO = ["Filhotes", "Adultos", "Sênior", "Castrados"];

export interface FiltrosCatalogo {
  faixasPreco: FaixaPreco[];
  marcas: { marca: string; total: number }[];
  especies: { especie: string; total: number }[];
  fases: { fase: string; total: number }[];
}

/**
 * Contagem pros 4 filtros da grade (preço/marca/espécie/fase) numa ÚNICA
 * consulta em vez de 4 separadas — as 4 antigas (`getFaixasPrecoComContagem`,
 * `getMarcasComContagem`, `getEspeciesComContagem`, `getFasesComContagem`)
 * liam exatamente a mesma tabela com o mesmo filtro (`empresa_id` +
 * "só produto-pai"), cada uma trazendo só 1 coluna — 4 idas ao Postgres
 * fazendo essencialmente o mesmo scan. Achado investigando TTFB de ~1,5s
 * na home do catálogo (reportado como "site lento"). Toda a agregação
 * continua em memória (JS), só a busca virou uma só.
 */
export async function getFiltrosCatalogo(empresaId: string): Promise<FiltrosCatalogo> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_produtos_publico")
    .select("preco, fabricante, especie, fase")
    .eq("empresa_id", empresaId)
    .is("produto_pai_id", null);

  if (error) {
    console.error("Erro ao buscar filtros do catálogo:", error.message);
    return { faixasPreco: [], marcas: [], especies: [], fases: [] };
  }

  const linhas = data ?? [];

  const faixasPreco = FAIXAS_PRECO_BASE.map((faixa) => ({
    ...faixa,
    total: linhas.filter(({ preco }) => preco >= faixa.min && (faixa.max == null || preco < faixa.max)).length,
  })).filter((faixa) => faixa.total > 0);

  // "Marca" pro cliente é a marca/fabricante de verdade (Vetnil, Ourofino,
  // Agener União...) — lê `fabricante`, não `produtos.marca`, que nesse
  // banco historicamente guarda o FORNECEDOR/distribuidora (Tecnew,
  // Seropec, Pet2Pet...), não uma marca que o cliente reconheceria (ver
  // [[gestor_padrao_nome_produto]]).
  const contagemMarcas = new Map<string, number>();
  for (const { fabricante } of linhas) {
    if (!fabricante) continue;
    contagemMarcas.set(fabricante, (contagemMarcas.get(fabricante) ?? 0) + 1);
  }
  const marcas = [...contagemMarcas.entries()]
    .map(([marca, total]) => ({ marca, total }))
    .sort((a, b) => b.total - a.total);

  const valoresEspecie = linhas.map((l) => l.especie ?? "");
  const especies = ESPECIES_FILTRO.map((especie) => ({
    especie,
    total: valoresEspecie.filter((v) => v.toLowerCase().includes(especie.toLowerCase())).length,
  })).filter((l) => l.total > 0);

  const valoresFase = linhas.map((l) => l.fase ?? "");
  const fases = FASES_FILTRO.map((fase) => ({
    fase,
    total: valoresFase.filter((v) => v.toLowerCase().includes(fase.toLowerCase())).length,
  })).filter((l) => l.total > 0);

  return { faixasPreco, marcas, especies, fases };
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
