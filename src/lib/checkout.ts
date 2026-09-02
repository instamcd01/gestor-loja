"use server";

import { redirect } from "next/navigation";
import { calcularFrete, type ResultadoFrete } from "@/lib/frete";
import { geocodificarEndereco, geocodificarReverso } from "@/lib/geocoding";
import { cobrarPagamentoOnline, type DadosPagamentoOnline } from "@/lib/mercadopago";
import { createClient } from "@/lib/supabase/server";
import type { CandidatoEndereco, EnderecoCliente } from "@/lib/types";
import { NOME_PAGAMENTO_ONLINE } from "@/lib/utils";
import { registrarErroSistema } from "@/lib/erros";

export type ResultadoCheckout = { ok: false; erro: string };

/**
 * Busca nome/telefone do cliente autenticado (RLS já restringe à própria
 * linha via auth_user_id) só pra enriquecer o alerta de erro do checkout
 * com "quem" foi afetado — nunca usado pra decisão de negócio, só contexto
 * de suporte. Falha silenciosa (retorna null) se não conseguir: o alerta
 * genérico ainda sai, só sem esse dado extra.
 */
async function getClienteAtualResumo(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ nome: string; telefone: string } | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("clientes")
      .select("nome, telefone")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!data?.nome) return null;
    return { nome: data.nome, telefone: data.telefone ?? "" };
  } catch {
    return null;
  }
}

/**
 * Só a parte de gravar o pedido (chama o RPC, que revalida tudo de
 * verdade — cupom, agendamento, estoque — nunca confiando no que o
 * client mostrou como preview). Compartilhada pelos dois fluxos de
 * finalização: `finalizarPedido` (métodos na entrega, redireciona na
 * hora) e `finalizarPedidoOnline` (Mercado Pago, precisa do pedido já
 * criado ANTES de cobrar, pra usar o id como `external_reference`).
 */
async function criarPedido(
  empresaId: string,
  tipoPagamento: string,
  tipoEntrega: "retirada" | "entrega",
  zonaId: string | null,
  observacoes: string,
  saldoUsado: number,
  trocoPara: number | null,
  cupomCodigo: string | null,
  agendamento: { inicio: string; fim: string } | null,
  parcelas: number | null,
  modalidadeEntrega: "expressa" | "economica",
  petcashUsado: number,
): Promise<{ ok: true; pedidoId: string } | ResultadoCheckout> {
  const supabase = await createClient();

  // Server Action é chamável direto (não só pelo clique no botão), sem
  // limite de tamanho embutido no Postgres pra esses campos de texto
  // livre — trunca antes de mandar, tanto pra evitar armazenamento sem
  // controle quanto payload gigante numa chamada direta.
  const observacoesLimitadas = observacoes.trim().slice(0, 1000) || null;
  const cupomLimitado = cupomCodigo?.trim().slice(0, 40) || null;

  const { data: pedidoId, error } = await supabase.rpc("finalizar_pedido_site", {
    p_empresa_id: empresaId,
    p_tipo_pagamento: tipoPagamento,
    p_tipo_entrega: tipoEntrega,
    p_zona_id: zonaId,
    p_observacoes: observacoesLimitadas,
    p_saldo_usado: saldoUsado,
    p_troco_para: trocoPara,
    p_cupom_codigo: cupomLimitado,
    p_agendado_inicio: agendamento?.inicio ?? null,
    p_agendado_fim: agendamento?.fim ?? null,
    p_parcelas: parcelas,
    p_modalidade_entrega: modalidadeEntrega,
    // Só informativo o quanto o client manda — a RPC nunca confia nesse
    // valor de verdade, sempre reclampa contra o saldo_petcash real do
    // cliente e os limites (mínimo de pedido, teto de %) configurados
    // pela loja (mesma regra já aplicada a saldo/cupom/frete).
    p_petcash_usado: petcashUsado,
  });

  if (error) {
    const cliente = await getClienteAtualResumo(supabase);
    await registrarErroSistema({
      mensagem: `Falha ao criar pedido (finalizar_pedido_site): ${error.message}`,
      rota: `/loja/checkout (tipo_pagamento=${tipoPagamento})`,
      contexto: cliente ? { clienteNome: cliente.nome, clienteTelefone: cliente.telefone } : undefined,
    });
    return { ok: false, erro: error.message };
  }
  return { ok: true, pedidoId };
}

export async function finalizarPedido(
  slug: string,
  empresaId: string,
  tipoPagamento: string,
  tipoEntrega: "retirada" | "entrega",
  zonaId: string | null,
  observacoes: string,
  saldoUsado: number,
  trocoPara: number | null,
  cupomCodigo: string | null,
  agendamento: { inicio: string; fim: string } | null,
  parcelas: number | null,
  modalidadeEntrega: "expressa" | "economica",
  petcashUsado: number,
): Promise<ResultadoCheckout> {
  const resultado = await criarPedido(
    empresaId,
    tipoPagamento,
    tipoEntrega,
    zonaId,
    observacoes,
    saldoUsado,
    trocoPara,
    cupomCodigo,
    agendamento,
    parcelas,
    modalidadeEntrega,
    petcashUsado,
  );
  if (!resultado.ok) return resultado;

  redirect(`/loja/${slug}/pedido/${resultado.pedidoId}`);
}

/**
 * Pagamento online (Mercado Pago) — cria o pedido normalmente (mesmo RPC,
 * mesma revalidação de cupom/estoque/agendamento) e SÓ DEPOIS cobra na
 * API do Mercado Pago, usando o id do pedido recém-criado como
 * `external_reference` (é assim que o webhook encontra de volta qual
 * pedido atualizar). Sem parcelamento "informativo" nem troco — isso é
 * só sentido pra pagamento na entrega; parcelas de cartão aqui vêm do
 * próprio Payment Brick.
 */
export async function finalizarPedidoOnline(
  slug: string,
  empresaId: string,
  tipoEntrega: "retirada" | "entrega",
  zonaId: string | null,
  observacoes: string,
  saldoUsado: number,
  cupomCodigo: string | null,
  agendamento: { inicio: string; fim: string } | null,
  modalidadeEntrega: "expressa" | "economica",
  dadosPagamento: DadosPagamentoOnline,
  petcashUsado: number,
): Promise<ResultadoCheckout> {
  const resultado = await criarPedido(
    empresaId,
    NOME_PAGAMENTO_ONLINE,
    tipoEntrega,
    zonaId,
    observacoes,
    saldoUsado,
    null,
    cupomCodigo,
    agendamento,
    null,
    modalidadeEntrega,
    petcashUsado,
  );
  if (!resultado.ok) return resultado;

  const cobranca = await cobrarPagamentoOnline(empresaId, resultado.pedidoId, dadosPagamento);
  if (!cobranca.ok) {
    // O pedido já existe (mesmo tratamento de "pagamento recusado depois
    // de criado" que qualquer outro método já tem hoje — lojista cancela
    // na mão) — mas aqui a cobrança nem chegou a ser tentada de verdade
    // (ex: token inválido), então ainda faz sentido mostrar o erro em
    // vez de mandar pra confirmação como se tivesse dado certo.
    const supabase = await createClient();
    const cliente = await getClienteAtualResumo(supabase);
    await registrarErroSistema({
      mensagem: `Falha ao cobrar pagamento online (Mercado Pago): ${cobranca.erro}`,
      rota: `/loja/${slug}/carrinho/pagamento`,
      contexto: {
        pedidoId: resultado.pedidoId,
        ...(cliente ? { clienteNome: cliente.nome, clienteTelefone: cliente.telefone } : {}),
      },
    });
    return { ok: false, erro: cobranca.erro };
  }

  redirect(`/loja/${slug}/pedido/${resultado.pedidoId}`);
}

/**
 * Cancela um pedido "Pagamento Online" ainda não pago (Pix não escaneado,
 * ou o cliente simplesmente mudou de ideia) e reabre o carrinho com os
 * mesmos itens — mesmo mecanismo já usado quando o Mercado Pago recusa um
 * cartão (`reabrirCarrinhoPagamentoRecusado`), só que aqui é o próprio
 * cliente quem decide, não uma recusa automática. A RPC (`SECURITY
 * DEFINER`, ver migração `cliente_cancela_pagamento_pendente`) confere
 * dono do pedido e status ainda pendente com `FOR UPDATE` antes de
 * cancelar — protege contra cancelar um pedido que acabou de ser
 * confirmado pelo webhook bem nesse instante.
 */
export async function cancelarPagamentoPendente(slug: string, pedidoId: string): Promise<ResultadoCheckout> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cliente_cancelar_pagamento_pendente", { p_pedido_id: pedidoId });
  if (error) {
    return { ok: false, erro: "Não foi possível cancelar esse pagamento. Tente de novo." };
  }

  redirect(`/loja/${slug}/carrinho`);
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
  // Vai pra API paga do Google (Geocoding) — trunca antes, uma string
  // gigante numa chamada direta à Server Action não vira custo maior.
  return geocodificarEndereco(query.trim().slice(0, 300));
}

export async function buscarEnderecoPorLocalizacao(lat: number, lng: number): Promise<CandidatoEndereco | null> {
  return geocodificarReverso(lat, lng);
}
