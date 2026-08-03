"use server";

import { redirect } from "next/navigation";
import { calcularFrete, resolverZonaPorCep, type ResultadoFrete, type ResultadoZonaPorCep } from "@/lib/frete";
import { getEnderecoCliente } from "@/lib/cliente";
import { createClient } from "@/lib/supabase/server";

export type ResultadoCheckout = { ok: false; erro: string };

export async function finalizarPedido(
  slug: string,
  empresaId: string,
  tipoPagamento: string,
  tipoEntrega: "retirada" | "entrega",
  zonaId: string | null,
  observacoes: string,
  saldoUsado: number,
  trocoPara: number | null,
): Promise<ResultadoCheckout> {
  const supabase = await createClient();

  const { data: pedidoId, error } = await supabase.rpc("finalizar_pedido_site", {
    p_empresa_id: empresaId,
    p_tipo_pagamento: tipoPagamento,
    p_tipo_entrega: tipoEntrega,
    p_zona_id: zonaId,
    p_observacoes: observacoes.trim() || null,
    p_saldo_usado: saldoUsado,
    p_troco_para: trocoPara,
  });

  if (error) {
    return { ok: false, erro: error.message };
  }

  redirect(`/loja/${slug}/pedido/${pedidoId}`);
}

export async function obterOpcaoFrete(
  empresaId: string,
  enderecoEmpresa: { endereco: string | null; cidade: string | null; estado: string | null; cep: string | null },
  subtotal: number,
): Promise<ResultadoFrete> {
  const endereco = await getEnderecoCliente(empresaId);

  if (!endereco || !endereco.endereco || !endereco.cep) {
    return { disponivel: false, motivo: "sem_endereco" };
  }

  return calcularFrete(empresaId, enderecoEmpresa, endereco, subtotal);
}

export async function estimarFreteGratisPorCep(
  empresaId: string,
  enderecoEmpresa: { endereco: string | null; cidade: string | null; estado: string | null; cep: string | null },
  cep: string,
): Promise<ResultadoZonaPorCep> {
  return resolverZonaPorCep(empresaId, enderecoEmpresa, cep);
}
