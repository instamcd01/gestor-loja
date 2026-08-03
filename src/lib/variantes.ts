/**
 * Extrai o peso/tamanho do nome do produto (ex: "...3kg – PremieRpet" ->
 * {rotulo:"3kg", gramas:3000}). Não exige mais que o peso esteja no fim da
 * string — o padrão de nome atual (ver gestor_padrao_nome_produto) põe o
 * fabricante depois do peso ("... 10kg – Quatree"), então o peso fica no
 * meio. Continua exigindo espaço antes do número (evita casar um token
 * tipo "100mg" ou grudado em outra palavra).
 */
const REGEX_PESO = /\s+(\d+(?:[.,]\d+)?)\s*(KG|G)\b/i;

export function extrairPeso(nome: string): { rotulo: string; gramas: number } | null {
  const match = nome.match(REGEX_PESO);
  if (!match) return null;

  const [, valorTexto, unidadeTexto] = match;
  const valor = Number.parseFloat(valorTexto.replace(",", "."));
  const unidade = unidadeTexto.toUpperCase();
  const gramas = unidade === "KG" ? valor * 1000 : valor;
  const rotulo = `${valorTexto}${unidade.toLowerCase()}`;

  return { rotulo, gramas };
}

/**
 * Chave de ordenação genérica pra qualquer rótulo de variante (não só
 * peso): extrai o primeiro número do rótulo ("250mg" -> 250, "10kg" -> 10)
 * — correto porque todas as opções de uma mesma família compartilham a
 * mesma unidade (um produto nunca mistura "kg" com "mg" no mesmo eixo).
 * Rótulos sem número (sabor, cor...) vão pro fim, ordenados alfabeticamente
 * entre si pelo tie-break de `rotulo` que quem ordena deve aplicar depois.
 */
export function chaveOrdenacaoRotulo(rotulo: string): number {
  const match = rotulo.match(/(\d+(?:[.,]\d+)?)/);
  return match ? Number.parseFloat(match[1].replace(",", ".")) : Number.POSITIVE_INFINITY;
}

/** Texto do cabeçalho do seletor de variante, conforme o eixo detectado. */
export function rotuloSeletorVariante(tipoVariacao: string | null | undefined): string {
  switch (tipoVariacao) {
    case "peso":
      return "Escolha o peso";
    case "volume":
      return "Escolha o volume";
    case "dose":
      return "Escolha a dose";
    case "sabor":
      return "Escolha o sabor";
    case "apresentacao":
      return "Escolha a apresentação";
    default:
      return "Escolha o tamanho";
  }
}
