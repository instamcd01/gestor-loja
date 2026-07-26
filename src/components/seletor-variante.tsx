"use client";

import { useRouter } from "next/navigation";
import type { VarianteProduto } from "@/lib/types";

/**
 * Pills de peso/tamanho na página de produto. Ao contrário do card da
 * grade (que só troca o preço exibido), aqui clicar navega pra URL da
 * variante escolhida — mantém uma URL própria por variante (bom pra
 * compartilhar link e pro carrinho, que já trabalha em cima de produto_id).
 */
export function SeletorVariante({
  slug,
  variantes,
  idAtual,
}: {
  slug: string;
  variantes: VarianteProduto[];
  idAtual: string;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
        Escolha o tamanho
      </span>
      <div className="flex flex-wrap gap-2">
        {variantes.map((variante) => (
          <button
            key={variante.id}
            type="button"
            onClick={() => router.push(`/loja/${slug}/produto/${variante.id}`)}
            className={`rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm ${
              variante.id === idAtual
                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 font-medium text-[var(--brand-primary)]"
                : "border-black/10 text-black/60 hover:border-black/20 dark:border-white/10 dark:text-white/60"
            }`}
          >
            {variante.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}
