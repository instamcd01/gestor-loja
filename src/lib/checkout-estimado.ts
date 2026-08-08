/**
 * Resultado da etapa de ENTREGA do checkout (retirada/entrega, modalidade,
 * agendamento, frete já resolvido) — escrito pelo `EntregaForm` ao clicar
 * "Ir para pagamento" e lido pelo `PagamentoForm` na rota
 * `/carrinho/pagamento`, que só existe depois da primeira etapa. Mesmo
 * padrão de `endereco-estimado.ts` (localStorage + useSyncExternalStore,
 * já validado nesta base pra sobreviver ao SSR sem descompasso entre
 * servidor/cliente). O endereço em si continua vivendo só em
 * `endereco-estimado.ts` — aqui é só o que a etapa de entrega DECIDIU a
 * partir dele (zona, valor, prazo), pra tela de pagamento não precisar
 * recalcular frete de novo.
 *
 * Não guarda nada de pagamento (forma de pagamento, cupom, saldo,
 * parcelas) — isso é preenchido do zero a cada visita à etapa 2, igual já
 * era antes da divisão em duas telas.
 */

export interface CheckoutEstimado {
  tipoEntrega: "retirada" | "entrega";
  modalidadeEntrega: "expressa" | "economica";
  zonaId: string | null;
  /** "Retirada na loja" | "Entrega" | nome da zona — pronto pra exibir no resumo. */
  entregaLabel: string;
  /** Já zerado se a entrega saiu grátis. */
  valorEntrega: number;
  /** Valor cheio da entrega (antes do frete grátis) — null se não há como saber ou não se aplica. */
  valorEntregaOriginal: number | null;
  /** Texto pronto pro resumo, ex: "Chega em 20–35 min" / "Chega até 12/08" / "Pronto em até 30 min". */
  prazoLabel: string | null;
  janelaAgendamento: { inicio: string; fim: string } | null;
}

function chave(empresaId: string) {
  return `gestor_checkout_estimado_${empresaId}`;
}

let snapshotCache: { empresaId: string; bruto: string | null; valor: CheckoutEstimado | null } | null = null;
const ouvintes = new Set<() => void>();

function notificarOuvintes() {
  for (const ouvinte of ouvintes) ouvinte();
}

export function assinarCheckoutEstimado(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function obterSnapshotServidorCheckoutEstimado(): CheckoutEstimado | null {
  return null;
}

export function obterSnapshotCheckoutEstimado(empresaId: string): CheckoutEstimado | null {
  if (typeof window === "undefined") return null;
  const bruto = window.localStorage.getItem(chave(empresaId));
  if (snapshotCache && snapshotCache.empresaId === empresaId && snapshotCache.bruto === bruto) {
    return snapshotCache.valor;
  }
  let valor: CheckoutEstimado | null;
  try {
    valor = bruto ? (JSON.parse(bruto) as CheckoutEstimado) : null;
  } catch {
    valor = null;
  }
  snapshotCache = { empresaId, bruto, valor };
  return valor;
}

export function salvarCheckoutEstimado(empresaId: string, valor: CheckoutEstimado) {
  window.localStorage.setItem(chave(empresaId), JSON.stringify(valor));
  notificarOuvintes();
}

export function limparCheckoutEstimado(empresaId: string) {
  window.localStorage.removeItem(chave(empresaId));
  notificarOuvintes();
}
