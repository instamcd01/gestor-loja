import { ProdutoCard } from "@/components/produto-card";
import { getVariantesEmLote } from "@/lib/catalogo";
import type { ProdutoCatalogo } from "@/lib/types";

/**
 * Server Component assíncrono isolado só pra poder ficar dentro de um
 * <Suspense> em page.tsx — a busca de variantes (getVariantesEmLote, 2
 * idas sequenciais ao banco) é a parte mais lenta do carregamento da
 * home, mas nada do resto da página (banners, filtros, contagem de
 * departamento) depende dela. Sem esse isolamento o await bloqueava o
 * streaming da página inteira; com ele, o resto renderiza na hora e só
 * a grade de produtos aparece um instante depois.
 */
export async function GradeDeProdutos({
  produtos,
  slug,
  empresaId,
  enderecoEmpresa,
  moderno,
  filtroAtivo,
  ordenar,
}: {
  produtos: ProdutoCatalogo[];
  slug: string;
  empresaId: string;
  enderecoEmpresa: { endereco: string | null; cidade: string | null; estado: string | null; cep: string | null };
  moderno: boolean;
  filtroAtivo: boolean;
  ordenar?: string;
}) {
  const variantesPorPai = await getVariantesEmLote(empresaId, produtos);

  if (filtroAtivo || ordenar) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {produtos.map((produto) => (
          <ProdutoCard
            key={produto.id}
            produto={produto}
            slug={slug}
            empresaId={empresaId}
            enderecoEmpresa={enderecoEmpresa}
            variantes={variantesPorPai.get(produto.id)}
            moderno={moderno}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {agruparPorCategoria(produtos).map(([cat, itens]) => (
        <section key={cat} className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">{cat}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {itens.map((produto) => (
              <ProdutoCard
                key={produto.id}
                produto={produto}
                slug={slug}
                empresaId={empresaId}
                enderecoEmpresa={enderecoEmpresa}
                variantes={variantesPorPai.get(produto.id)}
                moderno={moderno}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function agruparPorCategoria<T extends { categoria: string | null }>(produtos: T[]) {
  const porCategoria = new Map<string, T[]>();
  for (const produto of produtos) {
    const chave = produto.categoria ?? "Outros";
    porCategoria.set(chave, [...(porCategoria.get(chave) ?? []), produto]);
  }
  return [...porCategoria.entries()];
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
