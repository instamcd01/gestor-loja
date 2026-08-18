"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FaixaPreco } from "@/lib/catalogo";
import { formatarPreco } from "@/lib/utils";

export function FiltroPreco({
  faixas,
  faixaAtiva,
}: {
  faixas: FaixaPreco[];
  faixaAtiva: { min?: number; max?: number } | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function selecionar(faixa: FaixaPreco | null) {
    const params = new URLSearchParams(searchParams);
    if (faixa) {
      params.set("precoMin", String(faixa.min));
      if (faixa.max != null) {
        params.set("precoMax", String(faixa.max));
      } else {
        params.delete("precoMax");
      }
    } else {
      params.delete("precoMin");
      params.delete("precoMax");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function ativa(faixa: FaixaPreco) {
    return faixaAtiva?.min === faixa.min && faixaAtiva?.max === faixa.max;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
        Faixa de preço
      </span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => selecionar(null)}
          className={`rounded-full border px-3 py-1 text-xs whitespace-nowrap ${
            faixaAtiva === null
              ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 font-medium"
              : "border-black/10 text-black/60 dark:border-white/10 dark:text-white/60"
          }`}
        >
          Todos
        </button>
        {faixas.map((faixa) => (
          <button
            key={`${faixa.min}-${faixa.max ?? "inf"}`}
            type="button"
            onClick={() => selecionar(faixa)}
            className={`rounded-full border px-3 py-1 text-xs whitespace-nowrap ${
              ativa(faixa)
                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 font-medium"
                : "border-black/10 text-black/60 dark:border-white/10 dark:text-white/60"
            }`}
          >
            {faixa.max != null
              ? `${formatarPreco(faixa.min)} - ${formatarPreco(faixa.max)}`
              : `Acima de ${formatarPreco(faixa.min)}`}
          </button>
        ))}
      </div>
    </div>
  );
}
