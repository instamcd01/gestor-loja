import Link from "next/link";
import { ProdutoCard } from "@/components/produto-card";
import { getMaisVendidos, getPromocoesDoDia, getVariantesEmLote } from "@/lib/catalogo";
import type { ProdutoCatalogo } from "@/lib/types";

/**
 * Uma linha de produtos com scroll horizontal, mesmo visual de
 * `CategoriasEmLinha` — mas pra uma lista já pronta (promoções, mais
 * vendidos), não agrupada por categoria.
 */
async function LinhaProdutos({
  titulo,
  produtos,
  slug,
  empresaId,
  moderno,
  verMaisHref,
}: {
  titulo: string;
  produtos: ProdutoCatalogo[];
  slug: string;
  empresaId: string;
  moderno: boolean;
  verMaisHref?: string;
}) {
  if (produtos.length === 0) return null;

  const variantesPorPai = await getVariantesEmLote(empresaId, produtos);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{titulo}</h2>
        {verMaisHref && (
          <Link href={verMaisHref} className="shrink-0 text-sm font-medium text-[var(--brand-primary)] hover:underline">
            Ver mais →
          </Link>
        )}
      </div>
      <div className="scrollbar-none flex snap-x gap-4 overflow-x-auto pb-1">
        {produtos.map((produto) => (
          <div key={produto.id} className="w-40 shrink-0 snap-start sm:w-48">
            <ProdutoCard
              produto={produto}
              slug={slug}
              variantes={variantesPorPai.get(produto.id)}
              moderno={moderno}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Busca + renderiza numa peça só — pensado pra ficar isolado num
 * `<Suspense>` próprio na home (mesmo motivo de `CategoriasEmLinha`: não
 * travar o resto da página esperando a query de desconto/ranking).
 */
export async function PromocoesDoDia({
  slug,
  empresaId,
  moderno,
}: {
  slug: string;
  empresaId: string;
  moderno: boolean;
}) {
  const produtos = await getPromocoesDoDia(empresaId);
  return (
    <LinhaProdutos
      titulo="Promoções do dia"
      produtos={produtos}
      slug={slug}
      empresaId={empresaId}
      moderno={moderno}
      verMaisHref={`/loja/${slug}?ordenar=maior_desconto`}
    />
  );
}

export async function MaisVendidos({
  slug,
  empresaId,
  moderno,
}: {
  slug: string;
  empresaId: string;
  moderno: boolean;
}) {
  const produtos = await getMaisVendidos(empresaId);
  return (
    <LinhaProdutos titulo="Mais vendidos" produtos={produtos} slug={slug} empresaId={empresaId} moderno={moderno} />
  );
}
