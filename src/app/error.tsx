"use client";

import { useEffect } from "react";
import { ehChunkLoadError } from "@/lib/chunk-error";
import { reportarErroCliente } from "@/lib/erros-cliente";

const CHAVE_ULTIMO_RELOAD = "gestor-loja:chunk-reload-em";

/**
 * error.tsx é sempre client component (exigência do App Router). Loga
 * o erro real só no console — a mensagem pro usuário não expõe stack
 * trace nem detalhe técnico. Também reporta pro rastreamento caseiro
 * (registrarErroSistema, ver src/lib/erros.ts) via Server Action —
 * é assim que um erro capturado aqui (renderização) chega a virar
 * alerta de WhatsApp.
 *
 * Exceção: `ChunkLoadError` (ver lib/chunk-error.ts) recarrega a página
 * sozinho em vez de mostrar a tela de erro/alertar — só cai no fluxo normal
 * se acontecer de novo dentro de 10s do último reload (sinal de que não era
 * só um deploy no meio do caminho).
 */
export default function ErroGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    if (ehChunkLoadError(error)) {
      const ultimoReload = Number(sessionStorage.getItem(CHAVE_ULTIMO_RELOAD) ?? 0);
      if (Date.now() - ultimoReload > 10_000) {
        sessionStorage.setItem(CHAVE_ULTIMO_RELOAD, String(Date.now()));
        window.location.reload();
        return;
      }
    }
    reportarErroCliente(error.message, window.location.pathname, error.stack);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="text-sm font-medium text-black/40 dark:text-white/40">Erro</span>
      <h1 className="text-2xl font-semibold">Algo deu errado</h1>
      <p className="max-w-sm text-sm text-black/60 dark:text-white/60">
        Não foi possível carregar essa página. Tente de novo em alguns instantes.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-[var(--radius-sm)] bg-black px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black"
      >
        Tentar novamente
      </button>
    </div>
  );
}
