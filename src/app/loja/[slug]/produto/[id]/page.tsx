import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { AdicionarCarrinhoButton } from "@/components/carrinho/adicionar-carrinho-button";
import { GaleriaProduto } from "@/components/galeria-produto";
import { SeletorVariante } from "@/components/seletor-variante";
import { ButtonLink } from "@/components/ui/button";
import { getEmpresaPorSlug, getProdutoCatalogo, getVariantesDoProduto } from "@/lib/catalogo";
import { formatarPreco } from "@/lib/utils";

export const revalidate = 60;

async function carregar(slug: string, id: string) {
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) return null;
  const produto = await getProdutoCatalogo(empresa.id, id);
  if (!produto) return null;
  const variantes = await getVariantesDoProduto(empresa.id, produto);
  return { empresa, produto, variantes };
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
  const { produto, variantes } = dados;

  const temPromocao =
    produto.preco_promocional != null && produto.preco_promocional < produto.preco;

  return (
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
        <GaleriaProduto
          nome={produto.nome}
          categoria={produto.categoria}
          imagemPrincipal={produto.imagem_url}
          imagemSecundaria={produto.imagem_url_secundaria}
        />

        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{produto.nome}</h1>

          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold">
              {formatarPreco(temPromocao ? produto.preco_promocional! : produto.preco)}
            </span>
            {temPromocao && (
              <span className="text-base text-black/40 line-through dark:text-white/40">
                {formatarPreco(produto.preco)}
              </span>
            )}
          </div>

          {variantes.length > 0 && (
            <SeletorVariante slug={slug} variantes={variantes} idAtual={produto.id} />
          )}

          {produto.descricao && (
            <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
              {produto.descricao}
            </p>
          )}

          <div className="mt-2">
            <AdicionarCarrinhoButton
              slug={slug}
              empresaId={dados.empresa.id}
              produtoId={produto.id}
              produto={{
                nome: produto.nome,
                imagemUrl: produto.imagem_url,
                categoria: produto.categoria,
                preco: temPromocao ? produto.preco_promocional! : produto.preco,
              }}
            />
          </div>

          <ButtonLink href={`/loja/${slug}`} variant="secondary" className="mt-2 w-fit">
            ← Voltar ao catálogo
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
