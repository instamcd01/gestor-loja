"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function FiltroCategorias({
  categorias,
  categoriaAtiva,
}: {
  categorias: { categoria: string; total: number }[];
  categoriaAtiva: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function selecionar(categoria: string | null) {
    const params = new URLSearchParams(searchParams);
    if (categoria) {
      params.set("categoria", categoria);
    } else {
      params.delete("categoria");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => selecionar(null)}
        className={`rounded-full border px-3 py-1.5 text-sm whitespace-nowrap ${
          categoriaAtiva === null
            ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 font-medium"
            : "border-black/10 text-black/60 dark:border-white/10 dark:text-white/60"
        }`}
      >
        Todos
      </button>
      {categorias.map(({ categoria, total }) => (
        <button
          key={categoria}
          type="button"
          onClick={() => selecionar(categoria)}
          className={`rounded-full border px-3 py-1.5 text-sm whitespace-nowrap ${
            categoriaAtiva === categoria
              ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 font-medium"
              : "border-black/10 text-black/60 dark:border-white/10 dark:text-white/60"
          }`}
        >
          {categoria} ({total})
        </button>
      ))}
    </div>
  );
}
