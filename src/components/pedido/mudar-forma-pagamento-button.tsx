"use client";

import { useState } from "react";
import { cancelarPagamentoPendente } from "@/lib/checkout";

/**
 * Só aparece pra pedido "Pagamento Online" ainda não pago (ver
 * `aguardandoPagamentoOnline` em pedido/[id]/page.tsx). Cancela o pedido
 * atual e reabre o carrinho com os mesmos itens — mesmo padrão de
 * confirmação inline do `LimparCarrinhoButton`, já que é uma ação real
 * (abandona o Pix/cartão em andamento) num pedido de verdade.
 */
export function MudarFormaPagamentoButton({ slug, pedidoId }: { slug: string; pedidoId: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (confirmando) {
    return (
      <div className="flex flex-col items-center gap-2 text-sm">
        <span className="text-black/60 dark:text-white/60">
          Isso cancela esse pagamento e leva você de volta pro carrinho pra escolher outra forma. Continuar?
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={processando}
            onClick={async () => {
              setProcessando(true);
              setErro(null);
              const resultado = await cancelarPagamentoPendente(slug, pedidoId);
              // se chegou aqui, deu erro — sucesso já redireciona e não retorna
              setProcessando(false);
              setErro(resultado.erro);
            }}
            className="rounded-full bg-[var(--color-danger)] px-3.5 py-1.5 font-medium text-white disabled:opacity-50"
          >
            {processando ? "..." : "Sim, mudar forma de pagamento"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className="rounded-full border border-black/10 px-3.5 py-1.5 font-medium dark:border-white/10"
          >
            Não
          </button>
        </div>
        {erro && <p className="text-xs text-[var(--color-danger)]">{erro}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirmando(true)}
      className="text-sm text-black/50 underline-offset-2 hover:underline dark:text-white/50"
    >
      Mudar forma de pagamento
    </button>
  );
}
