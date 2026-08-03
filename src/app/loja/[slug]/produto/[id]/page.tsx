import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { AdicionarCarrinhoButton } from "@/components/carrinho/adicionar-carrinho-button";
import { GaleriaProduto } from "@/components/galeria-produto";
import { ClubeEmBreve } from "@/components/loja/clube-em-breve";
import { ProdutosRelacionados } from "@/components/loja/produtos-relacionados";
import { SeletorVariante } from "@/components/seletor-variante";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import {
  getEmpresaPorSlug,
  getProdutoCatalogo,
  getProdutosCatalogo,
  getVariantesDoProduto,
} from "@/lib/catalogo";
import { formatarPreco, percentualDesconto } from "@/lib/utils";
import { rotuloSeletorVariante } from "@/lib/variantes";

export const revalidate = 60;

async function carregar(slug: string, id: string) {
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) return null;
  const produto = await getProdutoCatalogo(empresa.id, id);
  if (!produto) return null;
  const [variantes, relacionados] = await Promise.all([
    getVariantesDoProduto(empresa.id, produto),
    produto.categoria
      ? getProdutosCatalogo(empresa.id, { categoria: produto.categoria })
      : Promise.resolve([]),
  ]);
  return {
    empresa,
    produto,
    variantes,
    relacionados: relacionados.filter((p) => p.id !== produto.id).slice(0, 8),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug, id } = await params;
  const dados = await carregar(slug, id);
  if (!dados) return {};
  return { title: `${dados.produto.nome} · ${dados.empresa.nome}` };
}

export default async function ProdutoPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const dados = await carregar(slug, id);
  if (!dados) notFound();
  const { produto, variantes, relacionados, empresa } = dados;

  const temPromocao =
    produto.preco_promocional != null && produto.preco_promocional < produto.preco;
  const percentualOff = percentualDesconto(produto.preco, produto.preco_promocional);

  const mensagemWhatsapp = encodeURIComponent(`Olá! Tenho interesse em: ${produto.nome}`);
  const moderno = empresa.catalogo_modelo === "moderno";

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <Breadcrumb
          itens={[
            { rotulo: "Loja", href: `/loja/${slug}` },
            ...(produto.categoria
              ? [{ rotulo: produto.categoria, href: `/loja/${slug}?categoria=${encodeURIComponent(produto.categoria)}` }]
              : []),
            { rotulo: produto.nome },
          ]}
        />

        <div className="grid gap-8 md:grid-cols-2">
          <div className="relative">
            {percentualOff > 0 && (
              <Badge variant="secondary" className="absolute top-2 left-2 z-[1]">
                {percentualOff}% OFF
              </Badge>
            )}
            <GaleriaProduto
              nome={produto.nome}
              categoria={produto.categoria}
              imagemPrincipal={produto.imagem_url}
              imagemSecundaria={produto.imagem_url_secundaria}
            />
          </div>

          <div className="flex flex-col gap-4">
            {produto.categoria && (
              <span className="text-xs font-medium text-black/40 dark:text-white/40">
                {produto.categoria}
              </span>
            )}
            <h1 className="text-2xl font-semibold">{produto.nome}</h1>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold">
                {formatarPreco(temPromocao ? produto.preco_promocional! : produto.preco)}
              </span>
              {temPromocao && (
                <span className="text-base text-black/40 line-through dark:text-white/40">
                  {formatarPreco(produto.preco)}
                </span>
              )}
            </div>

            {variantes.length > 0 && (
              <SeletorVariante
                slug={slug}
                variantes={variantes}
                idAtual={produto.id}
                rotulo={rotuloSeletorVariante(produto.tipo_variacao)}
              />
            )}

            {produto.descricao && (
              <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
                {produto.descricao}
              </p>
            )}

            <Card className="flex flex-col gap-3 p-4">
              <AdicionarCarrinhoButton
                slug={slug}
                empresaId={empresa.id}
                enderecoEmpresa={{
                  endereco: empresa.endereco,
                  cidade: empresa.cidade,
                  estado: empresa.estado,
                  cep: empresa.cep,
                }}
                produtoId={produto.id}
                produto={{
                  nome: produto.nome,
                  imagemUrl: produto.imagem_url,
                  categoria: produto.categoria,
                  preco: temPromocao ? produto.preco_promocional! : produto.preco,
                }}
              />

              {empresa.whatsapp_catalogo && (
                <a
                  href={`https://wa.me/${empresa.whatsapp_catalogo.replace(/\D/g, "")}?text=${mensagemWhatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-center text-xs font-medium text-[var(--brand-primary)] hover:underline"
                >
                  Prefere combinar pelo WhatsApp? Fale com a gente
                </a>
              )}
            </Card>

            <ClubeEmBreve nome={empresa.nome} moderno={moderno} />

            <ButtonLink href={`/loja/${slug}`} variant="secondary" className="mt-2 w-fit">
              ← Voltar ao catálogo
            </ButtonLink>
          </div>
        </div>
      </div>

      <ProdutosRelacionados produtos={relacionados} slug={slug} moderno={moderno} />
    </div>
  );
}
