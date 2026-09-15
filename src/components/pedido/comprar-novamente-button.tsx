"use client";

import { useState } from "react";
import Link from "next/link";
import { repetirPedido } from "@/lib/carrinho";

/**
 * Puxa os itens desse pedido pro carrinho ativo (soma ao que já tiver lá,
 * preço de hoje) — ver `repetirPedido` em lib/carrinho.ts. Item sem
 * estoque/descontinuado não trava o resto, só aparece avisado depois.
 */
export function ComprarNovamenteButton({
  slug,
  empresaId,
  pedidoId,
}: {
  slug: string;
  empresaId: string;
  pedidoId: string;
}) {
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<Awaited<ReturnType<typeof repetirPedido>> | null>(null);
  const [erroInesperado, setErroInesperado] = useState(false);

  if (resultado) {
    if (!resultado.ok) {
      return (
        <p className="text-sm text-[var(--color-danger)]">
          {resultado.erro === "login_necessario"
            ? "Faça login de novo pra repetir esse pedido."
            : "Não foi possível repetir esse pedido."}
        </p>
      );
    }

    const indisponiveis = resultado.itens.filter((i) => !i.ok);
    return (
      <div className="flex flex-col items-center gap-2 text-center text-sm">
        <p>
          {resultado.itens.length - indisponiveis.length} ite{resultado.itens.length - indisponiveis.length === 1 ? "m" : "ns"} adicionado
          {resultado.itens.length - indisponiveis.length === 1 ? "" : "s"} ao carrinho.
        </p>
        {indisponiveis.length > 0 && (
          <p className="text-black/50 dark:text-white/50">
            Não entraram (indisponíveis): {indisponiveis.map((i) => i.nome).join(", ")}.
          </p>
        )}
        <Link
          href={`/loja/${slug}/carrinho`}
          className="rounded-full bg-[var(--brand-primary)] px-3.5 py-1.5 font-medium text-white"
        >
          Ver carrinho
        </Link>
      </div>
    );
  }

  if (erroInesperado) {
    return <p className="text-sm text-[var(--color-danger)]">Não foi possível repetir esse pedido. Tente de novo.</p>;
  }

  return (
    <button
      type="button"
      disabled={processando}
      onClick={async () => {
        setProcessando(true);
        try {
          setResultado(await repetirPedido(slug, empresaId, pedidoId));
        } catch {
          // Mesmo achado de sempre (ver entrega-form.tsx, 15/09) — sem
          // isso, o botão ficava preso em "..." pra sempre numa falha.
          setErroInesperado(true);
        } finally {
          setProcessando(false);
        }
      }}
      className="rounded-full border border-[var(--brand-primary)] px-3.5 py-1.5 font-medium text-[var(--brand-primary)] disabled:opacity-50"
    >
      {processando ? "..." : "Comprar novamente"}
    </button>
  );
}
