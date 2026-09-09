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
  updatedAt,
}: {
  src: string | null;
  alt: string;
  categoria: string | null;
  sizes?: string;
  className?: string;
  priority?: boolean;
  /**
   * `produtos.updated_at` (ISO) — o path do arquivo no Storage é sempre o
   * mesmo pro mesmo produto+posição (upload usa `upsert: true`, ver app
   * Gestor), então trocar a foto sobrescreve o arquivo na MESMA url. O
   * cache de otimização de imagem do Next (por url+tamanho+qualidade)
   * continua servindo a versão antiga se a url não mudar — achado real
   * (08/09): usuário via a foto nova na lista mas a antiga na página do
   * produto, cada uma batendo num cache de tamanho diferente. Opcional —
   * sem isso, mantém o comportamento de antes (sem cache-busting).
   */
  updatedAt?: string | null;
}) {
  const [falhou, setFalhou] = useState(false);

  if (!src || falhou) {
    return <ProdutoPlaceholder categoria={categoria} />;
  }

  const srcComCacheBuster = updatedAt
    ? `${src}?cb=${new Date(updatedAt).getTime()}`
    : src;

  return (
    <Image
      src={srcComCacheBuster}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={className}
      onError={() => setFalhou(true)}
    />
  );
}
