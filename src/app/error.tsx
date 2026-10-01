"use client";

import { useEffect } from "react";
import { contextoChunkError, ehChunkLoadError, recarregarPorChunkError } from "@/lib/chunk-error";
import { reportarErroCliente } from "@/lib/erros-cliente";

/**
 * error.tsx é sempre client component (exigência do App Router). Loga
 * o erro real só no console — a mensagem pro usuário não expõe stack
 * trace nem detalhe técnico. Também reporta pro rastreamento caseiro
 * (registrarErroSistema, ver src/lib/erros.ts) via Server Action —
 * é assim que um erro capturado aqui (renderização) chega a virar
 * alerta pro lojista.
 *
 * Exceção: `ChunkLoadError` (ver lib/chunk-error.ts) recarrega a página
 * sozinho em vez de mostrar a tela de erro. Se acontecer de novo dentro de
 * 10s do último reload, mostra "conexão instável" com botão de recarregar
 * (o `reset()` não adianta: o arquivo JS precisa ser baixado de novo) e
 * reporta sem gerar notificação.
 */
export default function ErroGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunk = ehChunkLoadError(error);

  useEffect(() => {
    console.error(error);
    if (chunk) {
      if (recarregarPorChunkError()) return;
      reportarErroCliente(error.message, window.location.pathname, error.stack, contextoChunkError());
      return;
    }
    reportarErroCliente(error.message, window.location.pathname, error.stack);
  }, [error, chunk]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="text-sm font-medium text-black/40 dark:text-white/40">Erro</span>
      <h1 className="text-2xl font-semibold">{chunk ? "Conexão instável" : "Algo deu errado"}</h1>
      <p className="max-w-sm text-sm text-black/60 dark:text-white/60">
        {chunk
          ? "Não conseguimos carregar esta página. Confira sua internet e toque em recarregar."
          : "Não foi possível carregar essa página. Tente de novo em alguns instantes."}
      </p>
      <button
        type="button"
        onClick={chunk ? () => window.location.reload() : reset}
        className="mt-2 rounded-[var(--radius-sm)] bg-black px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black"
      >
        {chunk ? "Recarregar" : "Tentar novamente"}
      </button>
    </div>
  );
}
