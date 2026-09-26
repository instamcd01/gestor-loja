"use server";

import { redirect } from "next/navigation";
import { calcularFrete, type ResultadoFrete } from "@/lib/frete";
import { geocodificarEndereco, geocodificarReverso } from "@/lib/geocoding";
import { cobrarPagamentoOnline, type DadosPagamentoOnline } from "@/lib/mercadopago";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { CandidatoEndereco, EnderecoCliente } from "@/lib/types";
import { NOME_PAGAMENTO_ONLINE } from "@/lib/utils";
import { registrarErroSistema } from "@/lib/erros";
import { validarEnderecoEntrega } from "@/lib/validar-endereco";
import { getUsuarioSeguro } from "@/lib/supabase/auth";

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
 * Loga cada confirmação de endereço no checkout — cobre dois pontos hoje
 * invisíveis: (1) frete indisponível (fora_de_area/erro_distancia), que
 * antes só virava uma linha de texto na tela e sumia sem deixar rastro; e
 * (2) a confiança do Google no geocoding (`endereco.precisao`, ver
 * `types.ts`) — quando vem RANGE_INTERPOLATED/GEOMETRIC_CENTER/APPROXIMATE
 * em vez de ROOFTOP, o pino pode ter caído num endereço vizinho, não no
 * real, e hoje isso não aparece em lugar nenhum pro lojista. Best-effort:
 * nunca deixa uma falha de log quebrar o cálculo de frete (já em
 * andamento/já exibido pro cliente).
 */
async function registrarEventoEndereco(
  supabaseUsuario: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  endereco: EnderecoCliente,
  resultado: ResultadoFrete,
): Promise<void> {
  try {
    const cliente = await getClienteAtualResumo(supabaseUsuario);
    const supabase = createServiceClient();
    await supabase.from("eventos_sistema").insert({
      tipo_evento: "site_endereco_confirmado",
      tabela_origem: "clientes",
      dados: {
        empresaId,
        clienteNome: cliente?.nome ?? null,
        clienteTelefone: cliente?.telefone ?? null,
        cep: endereco.cep,
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        precisao: endereco.precisao ?? null,
        freteDisponivel: resultado.disponivel,
        motivo: resultado.disponivel ? null : resultado.motivo,
      },
    });
  } catch (e) {
    console.error("Falha ao registrar evento de endereço:", e);
  }
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
  // CEP nunca é usado no cálculo real (rota/zona usam lat/lng, já
  // confirmados nesse ponto por CapturarEndereco) — exigi-lo aqui além do
  // que a própria captura de endereço já exige bloqueava endereços
  // legítimos e geocodificados com precisão máxima (ROOFTOP) sempre que o
  // Google não devolve postal_code pra aquela rua (achado real 18/09: "Rua
  // Paulo de Lima, 16" resolve certinho, mas sem CEP no resultado do
  // Google — endereço ficava preso mostrando "fora da área de entrega",
  // mensagem errada pra esse motivo, ver estimar-frete-gratis.tsx).
  if (!endereco.endereco || (endereco.lat == null && endereco.lng == null)) {
    return { disponivel: false, motivo: "sem_endereco" };
  }
  const resultado = await calcularFrete(empresaId, enderecoEmpresa, endereco, subtotal);

  const supabase = await createClient();
  void registrarEventoEndereco(supabase, empresaId, endereco, resultado);

  return resultado;
}

export type ResultadoConfirmacaoEndereco =
  | { ok: true; endereco: EnderecoCliente; frete: ResultadoFrete }
  | { ok: false; motivo: "endereco_nao_confere" | "sem_rua_no_ponto" | "erro"; erro: string };

/**
 * Único caminho do checkout logado pra salvar o endereço de entrega e cotar
 * o frete — tudo decidido AQUI no servidor, nunca pelo navegador:
 *
 * 1. Valida que texto e ponto batem (ver `EnderecoCliente.modoPonto`):
 *    "pino" → rua/bairro/cidade/UF/CEP vêm da geocodificação reversa do
 *    ponto (só número/complemento continuam do cliente); "texto" → o texto
 *    é geocodificado de novo e o ponto tem que estar a até 400 m dele.
 * 2. Salva o endereço já validado.
 * 3. Calcula a rota/zona e grava a cotação (service role) em
 *    `cotacoes_frete_site` — é ela que `finalizar_pedido_site` usa pra
 *    decidir a zona. Antes o navegador mandava a zona e qualquer zona ativa
 *    era aceita (brecha achada 26/09).
 */
export async function confirmarEnderecoEntrega(
  empresaId: string,
  enderecoEmpresa: { endereco: string | null; cidade: string | null; estado: string | null; cep: string | null },
  endereco: EnderecoCliente,
  subtotal: number,
): Promise<ResultadoConfirmacaoEndereco> {
  const supabase = await createClient();
  const user = await getUsuarioSeguro(supabase);
  if (!user) return { ok: false, motivo: "erro", erro: "Entre na sua conta pra continuar." };

  const lat = Number(endereco.lat);
  const lng = Number(endereco.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { ok: false, motivo: "endereco_nao_confere", erro: "Confirme o endereço de novo." };
  }

  const validacao = await validarEnderecoEntrega({ ...endereco, lat, lng });
  if (!validacao.ok) return validacao;
  const validado = validacao.endereco;

  const limitar = (v: string | null | undefined, max: number) => v?.trim().slice(0, max) || null;
  const { error: erroSalvar } = await supabase.rpc("atualizar_endereco_cliente", {
    p_empresa_id: empresaId,
    p_endereco: limitar(validado.endereco, 200),
    p_numero: limitar(validado.numero, 20),
    p_bairro: limitar(validado.bairro, 100),
    p_cidade: limitar(validado.cidade, 100),
    p_estado: limitar(validado.estado, 2),
    p_cep: limitar(validado.cep, 9),
    p_complemento: limitar(validado.complemento, 100),
    p_latitude: lat,
    p_longitude: lng,
    // Indicador pro cadastro/entregador: ponto marcado pelo próprio cliente
    // na tela "Ajustar local no mapa" (precisao MANUAL) — o pino é a referência.
    p_ponto_ajustado_cliente: validado.modoPonto === "pino" && validado.precisao === "MANUAL",
  });
  if (erroSalvar) return { ok: false, motivo: "erro", erro: erroSalvar.message };

  const frete = await calcularFrete(empresaId, enderecoEmpresa, validado, subtotal);
  void registrarEventoEndereco(supabase, empresaId, validado, frete);

  if (frete.disponivel) {
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!cliente?.id) return { ok: false, motivo: "erro", erro: "Cliente não encontrado." };

    const { error: erroCotacao } = await createServiceClient().from("cotacoes_frete_site").insert({
      empresa_id: empresaId,
      cliente_id: cliente.id,
      zona_id: frete.opcao.zona_id,
      distancia_km: Math.round(frete.distanciaKm * 1000) / 1000,
      latitude: lat,
      longitude: lng,
      endereco: limitar(validado.endereco, 200),
      numero: limitar(validado.numero, 20),
      modo_ponto: validado.modoPonto ?? "texto",
    });
    if (erroCotacao) {
      await registrarErroSistema({
        mensagem: `Falha ao gravar cotação de frete: ${erroCotacao.message}`,
        rota: "/loja/carrinho (confirmarEnderecoEntrega)",
      });
      return { ok: false, motivo: "erro", erro: "Não foi possível calcular o frete agora. Tente de novo em instantes." };
    }
  }

  return { ok: true, endereco: validado, frete };
}

export async function buscarEnderecoCandidatos(query: string): Promise<CandidatoEndereco[]> {
  // Vai pra API paga do Google (Geocoding) — trunca antes, uma string
  // gigante numa chamada direta à Server Action não vira custo maior.
  return geocodificarEndereco(query.trim().slice(0, 300));
}

export async function buscarEnderecoPorLocalizacao(lat: number, lng: number): Promise<CandidatoEndereco | null> {
  return geocodificarReverso(lat, lng);
}
