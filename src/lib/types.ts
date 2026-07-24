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
}

export interface OpcaoFrete {
  zona_id: string;
  zona_nome: string;
  valor: number;
  frete_gratis: boolean;
}
