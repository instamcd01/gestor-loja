import Link from "next/link";

const CATEGORIAS = [
  { rotulo: "Cães", emoji: "🐶", params: "especie=C%C3%A3es" },
  { rotulo: "Gatos", emoji: "🐱", params: "especie=Gatos" },
  { rotulo: "Pássaros", emoji: "🐦", params: "especie=P%C3%A1ssaros" },
  { rotulo: "Outros", emoji: "🐾", params: "departamento=Outros%20Animais" },
] as const;

/** Atalho visual pra filtrar direto por espécie/departamento de "outros animais" na home. */
export function CategoriasEspecie({ slug }: { slug: string }) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-4">
      {CATEGORIAS.map((c) => (
        <Link
          key={c.rotulo}
          href={`/loja/${slug}?${c.params}`}
          className="flex flex-col items-center gap-1.5 rounded-[var(--radius-lg)] border border-black/5 bg-[var(--surface)] py-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10"
        >
          <span className="text-3xl sm:text-4xl">{c.emoji}</span>
          <span className="text-xs font-semibold sm:text-sm">{c.rotulo}</span>
        </Link>
      ))}
    </div>
  );
}
