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

export type ResultadoCarrinho =
  | { ok: true; limitado: boolean; disponivel: number }
  | { ok: false; erro: "login_necessario" | "produto_invalido" | "sem_estoque"; disponivel?: number };

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
    .select("preco, preco_promocional, estoque_disponivel")
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

  const quantidadeAtual = existente?.quantidade ?? 0;
  if (quantidadeAtual >= produto.estoque_disponivel) {
    return { ok: false, erro: "sem_estoque", disponivel: produto.estoque_disponivel };
  }

  const quantidadeDesejada = quantidadeAtual + quantidade;
  const novaQuantidade = Math.min(quantidadeDesejada, produto.estoque_disponivel);
  const limitado = novaQuantidade < quantidadeDesejada;

  if (existente) {
    await supabase
      .from("carrinho_itens")
      .update({ quantidade: novaQuantidade, subtotal: novaQuantidade * preco })
      .eq("id", existente.id);
  } else {
    await supabase.from("carrinho_itens").insert({
      carrinho_id: carrinhoId,
      produto_id: produtoId,
      quantidade: novaQuantidade,
      preco_unitario: preco,
      subtotal: preco * novaQuantidade,
    });
  }

  await recalcularTotal(supabase, carrinhoId);
  revalidatePath(`/loja/${slug}/carrinho`);
  return { ok: true, limitado, disponivel: produto.estoque_disponivel };
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
      .select("preco_unitario, produto_id")
      .eq("id", itemId)
      .single();
    if (item) {
      // Nunca deixa a quantidade passar do estoque real, mesmo que o
      // clique de "+" tenha chegado depois de outra aba/pessoa já ter
      // levado o resto — mesma trava que finalizar_pedido_site aplica
      // no fim, só que já aqui, pro cliente ver o limite na hora.
      const { data: produto } = await supabase
        .from("catalogo_produtos_publico")
        .select("estoque_disponivel")
        .eq("id", item.produto_id)
        .maybeSingle();
      const quantidadeFinal = produto ? Math.min(quantidade, produto.estoque_disponivel) : quantidade;

      await supabase
        .from("carrinho_itens")
        .update({ quantidade: quantidadeFinal, subtotal: quantidadeFinal * item.preco_unitario })
        .eq("id", itemId);
    }
  }

  await recalcularTotal(supabase, carrinhoId);
  revalidatePath(`/loja/${slug}/carrinho`);
}

/** Mesma ação do ícone "Esvaziar carrinho" no app (carrinho_screen.dart) — remove todos os itens do carrinho ativo. */
export async function limparCarrinho(slug: string, carrinhoId: string) {
  const supabase = await createClient();
  await supabase.from("carrinho_itens").delete().eq("carrinho_id", carrinhoId);
  await recalcularTotal(supabase, carrinhoId);
  revalidatePath(`/loja/${slug}/carrinho`);
}

/** Soma de quantidades no carrinho ativo — usado só pro badge do cabeçalho, não busca os itens inteiros. */
export async function getContagemCarrinho(empresaId: string): Promise<number> {
  const supabase = await createClient();
  const clienteId = await getClienteId(supabase, empresaId);
  if (!clienteId) return 0;

  const { data: carrinho } = await supabase
    .from("carrinho")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("cliente_id", clienteId)
    .eq("status", "ativo")
    .maybeSingle();
  if (!carrinho) return 0;

  const { data: itens } = await supabase.from("carrinho_itens").select("quantidade").eq("carrinho_id", carrinho.id);
  return (itens ?? []).reduce((soma, item) => soma + item.quantidade, 0);
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
    .select("id, nome, imagem_url, categoria, subcategoria, fabricante, estoque_disponivel")
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
