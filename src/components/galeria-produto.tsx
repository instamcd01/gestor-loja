"use client";

import { useState } from "react";
import { ProdutoImagem } from "@/components/produto-imagem";

export function GaleriaProduto({
  nome,
  categoria,
  imagemPrincipal,
  imagemSecundaria,
}: {
  nome: string;
  categoria: string | null;
  imagemPrincipal: string | null;
  imagemSecundaria: string | null;
}) {
  const imagens = [imagemPrincipal, imagemSecundaria].filter((src): src is string => !!src);
  const [ativa, setAtiva] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black/5 dark:bg-white/5">
        <ProdutoImagem
          src={imagens[ativa] ?? null}
          alt={nome}
          categoria={categoria}
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
          priority
        />
      </div>

      {imagens.length > 1 && (
        <div className="flex gap-2">
          {imagens.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setAtiva(i)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${
                ativa === i ? "border-[var(--brand-primary)]" : "border-transparent"
              }`}
            >
              <ProdutoImagem src={src} alt={`${nome} — foto ${i + 1}`} categoria={categoria} className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
