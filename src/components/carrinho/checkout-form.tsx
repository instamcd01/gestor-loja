"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CapturarEndereco } from "@/components/endereco/capturar-endereco";
import { IconePagamento } from "@/components/carrinho/icone-pagamento";
import { ResumoTotais } from "@/components/carrinho/resumo-totais";
import { SeletorAgendamento } from "@/components/carrinho/seletor-agendamento";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { JanelaHorarioAgendamento } from "@/lib/agendamento";
import { calcularFretePorEndereco, finalizarPedido } from "@/lib/checkout";
import { salvarEndereco } from "@/lib/cliente";
import { validarCupom } from "@/lib/cupom";
import {
  assinarEnderecoEstimado,
  obterSnapshotEnderecoEstimado,
  obterSnapshotServidorEnderecoEstimado,
} from "@/lib/endereco-estimado";
import type { EmpresaCatalogo, EnderecoCliente, ItemCarrinho } from "@/lib/types";
import { formatarPreco } from "@/lib/utils";

type TipoEntrega = "retirada" | "entrega";

export function CheckoutForm({
  slug,
  empresaId,
  metodosPagamento,
  aceitaRetirada,
  enderecoEmpresa,
  horarioFuncionamento,
  subtotal,
  itens,
  enderecoSalvo,
  saldoCliente,
  aoConfirmarAntes,
}: {
  slug: string;
  empresaId: string;
  metodosPagamento: string[];
  aceitaRetirada: boolean;
  enderecoEmpresa: { endereco: string | null; cidade: string | null; estado: string | null; cep: string | null };
  horarioFuncionamento: EmpresaCatalogo["horario_funcionamento"];
  subtotal: number;
  itens: ItemCarrinho[];
  enderecoSalvo: EnderecoCliente | null;
  saldoCliente: number;
  /** Garante que qualquer alteração de quantidade ainda pendente (dentro da janela de debounce) chegue no banco antes de finalizar — senão o pedido podia sair com uma quantidade desatualizada. */
  aoConfirmarAntes: () => Promise<void>;
}) {
  // Se o cliente já resolveu o endereço na estimativa pré-carrinho (ver
  // EstimarFreteGratis), reaproveita em vez de pedir de novo — só usada
  // quando a conta ainda não tem um endereço salvo.
  const enderecoEstimado = useSyncExternalStore(
    assinarEnderecoEstimado,
    () => obterSnapshotEnderecoEstimado(empresaId),
    obterSnapshotServidorEnderecoEstimado,
  );

  // Cliente que já tem endereço salvo (ou loja que não aceita retirada)
  // provavelmente quer entrega — só cai pra retirada por padrão quando
  // não há indício nenhum de endereço ainda.
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>(() =>
    !aceitaRetirada || enderecoSalvo ? "entrega" : "retirada",
  );
  // true assim que o cliente escolhe manualmente — depois disso o efeito
  // abaixo (endereço resolvido tarde, ex: estimativa pré-carrinho só
  // chega depois da hidratação) para de tentar mudar a seleção sozinho.
  const escolhaManual = useRef(false);
  const [tipoPagamento, setTipoPagamento] = useState(metodosPagamento[0] ?? "Dinheiro");
  const [observacoes, setObservacoes] = useState("");
  // Confirmado nessa sessão > salvo na conta > estimado no navegador antes
  // do login — derivado a cada render (não useState) pra reagir sozinho
  // quando o useSyncExternalStore acima resolve depois da hidratação.
  const [enderecoConfirmado, setEnderecoConfirmado] = useState<EnderecoCliente | null>(null);
  const endereco = enderecoConfirmado ?? enderecoSalvo ?? enderecoEstimado?.endereco ?? null;

  useEffect(() => {
    if (!escolhaManual.current && endereco && tipoEntrega === "retirada") {
      setTipoEntrega("entrega");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endereco]);
  const [frete, setFrete] = useState<Awaited<ReturnType<typeof calcularFretePorEndereco>> | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [usarSaldo, setUsarSaldo] = useState(false);
  const [trocoParaTexto, setTrocoParaTexto] = useState("");
  const [cupomTexto, setCupomTexto] = useState("");
  const [cupomAplicado, setCupomAplicado] = useState<{ codigo: string; valorDesconto: number } | null>(null);
  const [validandoCupom, setValidandoCupom] = useState(false);
  const [erroCupom, setErroCupom] = useState<string | null>(null);
  const [janelaAgendamento, setJanelaAgendamento] = useState<JanelaHorarioAgendamento | null>(null);

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
  // cliente mudasse a quantidade de algo no carrinho depois de aplicar —
  // mesma classe do bug do frete grátis (valor calculado uma vez, nunca
  // reavaliado contra o carrinho atual). finalizar_pedido_site sempre
  // revalida o cupom de verdade no servidor, então nunca é cobrado errado
  // — mas o total mostrado no botão de confirmar ficava inconsistente
  // com o que ia ser cobrado de fato. Debounced (junto com o resto do
  // carrinho) pra não validar de novo a cada clique de +/- em sequência.
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

  function mudarTipoEntrega(novo: TipoEntrega) {
    escolhaManual.current = true;
    setTipoEntrega(novo);
    setFrete(null);
    setErro(null);
  }

  async function confirmarEnderecoECalcularFrete(novoEndereco: EnderecoCliente) {
    setEnderecoConfirmado(novoEndereco);
    setCalculando(true);
    setErro(null);

    const salvo = await salvarEndereco(empresaId, novoEndereco);
    if (!salvo.ok) {
      setCalculando(false);
      setErro(salvo.erro);
      return;
    }

    const resultado = await calcularFretePorEndereco(empresaId, enderecoEmpresa, novoEndereco, subtotal);
    setCalculando(false);
    setFrete(resultado);
  }

  // O cliente pode já ter confirmado o endereço antes de chegar aqui (na
  // gaveta, via EstimarFreteGratis, ou porque a conta já tem endereço
  // salvo) — nesse caso o frete calcula sozinho, sem esperar ele clicar
  // "Confirmar endereço" de novo dentro do CapturarEndereco. Só dispara
  // uma vez (a mesma regra do CarrinhoProvider.valorEntregaCalculado no
  // app não recalcula frete a cada mudança de subtotal, só a decisão de
  // "é grátis?", já reavaliada localmente em entregaGratisAgora abaixo).
  const autoConfirmado = useRef(false);
  useEffect(() => {
    if (!autoConfirmado.current && endereco && !frete && !calculando) {
      autoConfirmado.current = true;
      confirmarEnderecoECalcularFrete(endereco);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endereco]);

  const freteResolvido = tipoEntrega === "entrega" && frete?.disponivel ? frete.opcao : null;
  // frete_gratis veio do subtotal de quando o endereço foi confirmado —
  // se o cliente mudou quantidade depois (item-carrinho-row, acima nesta
  // mesma página), reavalia contra o subtotal atual em vez de confiar no
  // flag congelado (mesma regra do CarrinhoProvider.valorEntregaCalculado
  // no app: grátis quando subtotal >= mínimo da zona).
  const entregaGratisAgora =
    !!freteResolvido &&
    (freteResolvido.valor_minimo_frete_gratis != null
      ? subtotal >= freteResolvido.valor_minimo_frete_gratis
      : freteResolvido.frete_gratis);
  const valorEntrega = freteResolvido ? (entregaGratisAgora ? 0 : freteResolvido.valor) : 0;
  const descontoCupom = cupomAplicado?.valorDesconto ?? 0;
  const valorAntesDoSaldo = Math.max(0, subtotal + valorEntrega - descontoCupom);
  const saldoAplicado = usarSaldo ? Math.min(saldoCliente, valorAntesDoSaldo) : 0;
  const valorFinal = valorAntesDoSaldo - saldoAplicado;
  const faltaParaFreteGratis =
    freteResolvido && !entregaGratisAgora && freteResolvido.valor_minimo_frete_gratis != null
      ? freteResolvido.valor_minimo_frete_gratis - subtotal
      : null;

  const trocoPara = Number.parseFloat(trocoParaTexto.replace(",", "."));
  const trocoValido = Number.isFinite(trocoPara) && trocoPara > 0;
  const troco = trocoValido ? trocoPara - valorFinal : null;

  async function confirmar() {
    setConfirmando(true);
    setErro(null);

    // Garante que qualquer mudança de quantidade feita nos últimos
    // instantes (ainda dentro da janela de debounce) já esteja salva no
    // banco antes de ler o carrinho pra montar o pedido — senão o pedido
    // podia sair com uma quantidade desatualizada.
    await aoConfirmarAntes();

    const zonaId = tipoEntrega === "entrega" && frete?.disponivel ? frete.opcao.zona_id : null;
    const resultado = await finalizarPedido(
      slug,
      empresaId,
      tipoPagamento,
      tipoEntrega,
      zonaId,
      observacoes,
      saldoAplicado,
      tipoPagamento === "Dinheiro" && trocoValido ? trocoPara : null,
      cupomAplicado?.codigo ?? null,
      janelaAgendamento ? { inicio: janelaAgendamento.inicio, fim: janelaAgendamento.fim } : null,
    );

    // se chegou aqui, deu erro — sucesso já redireciona e não retorna
    setConfirmando(false);
    setErro(resultado.erro);
  }

  // Dinheiro sem valor informado (ou insuficiente) não confirma — mesma
  // regra já usada na venda presencial do app (pagamento_dinheiro_screen.dart:
  // "Pagamento incompleto!" bloqueia até o valor recebido cobrir o total).
  const dinheiroResolvido =
    tipoPagamento !== "Dinheiro" || valorFinal <= 0 || (trocoValido && troco !== null && troco >= 0);
  const podeConfirmar = (tipoEntrega === "retirada" || (frete?.disponivel ?? false)) && dinheiroResolvido;

  return (
    <div className="flex flex-col gap-4 border-t border-black/10 pt-6 dark:border-white/10">
      {aceitaRetirada && (
        <div>
          <p className="mb-2 text-sm font-semibold">Retirada ou entrega</p>
          <div className="flex gap-2">
            {(["entrega", "retirada"] as const).map((opcao) => (
              <button
                key={opcao}
                type="button"
                onClick={() => mudarTipoEntrega(opcao)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  tipoEntrega === opcao
                    ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
                    : "border-black/10 dark:border-white/10"
                }`}
              >
                {opcao === "retirada" ? "Retirar na loja" : "Entrega"}
              </button>
            ))}
          </div>
        </div>
      )}

      {tipoEntrega === "entrega" && (
        <Card className="flex flex-col gap-3 p-4">
          <CapturarEndereco valorInicial={endereco} onResolvido={confirmarEnderecoECalcularFrete} />

          {calculando && (
            <p className="text-sm text-black/50 dark:text-white/50">Calculando frete...</p>
          )}

          {frete && frete.disponivel && (
            <p className="text-sm font-medium text-[var(--color-success)]">
              {entregaGratisAgora
                ? "Frete grátis!"
                : `Frete (${frete.opcao.zona_nome}): ${formatarPreco(frete.opcao.valor)}`}
            </p>
          )}
          {frete && !frete.disponivel && (
            <p className="text-sm text-[var(--color-danger)]">
              {frete.motivo === "fora_de_area"
                ? "Esse endereço está fora da nossa área de entrega."
                : "Não foi possível calcular o frete para esse endereço."}
            </p>
          )}
        </Card>
      )}

      <SeletorAgendamento
        horarioFuncionamento={horarioFuncionamento}
        janela={janelaAgendamento}
        onMudarJanela={setJanelaAgendamento}
        estimativa={
          freteResolvido && freteResolvido.estimativa_min_min != null && freteResolvido.estimativa_min_max != null
            ? { min: freteResolvido.estimativa_min_min, max: freteResolvido.estimativa_min_max }
            : null
        }
      />

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
        <p className="mb-2 text-sm font-semibold">Forma de pagamento (na retirada/entrega)</p>
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
                onChange={() => setTipoPagamento(metodo)}
                className="sr-only"
              />
              <IconePagamento metodo={metodo} className="h-4 w-4" />
              {metodo}
            </label>
          ))}
        </div>
      </div>

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
          entregaLabel={tipoEntrega === "entrega" ? "Entrega" : "Retirada na loja"}
          entregaValor={tipoEntrega === "entrega" ? (freteResolvido ? valorEntrega : null) : null}
          entregaValorOriginal={freteResolvido?.valor}
          faltaParaFreteGratis={faltaParaFreteGratis}
          descontoCupom={descontoCupom}
          saldoAplicado={saldoAplicado}
          total={valorFinal}
        />
      </Card>

      {erro && <p className="text-sm text-[var(--color-danger)]">{erro}</p>}

      <Button onClick={confirmar} disabled={!podeConfirmar || confirmando} className="w-full py-3.5 text-base">
        {confirmando ? "Confirmando..." : `Confirmar pedido — ${formatarPreco(valorFinal)}`}
      </Button>

      <p className="text-center text-xs text-black/40 dark:text-white/40">
        Pedido é confirmado direto com o lojista — sem pagamento online por enquanto.
      </p>
    </div>
  );
}
