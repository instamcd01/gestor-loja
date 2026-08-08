import { notFound, redirect } from "next/navigation";
import { PagamentoForm } from "@/components/carrinho/pagamento-form";
import { ButtonLink } from "@/components/ui/button";
import { getEmpresaPorSlug } from "@/lib/catalogo";
import { getCarrinho } from "@/lib/carrinho";
import { getSaldoCliente } from "@/lib/cliente";
import { createClient } from "@/lib/supabase/server";

// "Link de Pagamento" e "Outros" só fazem sentido com um atendente
// mediando (gerar/enviar link, decidir o que é "outros") — no
// autoatendimento do site, o cliente escolhe sozinho, então só faz
// sentido oferecer os métodos que se resolvem na entrega/retirada.
const METODOS_SEM_MEDIACAO_DE_ATENDENTE = new Set(["Dinheiro", "Pix", "Cartão de Débito", "Cartão de Crédito"]);

export const dynamic = "force-dynamic";

/**
 * Segunda etapa do checkout — só existe pra quem já passou pela primeira
 * (`/carrinho`, ver EntregaForm), que grava o resultado da entrega em
 * `checkout-estimado.ts` antes de navegar pra cá. O `PagamentoForm` lê
 * esse cache no client e redireciona de volta pro carrinho se estiver
 * vazio (acesso direto a essa URL). Repete o mesmo bootstrap server-side
 * de `carrinho/page.tsx` porque o carrinho pode ter mudado entre as duas
 * telas — nada é passado via querystring/route state, só via esse cache
 * compartilhado mais os dados sempre buscados de novo no servidor.
 */
export default async function CarrinhoPagamentoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sem login não existe etapa de pagamento própria (ver CarrinhoConvidado
  // em carrinho/page.tsx) — manda pro carrinho, que resolve login antes.
  if (!user) redirect(`/loja/${slug}/carrinho`);

  const [carrinho, saldoCliente] = await Promise.all([getCarrinho(empresa.id), getSaldoCliente(empresa.id)]);

  if (!carrinho.id || carrinho.itens.length === 0) {
    redirect(`/loja/${slug}/carrinho`);
  }

  return (
    <div className="mx-auto max-w-2xl pb-44 pt-6">
      <ButtonLink href={`/loja/${slug}/carrinho`} variant="secondary" className="mb-4 w-fit">
        ← Voltar ao carrinho
      </ButtonLink>
      <h1 className="mb-6 text-xl font-semibold">Pagamento</h1>
      <PagamentoForm
        slug={slug}
        empresaId={empresa.id}
        metodosPagamento={(empresa.metodos_pagamento_ativos ?? ["Dinheiro", "Pix"]).filter((m) =>
          METODOS_SEM_MEDIACAO_DE_ATENDENTE.has(m),
        )}
        bandeirasAceitas={empresa.bandeiras_aceitas}
        taxasParcelamento={empresa.taxas_parcelamento}
        valorMinimoParcela={empresa.valor_minimo_parcela}
        taxaServicoTipo={empresa.taxa_servico_tipo}
        taxaServicoValor={empresa.taxa_servico_valor}
        subtotal={carrinho.valorTotal}
        itens={carrinho.itens}
        saldoCliente={saldoCliente}
      />
    </div>
  );
}
