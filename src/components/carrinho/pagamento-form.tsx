"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import { IconePagamento } from "@/components/carrinho/icone-pagamento";
import { ResumoTotais } from "@/components/carrinho/resumo-totais";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  assinarCheckoutEstimado,
  obterSnapshotCheckoutEstimado,
  obterSnapshotServidorCheckoutEstimado,
} from "@/lib/checkout-estimado";
import { finalizarPedido, finalizarPedidoOnline } from "@/lib/checkout";
import { validarCupom } from "@/lib/cupom";
import {
  assinarEnderecoEstimado,
  obterSnapshotEnderecoEstimado,
  obterSnapshotServidorEnderecoEstimado,
} from "@/lib/endereco-estimado";
import type { DadosPagamentoOnline } from "@/lib/mercadopago";
import type { EmpresaCatalogo, ItemCarrinho } from "@/lib/types";
import { formatarEnderecoCompleto, formatarPreco, NOME_PAGAMENTO_ONLINE, parseValorMonetarioBr } from "@/lib/utils";

const NOME_BANDEIRA: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  elo: "Elo",
  amex: "American Express",
  hipercard: "Hipercard",
  diners: "Diners Club",
};

/**
 * Segunda etapa do checkout (forma de pagamento, parcelamento, cupom,
 * saldo, resumo final e confirmação) — a primeira etapa (entrega) fica em
 * `EntregaForm`. Lê o resultado da entrega gravado em `checkout-estimado.ts`;
 * se não existir (acesso direto a essa URL sem passar pela etapa 1, ou
 * cache limpo), redireciona de volta pro carrinho.
 */
export function PagamentoForm({
  slug,
  empresaId,
  metodosPagamento,
  mpPublicKey,
  bandeirasAceitas,
  taxasParcelamento,
  valorMinimoParcela,
  taxaServicoTipo,
  taxaServicoValor,
  subtotal,
  itens,
  saldoCliente,
}: {
  slug: string;
  empresaId: string;
  metodosPagamento: string[];
  /** null = loja não conectou o Mercado Pago — "Pagamento Online" não aparece em `metodosPagamento` nesse caso (ver pagamento/page.tsx), mas o tipo continua opcional aqui por segurança. */
  mpPublicKey: string | null;
  bandeirasAceitas: EmpresaCatalogo["bandeiras_aceitas"];
  taxasParcelamento: EmpresaCatalogo["taxas_parcelamento"];
  valorMinimoParcela: EmpresaCatalogo["valor_minimo_parcela"];
  taxaServicoTipo: EmpresaCatalogo["taxa_servico_tipo"];
  taxaServicoValor: EmpresaCatalogo["taxa_servico_valor"];
  subtotal: number;
  itens: ItemCarrinho[];
  saldoCliente: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (mpPublicKey) initMercadoPago(mpPublicKey, { locale: "pt-BR" });
  }, [mpPublicKey]);

  const checkoutEstimado = useSyncExternalStore(
    assinarCheckoutEstimado,
    () => obterSnapshotCheckoutEstimado(empresaId),
    obterSnapshotServidorCheckoutEstimado,
  );
  // Mesmo cache que a etapa de entrega lê/escreve (ver endereco-estimado.ts)
  // — só pra mostrar o endereço no resumo, não pra recalcular frete de novo.
  const enderecoEstimado = useSyncExternalStore(
    assinarEnderecoEstimado,
    () => obterSnapshotEnderecoEstimado(empresaId),
    obterSnapshotServidorEnderecoEstimado,
  );

  useEffect(() => {
    if (checkoutEstimado === null) {
      router.replace(`/loja/${slug}/carrinho`);
    }
  }, [checkoutEstimado, router, slug]);

  const [tipoPagamento, setTipoPagamento] = useState(metodosPagamento[0] ?? "Dinheiro");
  const [observacoes, setObservacoes] = useState("");
  const [usarSaldo, setUsarSaldo] = useState(false);
  const [trocoParaTexto, setTrocoParaTexto] = useState("");
  const [cupomTexto, setCupomTexto] = useState("");
  const [cupomAplicado, setCupomAplicado] = useState<{ codigo: string; valorDesconto: number } | null>(null);
  const [validandoCupom, setValidandoCupom] = useState(false);
  const [erroCupom, setErroCupom] = useState<string | null>(null);
  const [parcelaEscolhida, setParcelaEscolhida] = useState(1);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aplicarCupom() {
    if (!cupomTexto.trim()) return;
    setValidandoCupom(true);
    setErroCupom(null);

    const resultado = await validarCupom(empresaId, cupomTexto.trim(), itens, subtotal);
    setValidandoCupom(false);

    if (!resultado.valido) {
      setErroCupom(resultado.motivo);
      return;
    }
    setCupomAplicado({ codigo: cupomTexto.trim(), valorDesconto: resultado.valorDesconto });
  }

  function removerCupom() {
    setCupomAplicado(null);
    setCupomTexto("");
    setErroCupom(null);
  }

  // O desconto calculado por aplicarCupom() ficava congelado mesmo que o
  // subtotal mudasse depois de aplicar (mesma classe do bug do frete
  // grátis: valor calculado uma vez, nunca reavaliado). finalizar_pedido_site
  // sempre revalida o cupom de verdade no servidor, então nunca é cobrado
  // errado — mas o total mostrado ficava inconsistente com o que ia ser
  // cobrado de fato.
  useEffect(() => {
    if (!cupomAplicado) return;
    const codigo = cupomAplicado.codigo;
    const timer = setTimeout(async () => {
      const resultado = await validarCupom(empresaId, codigo, itens, subtotal);
      if (!resultado.valido) {
        setCupomAplicado((atual) => (atual?.codigo === codigo ? null : atual));
        setCupomTexto((atual) => (atual === codigo ? "" : atual));
        setErroCupom(resultado.motivo);
        return;
      }
      setCupomAplicado((atual) =>
        atual?.codigo === codigo ? { codigo, valorDesconto: resultado.valorDesconto } : atual,
      );
    }, 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  function mudarMetodoPagamento(metodo: string) {
    setTipoPagamento(metodo);
    if (metodo !== "Cartão de Crédito") setParcelaEscolhida(1);
  }

  const quantidadeItens = itens.reduce((soma, item) => soma + item.quantidade, 0);
  // Soma de (preço de catálogo atual − preço promocional) × quantidade —
  // só dos itens que estão em promoção agora. Usa o preço de catálogo
  // corrente (não o que foi travado no carrinho) só pra mostrar "quanto
  // você economizou", igual ao efeito do iFood — o que é cobrado de
  // verdade continua vindo de `preco_unitario`/`subtotal` do item.
  const descontoProdutos = itens.reduce((soma, item) => {
    const produto = item.produto;
    if (!produto || produto.preco_promocional == null || produto.preco_promocional >= produto.preco) return soma;
    return soma + (produto.preco - produto.preco_promocional) * item.quantidade;
  }, 0);
  const taxaServico =
    taxaServicoValor != null && taxaServicoValor > 0
      ? taxaServicoTipo === "fixo"
        ? taxaServicoValor
        : Math.round(subtotal * taxaServicoValor) / 100
      : 0;

  const valorEntrega = checkoutEstimado?.valorEntrega ?? 0;
  const descontoCupom = cupomAplicado?.valorDesconto ?? 0;
  const valorAntesDoSaldo = Math.max(0, subtotal + valorEntrega + taxaServico - descontoCupom);
  const saldoAplicado = usarSaldo ? Math.min(saldoCliente, valorAntesDoSaldo) : 0;
  const valorFinal = valorAntesDoSaldo - saldoAplicado;

  const trocoPara = parseValorMonetarioBr(trocoParaTexto);
  const trocoValido = Number.isFinite(trocoPara) && trocoPara > 0;
  const troco = trocoValido ? trocoPara - valorFinal : null;

  // Só informativo (mostra o valor de cada parcela já com o juros da
  // maquininha aplicado) — a cobrança real continua acontecendo na
  // maquininha física, na entrega/retirada, não tem gateway aqui.
  const opcoesParcelamento = Object.entries(taxasParcelamento ?? {})
    .map(([parcelasTexto, taxa]) => {
      const parcelas = Number(parcelasTexto);
      const valorComJuros = valorFinal * (1 + taxa / 100);
      return { parcelas, taxa, valorParcela: valorComJuros / parcelas };
    })
    .filter((opcao) => Number.isFinite(opcao.parcelas) && opcao.parcelas >= 1)
    // 1x sempre entra (é só o preço à vista, não uma "parcela pequena
    // demais"). Pra 2x em diante, esconde opção cuja parcela ficaria
    // abaixo do mínimo que maquininha costuma aceitar.
    .filter((opcao) => opcao.parcelas === 1 || opcao.valorParcela >= valorMinimoParcela)
    .sort((a, b) => a.parcelas - b.parcelas);

  async function confirmar() {
    if (!checkoutEstimado) return;
    setConfirmando(true);
    setErro(null);

    const resultado = await finalizarPedido(
      slug,
      empresaId,
      tipoPagamento,
      checkoutEstimado.tipoEntrega,
      checkoutEstimado.zonaId,
      observacoes,
      saldoAplicado,
      tipoPagamento === "Dinheiro" && trocoValido ? trocoPara : null,
      cupomAplicado?.codigo ?? null,
      checkoutEstimado.janelaAgendamento,
      tipoPagamento === "Cartão de Crédito" && parcelaEscolhida > 1 ? parcelaEscolhida : null,
      checkoutEstimado.modalidadeEntrega,
    );

    // se chegou aqui, deu erro — sucesso já redireciona e não retorna
    setConfirmando(false);
    setErro(resultado.erro);
  }

  /**
   * onSubmit do Payment Brick — chamado depois que o próprio Brick já
   * tokenizou o cartão (ou montou os dados do Pix) no browser. Cria o
   * pedido e cobra na mesma chamada (ver finalizarPedidoOnline em
   * checkout.ts); precisa devolver/rejeitar a Promise pro Brick saber se
   * mostra o próprio estado de erro.
   */
  async function pagarOnline({
    formData,
  }: {
    formData: {
      token?: string;
      issuer_id?: string;
      payment_method_id: string;
      transaction_amount: number;
      installments?: number;
      payer: { email: string; identification?: { type: string; number: string } };
    };
  }) {
    if (!checkoutEstimado) return;
    setConfirmando(true);
    setErro(null);

    const dados: DadosPagamentoOnline = {
      token: formData.token,
      issuer_id: formData.issuer_id,
      payment_method_id: formData.payment_method_id,
      transaction_amount: formData.transaction_amount,
      installments: formData.installments,
      payer: formData.payer,
    };

    const resultado = await finalizarPedidoOnline(
      slug,
      empresaId,
      checkoutEstimado.tipoEntrega,
      checkoutEstimado.zonaId,
      observacoes,
      saldoAplicado,
      cupomAplicado?.codigo ?? null,
      checkoutEstimado.janelaAgendamento,
      checkoutEstimado.modalidadeEntrega,
      dados,
    );

    // se chegou aqui, deu erro — sucesso já redireciona e não retorna
    setConfirmando(false);
    setErro(resultado.erro);
    throw new Error(resultado.erro);
  }

  // Dinheiro sem valor informado (ou insuficiente) não confirma — mesma
  // regra já usada na venda presencial do app (pagamento_dinheiro_screen.dart:
  // "Pagamento incompleto!" bloqueia até o valor recebido cobrir o total).
  const dinheiroResolvido =
    tipoPagamento !== "Dinheiro" || valorFinal <= 0 || (trocoValido && troco !== null && troco >= 0);
  const podeConfirmar =
    !!checkoutEstimado &&
    (checkoutEstimado.tipoEntrega === "retirada" || checkoutEstimado.zonaId != null) &&
    dinheiroResolvido;

  if (!checkoutEstimado) {
    return <p className="pt-6 text-sm text-black/50 dark:text-white/50">Redirecionando para o carrinho...</p>;
  }

  return (
    <div className="flex flex-col gap-4 border-t border-black/10 pt-6 dark:border-white/10">
      {saldoCliente > 0 && (
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--brand-primary)]/40 bg-[var(--brand-primary)]/5 p-4">
          <span className="flex flex-col">
            <span className="text-sm font-semibold">Usar meu saldo na loja</span>
            <span className="text-xs text-black/50 dark:text-white/50">
              Você tem {formatarPreco(saldoCliente)} disponível
            </span>
          </span>
          <input
            type="checkbox"
            checked={usarSaldo}
            onChange={(e) => setUsarSaldo(e.target.checked)}
            className="h-5 w-5 accent-[var(--brand-primary)]"
          />
        </label>
      )}

      <div>
        <p className="mb-2 text-sm font-semibold">Forma de pagamento</p>
        <div className="flex flex-wrap gap-2">
          {metodosPagamento.map((metodo) => (
            <label
              key={metodo}
              className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                tipoPagamento === metodo
                  ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
                  : "border-black/10 dark:border-white/10"
              }`}
            >
              <input
                type="radio"
                name="tipoPagamento"
                value={metodo}
                checked={tipoPagamento === metodo}
                onChange={() => mudarMetodoPagamento(metodo)}
                className="sr-only"
              />
              <IconePagamento metodo={metodo} className="h-4 w-4" />
              {metodo}
            </label>
          ))}
        </div>
      </div>

      {(tipoPagamento === "Cartão de Crédito" || tipoPagamento === "Cartão de Débito") &&
        !!bandeirasAceitas?.length && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-black/50 dark:text-white/50">
            <span>Bandeiras aceitas:</span>
            {bandeirasAceitas.map((bandeira) => (
              <span
                key={bandeira}
                className="rounded-full border border-black/10 px-2.5 py-1 font-medium dark:border-white/10"
              >
                {NOME_BANDEIRA[bandeira] ?? bandeira}
              </span>
            ))}
          </div>
        )}

      {tipoPagamento === "Cartão de Crédito" && opcoesParcelamento.length > 1 && (
        <Card className="flex flex-col gap-2 p-4">
          <p className="text-sm font-semibold">Parcelamento</p>
          <p className="text-xs text-black/50 dark:text-white/50">
            Só informativo — o pagamento é feito na maquininha, na entrega/retirada.
          </p>
          <div className="flex flex-col gap-1.5">
            {opcoesParcelamento.map((opcao) => (
              <label
                key={opcao.parcelas}
                className={`flex cursor-pointer items-center justify-between rounded-[var(--radius-md)] border px-3.5 py-2.5 text-sm transition-colors ${
                  parcelaEscolhida === opcao.parcelas
                    ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10"
                    : "border-black/10 dark:border-white/10"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="parcelamento"
                    checked={parcelaEscolhida === opcao.parcelas}
                    onChange={() => setParcelaEscolhida(opcao.parcelas)}
                    className="accent-[var(--brand-primary)]"
                  />
                  {opcao.parcelas}x de {formatarPreco(opcao.valorParcela)}
                </span>
                <span className="text-xs text-black/50 dark:text-white/50">
                  {opcao.taxa > 0 ? `com juros (${opcao.taxa.toString().replace(".", ",")}%)` : "sem juros"}
                </span>
              </label>
            ))}
          </div>
        </Card>
      )}

      {tipoPagamento === "Dinheiro" && valorFinal > 0 && (
        <Card className="flex flex-col gap-2 p-4">
          <label htmlFor="trocoPara" className="text-sm font-semibold">
            Vai pagar com quanto? <span className="text-[var(--color-danger)]">*</span>
          </label>
          <Input
            id="trocoPara"
            inputMode="decimal"
            placeholder={`Ex: ${formatarPreco(Math.ceil(valorFinal / 10) * 10)}`}
            value={trocoParaTexto}
            onChange={(e) => setTrocoParaTexto(e.target.value)}
          />
          {trocoValido && troco !== null ? (
            <p className={`text-sm font-medium ${troco >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
              {troco >= 0 ? `Troco: ${formatarPreco(troco)}` : `Faltam ${formatarPreco(-troco)} — informe um valor maior`}
            </p>
          ) : (
            <p className="text-xs text-black/50 dark:text-white/50">
              Obrigatório — pra já sabermos se vai precisar de troco.
            </p>
          )}
        </Card>
      )}

      {tipoPagamento === "Pix" && (
        <p className="text-xs text-black/50 dark:text-white/50">
          O QR Code e o código Pix copia e cola aparecem assim que você confirmar o pedido.
        </p>
      )}

      {/* Botão de envio é o próprio do Brick (não o "Confirmar pedido" da
          barra fixa, que fica escondido pra esse método — ver mais
          abaixo) — ele já cuida de tokenizar cartão/montar Pix no
          browser antes de chegar em pagarOnline(). */}
      {tipoPagamento === NOME_PAGAMENTO_ONLINE && mpPublicKey && (
        <Card className="p-4">
          <Payment
            key={valorFinal}
            initialization={{ amount: valorFinal }}
            customization={{
              paymentMethods: { creditCard: "all", debitCard: "all", bankTransfer: "all" },
              visual: { style: { theme: "dark" } },
            }}
            onSubmit={pagarOnline}
            onError={() => setErro("Não foi possível processar o pagamento. Tente de novo.")}
          />
        </Card>
      )}

      <div>
        <label htmlFor="observacoes" className="mb-1 block text-sm font-semibold">
          Observações (opcional)
        </label>
        <textarea
          id="observacoes"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
          className="w-full rounded-[var(--radius-md)] border border-black/10 bg-[var(--surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--brand-primary)] dark:border-white/10"
        />
      </div>

      <div>
        <label htmlFor="cupom" className="mb-1 block text-sm font-semibold">
          Cupom de desconto (opcional)
        </label>
        {cupomAplicado ? (
          <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-success)]/40 bg-[var(--color-success)]/10 px-3.5 py-2.5">
            <span className="text-sm font-medium text-[var(--color-success)]">
              &ldquo;{cupomAplicado.codigo}&rdquo; aplicado — -{formatarPreco(cupomAplicado.valorDesconto)}
            </span>
            <button
              type="button"
              onClick={removerCupom}
              className="text-xs text-black/50 hover:underline dark:text-white/50"
            >
              Remover
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              id="cupom"
              value={cupomTexto}
              onChange={(e) => setCupomTexto(e.target.value.toUpperCase())}
              placeholder="Ex: BEMVINDO10"
              className="flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={aplicarCupom}
              disabled={validandoCupom || !cupomTexto.trim()}
            >
              {validandoCupom ? "..." : "Aplicar"}
            </Button>
          </div>
        )}
        {erroCupom && <p className="mt-1 text-xs text-[var(--color-danger)]">{erroCupom}</p>}
      </div>

      <Card className="p-4">
        <ResumoTotais
          subtotal={subtotal}
          quantidadeItens={quantidadeItens}
          enderecoLabel={
            checkoutEstimado.tipoEntrega === "entrega" && enderecoEstimado
              ? formatarEnderecoCompleto(enderecoEstimado.endereco)
              : null
          }
          prazoEntregaLabel={checkoutEstimado.prazoLabel}
          entregaLabel={checkoutEstimado.entregaLabel}
          entregaValor={checkoutEstimado.tipoEntrega === "entrega" ? valorEntrega : null}
          entregaValorOriginal={checkoutEstimado.valorEntregaOriginal}
          taxaServicoValor={taxaServico}
          descontoCupom={descontoCupom}
          descontoProdutos={descontoProdutos}
          saldoAplicado={saldoAplicado}
          total={valorFinal}
        />
      </Card>

      {erro && <p className="text-sm text-[var(--color-danger)]">{erro}</p>}

      {tipoPagamento !== NOME_PAGAMENTO_ONLINE && (
        <p className="text-center text-xs text-black/40 dark:text-white/40">
          Pedido é confirmado direto com o lojista — pagamento só na entrega/retirada.
        </p>
      )}

      {/* Barra fixa: total final + único botão "Confirmar pedido" — sem
          duplicar em fluxo (pedido do usuário: só o da barra fixa). Mesmo
          padrão visual da barra da etapa de entrega (ver entrega-form.tsx).
          z-30 fica acima do botão do WhatsApp (z-20 — ver
          whatsapp-suporte-button.tsx). Some pro método "Pagamento Online":
          o Payment Brick (acima, no fluxo normal) já tem o próprio botão
          de envio — dois botões fariam parecer que são ações diferentes. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-[var(--surface)] px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] dark:border-white/10">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs text-black/50 dark:text-white/50">Total</p>
            <p className="truncate text-lg font-bold">{formatarPreco(valorFinal)}</p>
          </div>
          {tipoPagamento === NOME_PAGAMENTO_ONLINE ? (
            <p className="flex-1 text-right text-xs text-black/40 dark:text-white/40">
              Use o botão de pagamento acima
            </p>
          ) : (
            <Button onClick={confirmar} disabled={!podeConfirmar || confirmando} className="flex-1 py-3 text-base">
              {confirmando ? "Confirmando..." : "Confirmar pedido"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
