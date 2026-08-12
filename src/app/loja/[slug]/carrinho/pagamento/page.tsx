import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PagamentoForm } from "@/components/carrinho/pagamento-form";
import { getEmpresaPorSlug, getMercadoPagoPublicKey } from "@/lib/catalogo";
import { getCarrinho } from "@/lib/carrinho";
import { getMercadoPagoCustomerId, getSaldoCliente } from "@/lib/cliente";
import { listarCartoesSalvos } from "@/lib/mercadopago";
import { createClient } from "@/lib/supabase/server";
import { NOME_PAGAMENTO_ONLINE } from "@/lib/utils";

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

  // Só busca a public_key se a loja realmente pode oferecer pagamento
  // online (evita uma ida ao banco à toa nas lojas que nunca vão usar
  // isso). Se a loja configurou "online"/"ambos" mas nunca conectou o
  // Mercado Pago (public_key null), cai pros métodos na entrega — nunca
  // deixa o cliente sem opção nenhuma de pagamento.
  const mpPublicKey =
    empresa.pagamento_online_disponibilidade !== "entrega" ? await getMercadoPagoPublicKey(empresa.id) : null;

  // Cartão salvo (ver salvarCartaoDoCliente em mercadopago.ts) — repassado
  // pro Payment Brick mostrar como opção pronta, sem o cliente digitar o
  // cartão de novo. `mpCustomerId` null = cliente nunca pagou online nessa
  // loja ainda, Brick renderiza o formulário normal de cartão novo.
  const mpCustomerId = mpPublicKey ? await getMercadoPagoCustomerId(empresa.id) : null;
  const cartoesSalvos = mpCustomerId ? await listarCartoesSalvos(empresa.id, mpCustomerId) : [];

  const metodosEntrega = (empresa.metodos_pagamento_ativos ?? ["Dinheiro", "Pix"]).filter((m) =>
    METODOS_SEM_MEDIACAO_DE_ATENDENTE.has(m),
  );
  const metodosPagamento =
    mpPublicKey && empresa.pagamento_online_disponibilidade === "online"
      ? [NOME_PAGAMENTO_ONLINE]
      : mpPublicKey && empresa.pagamento_online_disponibilidade === "ambos"
        ? [...metodosEntrega, NOME_PAGAMENTO_ONLINE]
        : metodosEntrega;

  return (
    <div className="mx-auto max-w-2xl pb-44 pt-3">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/loja/${slug}/carrinho`}
          aria-label="Voltar ao carrinho"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-black/60 transition-colors hover:border-black/20 hover:bg-black/5 hover:text-black/80 dark:border-white/15 dark:text-white/60 dark:hover:border-white/25 dark:hover:bg-white/10 dark:hover:text-white/80"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div>
          <p className="text-xs font-medium text-black/40 dark:text-white/40">Etapa 2 de 2</p>
          <h1 className="text-xl font-semibold">Pagamento</h1>
        </div>
      </div>
      <PagamentoForm
        slug={slug}
        empresaId={empresa.id}
        metodosPagamento={metodosPagamento}
        mpPublicKey={mpPublicKey}
        mpCustomerId={mpCustomerId}
        cartoesSalvos={cartoesSalvos}
        mpPixAtivo={empresa.mp_pix_ativo}
        mpDebitoAtivo={empresa.mp_debito_ativo}
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
