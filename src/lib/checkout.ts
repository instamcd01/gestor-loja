"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ResultadoCheckout = { ok: false; erro: string };

export async function finalizarPedido(
  slug: string,
  empresaId: string,
  tipoPagamento: string,
  observacoes: string,
): Promise<ResultadoCheckout> {
  const supabase = await createClient();

  const { data: pedidoId, error } = await supabase.rpc("finalizar_pedido_site", {
    p_empresa_id: empresaId,
    p_tipo_pagamento: tipoPagamento,
    p_observacoes: observacoes.trim() || null,
  });

  if (error) {
    return { ok: false, erro: error.message };
  }

  redirect(`/loja/${slug}/pedido/${pedidoId}`);
}
