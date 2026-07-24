import type { NextConfig } from "next";

// Hostname do Supabase resolvido da própria env var (uma fonte de verdade
// só) — evita duplicar o project ref hardcoded aqui.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
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
