"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { finalizarPedido, obterOpcaoFrete } from "@/lib/checkout";
import { salvarEndereco } from "@/lib/cliente";
import type { EnderecoCliente } from "@/lib/types";
import { formatarPreco } from "@/lib/utils";

const ENDERECO_VAZIO: EnderecoCliente = {
  endereco: "",
  numero: "",
  bairro: "",
  cidade: "",
  estado: "",
  cep: "",
  complemento: "",
};

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
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>("retirada");
  const [tipoPagamento, setTipoPagamento] = useState(metodosPagamento[0] ?? "Dinheiro");
  const [observacoes, setObservacoes] = useState("");
  const [endereco, setEndereco] = useState<EnderecoCliente>(enderecoSalvo ?? ENDERECO_VAZIO);
  const [frete, setFrete] = useState<Awaited<ReturnType<typeof obterOpcaoFrete>> | null>(null);
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

  function campoPreenchido(campo: keyof EnderecoCliente) {
    return (endereco[campo] ?? "").trim().length > 0;
  }

  const enderecoCompleto =
    campoPreenchido("endereco") &&
    campoPreenchido("numero") &&
    campoPreenchido("bairro") &&
    campoPreenchido("cidade") &&
    campoPreenchido("estado") &&
    campoPreenchido("cep");

  async function calcularFreteAgora() {
    setCalculando(true);
    setErro(null);

    const salvo = await salvarEndereco(empresaId, endereco);
    if (!salvo.ok) {
      setCalculando(false);
      setErro(salvo.erro);
      return;
    }

    const resultado = await obterOpcaoFrete(empresaId, enderecoEmpresa, subtotal);
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
    <div className="flex flex-col gap-4 border-t border-black/10 pt-4 dark:border-white/10">
      <div>
        <p className="mb-2 text-sm font-medium">Retirada ou entrega</p>
        <div className="flex gap-2">
          {(["retirada", "entrega"] as const).map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => mudarTipoEntrega(opcao)}
              className={`rounded-full border px-4 py-1.5 text-sm ${
                tipoEntrega === opcao
                  ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10"
                  : "border-black/10 dark:border-white/10"
              }`}
            >
              {opcao === "retirada" ? "Retirar na loja" : "Entrega"}
            </button>
          ))}
        </div>
      </div>

      {tipoEntrega === "entrega" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-black/5 p-4 dark:border-white/10">
          <div className="grid grid-cols-3 gap-2">
            <input
              placeholder="Rua"
              value={endereco.endereco ?? ""}
              onChange={(e) => setEndereco({ ...endereco, endereco: e.target.value })}
              className="col-span-2 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            />
            <input
              placeholder="Número"
              value={endereco.numero ?? ""}
              onChange={(e) => setEndereco({ ...endereco, numero: e.target.value })}
              className="rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Bairro"
              value={endereco.bairro ?? ""}
              onChange={(e) => setEndereco({ ...endereco, bairro: e.target.value })}
              className="rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            />
            <input
              placeholder="Complemento (opcional)"
              value={endereco.complemento ?? ""}
              onChange={(e) => setEndereco({ ...endereco, complemento: e.target.value })}
              className="rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              placeholder="Cidade"
              value={endereco.cidade ?? ""}
              onChange={(e) => setEndereco({ ...endereco, cidade: e.target.value })}
              className="rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            />
            <input
              placeholder="UF"
              maxLength={2}
              value={endereco.estado ?? ""}
              onChange={(e) => setEndereco({ ...endereco, estado: e.target.value.toUpperCase() })}
              className="rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            />
            <input
              placeholder="CEP"
              value={endereco.cep ?? ""}
              onChange={(e) => setEndereco({ ...endereco, cep: e.target.value })}
              className="rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            />
          </div>

          <Button
            variant="secondary"
            onClick={calcularFreteAgora}
            disabled={!enderecoCompleto || calculando}
          >
            {calculando ? "Calculando..." : "Calcular frete"}
          </Button>

          {frete && frete.disponivel && (
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              {frete.opcao.frete_gratis
                ? "Frete grátis!"
                : `Frete (${frete.opcao.zona_nome}): ${formatarPreco(frete.opcao.valor)}`}
            </p>
          )}
          {frete && !frete.disponivel && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {frete.motivo === "fora_de_area"
                ? "Esse endereço está fora da nossa área de entrega."
                : "Não foi possível calcular o frete para esse endereço."}
            </p>
          )}
        </div>
      )}

      {saldoCliente > 0 && (
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-black/5 p-4 dark:border-white/10">
          <span className="flex flex-col">
            <span className="text-sm font-medium">Usar meu saldo na loja</span>
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
        <p className="mb-2 text-sm font-medium">Forma de pagamento (na retirada/entrega)</p>
        <div className="flex flex-wrap gap-2">
          {metodosPagamento.map((metodo) => (
            <label
              key={metodo}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${
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
                onChange={() => setTipoPagamento(metodo)}
                className="sr-only"
              />
              {metodo}
            </label>
          ))}
        </div>
      </div>

      {tipoPagamento === "Dinheiro" && valorFinal > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-black/5 p-4 dark:border-white/10">
          <label htmlFor="trocoPara" className="text-sm font-medium">
            Vai pagar com quanto? (pra levarmos o troco certo)
          </label>
          <input
            id="trocoPara"
            inputMode="decimal"
            placeholder={`Ex: ${formatarPreco(Math.ceil(valorFinal / 10) * 10)}`}
            value={trocoParaTexto}
            onChange={(e) => setTrocoParaTexto(e.target.value)}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
          />
          {trocoValido && troco !== null && (
            <p className={`text-sm font-medium ${troco >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {troco >= 0 ? `Troco: ${formatarPreco(troco)}` : `Faltam ${formatarPreco(-troco)} — informe um valor maior`}
            </p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="observacoes" className="mb-1 block text-sm font-medium">
          Observações (opcional)
        </label>
        <textarea
          id="observacoes"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)] dark:border-white/10 dark:bg-white/5"
        />
      </div>

      <div className="flex flex-col gap-1 rounded-2xl border border-black/5 p-4 text-sm dark:border-white/10">
        <div className="flex justify-between">
          <span className="text-black/50 dark:text-white/50">Subtotal</span>
          <span>{formatarPreco(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-black/50 dark:text-white/50">Entrega</span>
          <span>{valorEntrega === 0 ? "Grátis" : formatarPreco(valorEntrega)}</span>
        </div>
        {saldoAplicado > 0 && (
          <div className="flex justify-between text-green-600 dark:text-green-400">
            <span>Saldo aplicado</span>
            <span>-{formatarPreco(saldoAplicado)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t border-black/10 pt-1 text-base font-semibold dark:border-white/10">
          <span>Total</span>
          <span>{formatarPreco(valorFinal)}</span>
        </div>
      </div>

      {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}

      <Button onClick={confirmar} disabled={!podeConfirmar || confirmando} className="w-full">
        {confirmando ? "Confirmando..." : `Confirmar pedido — ${formatarPreco(valorFinal)}`}
      </Button>

      <p className="text-center text-xs text-black/40 dark:text-white/40">
        Pedido é confirmado direto com o lojista — sem pagamento online por enquanto.
      </p>
    </div>
  );
}
