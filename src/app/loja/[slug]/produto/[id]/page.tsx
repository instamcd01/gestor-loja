import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { getEmpresaPorSlug, getProdutoCatalogo } from "@/lib/catalogo";
import { formatarPreco } from "@/lib/utils";

export const revalidate = 60;

async function carregar(slug: string, id: string) {
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) return null;
  const produto = await getProdutoCatalogo(empresa.id, id);
  if (!produto) return null;
  return { empresa, produto };
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
  const { produto } = dados;

  const temPromocao =
    produto.preco_promocional != null && produto.preco_promocional < produto.preco;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black/5 dark:bg-white/5">
        {produto.imagem_url ? (
          <Image
            src={produto.imagem_url}
            alt={produto.nome}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-black/30 dark:text-white/30">
            sem foto
          </div>
        )}
      </div>

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

        {produto.descricao && (
          <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
            {produto.descricao}
          </p>
        )}

        {/*
          TODO: botão "Adicionar ao carrinho" — depende da estratégia de
          identidade do cliente (sessão anônima vs. login por telefone)
          ainda não decidida. Ver README.
        */}
        <ButtonLink href={`/loja/${slug}`} variant="secondary" className="mt-4 w-fit">
          ← Voltar ao catálogo
        </ButtonLink>
      </div>
    </div>
  );
}
