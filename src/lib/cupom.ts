"use server";

import { createClient } from "@/lib/supabase/server";
import { getUsuarioSeguro } from "@/lib/supabase/auth";
import type { ItemCarrinho } from "@/lib/types";

export type ResultadoCupom =
  | { valido: true; cupomId: string; valorDesconto: number }
  | { valido: false; motivo: string };

/**
 * Resolve o cliente pela sessão (auth.uid()), nunca por um id vindo do
 * cliente — mesma regra de "nunca confiar em identidade vinda do
 * navegador" já usada em finalizar_pedido_site/getEnderecoCliente.
 * validar_cupom é a mesma função Postgres usada pelo app (Gestor) e,
 * de novo, dentro de finalizar_pedido_site na hora de aplicar de
 * verdade — aqui é só o preview antes de confirmar o pedido.
 */
export async function validarCupom(
  empresaId: string,
  codigo: string,
  itens: ItemCarrinho[],
  subtotal: number,
): Promise<ResultadoCupom> {
  const supabase = await createClient();
  const user = await getUsuarioSeguro(supabase);
  if (!user) return { valido: false, motivo: "Faça login pra usar um cupom." };

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const itensPayload = itens.map((item) => ({
    produto_id: item.produto_id,
    categoria: item.produto?.categoria ?? null,
    subcategoria: item.produto?.subcategoria ?? null,
    marca: item.produto?.fabricante ?? null,
    subtotal: item.subtotal,
  }));

  const { data, error } = await supabase
    .rpc("validar_cupom", {
      p_empresa_id: empresaId,
      p_codigo: codigo.trim().slice(0, 40),
      p_cliente_id: cliente?.id ?? null,
      p_subtotal: subtotal,
      p_itens: itensPayload,
    })
    .maybeSingle<{ valido: boolean; motivo: string | null; cupom_id: string | null; valor_desconto: number }>();

  if (error || !data) {
    return { valido: false, motivo: "Não foi possível validar o cupom agora." };
  }
  if (!data.valido) {
    return { valido: false, motivo: data.motivo ?? "Cupom inválido." };
  }
  return { valido: true, cupomId: data.cupom_id as string, valorDesconto: Number(data.valor_desconto) };
}
