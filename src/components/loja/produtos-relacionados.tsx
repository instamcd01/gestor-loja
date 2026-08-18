import { ProdutoCard } from "@/components/produto-card";
import type { ProdutoCatalogo } from "@/lib/types";

export function ProdutosRelacionados({
  produtos,
  slug,
  moderno,
}: {
  produtos: ProdutoCatalogo[];
  slug: string;
  moderno: boolean;
}) {
  if (produtos.length === 0) return null;

  return (
    <section className="flex flex-col gap-4 border-t border-black/5 pt-8 dark:border-white/10">
      <h2 className="text-lg font-semibold">Quem viu, também viu</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {produtos.map((produto) => (
          <ProdutoCard
            key={produto.id}
            produto={produto}
            slug={slug}
            moderno={moderno}
          />
        ))}
      </div>
    </section>
  );
}
