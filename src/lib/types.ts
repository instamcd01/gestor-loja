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
  aceita_retirada: boolean;
  mostrar_estoque_baixo: boolean;
  /** Chaves: visa, mastercard, elo, amex, hipercard, diners — só exibição, sem validação real. */
  bandeiras_aceitas: string[] | null;
  /** Taxa de juros (%) por quantidade de parcelas no crédito, ex: {"1": 0, "2": 3.5} — só as chaves presentes são oferecidas. */
  taxas_parcelamento: Record<string, number> | null;
  /** Abaixo disso, a parcela (2x em diante) não é oferecida no checkout. */
  valor_minimo_parcela: number;
}

/** O que aparece numa posição configurável de marca (header/sidebar do site) — url null = mostrar o nome da empresa em texto. */
export interface MarcaPosicaoCatalogo {
  modo: "texto" | "imagem";
  url: string | null;
}

export interface BannerCatalogo {
  id: string;
  empresa_id: string;
  tipo: "imagem" | "video";
  url: string;
  url_thumbnail: string | null;
  titulo: string | null;
  link_destino: string | null;
  ordem: number;
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
  /** Soma do estoque real (view já filtra produto com 0) — usado pra limitar a quantidade no carrinho. */
  estoque_disponivel: number;
}

/** Uma variante (peso/tamanho) de um produto-pai, pra montar as pills de seleção. */
export interface VarianteProduto {
  id: string;
  nome: string;
  rotulo: string;
  preco: number;
  preco_promocional: number | null;
  estoque_disponivel: number;
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
  produto: {
    nome: string;
    imagem_url: string | null;
    categoria: string | null;
    subcategoria: string | null;
    fabricante: string | null;
    estoque_disponivel: number;
  } | null;
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
  /** Faixa configurada na zona (Configuração de Entrega no app) — mesma usada na venda presencial pra gravar a previsão do pedido. */
  estimativa_min_min: number | null;
  estimativa_min_max: number | null;
}
