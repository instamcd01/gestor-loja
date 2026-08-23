import { ProdutoCard } from "@/components/produto-card";
import { getVariantesEmLote } from "@/lib/catalogo";
import type { ProdutoCatalogo } from "@/lib/types";

/**
 * Grade plana (busca, filtro ou ordenação explícita ativos — a home SEM
 * filtro usa `CategoriasEmLinha` em vez desta). Server Component
 * assíncrono isolado só pra poder ficar dentro de um <Suspense> em
 * page.tsx — a busca de variantes (getVariantesEmLote, 2 idas
 * sequenciais ao banco) é a parte mais lenta do carregamento, mas nada
 * do resto da página (banners, filtros, contagem) depende dela. Sem esse
 * isolamento o await bloqueava o streaming da página inteira; com ele, o
 * resto renderiza na hora e só a grade aparece um instante depois.
 */
export async function GradeDeProdutos({
  produtos,
  slug,
  empresaId,
  moderno,
  usarPrecoAncoraMarketplace = false,
}: {
  produtos: ProdutoCatalogo[];
  slug: string;
  empresaId: string;
  moderno: boolean;
  usarPrecoAncoraMarketplace?: boolean;
}) {
  const variantesPorPai = await getVariantesEmLote(empresaId, produtos);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {produtos.map((produto) => (
        <ProdutoCard
          key={produto.id}
          produto={produto}
          slug={slug}
          variantes={variantesPorPai.get(produto.id)}
          moderno={moderno}
          usarPrecoAncoraMarketplace={usarPrecoAncoraMarketplace}
        />
      ))}
    </div>
  );
}

/** Placeholder mostrado enquanto a grade real (dependente de variantes) ainda não resolveu. */
export function GradeSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="aspect-square animate-pulse rounded-[var(--radius-sm)] bg-black/5 dark:bg-white/10" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-black/5 dark:bg-white/10" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-black/5 dark:bg-white/10" />
        </div>
      ))}
    </div>
  );
}
