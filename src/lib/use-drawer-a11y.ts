"use client";

import { useEffect, useRef } from "react";

const SELETOR_FOCAVEL =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Fecha com Esc e prende o Tab dentro do painel enquanto aberto — sem
 * isso, quem navega por teclado consegue tabular pra página por trás
 * enquanto o drawer ainda está visualmente por cima dela.
 */
export function useDrawerA11y(aberto: boolean, onFechar: () => void) {
  const painelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;

    const painel = painelRef.current;
    painel?.querySelector<HTMLElement>(SELETOR_FOCAVEL)?.focus();

    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onFechar();
        return;
      }
      if (e.key !== "Tab" || !painel) return;

      const lista = painel.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL);
      if (lista.length === 0) return;
      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];

      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  return painelRef;
}
