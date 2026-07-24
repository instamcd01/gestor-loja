"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { finalizarPedido } from "@/lib/checkout";

export function CheckoutForm({
  slug,
  empresaId,
  metodosPagamento,
}: {
  slug: string;
  empresaId: string;
  metodosPagamento: string[];
}) {
  const [tipoPagamento, setTipoPagamento] = useState(metodosPagamento[0] ?? "Dinheiro");
  const [observacoes, setObservacoes] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setCarregando(true);
    setErro(null);
    const resultado = await finalizarPedido(slug, empresaId, tipoPagamento, observacoes);
    // se chegou aqui, deu erro — sucesso já redireciona e não retorna
    setCarregando(false);
    setErro(resultado.erro);
  }

  return (
    <div className="flex flex-col gap-4 border-t border-black/10 pt-4 dark:border-white/10">
      <div>
        <p className="mb-2 text-sm font-medium">Forma de pagamento (na retirada)</p>
        <div className="flex flex-wrap gap-2">
          {metodosPagamento.map((metodo) => (
            <label
              key={metodo}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${
                tipoPagamento === metodo
                  ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10"
                  : "border-black/10 dark:border-white/10"
              }`}
            >
              <input
                type="radio"
                name="tipoPagamento"
                value={metodo}
                checked={tipoPagamento === metodo}
                onChange={() => setTipoPagamento(metodo)}
                className="sr-only"
              />
              {metodo}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="observacoes" className="mb-1 block text-sm font-medium">
          Observações (opcional)
        </label>
        <textarea
          id="observacoes"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)] dark:border-white/10 dark:bg-white/5"
        />
      </div>

      {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}

      <Button onClick={confirmar} disabled={carregando} className="w-full">
        {carregando ? "Confirmando..." : "Confirmar pedido"}
      </Button>

      <p className="text-center text-xs text-black/40 dark:text-white/40">
        Retirada na loja. Pedido é confirmado direto com o lojista — sem pagamento online por
        enquanto.
      </p>
    </div>
  );
}
