"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FaixaPeso } from "@/lib/catalogo";

/** Mesma convenção de exibição de peso usada nas variantes (kg acima de
 * 1, gramas abaixo) — ver `extrairPeso` em src/lib/variantes.ts. */
function formatarPeso(valor: number): string {
  if (valor < 1) return `${Math.round(valor * 1000)}g`;
  return `${valor % 1 === 0 ? valor : valor.toFixed(1).replace(".", ",")}kg`;
}

export function FiltroPeso({
  faixas,
  faixaAtiva,
}: {
  faixas: FaixaPeso[];
  faixaAtiva: { min?: number; max?: number } | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function selecionar(faixa: FaixaPeso | null) {
    const params = new URLSearchParams(searchParams);
    if (faixa) {
      params.set("pesoMin", String(faixa.min));
      if (faixa.max != null) {
        params.set("pesoMax", String(faixa.max));
      } else {
        params.delete("pesoMax");
      }
    } else {
      params.delete("pesoMin");
      params.delete("pesoMax");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function ativa(faixa: FaixaPeso) {
    return faixaAtiva?.min === faixa.min && faixaAtiva?.max === faixa.max;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
        Peso da embalagem
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
              ? `${formatarPeso(faixa.min)} - ${formatarPeso(faixa.max)}`
              : `Acima de ${formatarPeso(faixa.min)}`}
          </button>
        ))}
      </div>
    </div>
  );
}
