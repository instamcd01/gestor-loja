import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getEmpresaPorSlug, getUrlsSitemapCatalogo } from "@/lib/catalogo";
import { resolverSlugPorDominio } from "@/lib/dominio-tenant";
import { caminhoCategoria, caminhoLoja, caminhoProduto } from "@/lib/seo";

/**
 * Cada domínio de tenant serve o catálogo daquela empresa como se fosse
 * o site inteiro — por isso o sitemap é resolvido a partir do Host da
 * requisição, igual o middleware faz pra rotear. Sem domínio reconhecido
 * (ex: host de hospedagem cru, ou dev), devolve só a home como fallback
 * mínimo — não há uma "loja" única pra listar produtos.
 *
 * URLs no MESMO formato da canônica de cada página (`/loja/[slug]/...`,
 * ver lib/seo.ts). Antes listava `/produto/x` enquanto a página declarava
 * `/loja/slug/produto/x` como canônica — o Google tratava as duas como
 * cópia uma da outra (359 páginas no Search Console, 03/10).
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

  const produtos = await getUrlsSitemapCatalogo(empresa.id);
  const categorias = [...new Set(produtos.map((p) => p.categoria).filter((c): c is string => !!c))].sort();
  const paginasInstitucionais = ["mais-vendidos", "entrega", "perguntas-frequentes", "trocas-e-devolucoes"];

  return [
    { url: `${base}${caminhoLoja(slug)}`, changeFrequency: "daily", priority: 1 },
    ...categorias.map(
      (categoria): MetadataRoute.Sitemap[number] => ({
        url: `${base}${caminhoCategoria(slug, categoria)}`,
        changeFrequency: "daily",
        priority: 0.8,
      }),
    ),
    ...produtos.map(
      (produto): MetadataRoute.Sitemap[number] => ({
        url: `${base}${caminhoProduto(slug, produto.id, produto.nome)}`,
        ...(produto.updated_at ? { lastModified: new Date(produto.updated_at) } : {}),
        changeFrequency: "weekly",
        priority: 0.7,
      }),
    ),
    ...paginasInstitucionais.map(
      (pagina): MetadataRoute.Sitemap[number] => ({
        url: `${base}${caminhoLoja(slug)}/${pagina}`,
        changeFrequency: "monthly",
        priority: 0.3,
      }),
    ),
  ];
}
