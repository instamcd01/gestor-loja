"use client";

import { useRef } from "react";

const DEBOUNCE_MS = 450;

/**
 * Agrupa cliques rápidos de +/- num mesmo item numa chamada só ao
 * servidor, em vez de uma por clique — a UI já muda na hora (otimista),
 * isso só evita inundar o servidor e evita a resposta de um clique
 * antigo sobrescrever a UI já adiantada por um clique mais recente.
 *
 * flushTudo() dispara na hora qualquer sincronização ainda pendente (sem
 * esperar os 450ms) e só resolve quando todas terminarem — chamado antes
 * de qualquer ação que dependa do carrinho já estar salvo no banco (ir
 * pro carrinho, finalizar pedido). Sem isso, uma mudança de quantidade
 * feita nos últimos instantes se perdia: a próxima tela/o pedido lia o
 * banco antes do debounce disparar sozinho.
 */
export function useDebounceQuantidade() {
  const pendentes = useRef(
    new Map<string, { timer: ReturnType<typeof setTimeout>; fn: () => Promise<void> | void }>(),
  );

  function agendar(itemId: string, fn: () => Promise<void> | void) {
    const atual = pendentes.current.get(itemId);
    if (atual) clearTimeout(atual.timer);
    const timer = setTimeout(() => {
      pendentes.current.delete(itemId);
      fn();
    }, DEBOUNCE_MS);
    pendentes.current.set(itemId, { timer, fn });
  }

  async function flushTudo() {
    const agendados = Array.from(pendentes.current.values());
    pendentes.current.clear();
    await Promise.all(
      agendados.map(({ timer, fn }) => {
        clearTimeout(timer);
        return fn();
      }),
    );
  }

  return { agendar, flushTudo };
}
