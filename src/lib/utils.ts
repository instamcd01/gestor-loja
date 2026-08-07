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

/**
 * Converte um texto digitado em formato monetário BR ("1.234,56") pra
 * number. `parseFloat` sozinho quebra nesse formato — o ponto de milhar
 * fica pelo caminho e é interpretado como separador decimal (ex:
 * "1.234,56" virava 1.234 depois de só trocar vírgula por ponto).
 */
export function parseValorMonetarioBr(texto: string): number {
  const semMilhar = texto.replace(/\./g, "").replace(",", ".");
  return Number.parseFloat(semMilhar);
}

export function formatarHora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
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

/**
 * Mesma normalização/formato de linkWhatsApp no app Gestor
 * (lib/utils/telefone_utils.dart), que sempre força o "55" — lá isso é
 * seguro porque todo telefone de cliente/loja é brasileiro. Aqui adiciona
 * uma saída: um "+" no início do texto (ex: "+1 555 154 1583", número de
 * teste da Meta pra Cloud API) marca "já é internacional, não mexe",
 * pra não quebrar quando não for número do Brasil.
 */
export function linkWhatsApp(telefone: string, mensagem?: string): string {
  const jaInternacional = telefone.trim().startsWith("+");
  let digitos = telefone.replace(/\D/g, "");

  if (!jaInternacional) {
    if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
      digitos = digitos.slice(2);
    }
    digitos = `55${digitos}`;
  }

  const base = `https://wa.me/${digitos}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}
