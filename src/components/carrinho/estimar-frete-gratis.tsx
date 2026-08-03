"use client";

import { useState, useSyncExternalStore } from "react";
import { FreteGratisProgresso } from "@/components/carrinho/frete-gratis-progresso";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { estimarFreteGratisPorCep } from "@/lib/checkout";
import {
  assinarZonaEstimada,
  limparZonaEstimada,
  obterSnapshotServidorZonaEstimada,
  obterSnapshotZonaEstimada,
  salvarZonaEstimada,
  type ZonaEntregaEstimada,
} from "@/lib/zona-entrega-estimada";

/**
 * Pede o CEP antes de afirmar "frete grátis" — sem endereço não dá pra
 * saber qual zona (e qual mínimo) se aplica, mostrar um valor genérico
 * antes disso induz ao erro (relatado pelo usuário: aparecia "desbloqueado"
 * sem nenhum dado preenchido). Guarda o resultado no navegador pra não
 * pedir de novo em toda visita.
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
  const zona = useSyncExternalStore(
    assinarZonaEstimada,
    () => obterSnapshotZonaEstimada(empresaId),
    obterSnapshotServidorZonaEstimada,
  );
  const [cep, setCep] = useState("");
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState(false);

  async function calcular() {
    const cepLimpo = cep.replace(/\D/g, "");
    if (cepLimpo.length !== 8) {
      setErro(true);
      return;
    }
    setCalculando(true);
    setErro(false);

    const resultado = await estimarFreteGratisPorCep(empresaId, enderecoEmpresa, cepLimpo);
    setCalculando(false);

    if (!resultado.encontrada) {
      setErro(true);
      return;
    }

    const nova: ZonaEntregaEstimada = {
      cep: cepLimpo,
      zonaId: resultado.zonaId,
      zonaNome: resultado.zonaNome,
      valorMinimoFreteGratis: resultado.valorMinimoFreteGratis,
    };
    salvarZonaEstimada(empresaId, nova);
  }

  if (zona) {
    if (zona.valorMinimoFreteGratis == null) return null;
    return (
      <div className="flex flex-col gap-1">
        <FreteGratisProgresso subtotal={subtotal} minimo={zona.valorMinimoFreteGratis} />
        <button
          type="button"
          onClick={() => {
            limparZonaEstimada(empresaId);
            setCep("");
          }}
          className="self-start text-xs text-black/40 hover:underline dark:text-white/40"
        >
          Trocar CEP
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-black/5 bg-[var(--surface)] p-4 dark:border-white/10">
      <p className="text-xs font-medium">Informe seu CEP pra ver se sua região tem frete grátis</p>
      <div className="flex gap-2">
        <Input
          value={cep}
          onChange={(e) => setCep(e.target.value)}
          placeholder="00000-000"
          inputMode="numeric"
          maxLength={9}
          className="py-1.5"
        />
        <Button type="button" onClick={calcular} disabled={calculando} className="shrink-0 px-4 py-1.5 text-xs">
          {calculando ? "Calculando..." : "Calcular"}
        </Button>
      </div>
      {erro && (
        <p className="text-xs text-[var(--color-danger)]">
          Não encontramos esse CEP na nossa área de entrega.
        </p>
      )}
    </div>
  );
}
