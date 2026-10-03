import { createClient } from "@supabase/supabase-js";

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: Map<string, string> | null = null;
let cacheExpiraEm = 0;

async function carregarMapaDominios(): Promise<Map<string, string>> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data, error } = await supabase
    .from("catalogo_dominios_publico")
    .select("dominio_customizado, catalogo_slug");

  if (error) {
    console.error("Erro ao carregar domínios de tenants:", error.message);
    return new Map();
  }

  return new Map(
    (data ?? [])
      .filter((linha) => linha.dominio_customizado && linha.catalogo_slug)
      .map((linha) => [linha.dominio_customizado as string, linha.catalogo_slug as string]),
  );
}

/**
 * Resolve um host (ex: "minhaloja.com.br") pro catalogo_slug da empresa
 * dona desse domínio. Cache em memória de processo por 5min — a tabela
 * de domínios muda raríssimo, não vale ida ao banco em toda requisição.
 * Cache é por processo (não distribuído): correto pro deploy self-hosted
 * de instância única deste projeto, não sobreviveria a múltiplas
 * instâncias/edge sem coordenação — revisitar se isso mudar.
 */
export async function resolverSlugPorDominio(host: string): Promise<string | null> {
  if (!cache || Date.now() > cacheExpiraEm) {
    cache = await carregarMapaDominios();
    cacheExpiraEm = Date.now() + CACHE_TTL_MS;
  }
  return cache.get(host.toLowerCase()) ?? null;
}

/**
 * Caminho inverso: origem pública (ex: "https://minhaloja.com.br") da loja
 * pelo slug — pra URLs absolutas em dados estruturados (schema.org) sem ler
 * o Host da requisição, o que forçaria a página a sair do cache ISR. Loja
 * sem domínio próprio cai no SITE_URL (host do próprio site).
 */
export async function origemPublicaPorSlug(slug: string): Promise<string> {
  if (!cache || Date.now() > cacheExpiraEm) {
    cache = await carregarMapaDominios();
    cacheExpiraEm = Date.now() + CACHE_TTL_MS;
  }
  for (const [dominio, slugDominio] of cache) {
    if (slugDominio === slug) return `https://${dominio}`;
  }
  return (process.env.SITE_URL ?? "").replace(/\/$/, "");
}
