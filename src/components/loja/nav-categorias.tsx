"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { DepartamentoComContagem } from "@/lib/catalogo";

/**
 * Faixa de departamentos no header, visível em toda página. Menu de 2
 * níveis: linha principal = só os departamentos (poucos, cabem sem scroll
 * em qualquer tela — antes era uma lista plana de ~22 categorias que
 * dependia de scroll horizontal com barra escondida, inacessível pra quem
 * navega com mouse). Clicar num departamento filtra todos os produtos dele
 * e abre uma segunda linha com as subcategorias como refinamento.
 */
export function NavCategorias({
  departamentos,
  slug,
  moderno,
}: {
  departamentos: DepartamentoComContagem[];
  slug: string;
  moderno: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const destino = `/loja/${slug}`;
  const noCatalogo = pathname === destino;
  const departamentoAtivo = noCatalogo ? searchParams.get("departamento") : null;
  const categoriaAtiva = noCatalogo ? searchParams.get("categoria") : null;
  const temBusca = noCatalogo && !!searchParams.get("q");

  if (departamentos.length === 0) return null;

  const deptAtivo = departamentos.find((d) => d.nome === departamentoAtivo);

  return (
    <div className="border-t border-black/5 dark:border-white/10">
      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
        <Link href={destino} className={linkClasse(!departamentoAtivo && !temBusca, moderno)}>
          Todos
        </Link>
        {departamentos.map((d) => (
          <Link
            key={d.nome}
            href={`${destino}?departamento=${encodeURIComponent(d.nome)}`}
            className={linkClasse(departamentoAtivo === d.nome, moderno)}
          >
            {d.nome}
          </Link>
        ))}
      </nav>

      {deptAtivo && deptAtivo.categorias.length > 1 && (
        <nav className="mx-auto flex max-w-6xl items-center gap-1.5 overflow-x-auto border-t border-black/5 px-4 py-1.5 dark:border-white/10">
          <Link
            href={`${destino}?departamento=${encodeURIComponent(deptAtivo.nome)}`}
            className={subLinkClasse(!categoriaAtiva)}
          >
            Tudo em {deptAtivo.nome}
          </Link>
          {deptAtivo.categorias.map(({ categoria }) => (
            <Link
              key={categoria}
              href={`${destino}?departamento=${encodeURIComponent(deptAtivo.nome)}&categoria=${encodeURIComponent(categoria)}`}
              className={subLinkClasse(categoriaAtiva === categoria)}
            >
              {categoria}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

function linkClasse(ativo: boolean, moderno: boolean) {
  const pesoFonte = moderno ? "font-bold" : "font-medium";
  return `shrink-0 border-b-2 px-3 py-2.5 text-sm ${pesoFonte} whitespace-nowrap transition-colors ${
    ativo
      ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
      : "border-transparent text-black/60 hover:text-black/90 dark:text-white/60 dark:hover:text-white/90"
  }`;
}

function subLinkClasse(ativo: boolean) {
  return `shrink-0 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
    ativo
      ? "bg-[var(--brand-primary)] text-white"
      : "bg-black/5 text-black/60 hover:bg-black/10 dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/15"
  }`;
}
