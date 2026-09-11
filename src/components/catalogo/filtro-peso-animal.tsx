"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Peso do ANIMAL (não da embalagem, ver `FiltroPeso`) — só faz sentido em
 * Antipulgas/Vermífugos, onde `dose` já traz a faixa do fabricante ("10 a
 * 20kg"...). Peso é contínuo, então é um campo numérico (o dono sabe o
 * peso exato do pet), não botões de faixa fixa como os outros filtros. */
export function FiltroPesoAnimal({ valorAtivo }: { valorAtivo: number | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [valor, setValor] = useState(valorAtivo != null ? String(valorAtivo) : "");

  function aplicar(bruto: string) {
    const params = new URLSearchParams(searchParams);
    const numero = Number(bruto.replace(",", "."));
    if (bruto.trim() && !Number.isNaN(numero) && numero > 0) {
      params.set("pesoAnimal", String(numero));
    } else {
      params.delete("pesoAnimal");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
        Peso do seu pet
      </span>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-black/10 px-3 py-1 dark:border-white/10">
          <input
            type="text"
            inputMode="decimal"
            placeholder="Ex: 12"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onBlur={() => aplicar(valor)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className="w-14 bg-transparent text-xs outline-none"
          />
          <span className="text-xs text-black/40 dark:text-white/40">kg</span>
        </div>
        {valorAtivo != null && (
          <button
            type="button"
            onClick={() => {
              setValor("");
              aplicar("");
            }}
            className="text-xs text-black/40 underline dark:text-white/40"
          >
            limpar
          </button>
        )}
      </div>
    </div>
  );
}
