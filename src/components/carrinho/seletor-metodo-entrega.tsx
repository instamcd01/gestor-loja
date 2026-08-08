"use client";

import { useMemo, useState } from "react";
import {
  calcularDataUtilFutura,
  formatarDataPrevista,
  gerarJanelasHorario,
  gerarOpcoesData,
  type JanelaHorarioAgendamento,
  type OpcaoDataAgendamento,
} from "@/lib/agendamento";
import type { EmpresaCatalogo } from "@/lib/types";
import { formatarPreco } from "@/lib/utils";

type Metodo = "expressa" | "economica" | "agendada";

function pillPequena(ativo: boolean) {
  return `rounded-full border px-3 py-1.5 text-xs font-medium ${
    ativo
      ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
      : "border-black/10 text-black/60 dark:border-white/10 dark:text-white/60"
  }`;
}

/**
 * Uma escolha só pra "como e quando" a entrega acontece — Expressa (zona
 * de distância já existente) / Econômica (config única da loja, mais
 * barata/lenta) / Agendada (escolhe data e horário, mesmo preço da
 * expressa). Antes eram DOIS controles empilhados (modalidade +
 * "Quero agora/Agendar" à parte) que podiam parecer contraditórios
 * (ex: escolher "Econômica" E "Quero agora" ao mesmo tempo) — reportado
 * pelo usuário como ambíguo. Só cobre ENTREGA: retirada continua com o
 * `SeletorAgendamento` simples (agora/agendar), sem modalidade nenhuma.
 */
export function SeletorMetodoEntrega({
  metodo,
  onMudarMetodo,
  valorExpressa,
  estimativaExpressa,
  economicoValor,
  economicoPrazoDias,
  gratis,
  horarioFuncionamento,
  janela,
  onMudarJanela,
}: {
  metodo: Metodo;
  onMudarMetodo: (metodo: Metodo) => void;
  valorExpressa: number;
  estimativaExpressa: { min: number; max: number } | null;
  economicoValor: number | null;
  economicoPrazoDias: number | null;
  /** true quando o subtotal já desbloqueou o frete grátis da zona — vale pras 3 opções (agendada usa o mesmo preço da expressa). */
  gratis: boolean;
  horarioFuncionamento: EmpresaCatalogo["horario_funcionamento"];
  janela: JanelaHorarioAgendamento | null;
  onMudarJanela: (janela: JanelaHorarioAgendamento | null) => void;
}) {
  const opcoesData = useMemo(() => gerarOpcoesData(horarioFuncionamento), [horarioFuncionamento]);
  const [dataEscolhida, setDataEscolhida] = useState<OpcaoDataAgendamento | null>(opcoesData[0] ?? null);
  const janelasHorario = useMemo(
    () =>
      dataEscolhida ? gerarJanelasHorario(dataEscolhida.data, dataEscolhida.diaSemana, horarioFuncionamento) : [],
    [dataEscolhida, horarioFuncionamento],
  );

  function selecionar(novo: Metodo) {
    onMudarMetodo(novo);
    if (novo !== "agendada") onMudarJanela(null);
  }

  const cartaoBase =
    "relative flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border p-3 text-left transition-colors";
  function cartao(ativo: boolean) {
    return `${cartaoBase} ${
      ativo ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10" : "border-black/10 dark:border-white/10"
    }`;
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">Quando você quer receber?</p>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => selecionar("expressa")} className={cartao(metodo === "expressa")}>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Expressa</span>
            <span className="text-xs text-black/60 dark:text-white/60">
              {estimativaExpressa ? `Chega em ${estimativaExpressa.min}–${estimativaExpressa.max} min` : "A mais rápida"}
            </span>
          </div>
          <span className={`text-sm font-semibold ${gratis ? "text-[var(--color-success)]" : ""}`}>
            {gratis ? "Grátis" : formatarPreco(valorExpressa)}
          </span>
        </button>

        {economicoValor != null && (
          <button type="button" onClick={() => selecionar("economica")} className={cartao(metodo === "economica")}>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Econômica</span>
              <span className="text-xs text-black/60 dark:text-white/60">
                {economicoPrazoDias != null
                  ? `Chega até ${formatarDataPrevista(calcularDataUtilFutura(economicoPrazoDias))}`
                  : "Mais barata"}
              </span>
            </div>
            <span className={`text-sm font-semibold ${gratis ? "text-[var(--color-success)]" : ""}`}>
              {gratis ? "Grátis" : formatarPreco(economicoValor)}
            </span>
          </button>
        )}

        {opcoesData.length > 0 && (
          <button type="button" onClick={() => selecionar("agendada")} className={cartao(metodo === "agendada")}>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Agendada</span>
              <span className="text-xs text-black/60 dark:text-white/60">Você escolhe o dia e horário</span>
            </div>
            <span className={`text-sm font-semibold ${gratis ? "text-[var(--color-success)]" : ""}`}>
              {gratis ? "Grátis" : formatarPreco(valorExpressa)}
            </span>
          </button>
        )}
      </div>

      {metodo === "agendada" && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-black/10 p-3 dark:border-white/10">
          <div className="flex flex-wrap gap-2">
            {opcoesData.map((opcao) => (
              <button
                key={opcao.data}
                type="button"
                onClick={() => {
                  setDataEscolhida(opcao);
                  onMudarJanela(null);
                }}
                className={pillPequena(dataEscolhida?.data === opcao.data)}
              >
                {opcao.label}
              </button>
            ))}
          </div>

          {janelasHorario.length === 0 ? (
            <p className="text-xs text-black/50 dark:text-white/50">Sem horários disponíveis nesse dia.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {janelasHorario.map((opcao) => (
                <button
                  key={opcao.inicio}
                  type="button"
                  onClick={() => onMudarJanela(opcao)}
                  className={pillPequena(janela?.inicio === opcao.inicio)}
                >
                  {opcao.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
