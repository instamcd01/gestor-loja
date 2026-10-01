"use client";

import { useEffect } from "react";
import { contextoChunkError, ehChunkLoadError, recarregarPorChunkError } from "@/lib/chunk-error";
import { reportarErroCliente } from "@/lib/erros-cliente";

/**
 * Só dispara quando o erro acontece no PRÓPRIO root layout (fora do
 * alcance de error.tsx normal) — precisa renderizar <html>/<body> porque
 * substitui o root layout inteiro enquanto ativo. Caso raro, mas sem isso
 * um erro aí não gera nem tela de erro nem alerta nenhum.
 *
 * Mesma exceção de error.tsx pra `ChunkLoadError` — ver lib/chunk-error.ts.
 */
export default function ErroGlobalRaiz({
  error,
}: {
  error: Error & { digest?: string };
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
    <html lang="pt-BR">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-2xl font-semibold">{chunk ? "Conexão instável" : "Algo deu errado"}</h1>
          <p className="max-w-sm text-sm text-black/60">
            {chunk
              ? "Não conseguimos carregar o site. Confira sua internet e toque em recarregar."
              : "Não foi possível carregar o site. Tente de novo em alguns instantes."}
          </p>
          {chunk && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 rounded-[var(--radius-sm)] bg-black px-5 py-2.5 text-sm font-medium text-white"
            >
              Recarregar
            </button>
          )}
        </div>
      </body>
    </html>
  );
}
