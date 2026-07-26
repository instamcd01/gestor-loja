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
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {destaques.map(({ categoria, total }) => (
        <Link
          key={categoria}
          href={`/loja/${slug}?categoria=${encodeURIComponent(categoria)}`}
          className="group flex flex-col items-center gap-2 rounded-2xl border border-black/5 bg-[var(--surface)] p-4 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-white/10"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-primary)]/15 to-[var(--brand-secondary)]/15 transition-colors group-hover:from-[var(--brand-primary)]/25 group-hover:to-[var(--brand-secondary)]/25">
            <IconeSvg tipo={detectarIcone(categoria)} className="h-5 w-5 text-[var(--brand-primary)]" />
          </div>
          <span className="line-clamp-2 text-[11px] leading-tight font-semibold">{categoria}</span>
          <span className="text-[10px] text-black/40 dark:text-white/40">{total}</span>
        </Link>
      ))}
    </div>
  );
}
