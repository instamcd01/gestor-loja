"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Esconde o rodapé (atendimento/políticas) fora da tela principal e da
 * conta — pedido do usuário: nas outras telas (carrinho, checkout, produto,
 * pedidos...) ele só empurra conteúdo pra baixo sem servir de navegação.
 * Só a decisão de mostrar/esconder roda no cliente (precisa do pathname);
 * o LojaFooter em si continua sendo renderizado no servidor, passado aqui
 * como children já pronto.
 */
export function RodapeVisivel({ slug, children }: { slug: string; children: ReactNode }) {
  const pathname = usePathname();
  const visivel = pathname === `/loja/${slug}` || pathname === `/loja/${slug}/conta`;
  if (!visivel) return null;
  return children;
}
