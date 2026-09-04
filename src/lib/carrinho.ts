"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioSeguro } from "@/lib/supabase/auth";
import type { Carrinho } from "@/lib/types";

async function getClienteId(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<string | null> {
  const user = await getUsuarioSeguro(supabase);
  if (!user) return null;

  const { data } = await supabase
    .from("clientes")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return data?.id ?? null;
}

/**
 * Busca os itens do carrinho (com produto) e recalcula o total a partir
 * deles — nunca confia no valor_total armazenado — e salva de volta.
 * Chamada só depois de mutar carrinho_itens (adicionar/atualizar), pra
 * devolver o carrinho fresco na mesma ida ao servidor em vez de o cliente
 * ter que buscar tudo de novo numa segunda chamada (era o maior custo de
 * latência do fluxo de adicionar/remover: cada clique fazia a mutação e
 * DEPOIS um getCarrinho inteiro separado).
 */
async function recarregarCarrinho(supabase: SupabaseClient, carrinhoId: string): Promise<Carrinho> {
  const { data: itensRaw } = await supabase
    .from("carrinho_itens")
    .select("id, produto_id, quantidade, preco_unitario, subtotal")
    .eq("carrinho_id", carrinhoId)
    .order("created_at", { ascending: true });

  const itensBrutos = itensRaw ?? [];
  const valorTotal = itensBrutos.reduce((soma, item) => soma + Number(item.subtotal), 0);
  const atualizarTotal = supabase.from("carrinho").update({ valor_total: valorTotal }).eq("id", carrinhoId);

  if (itensBrutos.length === 0) {
    await atualizarTotal;
    return { id: carrinhoId, itens: [], valorTotal: 0 };
  }

  // Busca de produtos e gravação do total não dependem uma da outra —
  // dispara as duas juntas em vez de esperar uma pra começar a outra.
  const [{ data: produtos }] = await Promise.all([
    supabase
      .from("catalogo_produtos_publico")
      .select(
        "id, nome, imagem_url, categoria, subcategoria, fabricante, estoque_disponivel, preco, preco_promocional, preco_ancora_canais",
      )
      .in(
        "id",
        itensBrutos.map((i) => i.produto_id),
      ),
    atualizarTotal,
  ]);

  const produtosPorId = new Map((produtos ?? []).map((p) => [p.id, p]));
  return {
    id: carrinhoId,
    valorTotal,
    itens: itensBrutos.map((item) => ({
      ...item,
      produto: produtosPorId.get(item.produto_id) ?? null,
    })),
  };
}

export type ResultadoCarrinho =
  | { ok: true; limitado: boolean; disponivel: number; carrinho: Carrinho }
  | { ok: false; erro: "login_necessario" | "produto_invalido" }
  // Carrinho já tem o máximo do estoque — nada muda, mas devolve o
  // carrinho mesmo assim: quem chama precisa dele pra abrir a gaveta e
  // mostrar o que já está lá, em vez de só um erro sem contexto nenhum
  // (era exatamente esse o bug: clicar "adicionar" com o carrinho já no
  // limite não abria a gaveta, só mostrava a mensagem e parava).
  | { ok: false; erro: "sem_estoque"; disponivel: number; carrinho: Carrinho };

export async function adicionarAoCarrinho(
  slug: string,
  empresaId: string,
  produtoId: string,
  quantidade: number,
): Promise<ResultadoCarrinho> {
  const supabase = await createClient();

  const user = await getUsuarioSeguro(supabase);
  if (!user) return { ok: false, erro: "login_necessario" };

  // RPC atômica (adicionar_ao_carrinho_site) em vez de ler a quantidade
  // atual e depois escrever em chamadas separadas — dois cliques rápidos
  // no "+" podiam ler a mesma quantidade e ambos escreverem o mesmo
  // resultado, perdendo uma unidade (INSERT ... ON CONFLICT DO UPDATE
  // referenciando carrinho_itens.quantidade dentro da própria expressão
  // é resolvido atomicamente pelo Postgres mesmo com chamadas concorrentes).
  const { data, error } = await supabase
    .rpc("adicionar_ao_carrinho_site", {
      p_empresa_id: empresaId,
      p_produto_id: produtoId,
      p_quantidade: quantidade,
    })
    .maybeSingle<{
      id_carrinho: string;
      quantidade_antes: number;
      quantidade_final: number;
      estoque_disponivel: number;
    }>();

  if (error || !data) {
    return { ok: false, erro: "produto_invalido" };
  }

  const { id_carrinho: carrinhoId, quantidade_antes: antes, quantidade_final: final, estoque_disponivel: disponivel } = data;

  if (final === antes) {
    // Nada mudou — já estava no limite do estoque (ou o produto não tem
    // estoque nenhum). Devolve o carrinho mesmo assim: quem chama precisa
    // dele pra abrir a gaveta com o que já está lá, não um dead-end.
    const carrinho = await recarregarCarrinho(supabase, carrinhoId);
    return { ok: false, erro: "sem_estoque", disponivel, carrinho };
  }

  const limitado = final - antes < quantidade;
  const carrinho = await recarregarCarrinho(supabase, carrinhoId);
  revalidatePath(`/loja/${slug}/carrinho`);
  return { ok: true, limitado, disponivel, carrinho };
}

export async function atualizarQuantidade(
  slug: string,
  carrinhoId: string,
  itemId: string,
  quantidade: number,
): Promise<Carrinho> {
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

  const carrinho = await recarregarCarrinho(supabase, carrinhoId);
  revalidatePath(`/loja/${slug}/carrinho`);
  return carrinho;
}

/** Mesma ação do ícone "Esvaziar carrinho" no app (carrinho_screen.dart) — remove todos os itens do carrinho ativo. */
export async function limparCarrinho(slug: string, carrinhoId: string) {
  const supabase = await createClient();
  await supabase.from("carrinho_itens").delete().eq("carrinho_id", carrinhoId);
  await supabase.from("carrinho").update({ valor_total: 0 }).eq("id", carrinhoId);
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
    .select("id")
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
    .select(
      "id, nome, imagem_url, categoria, subcategoria, fabricante, estoque_disponivel, preco, preco_promocional, preco_ancora_canais",
    )
    .in(
      "id",
      itens.map((i) => i.produto_id),
    );

  const produtosPorId = new Map((produtos ?? []).map((p) => [p.id, p]));
  const valorTotal = itens.reduce((soma, item) => soma + Number(item.subtotal), 0);

  return {
    id: carrinho.id,
    valorTotal,
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
