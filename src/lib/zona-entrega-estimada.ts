/**
 * Zona de entrega estimada por CEP, guardada só no navegador — resultado
 * de EstimarFreteGratis. Separado do endereço completo salvo na conta
 * (ver EnderecoCliente/salvarEndereco), que só existe depois de logar no
 * checkout de verdade. Aqui é só uma estimativa rápida pra decidir se
 * mostra a barra de frete grátis antes disso.
 *
 * useSyncExternalStore (mesmo padrão de carrinho-convidado.ts): localStorage
 * não existe no servidor, então sem isso o primeiro render no cliente não
 * bateria com o HTML gerado no servidor.
 */

export interface ZonaEntregaEstimada {
  cep: string;
  zonaId: string;
  zonaNome: string;
  valorMinimoFreteGratis: number | null;
}

function chave(empresaId: string) {
  return `gestor_zona_estimada_${empresaId}`;
}

let snapshotCache: { empresaId: string; bruto: string | null; zona: ZonaEntregaEstimada | null } | null = null;
const ouvintes = new Set<() => void>();

function notificarOuvintes() {
  for (const ouvinte of ouvintes) ouvinte();
}

export function assinarZonaEstimada(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function obterSnapshotServidorZonaEstimada(): ZonaEntregaEstimada | null {
  return null;
}

export function obterSnapshotZonaEstimada(empresaId: string): ZonaEntregaEstimada | null {
  if (typeof window === "undefined") return null;
  const bruto = window.localStorage.getItem(chave(empresaId));
  if (snapshotCache && snapshotCache.empresaId === empresaId && snapshotCache.bruto === bruto) {
    return snapshotCache.zona;
  }
  const zona = bruto ? (JSON.parse(bruto) as ZonaEntregaEstimada) : null;
  snapshotCache = { empresaId, bruto, zona };
  return zona;
}

export function salvarZonaEstimada(empresaId: string, zona: ZonaEntregaEstimada) {
  window.localStorage.setItem(chave(empresaId), JSON.stringify(zona));
  notificarOuvintes();
}

export function limparZonaEstimada(empresaId: string) {
  window.localStorage.removeItem(chave(empresaId));
  notificarOuvintes();
}
