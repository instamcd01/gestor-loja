"use client";

import { useState } from "react";

/**
 * Mesma ação do ícone "Esvaziar carrinho" no app (carrinho_screen.dart),
 * mas com confirmação inline antes de excluir — o app apaga na hora e só
 * avisa depois (SnackBar), aceitável numa ferramenta interna de
 * funcionário; aqui, com dinheiro/pedido real do cliente final, confirma
 * antes, mesmo padrão já usado pra remover item na gaveta.
 */
export function LimparCarrinhoButton({ onConfirmar }: { onConfirmar: () => void | Promise<void> }) {
  const [confirmando, setConfirmando] = useState(false);
  const [processando, setProcessando] = useState(false);

  if (confirmando) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-black/60 dark:text-white/60">Esvaziar carrinho?</span>
        <button
          type="button"
          disabled={processando}
          onClick={async () => {
            setProcessando(true);
            await onConfirmar();
          }}
          className="rounded-full bg-[var(--color-danger)] px-2.5 py-1 font-medium text-white disabled:opacity-50"
        >
          {processando ? "..." : "Sim"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="rounded-full border border-black/10 px-2.5 py-1 font-medium dark:border-white/10"
        >
          Não
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirmando(true)}
      className="flex items-center gap-1.5 text-xs text-black/50 hover:text-[var(--color-danger)] dark:text-white/50"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m1 0-.8 12.2a2 2 0 0 1-2 1.8H8.8a2 2 0 0 1-2-1.8L6 7h12Z"
        />
      </svg>
      Esvaziar carrinho
    </button>
  );
}
