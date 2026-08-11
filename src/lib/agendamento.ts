import type { EmpresaCatalogo } from "@/lib/types";

type HorarioFuncionamento = EmpresaCatalogo["horario_funcionamento"];

const DIAS_SEMANA = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"] as const;
type DiaSemana = (typeof DIAS_SEMANA)[number];

const DIAS_A_FRENTE = 3;
const ANTECEDENCIA_MINIMA_MIN = 60;
const DURACAO_JANELA_MIN = 60;

export interface OpcaoDataAgendamento {
  /** YYYY-MM-DD, sempre no fuso do navegador (mesmo raciocínio de horário já usado no resto do checkout). */
  data: string;
  label: string;
  diaSemana: DiaSemana;
}

export interface JanelaHorarioAgendamento {
  inicio: string; // ISO
  fim: string; // ISO
  label: string; // "18:00–19:00"
}

function formatarDataISO(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function formatarHM(data: Date): string {
  return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Horário real estimado de chegada a partir de agora — mesma faixa
 * usada em "Quero agora" (min–max em minutos, vindo da zona de entrega),
 * só que convertida pro cliente ver um horário de relógio em vez de ter
 * que somar a duração de cabeça. Fixado em America/Sao_Paulo (fuso da
 * loja), não no fuso do navegador de quem está comprando.
 */
export function estimarChegada(min: number, max: number): { inicio: string; fim: string } {
  const agora = Date.now();
  const formatar = (data: Date) =>
    data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  return {
    inicio: formatar(new Date(agora + min * 60_000)),
    fim: formatar(new Date(agora + max * 60_000)),
  };
}

/**
 * Data prevista pulando os dias em que a LOJA está fechada de verdade
 * (`horario_funcionamento`) — mesma regra usada em `finalizar_pedido_site`
 * (SQL) pra modalidade "Econômica" (config única da loja, valor fixo +
 * prazo em dias úteis) — transforma "até X dias úteis" numa data real em
 * vez de deixar o cliente contar de cabeça. Achado real: "dias úteis" não
 * é sinônimo de "segunda a sexta" — uma loja que abre todo dia (comum em
 * pet shop) não deveria ter o prazo inflado pulando sábado/domingo à toa.
 * Sem `horario_funcionamento` configurado pro dia, assume aberto.
 */
export function calcularDataUtilFutura(diasUteis: number, horarioFuncionamento?: HorarioFuncionamento | null): Date {
  let data = new Date();
  let restantes = diasUteis;
  while (restantes > 0) {
    data = new Date(data.getFullYear(), data.getMonth(), data.getDate() + 1);
    const diaSemana = DIAS_SEMANA[data.getDay()];
    const fechado = horarioFuncionamento?.[diaSemana]?.aberto === false;
    if (!fechado) restantes--;
  }
  return data;
}

/**
 * Horário de fechamento da loja no dia informado — pra completar "chega
 * até <data> às <hora>" em vez de só a data, já que o cliente também quer
 * saber até que horas esperar a entrega naquele dia. `null` = dia sem
 * horário configurado (não força um valor padrão, só omite a hora).
 */
export function horarioFechamentoNoDia(data: Date, horarioFuncionamento?: HorarioFuncionamento | null): string | null {
  const diaSemana = DIAS_SEMANA[data.getDay()];
  return horarioFuncionamento?.[diaSemana]?.fecha ?? null;
}

export function formatarDataPrevista(data: Date): string {
  return data.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

/**
 * Dias em que dá pra agendar — hoje até +3 dias, pulando os que a loja
 * marcou como fechado em Configurações > Horário de Funcionamento.
 */
export function gerarOpcoesData(horarioFuncionamento: HorarioFuncionamento | null | undefined): OpcaoDataAgendamento[] {
  const opcoes: OpcaoDataAgendamento[] = [];
  const hoje = new Date();

  for (let i = 0; i <= DIAS_A_FRENTE; i++) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i);
    const diaSemana = DIAS_SEMANA[data.getDay()];
    const config = horarioFuncionamento?.[diaSemana];
    if (config?.aberto === false) continue;

    const label =
      i === 0
        ? "Hoje"
        : i === 1
          ? "Amanhã"
          : data.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
    opcoes.push({ data: formatarDataISO(data), label, diaSemana });
  }
  return opcoes;
}

/**
 * Janelas de 1h dentro do horário de funcionamento do dia escolhido,
 * já descartando qualquer janela que comece antes de 1h a partir de
 * agora (tempo mínimo pra loja se preparar).
 */
export function gerarJanelasHorario(
  dataISO: string,
  diaSemana: DiaSemana,
  horarioFuncionamento: HorarioFuncionamento | null | undefined,
): JanelaHorarioAgendamento[] {
  const config = horarioFuncionamento?.[diaSemana];
  if (config?.aberto === false) return [];

  const abre = config?.abre ?? "08:00";
  const fecha = config?.fecha ?? "18:00";
  const [horaAbre, minAbre] = abre.split(":").map(Number);
  const [horaFecha, minFecha] = fecha.split(":").map(Number);
  const [ano, mes, dia] = dataISO.split("-").map(Number);

  const antecedenciaMinima = new Date(Date.now() + ANTECEDENCIA_MINIMA_MIN * 60_000);
  const fechamento = new Date(ano, mes - 1, dia, horaFecha, minFecha);

  const janelas: JanelaHorarioAgendamento[] = [];
  let cursor = new Date(ano, mes - 1, dia, horaAbre, minAbre);

  while (cursor.getTime() + DURACAO_JANELA_MIN * 60_000 <= fechamento.getTime()) {
    const inicio = new Date(cursor);
    const fim = new Date(cursor.getTime() + DURACAO_JANELA_MIN * 60_000);

    if (inicio >= antecedenciaMinima) {
      janelas.push({ inicio: inicio.toISOString(), fim: fim.toISOString(), label: `${formatarHM(inicio)}–${formatarHM(fim)}` });
    }
    cursor = fim;
  }
  return janelas;
}
