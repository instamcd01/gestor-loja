"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Ordenacao } from "@/lib/catalogo";

const OPCOES: { valor: Ordenacao; rotulo: string }[] = [
  { valor: "relevancia", rotulo: "Mais relevantes" },
  { valor: "menor_preco", rotulo: "Menor preço" },
  { valor: "maior_preco", rotulo: "Maior preço" },
  { valor: "nome_az", rotulo: "Nome de A-Z" },
  { valor: "nome_za", rotulo: "Nome de Z-A" },
  { valor: "maior_desconto", rotulo: "Maior desconto" },
];

export function OrdenarPor({ ordenacaoAtiva }: { ordenacaoAtiva: Ordenacao }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function alterar(valor: string) {
    const params = new URLSearchParams(searchParams);
    if (valor === "relevancia") {
      params.delete("ordenar");
    } else {
      params.set("ordenar", valor);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <label className="flex items-center gap-2 text-sm text-black/60 dark:text-white/60">
      Ordenar por:
      <select
        value={ordenacaoAtiva}
        onChange={(e) => alterar(e.target.value)}
        className="rounded-lg border border-black/10 bg-white py-1.5 pl-2 pr-7 text-sm outline-none focus:border-[var(--brand-primary)] dark:border-white/10 dark:bg-white/5"
      >
        {OPCOES.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
}
