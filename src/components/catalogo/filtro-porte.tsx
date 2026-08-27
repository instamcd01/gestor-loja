"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function FiltroPorte({
  portes,
  porteAtivo,
}: {
  portes: { porte: string; total: number }[];
  porteAtivo: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function selecionar(porte: string | null) {
    const params = new URLSearchParams(searchParams);
    if (porte) {
      params.set("porte", porte);
    } else {
      params.delete("porte");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
        Porte
      </span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => selecionar(null)}
          className={`rounded-full border px-3 py-1 text-xs whitespace-nowrap ${
            porteAtivo === null
              ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 font-medium"
              : "border-black/10 text-black/60 dark:border-white/10 dark:text-white/60"
          }`}
        >
          Todos
        </button>
        {portes.map(({ porte }) => (
          <button
            key={porte}
            type="button"
            onClick={() => selecionar(porte)}
            className={`rounded-full border px-3 py-1 text-xs whitespace-nowrap ${
              porteAtivo === porte
                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 font-medium"
                : "border-black/10 text-black/60 dark:border-white/10 dark:text-white/60"
            }`}
          >
            {porte}
          </button>
        ))}
      </div>
    </div>
  );
}
