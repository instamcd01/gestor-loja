/**
 * Limitador de taxa em memória, por IP — correto pro alvo desse projeto
 * (self-host de instância única via Docker/Easypanel, mesmo raciocínio
 * já usado pro cache de domínio-tenant em dominio-tenant.ts). Não
 * sobrevive a reinício do processo nem escala pra múltiplas instâncias —
 * se isso mudar no futuro (múltiplas réplicas), precisa de um store
 * compartilhado (Redis/Upstash), não dá pra continuar em memória local.
 */

interface Balde {
  contagem: number;
  expiraEm: number;
}

const baldes = new Map<string, Balde>();

// Limpeza periódica pra não vazar memória com IPs que só apareceram uma
// vez (o balde deles nunca mais é lido, mas ficaria ocupando espaço
// pra sempre sem isso).
setInterval(
  () => {
    const agora = Date.now();
    for (const [chave, balde] of baldes) {
      if (balde.expiraEm < agora) baldes.delete(chave);
    }
  },
  5 * 60 * 1000,
);

/** true = permitido, false = estourou o limite pra essa chave nessa janela. */
export function permitido(chave: string, limite: number, janelaMs: number): boolean {
  const agora = Date.now();
  const balde = baldes.get(chave);

  if (!balde || balde.expiraEm < agora) {
    baldes.set(chave, { contagem: 1, expiraEm: agora + janelaMs });
    return true;
  }

  if (balde.contagem >= limite) return false;

  balde.contagem += 1;
  return true;
}

export function ipDaRequisicao(headers: Headers): string {
  const encaminhado = headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "desconhecido";
}
