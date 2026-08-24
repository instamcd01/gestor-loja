"use server";

import { registrarErroSistema } from "@/lib/erros";

/** Ponte pros error boundaries (client components) chamarem o rastreamento server-only. */
export async function reportarErroCliente(mensagem: string, rota: string, stack?: string) {
  await registrarErroSistema({ mensagem, rota, stack });
}
