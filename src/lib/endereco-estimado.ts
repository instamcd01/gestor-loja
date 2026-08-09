import type { EnderecoCliente } from "@/lib/types";

/**
 * Endereço ativo pra esse carrinho (com lat/lng confirmados) + zona
 * resolvida — FONTE ÚNICA de verdade, compartilhada entre a barra "frete
 * grátis" (gaveta/carrinho de visitante/carrinho logado) e o formulário
 * de checkout: os dois só leem daqui (via useSyncExternalStore) e só
 * escrevem aqui (nunca guardam uma cópia própria em estado local). Isso
 * existe de propósito — três variáveis "quase iguais" competindo (cache
 * daqui, endereço salvo na conta, estado local do formulário) foi
 * exatamente a causa de uma sequência de bugs de "barra mostra um
 * endereço, checkout mostra outro" (2026-08-06, ver
 * gestor_loja_lista_melhorias_ondas na memória). O endereço salvo na
 * conta (`enderecoSalvo`, vindo do servidor) só serve como semente
 * inicial UMA VEZ, quando esse cache ainda não existe — depois disso
 * nunca mais é comparado nem tem prioridade sobre o que está aqui.
 *
 * useSyncExternalStore (mesmo padrão de carrinho-convidado.ts): localStorage
 * não existe no servidor, então sem isso o primeiro render no cliente não
 * bateria com o HTML gerado no servidor.
 */

export interface EnderecoEstimado {
  endereco: EnderecoCliente;
  zonaId: string;
  zonaNome: string;
  /** O que seria cobrado NESTE cálculo — pode vir 0 se o subtotal de quando foi salvo já batia o mínimo. Pra "quanto custaria sem desconto", usar valorCheio. */
  valor: number;
  /** Valor cheio da zona, nunca zerado por frete grátis — estável mesmo depois do carrinho mudar. */
  valorCheio: number;
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
  // getSnapshot roda dentro do render do React — um JSON corrompido aqui
  // não pode derrubar a página inteira, precisa cair pra "sem endereço
  // estimado ainda" (mesmo tratamento de carrinho-convidado.ts).
  let valor: EnderecoEstimado | null;
  try {
    valor = bruto ? (JSON.parse(bruto) as EnderecoEstimado) : null;
  } catch {
    valor = null;
  }
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
