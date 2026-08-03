"use client";

/**
 * Sinal leve de "o carrinho mudou" — usado pelo badge de contagem no
 * cabeçalho (`CarrinhoLink`) pra saber quando refazer a contagem, sem
 * precisar de uma lib de estado global só pra isso. Cobre os dois casos
 * (convidado e logado): `carrinho-convidado.ts` dispara isso junto do seu
 * próprio pub-sub interno, e as ações que mexem no carrinho logado
 * (adicionar, alterar quantidade, remover) disparam direto.
 */
const EVENTO_CARRINHO_ATUALIZADO = "gestor:carrinho-atualizado";

export function notificarCarrinhoAtualizado() {
  window.dispatchEvent(new Event(EVENTO_CARRINHO_ATUALIZADO));
}

export function assinarCarrinhoAtualizado(callback: () => void) {
  window.addEventListener(EVENTO_CARRINHO_ATUALIZADO, callback);
  return () => window.removeEventListener(EVENTO_CARRINHO_ATUALIZADO, callback);
}
