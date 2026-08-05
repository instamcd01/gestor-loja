import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { EnderecoCliente } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Mesmo formato de Cliente.enderecoCompleto no app Gestor (lib/models/cliente.dart). */
export function formatarEnderecoCompleto(e: EnderecoCliente): string {
  const partes: string[] = [];
  if (e.endereco) partes.push(e.numero ? `${e.endereco}, ${e.numero}` : e.endereco);
  if (e.bairro) partes.push(e.bairro);

  const cidadeUf = [e.cidade, e.estado].filter(Boolean).join(" - ");
  if (cidadeUf) partes.push(cidadeUf);

  if (e.cep) partes.push(`CEP ${e.cep}`);

  return partes.join(", ");
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

/** Mesma normalização/formato de linkWhatsApp no app Gestor (lib/utils/telefone_utils.dart). */
export function linkWhatsApp(telefone: string, mensagem?: string): string {
  let digitos = telefone.replace(/\D/g, "");
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    digitos = digitos.slice(2);
  }
  const base = `https://wa.me/55${digitos}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}
