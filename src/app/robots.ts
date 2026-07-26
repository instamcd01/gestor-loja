import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/**
 * Dinâmico (lê o Host) porque cada domínio de tenant é o site inteiro
 * pra quem visita — o sitemap referenciado precisa apontar pro mesmo
 * domínio, não pro host de hospedagem por trás.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") ?? "";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Páginas funcionais/privadas do cliente — nada ali é conteúdo pra indexar.
      disallow: ["/carrinho", "/entrar", "/conta", "/pedido"],
    },
    sitemap: host ? `https://${host}/sitemap.xml` : undefined,
  };
}
