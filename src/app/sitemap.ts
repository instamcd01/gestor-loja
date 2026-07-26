import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getEmpresaPorSlug, getProdutosCatalogo } from "@/lib/catalogo";
import { resolverSlugPorDominio } from "@/lib/dominio-tenant";

/**
 * Cada domínio de tenant serve o catálogo daquela empresa como se fosse
 * o site inteiro — por isso o sitemap é resolvido a partir do Host da
 * requisição, igual o middleware faz pra rotear. Sem domínio reconhecido
 * (ex: host de hospedagem cru, ou dev), devolve só a home como fallback
 * mínimo — não há uma "loja" única pra listar produtos.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get("host")?.split(":")[0];
  const base = `https://${host ?? "localhost"}`;

  const slug = host ? await resolverSlugPorDominio(host) : null;
  if (!slug) {
    return [{ url: base, lastModified: new Date() }];
  }

  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) {
    return [{ url: base, lastModified: new Date() }];
  }

  const produtos = await getProdutosCatalogo(empresa.id);

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    ...produtos.map(
      (produto): MetadataRoute.Sitemap[number] => ({
        url: `${base}/produto/${produto.id}`,
        changeFrequency: "weekly",
        priority: 0.7,
      }),
    ),
  ];
}
