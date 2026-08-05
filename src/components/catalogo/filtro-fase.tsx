"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function FiltroFase({
  fases,
  faseAtiva,
}: {
  fases: { fase: string; total: number }[];
  faseAtiva: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function selecionar(fase: string | null) {
    const params = new URLSearchParams(searchParams);
    if (fase) {
      params.set("fase", fase);
    } else {
      params.delete("fase");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
        Fase
      </span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => selecionar(null)}
          className={`rounded-full border px-3 py-1 text-xs whitespace-nowrap ${
            faseAtiva === null
              ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 font-medium"
              : "border-black/10 text-black/60 dark:border-white/10 dark:text-white/60"
          }`}
        >
          Todas
        </button>
        {fases.map(({ fase, total }) => (
          <button
            key={fase}
            type="button"
            onClick={() => selecionar(fase)}
            className={`rounded-full border px-3 py-1 text-xs whitespace-nowrap ${
              faseAtiva === fase
                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 font-medium"
                : "border-black/10 text-black/60 dark:border-white/10 dark:text-white/60"
            }`}
          >
            {fase} ({total})
          </button>
        ))}
      </div>
    </div>
  );
}
