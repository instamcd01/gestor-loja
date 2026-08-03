"use client";

import { useState, useSyncExternalStore } from "react";
import { CapturarEndereco } from "@/components/endereco/capturar-endereco";
import { FreteGratisProgresso } from "@/components/carrinho/frete-gratis-progresso";
import { calcularFretePorEndereco } from "@/lib/checkout";
import {
  assinarEnderecoEstimado,
  limparEnderecoEstimado,
  obterSnapshotEnderecoEstimado,
  obterSnapshotServidorEnderecoEstimado,
  salvarEnderecoEstimado,
  type EnderecoEstimado,
} from "@/lib/endereco-estimado";
import type { EnderecoCliente } from "@/lib/types";

/**
 * Pede o endereço antes de afirmar "frete grátis" — sem saber onde o
 * cliente está não dá pra saber qual zona (e qual mínimo) se aplica,
 * mostrar um valor genérico antes disso induz ao erro (relatado pelo
 * usuário: aparecia "desbloqueado" sem nenhum dado preenchido). Endereço
 * completo + geolocalização em vez de só CEP, que geocodifica mal em
 * ruas longas/numéricas e pode errar a zona por vários km.
 */
export function EstimarFreteGratis({
  empresaId,
  enderecoEmpresa,
  subtotal,
}: {
  empresaId: string;
  enderecoEmpresa: { endereco: string | null; cidade: string | null; estado: string | null; cep: string | null };
  subtotal: number;
}) {
  const estimado = useSyncExternalStore(
    assinarEnderecoEstimado,
    () => obterSnapshotEnderecoEstimado(empresaId),
    obterSnapshotServidorEnderecoEstimado,
  );
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState(false);

  async function resolverEndereco(endereco: EnderecoCliente) {
    setCalculando(true);
    setErro(false);

    const resultado = await calcularFretePorEndereco(empresaId, enderecoEmpresa, endereco, 0);
    setCalculando(false);

    if (!resultado.disponivel) {
      setErro(true);
      return;
    }

    const novo: EnderecoEstimado = {
      endereco,
      zonaId: resultado.opcao.zona_id,
      zonaNome: resultado.opcao.zona_nome,
      valorMinimoFreteGratis: resultado.opcao.valor_minimo_frete_gratis,
    };
    salvarEnderecoEstimado(empresaId, novo);
  }

  if (estimado) {
    if (estimado.valorMinimoFreteGratis == null) return null;
    return (
      <div className="flex flex-col gap-1">
        <FreteGratisProgresso subtotal={subtotal} minimo={estimado.valorMinimoFreteGratis} />
        <button
          type="button"
          onClick={() => limparEnderecoEstimado(empresaId)}
          className="self-start text-xs text-black/40 hover:underline dark:text-white/40"
        >
          Trocar endereço
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-black/5 bg-[var(--surface)] p-4 dark:border-white/10">
      <p className="text-xs font-medium">Informe seu endereço pra ver se sua região tem frete grátis</p>
      <CapturarEndereco onResolvido={resolverEndereco} />
      {calculando && <p className="text-xs text-black/50 dark:text-white/50">Calculando...</p>}
      {erro && (
        <p className="text-xs text-[var(--color-danger)]">
          Esse endereço está fora da nossa área de entrega.
        </p>
      )}
    </div>
  );
}
