"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Global (não recebe o slug do tenant — limitação do App Router pra
 * not-found.tsx). "Voltar" usa o histórico do navegador em vez de um
 * link fixo, então volta pro catálogo de quem quer que tenha entrado.
 */
export default function NaoEncontrado() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="text-sm font-medium text-black/40 dark:text-white/40">404</span>
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="max-w-sm text-sm text-black/60 dark:text-white/60">
        O link pode estar errado, ou a página não existe mais.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-[var(--radius-sm)] border border-black/10 px-5 py-2.5 text-sm font-medium dark:border-white/15"
        >
          ← Voltar
        </button>
        <Link
          href="/"
          className="rounded-[var(--radius-sm)] bg-black px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Início
        </Link>
      </div>
    </div>
  );
}
