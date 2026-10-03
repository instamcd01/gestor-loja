import type { EmpresaCatalogo, ProdutoCatalogo } from "@/lib/types";
import { precoEfetivo } from "@/lib/utils";

/**
 * Textos e dados estruturados (schema.org) pra busca do Google.
 *
 * URLs sempre relativas ao namespace /loja/[slug] — é o mesmo caminho que
 * os links internos, a canônica de cada página e o sitemap usam. Achado
 * real (Search Console, 03/10): sitemap listava `/produto/x` enquanto a
 * canônica dizia `/loja/slug/produto/x` — 359 páginas marcadas como cópia.
 * Manter as três fontes no mesmo formato é o que resolve.
 */

const LIMITE_DESCRICAO = 155;

export function caminhoLoja(slug: string) {
  return `/loja/${slug}`;
}

const UUID_NO_FIM = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * Segmento da URL do produto: nome legível + id no fim, como Petz/Cobasi
 * (`racao-golden-special-15kg-<uuid>`). O id continua sendo a chave — o
 * nome é só pra quem lê o link (Google, WhatsApp); trocar o nome do produto
 * gera URL nova e a antiga redireciona (ver página do produto).
 */
export function segmentoProduto(id: string, nome?: string | null) {
  const legivel = (nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return legivel ? `${legivel}-${id}` : id;
}

/** Id do produto a partir do segmento da URL — aceita o formato novo e o antigo (só o id). */
export function idDoSegmentoProduto(segmento: string) {
  return decodeURIComponent(segmento).match(UUID_NO_FIM)?.[1]?.toLowerCase() ?? null;
}

export function caminhoProduto(slug: string, id: string, nome?: string | null) {
  return `/loja/${slug}/produto/${segmentoProduto(id, nome)}`;
}

export function caminhoCategoria(slug: string, categoria: string) {
  return `/loja/${slug}?categoria=${encodeURIComponent(categoria)}`;
}

/** Corta no último espaço antes do limite, sem deixar palavra pela metade. */
export function resumirTexto(texto: string, limite = LIMITE_DESCRICAO) {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= limite) return limpo;
  const corte = limpo.slice(0, limite - 1);
  const ultimoEspaco = corte.lastIndexOf(" ");
  return `${(ultimoEspaco > 60 ? corte.slice(0, ultimoEspaco) : corte).replace(/[,.;:\-–—]+$/, "")}…`;
}

function emRegiao(empresa: EmpresaCatalogo) {
  return empresa.seo_regiao ? ` em ${empresa.seo_regiao}` : "";
}

export function tituloHome(empresa: EmpresaCatalogo) {
  return empresa.seo_titulo?.trim() || empresa.nome;
}

export function descricaoHome(empresa: EmpresaCatalogo) {
  return (
    empresa.seo_descricao?.trim() ||
    empresa.catalogo_info_extra?.trim() ||
    `Peça online na ${empresa.nome} com entrega rápida${emRegiao(empresa)}.`
  );
}

export function tituloCategoria(empresa: EmpresaCatalogo, categoria: string) {
  return `${categoria} com entrega rápida${emRegiao(empresa)} | ${empresa.nome}`;
}

export function descricaoCategoria(empresa: EmpresaCatalogo, categoria: string) {
  return resumirTexto(
    `${categoria} na ${empresa.nome}, com entrega rápida${emRegiao(empresa)}. Compare preços e peça pelo site ou WhatsApp.`,
  );
}

export function descricaoProduto(empresa: EmpresaCatalogo, produto: ProdutoCatalogo) {
  const preco = precoEfetivo(produto).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const curta = `${produto.nome} por ${preco} na ${empresa.nome}.`;
  const base = `${curta} Entrega rápida${emRegiao(empresa)}.`;
  // Nome longo: melhor perder a frase da entrega inteira do que cortá-la no meio.
  if (base.length > LIMITE_DESCRICAO) return resumirTexto(curta);
  if (!produto.descricao?.trim()) return base;
  return resumirTexto(`${base} ${produto.descricao}`);
}

// ---------- schema.org ----------

const DIAS_SCHEMA: Record<string, string> = {
  segunda: "Monday",
  terca: "Tuesday",
  quarta: "Wednesday",
  quinta: "Thursday",
  sexta: "Friday",
  sabado: "Saturday",
  domingo: "Sunday",
};

function telefoneInternacional(telefone: string | null) {
  const digitos = telefone?.replace(/\D/g, "") ?? "";
  if (digitos.length < 10) return undefined;
  return `+${digitos.startsWith("55") ? digitos : `55${digitos}`}`;
}

/**
 * PetStore (subtipo de LocalBusiness) — nome, telefone, horário e região.
 * Sem rua nem CEP de propósito: a loja é só delivery (sem ponto físico) e
 * o endereço do cadastro é residencial — publicar aqui exporia a casa do
 * dono e ainda conflitaria com o Perfil da Empresa no Google. A região
 * atendida (`seo_regiao`) é o que importa pra busca local nesse caso.
 */
export function jsonLdLoja(empresa: EmpresaCatalogo, origem: string) {
  const horarios = Object.entries(empresa.horario_funcionamento ?? {})
    .filter(([dia, h]) => DIAS_SCHEMA[dia] && h.aberto !== false && h.abre && h.fecha)
    .map(([dia, h]) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: DIAS_SCHEMA[dia],
      opens: h.abre,
      closes: h.fecha,
    }));

  return {
    "@context": "https://schema.org",
    "@type": "PetStore",
    "@id": `${origem}${caminhoLoja(empresa.catalogo_slug)}#loja`,
    name: empresa.nome,
    url: `${origem}${caminhoLoja(empresa.catalogo_slug)}`,
    description: descricaoHome(empresa),
    ...(empresa.logo_url ? { logo: empresa.logo_url, image: empresa.logo_url } : {}),
    ...(telefoneInternacional(empresa.whatsapp_catalogo)
      ? { telephone: telefoneInternacional(empresa.whatsapp_catalogo) }
      : {}),
    ...(empresa.estado
      ? {
          address: {
            "@type": "PostalAddress",
            addressRegion: empresa.estado,
            addressCountry: "BR",
          },
        }
      : {}),
    ...(empresa.seo_regiao ? { areaServed: empresa.seo_regiao } : {}),
    ...(horarios.length ? { openingHoursSpecification: horarios } : {}),
    priceRange: "$$",
    currenciesAccepted: "BRL",
    ...(empresa.instagram
      ? { sameAs: [`https://www.instagram.com/${empresa.instagram.replace(/^@/, "")}`] }
      : {}),
  };
}

export function jsonLdProduto(empresa: EmpresaCatalogo, produto: ProdutoCatalogo, origem: string) {
  const url = `${origem}${caminhoProduto(empresa.catalogo_slug, produto.id, produto.nome)}`;
  const imagens = [produto.imagem_url, produto.imagem_url_secundaria].filter((i): i is string => !!i);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: produto.nome,
    url,
    ...(imagens.length ? { image: imagens } : {}),
    ...(produto.descricao?.trim() ? { description: resumirTexto(produto.descricao, 500) } : {}),
    ...(produto.marca ? { brand: { "@type": "Brand", name: produto.marca } } : {}),
    ...(produto.categoria ? { category: produto.categoria } : {}),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "BRL",
      price: precoEfetivo(produto).toFixed(2),
      availability:
        produto.estoque_disponivel > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": `${origem}${caminhoLoja(empresa.catalogo_slug)}#loja` },
    },
  };
}

export function jsonLdBreadcrumb(itens: { nome: string; url?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: itens.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.nome,
      ...(item.url ? { item: item.url } : {}),
    })),
  };
}
