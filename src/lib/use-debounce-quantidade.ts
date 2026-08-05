"use client";

import { useRef } from "react";

const DEBOUNCE_MS = 450;

/**
 * Agrupa cliques rápidos de +/- num mesmo item numa chamada só ao
 * servidor, em vez de uma por clique — a UI já muda na hora (otimista),
 * isso só evita inundar o servidor e evita a resposta de um clique
 * antigo sobrescrever a UI já adiantada por um clique mais recente.
 */
export function useDebounceQuantidade() {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  return function agendar(itemId: string, fn: () => void) {
    const timerAtual = timers.current.get(itemId);
    if (timerAtual) clearTimeout(timerAtual);
    timers.current.set(
      itemId,
      setTimeout(() => {
        timers.current.delete(itemId);
        fn();
      }, DEBOUNCE_MS),
    );
  };
}
