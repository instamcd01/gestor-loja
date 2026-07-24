import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Fotos de produto vêm de fontes variadas (storage do Supabase, links
    // colados na planilha de importação, etc). Restringir isso a hosts
    // conhecidos é um TODO antes de produção — por ora fica aberto para
    // o esqueleto não travar em imagem nenhuma.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
