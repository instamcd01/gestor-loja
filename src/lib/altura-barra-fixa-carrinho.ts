"use client";

import { useCallback, useRef } from "react";

const CSS_VAR = "--altura-barra-fixa-carrinho";

/** Espaço a reservar no fim do conteúdo rolável pra barra fixa não cobrir
 * a última linha (ex: o total). O WhatsApp agora fica dentro da barra
 * (WhatsappBotaoBarra), não precisa mais de espaço próprio acima dela. */
export const CALC_PADDING_RESERVADO_CHECKOUT = `calc(var(${CSS_VAR}, 11rem) + 1rem)`;

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
      delete document.documentElement.dataset.barraCheckout;
      return;
    }
    // Esconde o WhatsApp flutuante enquanto a barra existe — o da barra
    // (WhatsappBotaoBarra) toma o lugar dele (regra em globals.css).
    document.documentElement.dataset.barraCheckout = "1";
    const atualizar = () => document.documentElement.style.setProperty(CSS_VAR, `${elemento.offsetHeight}px`);
    atualizar();
    const observer = new ResizeObserver(atualizar);
    observer.observe(elemento);
    observerRef.current = observer;
  }, []);
}
