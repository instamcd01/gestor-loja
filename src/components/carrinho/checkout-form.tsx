"use client";

import { useState, useSyncExternalStore } from "react";
import { CapturarEndereco } from "@/components/endereco/capturar-endereco";
import { IconePagamento } from "@/components/carrinho/icone-pagamento";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { calcularFretePorEndereco, finalizarPedido } from "@/lib/checkout";
import { salvarEndereco } from "@/lib/cliente";
import {
  assinarEnderecoEstimado,
  obterSnapshotEnderecoEstimado,
  obterSnapshotServidorEnderecoEstimado,
} from "@/lib/endereco-estimado";
import type { EnderecoCliente } from "@/lib/types";
import { formatarPreco } from "@/lib/utils";

type TipoEntrega = "retirada" | "entrega";

export function CheckoutForm({
  slug,
  empresaId,
  metodosPagamento,
  enderecoEmpresa,
  subtotal,
  enderecoSalvo,
  saldoCliente,
}: {
  slug: string;
  empresaId: string;
  metodosPagamento: string[];
  enderecoEmpresa: { endereco: string | null; cidade: string | null; estado: string | null; cep: string | null };
  subtotal: number;
  enderecoSalvo: EnderecoCliente | null;
  saldoCliente: number;
}) {
  // Se o cliente já resolveu o endereço na estimativa pré-carrinho (ver
  // EstimarFreteGratis), reaproveita em vez de pedir de novo — só usada
  // quando a conta ainda não tem um endereço salvo.
  const enderecoEstimado = useSyncExternalStore(
    assinarEnderecoEstimado,
    () => obterSnapshotEnderecoEstimado(empresaId),
    obterSnapshotServidorEnderecoEstimado,
  );

  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>("retirada");
  const [tipoPagamento, setTipoPagamento] = useState(metodosPagamento[0] ?? "Dinheiro");
  const [observacoes, setObservacoes] = useState("");
  // Confirmado nessa sessão > salvo na conta > estimado no navegador antes
  // do login — derivado a cada render (não useState) pra reagir sozinho
  // quando o useSyncExternalStore acima resolve depois da hidratação.
  const [enderecoConfirmado, setEnderecoConfirmado] = useState<EnderecoCliente | null>(null);
  const endereco = enderecoConfirmado ?? enderecoSalvo ?? enderecoEstimado?.endereco ?? null;
  const [frete, setFrete] = useState<Awaited<ReturnType<typeof calcularFretePorEndereco>> | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [usarSaldo, setUsarSaldo] = useState(false);
  const [trocoParaTexto, setTrocoParaTexto] = useState("");

  function mudarTipoEntrega(novo: TipoEntrega) {
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

  const valorEntrega = tipoEntrega === "entrega" && frete?.disponivel ? frete.opcao.valor : 0;
  const valorAntesDoSaldo = subtotal + valorEntrega;
  const saldoAplicado = usarSaldo ? Math.min(saldoCliente, valorAntesDoSaldo) : 0;
  const valorFinal = valorAntesDoSaldo - saldoAplicado;

  const trocoPara = Number.parseFloat(trocoParaTexto.replace(",", "."));
  const trocoValido = Number.isFinite(trocoPara) && trocoPara > 0;
  const troco = trocoValido ? trocoPara - valorFinal : null;

  async function confirmar() {
    setConfirmando(true);
    setErro(null);

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
    );

    // se chegou aqui, deu erro — sucesso já redireciona e não retorna
    setConfirmando(false);
    setErro(resultado.erro);
  }

  const podeConfirmar = tipoEntrega === "retirada" || (frete?.disponivel ?? false);

  return (
    <div className="flex flex-col gap-4 border-t border-black/10 pt-6 dark:border-white/10">
      <div>
        <p className="mb-2 text-sm font-semibold">Retirada ou entrega</p>
        <div className="flex gap-2">
          {(["retirada", "entrega"] as const).map((opcao) => (
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

      {tipoEntrega === "entrega" && (
        <Card className="flex flex-col gap-3 p-4">
          <CapturarEndereco valorInicial={endereco} onResolvido={confirmarEnderecoECalcularFrete} />

          {calculando && (
            <p className="text-sm text-black/50 dark:text-white/50">Calculando frete...</p>
          )}

          {frete && frete.disponivel && (
            <p className="text-sm font-medium text-[var(--color-success)]">
              {frete.opcao.frete_gratis
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
            Vai pagar com quanto? (pra levarmos o troco certo)
          </label>
          <Input
            id="trocoPara"
            inputMode="decimal"
            placeholder={`Ex: ${formatarPreco(Math.ceil(valorFinal / 10) * 10)}`}
            value={trocoParaTexto}
            onChange={(e) => setTrocoParaTexto(e.target.value)}
          />
          {trocoValido && troco !== null && (
            <p className={`text-sm font-medium ${troco >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
              {troco >= 0 ? `Troco: ${formatarPreco(troco)}` : `Faltam ${formatarPreco(-troco)} — informe um valor maior`}
            </p>
          )}
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

      <Card className="flex flex-col gap-1.5 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-black/50 dark:text-white/50">Valor dos produtos</span>
          <span>{formatarPreco(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-black/50 dark:text-white/50">
            {tipoEntrega === "entrega" ? "Entrega" : "Retirada na loja"}
          </span>
          <span>
            {tipoEntrega === "entrega" ? (valorEntrega === 0 ? "Grátis" : formatarPreco(valorEntrega)) : "—"}
          </span>
        </div>
        {saldoAplicado > 0 && (
          <div className="flex justify-between text-[var(--color-success)]">
            <span>Saldo aplicado</span>
            <span>-{formatarPreco(saldoAplicado)}</span>
          </div>
        )}
        <div className="mt-1.5 flex justify-between border-t border-black/10 pt-2 text-base font-semibold dark:border-white/10">
          <span>Total</span>
          <span>{formatarPreco(valorFinal)}</span>
        </div>
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
