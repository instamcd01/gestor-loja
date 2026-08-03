import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function percentualDesconto(preco: number, precoPromocional: number | null) {
  if (precoPromocional == null || precoPromocional >= preco) return 0;
  return Math.round((1 - precoPromocional / preco) * 100);
}

/** Preço que o cliente realmente paga — promocional só quando é de fato menor que o preço cheio. */
export function precoEfetivo(item: { preco: number; preco_promocional: number | null }) {
  return item.preco_promocional != null && item.preco_promocional < item.preco
    ? item.preco_promocional
    : item.preco;
}
