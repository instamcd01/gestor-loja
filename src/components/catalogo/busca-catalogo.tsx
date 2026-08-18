"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Vive no header (visível em toda página, não só no catálogo) — por isso
 * sempre navega pra `/loja/${slug}`, mesmo se digitado a partir da página
 * de um produto. Se já estiver no catálogo, preserva os outros filtros
 * ativos (categoria/marca/preço) e só mexe em `q`.
 */
export function BuscaCatalogo({ slug }: { slug: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const destino = `/loja/${slug}`;
  const qAtual = searchParams.get("q") ?? "";

  const [valor, setValor] = useState(qAtual);
  const primeiraRenderizacao = useRef(true);

  // Guarda o último valor que ESTE componente mandou pra URL — não o
  // último `q` visto. Sem essa distinção, se a resposta do servidor
  // demorar mais que o debounce, sincronizar o campo sempre que `q` muda
  // confundia "minha própria busca chegando atrasada" com "mudou por
  // fora" e resetava o campo no meio da digitação (o "bugando" ao digitar
  // rápido). Só sincroniza de fato quando `q` muda por um motivo que não
  // foi este componente (ex: limpar busca ao trocar de categoria pelo nav).
  // Num efeito, não durante a renderização — o projeto usa uma regra de
  // lint que proíbe ler/escrever ref no corpo do componente.
  const ultimoValorEnviado = useRef(qAtual);
  // Marca que a próxima mudança em `valor` veio de fora (sincronização com a
  // URL), não de digitação — o efeito de debounce abaixo precisa saber
  // disso pra não reagir a ela. Sem essa distinção, ao clicar num produto
  // (navega pra fora de /loja/[slug], que não tem `?q=`) o `q` sumia,
  // `valor` era limpo por este efeito, e o efeito de debounce interpretava
  // isso como "usuário apagou a busca", agendando um `router.replace` pro
  // catálogo 350ms depois — te chutando de volta pra página inicial bem na
  // hora que a página do produto acabava de abrir.
  const mudancaExterna = useRef(false);
  useEffect(() => {
    if (qAtual !== ultimoValorEnviado.current) {
      ultimoValorEnviado.current = qAtual;
      mudancaExterna.current = true;
      setValor(qAtual);
    }
  }, [qAtual]);

  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    if (mudancaExterna.current) {
      mudancaExterna.current = false;
      return;
    }

    const timeout = setTimeout(() => {
      const valorFinal = valor.trim();
      ultimoValorEnviado.current = valorFinal;
      const params = new URLSearchParams(pathname === destino ? searchParams : undefined);
      if (valorFinal) {
        params.set("q", valorFinal);
      } else {
        params.delete("q");
      }
      router.replace(`${destino}?${params.toString()}`, { scroll: false });
    }, 350);

    return () => clearTimeout(timeout);
    // searchParams/pathname/router deliberadamente fora das deps: só a
    // mudança em `valor` (o que o usuário digita) deve disparar o debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  return (
    <div className="relative w-full">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-black/30 dark:text-white/30"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="O que seu pet precisa?"
        className="w-full rounded-full border border-black/10 bg-[var(--surface)] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[var(--brand-primary)] dark:border-white/10"
      />
    </div>
  );
}
