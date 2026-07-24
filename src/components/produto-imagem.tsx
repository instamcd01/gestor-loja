"use client";

import Image from "next/image";
import { useState } from "react";
import { ProdutoPlaceholder } from "@/components/produto-placeholder";

/**
 * Envolve next/image com fallback pro placeholder por categoria — não
 * só quando `imagem_url` é nula, mas também quando a URL existe mas a
 * imagem não carrega de verdade (link quebrado na planilha importada,
 * CDN fora do ar etc — achado real ao testar visualmente, não hipotético).
 */
export function ProdutoImagem({
  src,
  alt,
  categoria,
  sizes,
  className,
  priority,
}: {
  src: string | null;
  alt: string;
  categoria: string | null;
  sizes?: string;
  className?: string;
  priority?: boolean;
}) {
  const [falhou, setFalhou] = useState(false);

  if (!src || falhou) {
    return <ProdutoPlaceholder categoria={categoria} />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={className}
      onError={() => setFalhou(true)}
    />
  );
}
