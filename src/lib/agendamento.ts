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

function paraHM(data: Date): string {
  return `${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}`;
}

export interface StatusLoja {
  aberto: boolean;
  /** Só quando fechado — pronto pra UI, ex: "Abre às 08:00" / "Abre amanhã às 08:00" / "Abre seg às 08:00". */
  label: string | null;
}

/**
 * Loja aberta *agora* (dia + hora do relógio) — não confundir com
 * `gerarOpcoesData` (que só pula dias marcados como fechados pra
 * AGENDAR, sem olhar a hora atual). Usado pra travar pedido IMEDIATO
 * (Expressa/"Quero agora") fora do horário de funcionamento — a mesma
 * regra é reaplicada de verdade no servidor (`_finalizar_pedido_core`),
 * isto aqui é só a UI. Sem `horario_funcionamento` configurado, assume
 * sempre aberto (mesma regra já usada no resto deste arquivo).
 */
export function statusLojaAgora(horarioFuncionamento: HorarioFuncionamento | null | undefined): StatusLoja {
  if (!horarioFuncionamento) return { aberto: true, label: null };

  const agora = new Date();
  const diaHoje = DIAS_SEMANA[agora.getDay()];
  const configHoje = horarioFuncionamento[diaHoje];
  const horaAtual = paraHM(agora);

  if (configHoje?.aberto !== false) {
    const abre = configHoje?.abre;
    const fecha = configHoje?.fecha;
    if (!abre || !fecha || (horaAtual >= abre && horaAtual < fecha)) {
      return { aberto: true, label: null };
    }
    if (horaAtual < abre) {
      return { aberto: false, label: `Abre às ${abre}` };
    }
  }

  // Fechado por hoje (já passou do horário, ou o dia inteiro é fechado) —
  // procura o próximo dia aberto, até 1 semana à frente.
  for (let i = 1; i <= 7; i++) {
    const data = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + i);
    const diaSemana = DIAS_SEMANA[data.getDay()];
    const config = horarioFuncionamento[diaSemana];
    if (config?.aberto !== false) {
      const abre = config?.abre ?? "08:00";
      const rotuloDia = i === 1 ? "amanhã" : data.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
      return { aberto: false, label: `Abre ${rotuloDia} às ${abre}` };
    }
  }
  return { aberto: false, label: null };
}

export interface DisponibilidadeImediata {
  disponivel: boolean;
  /** Só quando indisponível — já pronto pra UI: "Loja em pausa • motivo • Volta às HH:MM" ou "Loja fechada • Abre às HH:MM". */
  mensagem: string | null;
}

/**
 * Combina pausa programada/imediata (pausas_loja) com o horário normal
 * pra decidir se pedido IMEDIATO (Expressa/"Quero agora") pode ser
 * oferecido agora — pausa tem precedência (é mais específica: tem
 * motivo e hora de volta exatos) sobre "loja fechada" (rotina semanal).
 * Agendada/Econômica nunca passam por aqui — nenhuma das duas promete
 * atendimento na hora. A trava de verdade é no servidor
 * (`_finalizar_pedido_core`), isto aqui é só a UI.
 */
export function disponibilidadeImediataAgora(
  horarioFuncionamento: HorarioFuncionamento | null | undefined,
  pausaAtiva: { motivo: string | null; fim: string } | null | undefined,
): DisponibilidadeImediata {
  if (pausaAtiva) {
    const label = new Date(pausaAtiva.fim).toLocaleString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
    return {
      disponivel: false,
      mensagem: `Loja em pausa${pausaAtiva.motivo ? ` • ${pausaAtiva.motivo}` : ""} • Volta às ${label}`,
    };
  }

  const status = statusLojaAgora(horarioFuncionamento);
  if (!status.aberto) {
    return { disponivel: false, mensagem: `Loja fechada${status.label ? ` • ${status.label}` : ""}` };
  }
  return { disponivel: true, mensagem: null };
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
  /** Janelas de pausa (ativa ou já agendada) a excluir — mesma regra aplicada de verdade no servidor. */
  pausasAgendamento?: { inicio: string; fim: string }[] | null,
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

    const dentroDePausa = pausasAgendamento?.some(
      (p) => inicio < new Date(p.fim) && fim > new Date(p.inicio),
    );

    if (inicio >= antecedenciaMinima && !dentroDePausa) {
      janelas.push({ inicio: inicio.toISOString(), fim: fim.toISOString(), label: `${formatarHM(inicio)}–${formatarHM(fim)}` });
    }
    cursor = fim;
  }
  return janelas;
}
