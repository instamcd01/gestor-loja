import type { NextConfig } from "next";

// Hostname do Supabase resolvido da própria env var (uma fonte de verdade
// só) — evita duplicar o project ref hardcoded aqui.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // Standalone: gera .next/standalone com só as deps realmente usadas em
  // runtime — é o formato recomendado pelo Next.js pra self-host via
  // Docker (evita copiar node_modules inteiro pra imagem final).
  output: "standalone",
  images: {
    // Padrão do Next (14400s = 4h) expira rápido demais pra foto de
    // produto, que quase nunca muda — e quando muda, `ProdutoImagem` já
    // troca a URL via cache-busting (`?cb=updated_at`), então uma entrada
    // de cache nunca fica "presa" numa versão velha por causa do TTL
    // longo aqui. Achado real (15/09): cada redeploy apaga o cache de
    // imagem do container (`.next/cache` não é volume persistente —
    // ver Dockerfile/instruções de infra), e o servidor rebaixava a
    // MESMA imagem 11-15x em 24h simplesmente por reprocessar do zero a
    // cada request até o cache (efêmero) repopular — maior consumidor de
    // egress do projeto. TTL longo reduz o estrago entre um redeploy e
    // outro; o resto da causa (cache não sobreviver ao redeploy) precisa
    // de volume persistente no Easypanel, fora do alcance de código.
    minimumCacheTTL: 31536000,

    // Hosts checados contra os dados reais de produção (939 produtos,
    // 2026-07-24): só dois hosts aparecem em `produtos.imagem_url` hoje
    // — Supabase Storage e imagens.lukz.com.br (CDN próprio, ainda
    // servindo algumas fotos por http). Qualquer host novo de imagem
    // precisa ser adicionado aqui explicitamente — é o ponto todo do
    // remotePatterns não ser "**": a API de otimização de imagem do
    // Next não deve virar proxy pra buscar URL arbitrária.
    remotePatterns: [
      ...(supabaseHostname
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      { protocol: "http" as const, hostname: "imagens.lukz.com.br" },
      { protocol: "https" as const, hostname: "imagens.lukz.com.br" },
    ],
  },
};

export default nextConfig;
