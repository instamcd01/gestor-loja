"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function FiltroMarca({
  marcas,
  marcaAtiva,
}: {
  marcas: { marca: string; total: number }[];
  marcaAtiva: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function selecionar(marca: string | null) {
    const params = new URLSearchParams(searchParams);
    if (marca) {
      params.set("marca", marca);
    } else {
      params.delete("marca");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
        Marca
      </span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => selecionar(null)}
          className={`rounded-full border px-3 py-1 text-xs whitespace-nowrap ${
            marcaAtiva === null
              ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 font-medium"
              : "border-black/10 text-black/60 dark:border-white/10 dark:text-white/60"
          }`}
        >
          Todas
        </button>
        {marcas.map(({ marca, total }) => (
          <button
            key={marca}
            type="button"
            onClick={() => selecionar(marca)}
            className={`rounded-full border px-3 py-1 text-xs whitespace-nowrap ${
              marcaAtiva === marca
                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 font-medium"
                : "border-black/10 text-black/60 dark:border-white/10 dark:text-white/60"
            }`}
          >
            {marca} ({total})
          </button>
        ))}
      </div>
    </div>
  );
}
