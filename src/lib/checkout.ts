"use server";

import { redirect } from "next/navigation";
import { calcularFrete, type ResultadoFrete } from "@/lib/frete";
import { geocodificarEndereco, geocodificarReverso } from "@/lib/geocoding";
import { createClient } from "@/lib/supabase/server";
import type { CandidatoEndereco, EnderecoCliente } from "@/lib/types";

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

/**
 * Calcula o frete a partir de um endereço já resolvido (com lat/lng
 * confirmados via CapturarEndereco) — não lê mais o endereço salvo na
 * conta diretamente, quem chama decide a origem (conta, estimativa
 * pré-carrinho salva no navegador, ou o que acabou de ser confirmado).
 */
export async function calcularFretePorEndereco(
  empresaId: string,
  enderecoEmpresa: { endereco: string | null; cidade: string | null; estado: string | null; cep: string | null },
  endereco: EnderecoCliente,
  subtotal: number,
): Promise<ResultadoFrete> {
  if (!endereco.endereco || !endereco.cep) {
    return { disponivel: false, motivo: "sem_endereco" };
  }
  return calcularFrete(empresaId, enderecoEmpresa, endereco, subtotal);
}

export async function buscarEnderecoCandidatos(query: string): Promise<CandidatoEndereco[]> {
  return geocodificarEndereco(query);
}

export async function buscarEnderecoPorLocalizacao(lat: number, lng: number): Promise<CandidatoEndereco | null> {
  return geocodificarReverso(lat, lng);
}
