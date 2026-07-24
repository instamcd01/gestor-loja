import Link from "next/link";
import { detectarIcone, IconeSvg } from "@/components/produto-placeholder";

/**
 * Bloco de acesso rápido acima da grade — não é a home separada que a Petz
 * tem (aqui a página de catálogo já é a "home" do tenant), então isso fica
 * no topo da própria listagem em vez de numa página própria. Mostra só as
 * categorias mais relevantes (maior contagem), não a lista inteira — pra
 * isso já existe o FiltroCategorias logo abaixo.
 */
export function AtalhosCategoria({
  categorias,
  slug,
  limite = 6,
}: {
  categorias: { categoria: string; total: number }[];
  slug: string;
  limite?: number;
}) {
  const destaques = categorias.filter((c) => c.categoria !== "Outros").slice(0, limite);
  if (destaques.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {destaques.map(({ categoria, total }) => (
        <Link
          key={categoria}
          href={`/loja/${slug}?categoria=${encodeURIComponent(categoria)}`}
          className="flex flex-col items-center gap-1.5 rounded-xl border border-black/5 bg-white p-3 text-center transition-colors hover:border-[var(--brand-primary)] dark:border-white/10 dark:bg-white/5"
        >
          <IconeSvg tipo={detectarIcone(categoria)} className="h-6 w-6 text-[var(--brand-primary)]" />
          <span className="line-clamp-2 text-[11px] leading-tight font-medium">{categoria}</span>
          <span className="text-[10px] text-black/40 dark:text-white/40">{total}</span>
        </Link>
      ))}
    </div>
  );
}
