"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CapturarEndereco } from "@/components/endereco/capturar-endereco";
import { FreteGratisProgresso } from "@/components/carrinho/frete-gratis-progresso";
import { calcularFretePorEndereco } from "@/lib/checkout";
import { getEnderecoCliente } from "@/lib/cliente";
import {
  assinarEnderecoEstimado,
  limparEnderecoEstimado,
  obterSnapshotEnderecoEstimado,
  obterSnapshotServidorEnderecoEstimado,
  salvarEnderecoEstimado,
  type EnderecoEstimado,
} from "@/lib/endereco-estimado";
import type { EnderecoCliente } from "@/lib/types";
import { formatarEnderecoCompleto } from "@/lib/utils";

/** Coordenadas iguais (com folga de ~10m) = mesmo endereço, sem precisar comparar texto. */
function mesmoEndereco(a: EnderecoCliente, b: EnderecoCliente): boolean {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) {
    return formatarEnderecoCompleto(a) === formatarEnderecoCompleto(b);
  }
  return Math.abs(a.lat - b.lat) < 0.0001 && Math.abs(a.lng - b.lng) < 0.0001;
}

/**
 * Pede o endereço antes de afirmar "frete grátis" — sem saber onde o
 * cliente está não dá pra saber qual zona (e qual mínimo) se aplica,
 * mostrar um valor genérico antes disso induz ao erro (relatado pelo
 * usuário: aparecia "desbloqueado" sem nenhum dado preenchido). Endereço
 * completo + geolocalização em vez de só CEP, que geocodifica mal em
 * ruas longas/numéricas e pode errar a zona por vários km.
 *
 * A barra de progresso fica sempre visível (gaveta, carrinho de
 * visitante e carrinho logado) — é o que incentiva o cliente a completar
 * o carrinho pra desbloquear frete grátis, então repetir a mesma
 * informação do ResumoTotais logo abaixo vale a pena aqui, não é
 * duplicação inútil. O endereço usado pra calcular fica sempre visível
 * também, pra o cliente confirmar que é o endereço certo antes de trocar.
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

  // Se o cliente já tem um endereço confirmado na conta (salvo num
  // checkout anterior) e ele for DIFERENTE do que está em cache no
  // navegador (ex: cache antigo de antes de logar, ou endereço trocado
  // desde a última estimativa), a conta vence — recalcula e sobrescreve.
  // Sem isso, a barra de frete grátis (gaveta e carrinho) podia mostrar
  // um valor pra um endereço, enquanto o checkout de verdade (que já
  // prioriza o endereço da conta) calculava o frete real pra outro —
  // exatamente o que o cliente reportou ver.
  const jaConferiuConta = useRef(false);
  useEffect(() => {
    if (jaConferiuConta.current) return;
    jaConferiuConta.current = true;

    getEnderecoCliente(empresaId).then((enderecoConta) => {
      if (!enderecoConta) return;
      const atual = obterSnapshotEnderecoEstimado(empresaId);
      if (atual && mesmoEndereco(atual.endereco, enderecoConta)) return;
      resolverEndereco(enderecoConta);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

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
      valor: resultado.opcao.valor,
      freteGratis: resultado.opcao.frete_gratis,
      valorMinimoFreteGratis: resultado.opcao.valor_minimo_frete_gratis,
      estimativaMinMin: resultado.opcao.estimativa_min_min,
      estimativaMinMax: resultado.opcao.estimativa_min_max,
    };
    salvarEnderecoEstimado(empresaId, novo);
  }

  if (estimado) {
    return (
      <div className="flex flex-col gap-2">
        {estimado.valorMinimoFreteGratis != null && (
          <FreteGratisProgresso subtotal={subtotal} minimo={estimado.valorMinimoFreteGratis} />
        )}
        <div className="flex items-center justify-between gap-2 text-xs text-black/50 dark:text-white/50">
          <span className="truncate">📍 {formatarEnderecoCompleto(estimado.endereco)}</span>
          <button
            type="button"
            onClick={() => limparEnderecoEstimado(empresaId)}
            className="shrink-0 text-black/40 hover:underline dark:text-white/40"
          >
            Trocar endereço
          </button>
        </div>
        {estimado.estimativaMinMin != null && estimado.estimativaMinMax != null && (
          <p className="text-xs text-black/50 dark:text-white/50">
            🕐 Entrega estimada em {estimado.estimativaMinMin}–{estimado.estimativaMinMax} min
          </p>
        )}
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
