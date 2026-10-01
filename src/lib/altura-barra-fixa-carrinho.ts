"use client";

import { useCallback, useRef } from "react";

const CSS_VAR = "--altura-barra-fixa-carrinho";

// Mesmos números usados no tamanho/posição do WhatsappSuporteButton
// (h-14 = 3.5rem, gap acima da barra = 1.25rem) — centralizados aqui em
// vez de repetidos em cada lugar que precisa reservar espaço pra ele, pra
// não desalinhar de novo se algum dia mudar só num lugar.
const GAP_ACIMA_DA_BARRA = "1.25rem";
const ALTURA_BOTAO_WHATSAPP = "3.5rem";

/** Onde o WhatsappSuporteButton deve ficar (`bottom`) nas telas de checkout.
 * Sem barra medida (carrinho vazio — a barra nem existe), fallback 0: o
 * botão desce pro canto (= `bottom-5`, igual às outras páginas). O
 * fallback antigo de 11rem deixava o botão flutuando no meio da tela com
 * o carrinho vazio (achado real 30/09). */
export const CALC_BOTTOM_BOTAO_WHATSAPP = `calc(var(${CSS_VAR}, 0px) + ${GAP_ACIMA_DA_BARRA})`;

/** Espaço a reservar no fim do conteúdo rolável pra nem a barra fixa nem
 * o botão do WhatsApp por cima dela cobrirem a última linha (ex: o total). */
export const CALC_PADDING_RESERVADO_CHECKOUT = `calc(var(${CSS_VAR}, 11rem) + ${GAP_ACIMA_DA_BARRA} + ${ALTURA_BOTAO_WHATSAPP} + 1rem)`;

/**
 * Reporta a altura real da barra fixa de total/confirmar (varia com o
 * indicador de frete grátis, texto que quebra linha em telas estreitas,
 * qual etapa do checkout) numa CSS var global, pra WhatsappSuporteButton
 * se posicionar sempre colado nela em vez de um valor fixo chutado.
 *
 * Callback ref (usar em `ref={...}` da barra), não `useLayoutEffect` com
 * RefObject: a versão antiga media uma vez só, na montagem — no carrinho
 * sem login os itens chegam do navegador DEPOIS, a barra aparece depois, e
 * nunca era medida (o fallback de 11rem escondia isso; achado real 30/09,
 * botão do WhatsApp ficou em cima do "Finalizar pedido"). O callback roda
 * sempre que a barra entra/sai da tela.
 */
export function useRefBarraFixaCarrinho() {
  const observerRef = useRef<ResizeObserver | null>(null);
  return useCallback((elemento: HTMLElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!elemento) {
      document.documentElement.style.removeProperty(CSS_VAR);
      return;
    }
    const atualizar = () => document.documentElement.style.setProperty(CSS_VAR, `${elemento.offsetHeight}px`);
    atualizar();
    const observer = new ResizeObserver(atualizar);
    observer.observe(elemento);
    observerRef.current = observer;
  }, []);
}
