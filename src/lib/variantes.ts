/**
 * Extrai o peso/tamanho do final do nome do produto (ex: "...3KG" -> {rotulo:"3kg", gramas:3000}).
 * Mesma regex usada na migração que populou `produtos.produto_pai_id` — precisa
 * ficar em sincronia se algum dia mudar o agrupamento no banco.
 */
const REGEX_PESO = /\s+(\d+(?:[.,]\d+)?)\s*(KG|G)\.?\s*$/i;

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
