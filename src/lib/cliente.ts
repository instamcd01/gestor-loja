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

/** PetCash disponível do cliente logado — coluna denormalizada (clientes.saldo_petcash), mantida em sincronia pelas funções do banco (consumir_petcash/gerar_petcash_pedido/expirar_petcash_vencido), nunca escrita direto daqui. */
export async function getSaldoPetCash(empresaId: string): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data } = await supabase
    .from("clientes")
    .select("saldo_petcash")
    .eq("empresa_id", empresaId)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return data?.saldo_petcash ?? 0;
}

export interface CreditoPetCash {
  id: string;
  valorTotal: number;
  valorUsado: number;
  valorDisponivel: number;
  status: "disponivel" | "esgotado" | "expirado";
  criadoEm: string;
  expiraEm: string;
  expiradoEm: string | null;
  /** Número do pedido que gerou esse crédito — null em créditos de estorno (pedido cancelado depois do original que gerou o crédito). */
  pedidoOrigemNumero: number | null;
}

/**
 * Extrato completo do PetCash — cada crédito ganho, quanto já foi usado e
 * se expirou. Existe porque saldo sumindo sem explicação parece erro do
 * sistema pro cliente (pedido explícito do usuário) — aqui ele vê que foi
 * usado numa compra ou que expirou, nunca fica sem saber o motivo.
 */
export async function getExtratoPetCash(empresaId: string): Promise<CreditoPetCash[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase.rpc("meu_extrato_petcash", { p_empresa_id: empresaId });
  if (!data) return [];

  return data.map(
    (row: {
      id: string;
      valor_total: number;
      valor_usado: number;
      valor_disponivel: number;
      status: "disponivel" | "esgotado" | "expirado";
      criado_em: string;
      expira_em: string;
      expirado_em: string | null;
      pedido_origem_numero: number | null;
    }) => ({
      id: row.id,
      valorTotal: row.valor_total,
      valorUsado: row.valor_usado,
      valorDisponivel: row.valor_disponivel,
      status: row.status,
      criadoEm: row.criado_em,
      expiraEm: row.expira_em,
      expiradoEm: row.expirado_em,
      pedidoOrigemNumero: row.pedido_origem_numero,
    }),
  );
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

export interface PedidoPendentePagamento {
  id: string;
  numeroSequencial: number;
  valorTotal: number;
}

/**
 * Pedido online (Mercado Pago) que já foi criado mas ainda não foi pago —
 * o carrinho que o originou já foi consumido (ver `finalizar_pedido_site`),
 * então depois de sair da tela de confirmação o cliente não tinha nenhum
 * jeito óbvio de voltar pra terminar o Pix/cartão: o carrinho aparecia
 * vazio, sem pista nenhuma do pedido pendente. Usado na tela de carrinho
 * vazio pra mostrar um link direto de volta (ver carrinho/page.tsx).
 */
export async function getPedidoPendentePagamento(empresaId: string): Promise<PedidoPendentePagamento | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("pedidos")
    .select("id, numero_sequencial, valor_total")
    .eq("empresa_id", empresaId)
    .eq("status", "aguardando_pagamento")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return { id: data.id, numeroSequencial: data.numero_sequencial, valorTotal: data.valor_total ?? 0 };
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
