"use client";

import { useState } from "react";
import { FiltroEspecie } from "@/components/catalogo/filtro-especie";
import { FiltroFase } from "@/components/catalogo/filtro-fase";
import { FiltroMarca } from "@/components/catalogo/filtro-marca";
import { FiltroPeso } from "@/components/catalogo/filtro-peso";
import { FiltroPorte } from "@/components/catalogo/filtro-porte";
import { FiltroPreco } from "@/components/catalogo/filtro-preco";
import type { FaixaPeso, FaixaPreco } from "@/lib/catalogo";
import { useDrawerA11y } from "@/lib/use-drawer-a11y";

export function FiltrosDrawer({
  marcas,
  marcaAtiva,
  especies,
  especieAtiva,
  fases,
  faseAtiva,
  portes,
  porteAtiva,
  faixasPreco,
  faixaAtiva,
  faixasPeso,
  faixaPesoAtiva,
}: {
  marcas: { marca: string; total: number }[];
  marcaAtiva: string | null;
  especies: { especie: string; total: number }[];
  especieAtiva: string | null;
  fases: { fase: string; total: number }[];
  faseAtiva: string | null;
  portes: { porte: string; total: number }[];
  porteAtiva: string | null;
  faixasPreco: FaixaPreco[];
  faixaAtiva: { min?: number; max?: number } | null;
  faixasPeso: FaixaPeso[];
  faixaPesoAtiva: { min?: number; max?: number } | null;
}) {
  const [aberto, setAberto] = useState(false);
  const ativos =
    (marcaAtiva ? 1 : 0) +
    (especieAtiva ? 1 : 0) +
    (faseAtiva ? 1 : 0) +
    (porteAtiva ? 1 : 0) +
    (faixaAtiva ? 1 : 0) +
    (faixaPesoAtiva ? 1 : 0);
  const painelRef = useDrawerA11y(aberto, () => setAberto(false));

  if (
    marcas.length <= 1 &&
    especies.length <= 1 &&
    fases.length <= 1 &&
    portes.length <= 1 &&
    faixasPreco.length <= 1 &&
    faixasPeso.length <= 1
  )
    return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center gap-1.5 rounded-full border border-black/10 px-3.5 py-2 text-sm font-medium dark:border-white/10"
      >
        <IconeFiltro className="h-4 w-4" />
        Filtros
        {ativos > 0 && (
          <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[10px] font-semibold text-white">
            {ativos}
          </span>
        )}
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setAberto(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div
            ref={painelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Filtros"
            className="relative flex h-full w-full max-w-xs flex-col gap-6 overflow-y-auto bg-[var(--surface)] p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Filtros</h2>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar"
                className="text-lg text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
              >
                ×
              </button>
            </div>

            {especies.length > 1 && <FiltroEspecie especies={especies} especieAtiva={especieAtiva} />}
            {fases.length > 1 && <FiltroFase fases={fases} faseAtiva={faseAtiva} />}
            {portes.length > 1 && <FiltroPorte portes={portes} porteAtivo={porteAtiva} />}
            {marcas.length > 1 && <FiltroMarca marcas={marcas} marcaAtiva={marcaAtiva} />}
            {faixasPreco.length > 1 && <FiltroPreco faixas={faixasPreco} faixaAtiva={faixaAtiva} />}
            {faixasPeso.length > 1 && <FiltroPeso faixas={faixasPeso} faixaAtiva={faixaPesoAtiva} />}

            <button
              type="button"
              onClick={() => setAberto(false)}
              className="mt-auto w-full rounded-full bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-medium text-white"
            >
              Ver resultados
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function IconeFiltro({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}
