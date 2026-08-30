"use client";

import { useLayoutEffect, type RefObject } from "react";

const CSS_VAR = "--altura-barra-fixa-carrinho";

// Mesmos números usados no tamanho/posição do WhatsappSuporteButton
// (h-14 = 3.5rem, gap acima da barra = 1.25rem) — centralizados aqui em
// vez de repetidos em cada lugar que precisa reservar espaço pra ele, pra
// não desalinhar de novo se algum dia mudar só num lugar.
const GAP_ACIMA_DA_BARRA = "1.25rem";
const ALTURA_BOTAO_WHATSAPP = "3.5rem";

/** Onde o WhatsappSuporteButton deve ficar (`bottom`) nas telas de checkout. */
export const CALC_BOTTOM_BOTAO_WHATSAPP = `calc(var(${CSS_VAR}, 11rem) + ${GAP_ACIMA_DA_BARRA})`;

/** Espaço a reservar no fim do conteúdo rolável pra nem a barra fixa nem
 * o botão do WhatsApp por cima dela cobrirem a última linha (ex: o total). */
export const CALC_PADDING_RESERVADO_CHECKOUT = `calc(var(${CSS_VAR}, 11rem) + ${GAP_ACIMA_DA_BARRA} + ${ALTURA_BOTAO_WHATSAPP} + 1rem)`;

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
