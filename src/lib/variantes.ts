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
