export interface Departamento {
  nome: string;
  categorias: string[];
}

/**
 * Agrupamento de categorias em departamentos pro menu do site — mapeamento
 * fixo em código, não uma tabela no banco (a tabela `categorias` existe mas
 * não é lida por nada no site, ver comentário em getCategoriasComContagem).
 * Categoria fora de todas as listas abaixo cai em "Outros" na navegação
 * (ver getDepartamentosComContagem em catalogo.ts) — rede de segurança pra
 * uma categoria nova/ainda não classificada não sumir do menu, não pra uso
 * normal do dia a dia.
 */
export const DEPARTAMENTOS: Departamento[] = [
  {
    nome: "Alimentação",
    categorias: [
      "Ração para Cães",
      "Ração para Gatos",
      "Petiscos para Cães",
      "Petiscos para Gatos",
      "Sachês para Cães",
      "Sachês para Gatos",
      "Alimento Terapêutico",
    ],
  },
  {
    nome: "Saúde e Bem-estar",
    categorias: ["Farmácia", "Antipulgas Cães", "Antipulgas Gatos", "Vermífugos", "Dermatológicos"],
  },
  {
    nome: "Higiene e Limpeza",
    categorias: [
      "Areia Sanitária",
      "Shampoos e Perfumes",
      "Tapetes Higiênicos",
      "Limpeza da Casa",
      "Controle de Pragas",
    ],
  },
  {
    nome: "Casa e Conforto",
    categorias: ["Camas e Colchonetes", "Brinquedos e Acessórios"],
  },
  {
    nome: "Outros Animais",
    categorias: ["Pássaros", "Roedores", "Peixes"],
  },
  {
    nome: "Conveniência",
    categorias: ["Conveniência"],
  },
];

/** Departamento dono de uma categoria, ou null se não mapeada. */
export function departamentoDaCategoria(categoria: string): string | null {
  return DEPARTAMENTOS.find((d) => d.categorias.includes(categoria))?.nome ?? null;
}
