/**
 * Tipos espelhando as views públicas do Supabase (catalogo_*_publico) —
 * não as tabelas reais, que ficam atrás de RLS restrito ao lojista.
 * Ver migração `catalogo_publico_views` no projeto Supabase.
 */

export interface EmpresaCatalogo {
  id: string;
  nome: string;
  catalogo_slug: string;
  catalogo_modelo: string;
  cor_primaria: string | null;
  cor_secundaria: string | null;
  logo_url: string | null;
  tema_preferido: string | null;
  whatsapp_catalogo: string | null;
  instagram: string | null;
  facebook: string | null;
  catalogo_info_extra: string | null;
  valor_minimo_pedido: number | null;
  metodos_pagamento_ativos: string[] | null;
  horario_funcionamento: Record<string, { abre?: string; fecha?: string; aberto?: boolean }> | null;
  aceita_pedidos_online: boolean;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  chave_pix: string | null;
}

export interface ProdutoCatalogo {
  id: string;
  empresa_id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  subcategoria: string | null;
  marca: string | null;
  preco: number;
  preco_promocional: number | null;
  imagem_url: string | null;
  unidade_medida: string | null;
  permite_fracionamento: boolean;
  destaque: boolean;
  produto_pai_id: string | null;
  imagem_url_secundaria: string | null;
  /** Eixo da variante ("peso", "dose", "sabor"...) — null se o produto não faz parte de uma família. */
  tipo_variacao: string | null;
  /** Valor deste produto dentro do eixo (ex: "3kg", "250mg", "Frango"). */
  variante_label: string | null;
}

/** Uma variante (peso/tamanho) de um produto-pai, pra montar as pills de seleção. */
export interface VarianteProduto {
  id: string;
  rotulo: string;
  preco: number;
  preco_promocional: number | null;
}

export interface CategoriaCatalogo {
  id: string;
  empresa_id: string;
  nome: string;
  ordem: number | null;
}

export interface ItemCarrinho {
  id: string;
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  produto: { nome: string; imagem_url: string | null; categoria: string | null } | null;
}

export interface Carrinho {
  id: string | null;
  itens: ItemCarrinho[];
  valorTotal: number;
}

export interface EnderecoCliente {
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  complemento: string | null;
  /** Coordenadas confirmadas (geocodificação ou geolocalização do navegador) — quando presentes, usadas no cálculo de distância em vez do texto do endereço, mais preciso pra ruas longas/numéricas. */
  lat: number | null;
  lng: number | null;
}

/** Um resultado possível ao geocodificar um endereço digitado — pode haver mais de um quando o nome se repete (ruas numéricas, bairros com nomes iguais em cidades diferentes etc). */
export interface CandidatoEndereco {
  formattedAddress: string;
  lat: number;
  lng: number;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
}

export interface OpcaoFrete {
  zona_id: string;
  zona_nome: string;
  valor: number;
  frete_gratis: boolean;
  valor_minimo_frete_gratis: number | null;
}
