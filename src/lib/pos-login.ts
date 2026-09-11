import type { useRouter } from "next/navigation";
import { mesclarCarrinhoConvidado } from "@/lib/carrinho";
import { lerCarrinhoConvidado, limparCarrinhoConvidado } from "@/lib/carrinho-convidado";
import { createClient } from "@/lib/supabase/client";

type Router = ReturnType<typeof useRouter>;

/** Último passo de qualquer entrada bem-sucedida (telefone, email ou
 * Google), só chamado quando o cadastro já está completo (perfil já
 * preenchido antes, ou acabou de preencher agora): mescla o carrinho de
 * visitante com o carrinho real do cliente e navega pro destino. Extraído
 * de `login-form.tsx` pra ser reaproveitado por `pos-login/page.tsx` — o
 * retorno do OAuth do Google é um redirect de página inteira, então não
 * dá pra manter esse passo só dentro do state do formulário de login.
 *
 * `clienteId`/`evento` alimentam a notificação "Cliente entrou no site" no
 * Gestor (RPC `notificar_cliente_ativo_site`, só dispara de fato se esse
 * cliente teve conversa no WhatsApp nas últimas 48h) — a função já existia
 * no banco e estava testada, mas nunca tinha sido chamada de lugar nenhum
 * do app (achado real 12/09, por isso o lojista nunca recebia o alerta).
 * Best-effort: nunca atrasa nem derruba a navegação por causa dela. */
export async function concluirLoginEIrPara(
  router: Router,
  {
    slug,
    empresaId,
    rotaPosLogin,
    clienteId,
    evento,
  }: { slug: string; empresaId: string; rotaPosLogin: string; clienteId?: string | null; evento?: string },
) {
  if (clienteId && evento) {
    createClient()
      .rpc("notificar_cliente_ativo_site", { p_cliente_id: clienteId, p_evento: evento })
      .then(
        () => {},
        () => {},
      );
  }

  const itensConvidado = lerCarrinhoConvidado(empresaId);
  if (itensConvidado.length > 0) {
    await mesclarCarrinhoConvidado(
      slug,
      empresaId,
      itensConvidado.map((item) => ({ produtoId: item.produtoId, quantidade: item.quantidade })),
    );
    limparCarrinhoConvidado(empresaId);
  }
  router.push(rotaPosLogin ? `/loja/${slug}/${rotaPosLogin}` : `/loja/${slug}`);
  router.refresh();
}
