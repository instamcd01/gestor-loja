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

/**
 * Deploy é atrás de um único proxy reverso confiável (Traefik do
 * Easypanel, ver README > Deploy) — nunca múltiplos hops. Um proxy
 * reverso sempre ANEXA o IP que ele mesmo observou ao final do header
 * X-Forwarded-For (nunca sobrescreve as entradas anteriores), então a
 * ÚLTIMA entrada é a única que o cliente não consegue forjar. Pegar a
 * PRIMEIRA (como estava antes) confia cegamente no que o próprio
 * visitante manda nesse header, permitindo qualquer um se passar por
 * outro IP e assim burlar o limite de requisições por IP.
 */
export function ipDaRequisicao(headers: Headers): string {
  const encaminhado = headers.get("x-forwarded-for");
  if (encaminhado) {
    const ips = encaminhado.split(",").map((ip) => ip.trim());
    return ips[ips.length - 1];
  }
  return headers.get("x-real-ip") ?? "desconhecido";
}
