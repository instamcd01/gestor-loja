"use server";

import { createClient } from "@/lib/supabase/server";
import type { EnderecoCliente } from "@/lib/types";

export async function getEnderecoCliente(empresaId: string): Promise<EnderecoCliente | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("clientes")
    .select("endereco, numero, bairro, cidade, estado, cep, complemento, latitude, longitude")
    .eq("empresa_id", empresaId)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // Linha do cliente existe desde o cadastro, mas o endereço só é
  // preenchido no primeiro checkout com entrega — sem lat/lng ainda não
  // há endereço confirmado, e retornar um objeto todo-null aqui faz o
  // "??" do checkout-form ignorar o endereço estimado salvo no navegador.
  if (!data || data.latitude == null || data.longitude == null) return null;

  const { latitude, longitude, ...resto } = data;
  return { ...resto, lat: latitude, lng: longitude };
}

/** Saldo/crédito de loja do cliente logado — mesmo campo que o atendente usa no app. */
export async function getSaldoCliente(empresaId: string): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data } = await supabase
    .from("clientes")
    .select("saldo")
    .eq("empresa_id", empresaId)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return data?.saldo ?? 0;
}

/** `null` = cliente ainda não tem Customer criado no Mercado Pago DESSA loja (nunca pagou online aqui, ou é a primeira vez). */
export async function getMercadoPagoCustomerId(empresaId: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("clientes")
    .select("mp_customer_id")
    .eq("empresa_id", empresaId)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return data?.mp_customer_id ?? null;
}

export type ResultadoEndereco = { ok: true } | { ok: false; erro: string };

export async function salvarEndereco(
  empresaId: string,
  endereco: EnderecoCliente,
): Promise<ResultadoEndereco> {
  const supabase = await createClient();

  // Server Action chamável direto, sem limite de tamanho no Postgres
  // pra esses campos — trunca antes de mandar (mesmo motivo do
  // finalizarPedido).
  const limitar = (v: string | null, max: number) => v?.trim().slice(0, max) || null;

  const { error } = await supabase.rpc("atualizar_endereco_cliente", {
    p_empresa_id: empresaId,
    p_endereco: limitar(endereco.endereco, 200),
    p_numero: limitar(endereco.numero, 20),
    p_bairro: limitar(endereco.bairro, 100),
    p_cidade: limitar(endereco.cidade, 100),
    p_estado: limitar(endereco.estado, 2),
    p_cep: limitar(endereco.cep, 9),
    p_complemento: limitar(endereco.complemento, 100),
    p_latitude: endereco.lat,
    p_longitude: endereco.lng,
  });

  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}
