"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function FiltroEspecie({
  especies,
  especieAtiva,
}: {
  especies: { especie: string; total: number }[];
  especieAtiva: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function selecionar(especie: string | null) {
    const params = new URLSearchParams(searchParams);
    if (especie) {
      params.set("especie", especie);
    } else {
      params.delete("especie");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
        Para
      </span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => selecionar(null)}
          className={`rounded-full border px-3 py-1 text-xs whitespace-nowrap ${
            especieAtiva === null
              ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 font-medium"
              : "border-black/10 text-black/60 dark:border-white/10 dark:text-white/60"
          }`}
        >
          Todos
        </button>
        {especies.map(({ especie, total }) => (
          <button
            key={especie}
            type="button"
            onClick={() => selecionar(especie)}
            className={`rounded-full border px-3 py-1 text-xs whitespace-nowrap ${
              especieAtiva === especie
                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 font-medium"
                : "border-black/10 text-black/60 dark:border-white/10 dark:text-white/60"
            }`}
          >
            {especie} ({total})
          </button>
        ))}
      </div>
    </div>
  );
}
