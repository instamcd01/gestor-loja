import type { EnderecoCliente } from "@/lib/types";

/**
 * Endereço (com lat/lng confirmados) + zona resolvida, guardados só no
 * navegador — resultado de CapturarEndereco usado antes do checkout
 * (produto/gaveta/carrinho). Também serve pra pré-preencher o checkout
 * de verdade sem pedir o endereço de novo, quando o cliente ainda não
 * tem um salvo na conta (`enderecoSalvo` null). Uma vez que o checkout
 * salva o endereço na conta (`salvarEndereco`), a conta passa a ser a
 * fonte de verdade — isso aqui só preenche o vazio até lá.
 *
 * useSyncExternalStore (mesmo padrão de carrinho-convidado.ts): localStorage
 * não existe no servidor, então sem isso o primeiro render no cliente não
 * bateria com o HTML gerado no servidor.
 */

export interface EnderecoEstimado {
  endereco: EnderecoCliente;
  zonaId: string;
  zonaNome: string;
  valor: number;
  freteGratis: boolean;
  valorMinimoFreteGratis: number | null;
  estimativaMinMin: number | null;
  estimativaMinMax: number | null;
}

function chave(empresaId: string) {
  return `gestor_endereco_estimado_${empresaId}`;
}

let snapshotCache: { empresaId: string; bruto: string | null; valor: EnderecoEstimado | null } | null = null;
const ouvintes = new Set<() => void>();

function notificarOuvintes() {
  for (const ouvinte of ouvintes) ouvinte();
}

export function assinarEnderecoEstimado(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function obterSnapshotServidorEnderecoEstimado(): EnderecoEstimado | null {
  return null;
}

export function obterSnapshotEnderecoEstimado(empresaId: string): EnderecoEstimado | null {
  if (typeof window === "undefined") return null;
  const bruto = window.localStorage.getItem(chave(empresaId));
  if (snapshotCache && snapshotCache.empresaId === empresaId && snapshotCache.bruto === bruto) {
    return snapshotCache.valor;
  }
  const valor = bruto ? (JSON.parse(bruto) as EnderecoEstimado) : null;
  snapshotCache = { empresaId, bruto, valor };
  return valor;
}

export function salvarEnderecoEstimado(empresaId: string, valor: EnderecoEstimado) {
  window.localStorage.setItem(chave(empresaId), JSON.stringify(valor));
  notificarOuvintes();
}

export function limparEnderecoEstimado(empresaId: string) {
  window.localStorage.removeItem(chave(empresaId));
  notificarOuvintes();
}
