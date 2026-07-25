"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Carrinho } from "@/lib/types";

async function getClienteId(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("clientes")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return data?.id ?? null;
}

async function recalcularTotal(supabase: SupabaseClient, carrinhoId: string) {
  const { data: itens } = await supabase
    .from("carrinho_itens")
    .select("subtotal")
    .eq("carrinho_id", carrinhoId);

  const total = (itens ?? []).reduce((soma, item) => soma + Number(item.subtotal), 0);
  await supabase.from("carrinho").update({ valor_total: total }).eq("id", carrinhoId);
}

async function getOrCriarCarrinho(
  supabase: SupabaseClient,
  empresaId: string,
  clienteId: string,
): Promise<string> {
  const { data: existente } = await supabase
    .from("carrinho")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("cliente_id", clienteId)
    .eq("status", "ativo")
    .maybeSingle();

  if (existente) return existente.id;

  const { data: novo, error } = await supabase
    .from("carrinho")
    .insert({ empresa_id: empresaId, cliente_id: clienteId, status: "ativo", origem: "site_proprio", valor_total: 0 })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return novo.id;
}

export type ResultadoCarrinho = { ok: true } | { ok: false; erro: "login_necessario" | "produto_invalido" };

export async function adicionarAoCarrinho(
  slug: string,
  empresaId: string,
  produtoId: string,
  quantidade: number,
): Promise<ResultadoCarrinho> {
  const supabase = await createClient();
  const clienteId = await getClienteId(supabase, empresaId);
  if (!clienteId) return { ok: false, erro: "login_necessario" };

  const { data: produto } = await supabase
    .from("catalogo_produtos_publico")
    .select("preco, preco_promocional")
    .eq("id", produtoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!produto) return { ok: false, erro: "produto_invalido" };

  const preco = produto.preco_promocional ?? produto.preco;
  const carrinhoId = await getOrCriarCarrinho(supabase, empresaId, clienteId);

  const { data: existente } = await supabase
    .from("carrinho_itens")
    .select("id, quantidade")
    .eq("carrinho_id", carrinhoId)
    .eq("produto_id", produtoId)
    .maybeSingle();

  if (existente) {
    const novaQuantidade = existente.quantidade + quantidade;
    await supabase
      .from("carrinho_itens")
      .update({ quantidade: novaQuantidade, subtotal: novaQuantidade * preco })
      .eq("id", existente.id);
  } else {
    await supabase.from("carrinho_itens").insert({
      carrinho_id: carrinhoId,
      produto_id: produtoId,
      quantidade,
      preco_unitario: preco,
      subtotal: preco * quantidade,
    });
  }

  await recalcularTotal(supabase, carrinhoId);
  revalidatePath(`/loja/${slug}/carrinho`);
  return { ok: true };
}

export async function atualizarQuantidade(
  slug: string,
  carrinhoId: string,
  itemId: string,
  quantidade: number,
) {
  const supabase = await createClient();

  if (quantidade <= 0) {
    await supabase.from("carrinho_itens").delete().eq("id", itemId);
  } else {
    const { data: item } = await supabase
      .from("carrinho_itens")
      .select("preco_unitario")
      .eq("id", itemId)
      .single();
    if (item) {
      await supabase
        .from("carrinho_itens")
        .update({ quantidade, subtotal: quantidade * item.preco_unitario })
        .eq("id", itemId);
    }
  }

  await recalcularTotal(supabase, carrinhoId);
  revalidatePath(`/loja/${slug}/carrinho`);
}

export async function getCarrinho(empresaId: string): Promise<Carrinho> {
  const supabase = await createClient();
  const clienteId = await getClienteId(supabase, empresaId);
  if (!clienteId) return { id: null, itens: [], valorTotal: 0 };

  const { data: carrinho } = await supabase
    .from("carrinho")
    .select("id, valor_total")
    .eq("empresa_id", empresaId)
    .eq("cliente_id", clienteId)
    .eq("status", "ativo")
    .maybeSingle();

  if (!carrinho) return { id: null, itens: [], valorTotal: 0 };

  const { data: itensRaw } = await supabase
    .from("carrinho_itens")
    .select("id, produto_id, quantidade, preco_unitario, subtotal")
    .eq("carrinho_id", carrinho.id)
    .order("created_at", { ascending: true });

  const itens = itensRaw ?? [];
  if (itens.length === 0) return { id: carrinho.id, itens: [], valorTotal: 0 };

  const { data: produtos } = await supabase
    .from("catalogo_produtos_publico")
    .select("id, nome, imagem_url, categoria")
    .in(
      "id",
      itens.map((i) => i.produto_id),
    );

  const produtosPorId = new Map((produtos ?? []).map((p) => [p.id, p]));

  return {
    id: carrinho.id,
    valorTotal: carrinho.valor_total,
    itens: itens.map((item) => ({
      ...item,
      produto: produtosPorId.get(item.produto_id) ?? null,
    })),
  };
}

/**
 * Chamado pelo LoginForm logo depois do OTP confirmado — passa pro
 * carrinho real (banco) os itens que o visitante montou sem login
 * (guardados no navegador). Reusa adicionarAoCarrinho item a item, então
 * o preço é sempre recalculado a partir do catálogo público, nunca do
 * que veio do carrinho de convidado.
 */
export async function mesclarCarrinhoConvidado(
  slug: string,
  empresaId: string,
  itens: { produtoId: string; quantidade: number }[],
) {
  for (const item of itens) {
    await adicionarAoCarrinho(slug, empresaId, item.produtoId, item.quantidade);
  }
}
