/**
 * Carrinho de visitante (sem login), guardado só no navegador —
 * permite navegar e montar o carrinho sem exigir telefone/OTP. O login
 * só é pedido na hora de finalizar o pedido (ver mesclarCarrinhoConvidado
 * em carrinho.ts, chamado pelo LoginForm depois do OTP confirmado).
 *
 * Preço/nome/imagem aqui são só pra exibição — o valor cobrado de
 * verdade é sempre recalculado a partir de `catalogo_produtos_publico`
 * no momento de mesclar com o carrinho real, nunca confiando no que
 * está salvo aqui (mesmo princípio já usado em finalizar_pedido_site).
 */

import { notificarCarrinhoAtualizado } from "@/lib/carrinho-eventos";

export type ItemCarrinhoConvidado = {
  produtoId: string;
  nome: string;
  imagemUrl: string | null;
  categoria: string | null;
  preco: number;
  /** Preço de catálogo original quando `preco` já é o promocional — null = não está em promoção. Só pra mostrar "quanto economizou" no resumo. */
  precoOriginal: number | null;
  quantidade: number;
  /** Estoque no momento em que foi adicionado — usado só pra limitar o stepper aqui no navegador; revalidado de verdade contra o catálogo ao logar (mesclarCarrinhoConvidado) e de novo no checkout. */
  estoqueDisponivel: number;
};

function chave(empresaId: string) {
  return `gestor_carrinho_convidado_${empresaId}`;
}

export function lerCarrinhoConvidado(empresaId: string): ItemCarrinhoConvidado[] {
  if (typeof window === "undefined") return [];
  try {
    const bruto = window.localStorage.getItem(chave(empresaId));
    return bruto ? (JSON.parse(bruto) as ItemCarrinhoConvidado[]) : [];
  } catch {
    return [];
  }
}

// Suporte a useSyncExternalStore (CarrinhoConvidado): getSnapshot precisa
// devolver a MESMA referência enquanto o localStorage não mudar, senão o
// React acha que a store está sempre mudando e entra em loop de render.
// Por isso o cache guarda o texto bruto junto com o array já parseado.
let snapshotCache: { empresaId: string; bruto: string | null; itens: ItemCarrinhoConvidado[] } | null = null;
const ouvintes = new Set<() => void>();

function notificarOuvintes() {
  for (const ouvinte of ouvintes) ouvinte();
}

export function assinarCarrinhoConvidado(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

const CARRINHO_VAZIO: ItemCarrinhoConvidado[] = [];

export function obterSnapshotServidorCarrinhoConvidado(): ItemCarrinhoConvidado[] {
  return CARRINHO_VAZIO;
}

export function obterSnapshotCarrinhoConvidado(empresaId: string): ItemCarrinhoConvidado[] {
  if (typeof window === "undefined") return CARRINHO_VAZIO;
  const bruto = window.localStorage.getItem(chave(empresaId));
  if (snapshotCache && snapshotCache.empresaId === empresaId && snapshotCache.bruto === bruto) {
    return snapshotCache.itens;
  }
  // getSnapshot roda dentro do render do React — um JSON corrompido aqui
  // (extensão de navegador, edição manual, escrita parcial) não pode
  // derrubar a página inteira, precisa cair pro carrinho vazio.
  let itens: ItemCarrinhoConvidado[];
  try {
    itens = bruto ? (JSON.parse(bruto) as ItemCarrinhoConvidado[]) : [];
  } catch {
    itens = CARRINHO_VAZIO;
  }
  snapshotCache = { empresaId, bruto, itens };
  return itens;
}

function salvarCarrinhoConvidado(empresaId: string, itens: ItemCarrinhoConvidado[]) {
  window.localStorage.setItem(chave(empresaId), JSON.stringify(itens));
  notificarOuvintes();
  notificarCarrinhoAtualizado();
}

export function adicionarItemConvidado(
  empresaId: string,
  item: Omit<ItemCarrinhoConvidado, "quantidade"> & { quantidade: number },
) {
  const itens = lerCarrinhoConvidado(empresaId);
  const existente = itens.find((i) => i.produtoId === item.produtoId);
  if (existente) {
    existente.quantidade = Math.min(existente.quantidade + item.quantidade, existente.estoqueDisponivel);
  } else {
    itens.push({ ...item, quantidade: Math.min(item.quantidade, item.estoqueDisponivel) });
  }
  salvarCarrinhoConvidado(empresaId, itens);
  return itens;
}

export function atualizarItemConvidado(empresaId: string, produtoId: string, quantidade: number) {
  let itens = lerCarrinhoConvidado(empresaId);
  if (quantidade <= 0) {
    itens = itens.filter((i) => i.produtoId !== produtoId);
  } else {
    const item = itens.find((i) => i.produtoId === produtoId);
    if (item) item.quantidade = Math.min(quantidade, item.estoqueDisponivel);
  }
  salvarCarrinhoConvidado(empresaId, itens);
  return itens;
}

export function limparCarrinhoConvidado(empresaId: string) {
  window.localStorage.removeItem(chave(empresaId));
}
