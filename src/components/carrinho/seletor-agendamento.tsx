"use client";

import { useMemo, useState } from "react";
import type { EmpresaCatalogo } from "@/lib/types";
import { gerarJanelasHorario, gerarOpcoesData, type JanelaHorarioAgendamento, type OpcaoDataAgendamento } from "@/lib/agendamento";

function pill(ativo: boolean) {
  return `rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
    ativo
      ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
      : "border-black/10 dark:border-white/10"
  }`;
}

function pillPequena(ativo: boolean) {
  return `rounded-full border px-3 py-1.5 text-xs font-medium ${
    ativo
      ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
      : "border-black/10 text-black/60 dark:border-white/10 dark:text-white/60"
  }`;
}

/**
 * "Quero agora" (padrão) vs "Agendar" — janela de 1h dentro do horário
 * de funcionamento da loja, hoje até 3 dias à frente. Vale tanto pra
 * entrega quanto pra retirada (a tela de cima já decide qual das duas).
 */
export function SeletorAgendamento({
  horarioFuncionamento,
  janela,
  onMudarJanela,
  estimativa,
}: {
  horarioFuncionamento: EmpresaCatalogo["horario_funcionamento"];
  janela: JanelaHorarioAgendamento | null;
  onMudarJanela: (janela: JanelaHorarioAgendamento | null) => void;
  /** Estimativa da zona de entrega (min–max em minutos) — null pra retirada, ou entrega sem frete resolvido ainda. Mostrada como legenda de "Quero agora", já que é o que esse horário representa. */
  estimativa?: { min: number; max: number } | null;
}) {
  const opcoesData = useMemo(() => gerarOpcoesData(horarioFuncionamento), [horarioFuncionamento]);
  const [agendando, setAgendando] = useState(false);
  const [dataEscolhida, setDataEscolhida] = useState<OpcaoDataAgendamento | null>(opcoesData[0] ?? null);

  const janelasHorario = useMemo(
    () =>
      dataEscolhida ? gerarJanelasHorario(dataEscolhida.data, dataEscolhida.diaSemana, horarioFuncionamento) : [],
    [dataEscolhida, horarioFuncionamento],
  );

  // Loja fechada nos próximos dias (feriado prolongado etc.) — sem
  // nenhuma data disponível, não faz sentido nem oferecer "Agendar".
  if (opcoesData.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-sm font-semibold">Quando?</p>
      <div className="flex items-start gap-2">
        <div className="flex flex-1 flex-col items-start gap-1">
          <button
            type="button"
            onClick={() => {
              setAgendando(false);
              onMudarJanela(null);
            }}
            className={`w-full ${pill(!agendando)}`}
          >
            Quero agora
          </button>
          {estimativa && (
            <p className="px-1 text-xs text-black/50 dark:text-white/50">
              Entrega estimada em {estimativa.min}–{estimativa.max} min
            </p>
          )}
        </div>
        <button type="button" onClick={() => setAgendando(true)} className={pill(agendando)}>
          Agendar
        </button>
      </div>

      {agendando && (
        <div className="mt-3 flex flex-col gap-2 rounded-[var(--radius-md)] border border-black/10 p-3 dark:border-white/10">
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
