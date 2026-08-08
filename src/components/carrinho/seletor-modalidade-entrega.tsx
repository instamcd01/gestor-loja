"use client";

import { calcularDataUtilFutura, formatarDataPrevista } from "@/lib/agendamento";
import { formatarPreco } from "@/lib/utils";

type Modalidade = "expressa" | "economica";

function cartao(ativo: boolean) {
  return `relative flex flex-col items-start gap-0.5 rounded-[var(--radius-md)] border p-3 text-left transition-colors ${
    ativo
      ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10"
      : "border-black/10 dark:border-white/10"
  }`;
}

function selo() {
  return "absolute top-2 right-2 rounded-full bg-[var(--color-success)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-success)]";
}

/**
 * Expressa (zona de distância já existente, estimativa em minutos) vs
 * Econômica (config única da loja: valor fixo + prazo em dias úteis, mais
 * barata/lenta) — só aparece quando a loja configurou o frete econômico
 * (`economicoValor` não nulo); com só a expressa disponível não faz
 * sentido pedir pra escolher entre 1 opção só, então some sozinho.
 */
export function SeletorModalidadeEntrega({
  modalidade,
  onMudar,
  valorExpressa,
  estimativaExpressa,
  economicoValor,
  economicoPrazoDias,
  gratis,
}: {
  modalidade: Modalidade;
  onMudar: (modalidade: Modalidade) => void;
  valorExpressa: number;
  estimativaExpressa: { min: number; max: number } | null;
  economicoValor: number | null;
  economicoPrazoDias: number | null;
  /** true quando o subtotal já desbloqueou o frete grátis da zona — vale pras duas modalidades. */
  gratis: boolean;
}) {
  if (economicoValor == null) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">Modalidade de entrega</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onMudar("expressa")} className={cartao(modalidade === "expressa")}>
          {gratis && <span className={selo()}>Grátis</span>}
          <span className="text-sm font-medium">Expressa</span>
          <span className="text-xs text-black/60 dark:text-white/60">
            {estimativaExpressa ? `Chega em ${estimativaExpressa.min}–${estimativaExpressa.max} min` : "A mais rápida"}
          </span>
          <span className="mt-1 text-sm font-semibold">{gratis ? "Grátis" : formatarPreco(valorExpressa)}</span>
        </button>

        <button type="button" onClick={() => onMudar("economica")} className={cartao(modalidade === "economica")}>
          {gratis && <span className={selo()}>Grátis</span>}
          <span className="text-sm font-medium">Econômica</span>
          <span className="text-xs text-black/60 dark:text-white/60">
            {economicoPrazoDias != null
              ? `Chega até ${formatarDataPrevista(calcularDataUtilFutura(economicoPrazoDias))}`
              : "Mais barata"}
          </span>
          <span className="mt-1 text-sm font-semibold">{gratis ? "Grátis" : formatarPreco(economicoValor)}</span>
        </button>
      </div>
    </div>
  );
}
