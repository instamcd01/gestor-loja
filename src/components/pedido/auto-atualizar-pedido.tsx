"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Recarrega a página do pedido a cada poucos segundos enquanto o
 * pagamento online (Mercado Pago) ainda está pendente — a confirmação
 * de verdade chega assíncrona, pelo webhook (ver mercadopago.ts), então
 * sem isso o cliente só veria "pago" recarregando manualmente. Some
 * sozinho quando o pai (`pedido/[id]/page.tsx`) para de renderizar esse
 * componente, assim que `status_pagamento` virar "pago".
 */
export function AutoAtualizarPedido() {
  const router = useRouter();

  useEffect(() => {
    const intervalo = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(intervalo);
  }, [router]);

  return null;
}
