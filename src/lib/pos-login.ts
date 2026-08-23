import type { useRouter } from "next/navigation";
import { mesclarCarrinhoConvidado } from "@/lib/carrinho";
import { lerCarrinhoConvidado, limparCarrinhoConvidado } from "@/lib/carrinho-convidado";

type Router = ReturnType<typeof useRouter>;

/** Último passo de qualquer entrada bem-sucedida (telefone, email ou
 * Google), só chamado quando o cadastro já está completo (perfil já
 * preenchido antes, ou acabou de preencher agora): mescla o carrinho de
 * visitante com o carrinho real do cliente e navega pro destino. Extraído
 * de `login-form.tsx` pra ser reaproveitado por `pos-login/page.tsx` — o
 * retorno do OAuth do Google é um redirect de página inteira, então não
 * dá pra manter esse passo só dentro do state do formulário de login. */
export async function concluirLoginEIrPara(
  router: Router,
  { slug, empresaId, rotaPosLogin }: { slug: string; empresaId: string; rotaPosLogin: string },
) {
  const itensConvidado = lerCarrinhoConvidado(empresaId);
  if (itensConvidado.length > 0) {
    await mesclarCarrinhoConvidado(
      slug,
      empresaId,
      itensConvidado.map((item) => ({ produtoId: item.produtoId, quantidade: item.quantidade })),
    );
    limparCarrinhoConvidado(empresaId);
  }
  router.push(`/loja/${slug}/${rotaPosLogin}`);
  router.refresh();
}
