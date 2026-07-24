import Link from "next/link";
import { ProdutoImagem } from "@/components/produto-imagem";
import type { ProdutoCatalogo } from "@/lib/types";
import { formatarPreco } from "@/lib/utils";

export function ProdutoCard({
  produto,
  slug,
}: {
  produto: ProdutoCatalogo;
  slug: string;
}) {
  const temPromocao =
    produto.preco_promocional != null && produto.preco_promocional < produto.preco;

  return (
    <Link
      href={`/loja/${slug}/produto/${produto.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-white transition-shadow hover:shadow-lg dark:border-white/10 dark:bg-white/5"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-black/5 dark:bg-white/5">
        <ProdutoImagem
          src={produto.imagem_url}
          alt={produto.nome}
          categoria={produto.categoria}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {produto.destaque && (
          <span className="absolute left-2 top-2 rounded-full bg-[var(--brand-secondary)] px-2.5 py-1 text-xs font-semibold text-white">
            Destaque
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-medium">{produto.nome}</h3>
        <div className="mt-auto flex items-baseline gap-2 pt-1">
          <span className="text-base font-semibold">
            {formatarPreco(temPromocao ? produto.preco_promocional! : produto.preco)}
          </span>
          {temPromocao && (
            <span className="text-xs text-black/40 line-through dark:text-white/40">
              {formatarPreco(produto.preco)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
