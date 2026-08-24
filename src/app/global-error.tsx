"use client";

import { useEffect } from "react";
import { reportarErroCliente } from "@/lib/erros-cliente";

/**
 * Só dispara quando o erro acontece no PRÓPRIO root layout (fora do
 * alcance de error.tsx normal) — precisa renderizar <html>/<body> porque
 * substitui o root layout inteiro enquanto ativo. Caso raro, mas sem isso
 * um erro aí não gera nem tela de erro nem alerta nenhum.
 */
export default function ErroGlobalRaiz({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error(error);
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
