"use client";

import Link from "next/link";
import { useState } from "react";
import { ProdutoImagem } from "@/components/produto-imagem";
import type { ProdutoCatalogo, VarianteProduto } from "@/lib/types";
import { formatarPreco } from "@/lib/utils";
import { extrairPeso } from "@/lib/variantes";

export function ProdutoCard({
  produto,
  slug,
  variantes,
}: {
  produto: ProdutoCatalogo;
  slug: string;
  variantes?: VarianteProduto[];
}) {
  const opcoes: VarianteProduto[] = [
    {
      id: produto.id,
      rotulo: extrairPeso(produto.nome)?.rotulo ?? produto.unidade_medida ?? "",
      preco: produto.preco,
      preco_promocional: produto.preco_promocional,
    },
    ...(variantes ?? []),
  ];
  const temVariantes = (variantes?.length ?? 0) > 0;

  const [ativa, setAtiva] = useState(0);
  const selecionada = opcoes[ativa];
  const temPromocao =
    selecionada.preco_promocional != null && selecionada.preco_promocional < selecionada.preco;

  return (
    <Link
      href={`/loja/${slug}/produto/${selecionada.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-white transition-shadow hover:shadow-lg dark:border-white/10 dark:bg-white/5"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-black/5 dark:bg-white/5">
        <ProdutoImagem
          src={produto.imagem_url}
          alt={produto.nome}
          categoria={produto.categoria}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {produto.destaque && (
          <span className="absolute left-2 top-2 rounded-full bg-[var(--brand-secondary)] px-2.5 py-1 text-xs font-semibold text-white">
            Destaque
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-medium">{produto.nome}</h3>

        {temVariantes && (
          <div className="mt-1 flex flex-wrap gap-1">
            {opcoes.map((opcao, i) => (
              <button
                key={opcao.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setAtiva(i);
                }}
                className={`rounded border px-1.5 py-0.5 text-[11px] ${
                  i === ativa
                    ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 font-medium text-[var(--brand-primary)]"
                    : "border-black/10 text-black/50 dark:border-white/10 dark:text-white/50"
                }`}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-baseline gap-2 pt-1">
          <span className="text-base font-semibold">
            {formatarPreco(temPromocao ? selecionada.preco_promocional! : selecionada.preco)}
          </span>
          {temPromocao && (
            <span className="text-xs text-black/40 line-through dark:text-white/40">
              {formatarPreco(selecionada.preco)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
