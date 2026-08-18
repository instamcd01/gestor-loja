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
      {/* Some no mobile — junto com o botão "Filtros" e o próprio select,
          o rótulo por extenso não cabia em telas estreitas e empurrava a
          linha inteira pra fora da tela (select nativo não encolhe pelo
          flex normal, precisa de max-width explícito também). */}
      <span className="hidden sm:inline">Ordenar por:</span>
      <select
        value={ordenacaoAtiva}
        onChange={(e) => alterar(e.target.value)}
        // bg/text explícitos (não só herdados do <label>) e opacos —
        // o popup nativo das <option> segue a cor/fundo do próprio
        // <select>, então um fundo com opacidade (ex: bg-white/5) rendeiriza
        // quase branco por trás, e sem "color" próprio o texto herdado
        // branco (dark:text-white/60 do label) ficava ilegível em tema
        // escuro (texto branco sobre bloco quase branco).
        className="max-w-[45vw] rounded-[var(--radius-sm)] border border-black/10 bg-[var(--surface)] py-1.5 pl-2 pr-7 text-sm text-black outline-none focus:border-[var(--brand-primary)] sm:max-w-none dark:border-white/10 dark:text-white"
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
