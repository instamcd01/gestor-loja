"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import { IconePagamento } from "@/components/carrinho/icone-pagamento";
import { ResumoTotais } from "@/components/carrinho/resumo-totais";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useReportarAlturaBarraFixaCarrinho } from "@/lib/altura-barra-fixa-carrinho";
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
import {
  descontoProdutosCarrinho,
  formatarEnderecoCompleto,
  formatarPreco,
  NOME_PAGAMENTO_ONLINE,
  parseValorMonetarioBr,
} from "@/lib/utils";

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
  mpCustomerId,
  cartoesSalvos,
  mpPixAtivo,
  mpDebitoAtivo,
  bandeirasAceitas,
  taxasParcelamento,
  valorMinimoParcela,
  taxaServicoTipo,
  taxaServicoValor,
  subtotal,
  itens,
  saldoCliente,
  saldoPetCash,
  petcashAtivo,
  petcashPercentual,
  petcashUsoMaximoPercentual,
  petcashPedidoMinimoUso,
  usarPrecoAncoraMarketplace = false,
}: {
  slug: string;
  empresaId: string;
  metodosPagamento: string[];
  /** null = loja não conectou o Mercado Pago — "Pagamento Online" não aparece em `metodosPagamento` nesse caso (ver pagamento/page.tsx), mas o tipo continua opcional aqui por segurança. */
  mpPublicKey: string | null;
  /** null = cliente nunca pagou online nessa loja ainda (ver getMercadoPagoCustomerId) — Brick mostra formulário de cartão novo normal. */
  mpCustomerId: string | null;
  cartoesSalvos: string[];
  /** Pix pelo Mercado Pago cobra taxa (0,99%) — desligável sem desconectar a conta (ver empresas.mp_pix_ativo). Pix na entrega (chave fixa, grátis) não é afetado. */
  mpPixAtivo: boolean;
  /** Cartão de Débito Virtual CAIXA — hoje só funciona com esse produto específico (não débito comum), lojista pode esconder pra não confundir cliente (ver empresas.mp_debito_ativo). */
  mpDebitoAtivo: boolean;
  bandeirasAceitas: EmpresaCatalogo["bandeiras_aceitas"];
  taxasParcelamento: EmpresaCatalogo["taxas_parcelamento"];
  valorMinimoParcela: EmpresaCatalogo["valor_minimo_parcela"];
  taxaServicoTipo: EmpresaCatalogo["taxa_servico_tipo"];
  taxaServicoValor: EmpresaCatalogo["taxa_servico_valor"];
  subtotal: number;
  itens: ItemCarrinho[];
  saldoCliente: number;
  /** PetCash disponível pra gastar — independente de `petcashAtivo` (crédito já concedido continua gastável mesmo se a loja desligar novos créditos). */
  saldoPetCash: number;
  /** false = loja não credita PetCash novo (não afeta o saldo já existente, ver `saldoPetCash`). */
  petcashAtivo: EmpresaCatalogo["petcash_ativo"];
  petcashPercentual: EmpresaCatalogo["petcash_percentual"];
  petcashUsoMaximoPercentual: EmpresaCatalogo["petcash_uso_maximo_percentual"];
  petcashPedidoMinimoUso: EmpresaCatalogo["petcash_pedido_minimo_uso"];
  usarPrecoAncoraMarketplace?: boolean;
}) {
  const router = useRouter();
  const barraFixaRef = useRef<HTMLDivElement>(null);
  useReportarAlturaBarraFixaCarrinho(barraFixaRef);

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

  // Só existe uma escolha de "categoria" (online vs na entrega) quando a
  // loja realmente oferece as duas coisas (disponibilidade "ambos" — ver
  // pagamento/page.tsx). Nos outros casos (só online, ou nunca conectou o
  // Mercado Pago) cai direto na lista simples de sempre, sem esse nível
  // extra de seleção, que não faria sentido sem escolha real por trás.
  const metodosEntrega = metodosPagamento.filter((m) => m !== NOME_PAGAMENTO_ONLINE);
  const temOnlineEEntrega = metodosPagamento.includes(NOME_PAGAMENTO_ONLINE) && metodosEntrega.length > 0;
  // Pix é o método preferencial dentro de "Pagar na entrega" (mesmo
  // destaque do badge "Instantâneo" abaixo) — é pra onde a categoria
  // entrega pré-seleciona ao ser escolhida, quando a loja oferecer Pix.
  const metodoEntregaPreferido = metodosEntrega.includes("Pix") ? "Pix" : (metodosEntrega[0] ?? "Dinheiro");
  // Pedido explícito do usuário (01/09): quando as duas categorias
  // existem, nenhuma vem pré-selecionada — o cliente escolhe "Pagamento
  // online" ou "Pagar na entrega" manualmente antes de qualquer método
  // aparecer marcado. Só cai direto num método quando não há essa escolha
  // real (loja não conectou Mercado Pago, por exemplo).
  const [tipoPagamento, setTipoPagamento] = useState(temOnlineEEntrega ? "" : metodosPagamento[0] ?? "Dinheiro");
  const [categoriaPagamento, setCategoriaPagamento] = useState<"online" | "entrega" | null>(
    temOnlineEEntrega ? null : "entrega",
  );
  const [mostrarObservacoes, setMostrarObservacoes] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [usarSaldo, setUsarSaldo] = useState(false);
  const [usarPetCash, setUsarPetCash] = useState(false);
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

  // Pix é a opção que mais queremos destacar (mais rápido que dinheiro/
  // cartão físico, e no caso "na entrega" não passa taxa nenhuma pro
  // lojista) — reordenado só pra exibição, não muda o método
  // pré-selecionado por padrão (isso continua vindo da config da loja).
  function ordenarComPixPrimeiro(metodos: string[]): string[] {
    return [...metodos].sort((a, b) => (a === "Pix" ? -1 : b === "Pix" ? 1 : 0));
  }

  function selecionarCategoria(categoria: "online" | "entrega") {
    setCategoriaPagamento(categoria);
    if (categoria === "online") {
      mudarMetodoPagamento(NOME_PAGAMENTO_ONLINE);
    } else if (metodosEntrega.length > 0) {
      mudarMetodoPagamento(metodoEntregaPreferido);
    }
  }

  const quantidadeItens = itens.reduce((soma, item) => soma + item.quantidade, 0);
  // Usa o preço de catálogo corrente (não o que foi travado no carrinho) só
  // pra mostrar "quanto você economizou" — o que é cobrado de verdade
  // continua vindo de `preco_unitario`/`subtotal` do item. Helper
  // compartilhado com a etapa de entrega (entrega-form.tsx).
  const descontoProdutos = descontoProdutosCarrinho(itens, usarPrecoAncoraMarketplace);
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
  const valorAntesDoPetCash = valorAntesDoSaldo - saldoAplicado;
  // Mesmo clamp de finalizar_pedido_site (nunca confia só no que aparece
  // aqui, o servidor reclampa igual) — só pra mostrar de verdade quanto
  // vai ser aplicado, não deixar o cliente marcar a caixa achando que vai
  // usar mais do que o teto/mínimo da loja permite.
  const petcashUtilizavel =
    valorAntesDoSaldo >= petcashPedidoMinimoUso
      ? Math.min(saldoPetCash, valorAntesDoPetCash, Math.round(valorAntesDoSaldo * petcashUsoMaximoPercentual) / 100)
      : 0;
  const petcashAplicado = usarPetCash ? petcashUtilizavel : 0;
  const valorFinal = valorAntesDoPetCash - petcashAplicado;
  const petcashPrevisto =
    petcashAtivo && petcashPercentual ? Math.round(subtotal * petcashPercentual) / 100 : 0;

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
      petcashAplicado,
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
      petcashAplicado,
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
    dinheiroResolvido &&
    // Sem isso, com "tipoPagamento" ainda vazio (nenhuma categoria
    // escolhida — ver estado inicial acima), o botão "Confirmar pedido"
    // ficava clicável mesmo sem nenhum método selecionado.
    !!tipoPagamento;

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

      {saldoPetCash > 0 && (
        <label
          className={`flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-dashed p-4 ${
            petcashUtilizavel > 0
              ? "cursor-pointer border-[var(--brand-primary)]/40 bg-[var(--brand-primary)]/5"
              : "cursor-not-allowed border-black/10 opacity-60 dark:border-white/10"
          }`}
        >
          <span className="flex flex-col">
            <span className="text-sm font-semibold">🐾 Usar meu PetCash</span>
            <span className="text-xs text-black/50 dark:text-white/50">
              {petcashUtilizavel > 0
                ? `Você tem ${formatarPreco(saldoPetCash)} disponível — pode usar até ${formatarPreco(petcashUtilizavel)} nesse pedido`
                : valorAntesDoSaldo < petcashPedidoMinimoUso
                  ? `Você tem ${formatarPreco(saldoPetCash)} disponível — faltam ${formatarPreco(petcashPedidoMinimoUso - valorAntesDoSaldo)} pra poder usar`
                  : `Você tem ${formatarPreco(saldoPetCash)} disponível`}
            </span>
          </span>
          <input
            type="checkbox"
            checked={usarPetCash}
            disabled={petcashUtilizavel <= 0}
            onChange={(e) => setUsarPetCash(e.target.checked)}
            className="h-5 w-5 accent-[var(--brand-primary)] disabled:cursor-not-allowed"
          />
        </label>
      )}

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

      {/* Cupom/saldo vêm ANTES da forma de pagamento de propósito — o
          Payment Brick (abaixo) remonta (`key={valorFinal}`) toda vez que
          o total muda, o que apaga qualquer cartão que o cliente já
          tivesse começado a digitar. Aplicar desconto antes de entrar no
          Brick evita que o cliente perca o que já preencheu. */}
      <div>
        <p className="mb-2 text-sm font-semibold">Forma de pagamento</p>

        {temOnlineEEntrega && (
          // grid-cols-1 no mobile: "Pagamento online" + o badge "Recomendado"
          // lado a lado não cabem na metade da largura de um card em tela
          // estreita (achado ao vivo — vazava pra fora do card). Card cheio
          // no mobile resolve de vez; volta a ficar lado a lado a partir de
          // `sm` (640px), onde já sobra espaço.
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => selecionarCategoria("online")}
              className={`flex flex-col items-start gap-1 rounded-[var(--radius-lg)] border p-3.5 text-left transition-colors ${
                categoriaPagamento === "online"
                  ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10"
                  : "border-black/10 dark:border-white/10"
              }`}
            >
              {/* flex-wrap + min-w-0 no título é rede de segurança: mesmo
                  com o card cheio, um dispositivo bem estreito (320px)
                  ainda podia empurrar o badge pra fora sem isso — ver
                  regra de flex/min-width no checklist de engenharia do
                  projeto. */}
              <div className="flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="min-w-0 text-sm font-semibold">Pagamento online</span>
                <Badge>Recomendado</Badge>
              </div>
              <span className="text-xs text-black/50 dark:text-white/50">
                Cartão em até 12x, Pix ou saldo — confirmado na hora
              </span>
            </button>
            <button
              type="button"
              onClick={() => selecionarCategoria("entrega")}
              className={`flex flex-col items-start gap-1 rounded-[var(--radius-lg)] border p-3.5 text-left transition-colors ${
                categoriaPagamento === "entrega"
                  ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10"
                  : "border-black/10 dark:border-white/10"
              }`}
            >
              <span className="text-sm font-semibold">Pagar na entrega</span>
              <span className="text-xs text-black/50 dark:text-white/50">Dinheiro, Pix ou cartão na hora</span>
            </button>
          </div>
        )}

        {/* Grid de cards (não pills) — com 4 métodos possíveis
            (Pix/Dinheiro/Débito/Crédito) uma linha de pills ficava
            apertada e quebrava de forma inconsistente; cards do mesmo
            tamanho em grid de 2 colunas escaneiam melhor e dão espaço
            pro selo do Pix sem espremer o texto do método. */}
        {(!temOnlineEEntrega || categoriaPagamento === "entrega") && (
          <div className="grid grid-cols-2 gap-2">
            {ordenarComPixPrimeiro(temOnlineEEntrega ? metodosEntrega : metodosPagamento).map((metodo) => (
              <label
                key={metodo}
                className={`flex cursor-pointer flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-[var(--radius-lg)] border p-3.5 transition-colors ${
                  tipoPagamento === metodo
                    ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10"
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
                {/* Nome ao lado do ícone (não embaixo) — melhor
                    aproveitamento do espaço do card, mesmo padrão de
                    linha do card "Pagamento online" acima. */}
                <span className="flex min-w-0 items-center gap-2.5">
                  <IconePagamento
                    metodo={metodo}
                    className={`h-5 w-5 shrink-0 ${tipoPagamento === metodo ? "text-[var(--brand-primary)]" : "text-black/60 dark:text-white/60"}`}
                  />
                  <span
                    className={`text-sm font-medium ${tipoPagamento === metodo ? "text-[var(--brand-primary)]" : ""}`}
                  >
                    {metodo}
                  </span>
                </span>
                {metodo === "Pix" && (
                  <Badge variant="success" className="shrink-0 px-1.5 py-0.5 text-[9px]">
                    Instantâneo
                  </Badge>
                )}
              </label>
            ))}
          </div>
        )}
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
                  {opcao.taxa > 0 ? "com juros" : "sem juros"}
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
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-1.5 text-xs text-black/50 dark:text-white/50">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5 shrink-0"
            >
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <span>Pagamento processado com segurança pelo Mercado Pago</span>
          </div>
          <Payment
            key={valorFinal}
            initialization={{
              amount: valorFinal,
              // Cliente com cartão salvo dessa loja (ver getMercadoPagoCustomerId
              // em cliente.ts) — o Brick já mostra o cartão pronto, só pede o
              // CVV de novo (nunca fica guardado, por segurança do próprio MP).
              ...(mpCustomerId ? { payer: { customerId: mpCustomerId, cardsIds: cartoesSalvos } } : {}),
            }}
            customization={{
              paymentMethods: {
                creditCard: "all",
                // Único produto de débito que o Brick oferece hoje é o
                // Cartão Virtual CAIXA (não débito comum do banco do
                // cliente — ver mercado_pago_conectar_screen.dart) —
                // lojista pode esconder pra não confundir quem tenta pagar
                // com o débito normal e não encontra (ver empresas.mp_debito_ativo).
                ...(mpDebitoAtivo ? { debitCard: "all" as const } : {}),
                // Omitir a chave inteira (não só "excluded") é o jeito de
                // esconder a categoria — Pix aqui é o do Mercado Pago
                // (cobra 0,99%), diferente do Pix manual (chave fixa,
                // grátis) que continua disponível nos métodos na entrega.
                ...(mpPixAtivo ? { bankTransfer: "all" as const } : {}),
                // Saldo/carteira Mercado Pago — cliente com conta MP paga
                // com o saldo que já tem lá, sem digitar cartão de novo.
                // Sem toggle próprio (diferente de Pix/débito): é o
                // dinheiro que o próprio cliente já tem na conta dele, não
                // muda taxa nem comportamento pro lojista.
                mercadoPago: "all",
                // Explícito (não só o padrão da conta MP) — é o número que
                // aparece na mensagem "em até 12x" logo acima, então o
                // limite real do Brick precisa bater com o que foi prometido.
                maxInstallments: 12,
              },
              visual: {
                style: { theme: "dark" },
                // Pix é o destaque tanto aqui quanto em "Pagar na entrega"
                // (ver ordenarComPixPrimeiro) — quando disponível, o Brick
                // já abre nele em vez de cair no formulário de cartão.
                ...(mpPixAtivo ? { defaultPaymentOption: { bankTransferForm: true } } : {}),
              },
            }}
            onSubmit={pagarOnline}
            onError={() => setErro("Não foi possível processar o pagamento. Tente de novo.")}
          />
        </Card>
      )}

      {mostrarObservacoes ? (
        <div>
          <label htmlFor="observacoes" className="mb-1 block text-sm font-semibold">
            Observações (opcional)
          </label>
          <textarea
            id="observacoes"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            autoFocus
            className="w-full rounded-[var(--radius-md)] border border-black/10 bg-[var(--surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--brand-primary)] dark:border-white/10"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setMostrarObservacoes(true)}
          className="self-start text-sm text-black/50 underline-offset-2 hover:underline dark:text-white/50"
        >
          + Adicionar observação (opcional)
        </button>
      )}

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
          petcashAplicado={petcashAplicado}
          petcashPrevisto={petcashPrevisto}
          total={valorFinal}
        />
      </Card>

      {erro && <p className="text-sm text-[var(--color-danger)]">{erro}</p>}

      {tipoPagamento && tipoPagamento !== NOME_PAGAMENTO_ONLINE && (
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
      <div
        ref={barraFixaRef}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-[var(--surface)] px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] dark:border-white/10"
      >
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
