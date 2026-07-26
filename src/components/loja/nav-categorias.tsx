"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Faixa de categorias no header, visível em toda página — substitui os
 * atalhos em grade + a lista de pills que antes viviam espalhados no
 * corpo da home. Só sabe destacar a categoria ativa quando o visitante
 * já está no catálogo (outras páginas não têm esse conceito).
 */
export function NavCategorias({
  categorias,
  slug,
}: {
  categorias: { categoria: string; total: number }[];
  slug: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const destino = `/loja/${slug}`;
  const noCatalogo = pathname === destino;
  const categoriaAtiva = noCatalogo ? searchParams.get("categoria") : null;
  const temBusca = noCatalogo && !!searchParams.get("q");

  const destaques = categorias.filter((c) => c.categoria !== "Outros");
  if (destaques.length === 0) return null;

  return (
    <div className="border-t border-black/5 dark:border-white/10">
      <nav className="scrollbar-none mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
        <Link
          href={destino}
          className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
            !categoriaAtiva && !temBusca
              ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
              : "border-transparent text-black/60 hover:text-black/90 dark:text-white/60 dark:hover:text-white/90"
          }`}
        >
          Todos
        </Link>
        {destaques.map(({ categoria }) => (
          <Link
            key={categoria}
            href={`${destino}?categoria=${encodeURIComponent(categoria)}`}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              categoriaAtiva === categoria
                ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
                : "border-transparent text-black/60 hover:text-black/90 dark:text-white/60 dark:hover:text-white/90"
            }`}
          >
            {categoria}
          </Link>
        ))}
      </nav>
    </div>
  );
}
