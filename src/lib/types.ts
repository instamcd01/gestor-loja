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
  /** Prazo em minutos pra retirada ficar pronta — null = não mostra prazo nenhum. */
  retirada_prazo_min: number | null;
  mostrar_estoque_baixo: boolean;
  /** Chaves: visa, mastercard, elo, amex, hipercard, diners — só exibição, sem validação real. */
  bandeiras_aceitas: string[] | null;
  /** Taxa de juros (%) por quantidade de parcelas no crédito, ex: {"1": 0, "2": 3.5} — só as chaves presentes são oferecidas. */
  taxas_parcelamento: Record<string, number> | null;
  /** Abaixo disso, a parcela (2x em diante) não é oferecida no checkout. */
  valor_minimo_parcela: number;
  /** null = sem taxa de serviço configurada. Cobrada em qualquer pedido do site (entrega ou retirada). */
  taxa_servico_tipo: "percentual" | "fixo" | null;
  /** Percentual (ex: 5 = 5%) quando tipo é "percentual", ou valor em R$ quando "fixo". */
  taxa_servico_valor: number | null;
  /** Configurado pelo lojista (app Gestor) — "entrega" = comportamento de sempre (só métodos na entrega); "online"/"ambos" só valem de verdade se a loja já conectou o Mercado Pago (ver getMercadoPagoPublicKey). */
  pagamento_online_disponibilidade: "entrega" | "online" | "ambos";
  /** Pix pelo Mercado Pago cobra taxa (diferente do Pix manual, na entrega, que é grátis) — lojista pode desativar sem desconectar a conta inteira. */
  mp_pix_ativo: boolean;
  /** Cartão de Débito Virtual CAIXA no Brick — hoje só funciona com esse produto específico da CAIXA (não débito comum do banco do cliente), então o lojista pode esconder se isso estiver confundindo clientes. */
  mp_debito_ativo: boolean;
  /** PetCash — cashback automático em pedidos do site quando entregues. false = loja não credita PetCash novo (saldo já concedido continua gastável). */
  petcash_ativo: boolean;
  /** Percentual sobre o subtotal de produtos (nunca sobre frete/taxa) creditado como PetCash quando ativo. */
  petcash_percentual: number | null;
  /** Dias até um crédito de PetCash expirar, contados da data do crédito. */
  petcash_validade_dias: number;
  /** Teto de quanto do PetCash pode pagar um pedido, em % do valor do pedido. */
  petcash_uso_maximo_percentual: number;
  /** Valor mínimo do pedido pra poder usar PetCash como parte do pagamento. */
  petcash_pedido_minimo_uso: number;
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
  /** Versão recortada especificamente pra mobile (16:9), opcional — nula usa `url` (recorte central 21:9) também no mobile. */
  url_mobile: string | null;
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
    /** Preço de catálogo atual (pode ter mudado desde que o item entrou no carrinho) — usado só pra calcular "quanto você economizou" no resumo, não pro que é cobrado (isso é `preco_unitario`, travado na hora de adicionar). */
    preco: number;
    preco_promocional: number | null;
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
  /** O que seria cobrado NESTE cálculo — já vem 0 quando o subtotal usado na chamada bate o mínimo. Não confiável como "preço cheio" (ver valor_cheio). */
  valor: number;
  /** Valor cheio da zona, nunca zerado por frete grátis — use este pra saber "quanto custaria sem desconto", independente do subtotal usado no cálculo. */
  valor_cheio: number;
  frete_gratis: boolean;
  valor_minimo_frete_gratis: number | null;
  /** Faixa configurada na zona (Configuração de Entrega no app) — mesma usada na venda presencial pra gravar a previsão do pedido. */
  estimativa_min_min: number | null;
  estimativa_min_max: number | null;
  /** Modalidade "Econômica" (config única da loja, não por zona) — null = loja não configurou, não oferece essa modalidade. */
  economico_valor: number | null;
  economico_prazo_dias: number | null;
}
