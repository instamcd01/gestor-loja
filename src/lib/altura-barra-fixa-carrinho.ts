"use client";

import { useLayoutEffect, type RefObject } from "react";

const CSS_VAR = "--altura-barra-fixa-carrinho";

/**
 * Reporta a altura real da barra fixa de total/confirmar (varia com o
 * indicador de frete grátis, texto que quebra linha em telas estreitas,
 * qual etapa do checkout) numa CSS var global, pra WhatsappSuporteButton
 * se posicionar sempre colado nela em vez de um valor fixo chutado —
 * `bottom-44` já ficou curto de novo (ver comentário em
 * whatsapp-suporte-button.tsx sobre essa mesma classe de bug).
 */
export function useReportarAlturaBarraFixaCarrinho(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;

    function atualizar() {
      document.documentElement.style.setProperty(CSS_VAR, `${elemento!.offsetHeight}px`);
    }

    atualizar();
    const observer = new ResizeObserver(atualizar);
    observer.observe(elemento);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty(CSS_VAR);
    };
  }, [ref]);
}
