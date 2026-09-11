"use client";

import { useEffect } from "react";
import { ehChunkLoadError } from "@/lib/chunk-error";
import { reportarErroCliente } from "@/lib/erros-cliente";

const CHAVE_ULTIMO_RELOAD = "gestor-loja:chunk-reload-em";

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
    <html lang="pt-BR">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-2xl font-semibold">Algo deu errado</h1>
          <p className="max-w-sm text-sm text-black/60">
            Não foi possível carregar o site. Tente de novo em alguns instantes.
          </p>
        </div>
      </body>
    </html>
  );
}
