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
