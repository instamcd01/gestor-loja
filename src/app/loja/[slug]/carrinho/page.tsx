import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CarrinhoConvidado } from "@/components/carrinho/carrinho-convidado";
import { CarrinhoLogado } from "@/components/carrinho/carrinho-logado";
import { getEmpresaPorSlug } from "@/lib/catalogo";
import { getCarrinho } from "@/lib/carrinho";
import { getEnderecoCliente, getPedidoPendentePagamento } from "@/lib/cliente";
import { createClient } from "@/lib/supabase/server";
import { formatarPreco } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  return { title: empresa ? `Carrinho — ${empresa.nome}` : "Carrinho" };
}

export default async function CarrinhoPage({
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

  const enderecoEmpresa = {
    endereco: empresa.endereco,
    cidade: empresa.cidade,
    estado: empresa.estado,
    cep: empresa.cep,
  };

  // Sem login, o carrinho vive só no navegador — telefone só é pedido
  // na hora de finalizar (ver CarrinhoConvidado e mesclarCarrinhoConvidado).
  if (!user) {
    return <CarrinhoConvidado slug={slug} empresaId={empresa.id} enderecoEmpresa={enderecoEmpresa} />;
  }

  const [carrinho, enderecoSalvo] = await Promise.all([getCarrinho(empresa.id), getEnderecoCliente(empresa.id)]);

  if (!carrinho.id || carrinho.itens.length === 0) {
    // O carrinho que originou um pedido "Pagamento Online" já foi
    // consumido no momento em que o pedido foi criado (ver
    // finalizar_pedido_site) — se o cliente sair da tela de confirmação
    // (Pix/cartão) antes de terminar, o carrinho aparece vazio sem
    // nenhuma pista de que existe um pagamento esperando. Achado ao vivo:
    // cliente tentou voltar pelo carrinho pra mudar de forma de
    // pagamento e ficou sem saber como retomar o Pix já gerado.
    const pedidoPendente = await getPedidoPendentePagamento(empresa.id);

    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
        {pedidoPendente && (
          <Link
            href={`/loja/${slug}/pedido/${pedidoPendente.id}`}
            className="mb-2 flex w-full flex-col gap-1 rounded-[var(--radius-lg)] border border-dashed border-[var(--brand-primary)]/40 bg-[var(--brand-primary)]/5 p-4 text-left"
          >
            <span className="text-sm font-semibold">
              Você tem um pagamento pendente — Pedido #{pedidoPendente.numeroSequencial}
            </span>
            <span className="text-xs text-black/50 dark:text-white/50">
              {formatarPreco(pedidoPendente.valorTotal)} · Toque pra ver o QR Code e terminar de pagar
            </span>
          </Link>
        )}
        <h1 className="text-xl font-semibold">Seu carrinho está vazio</h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          Volte ao catálogo e adicione alguns produtos.
        </p>
      </div>
    );
  }

  return (
    <CarrinhoLogado
      slug={slug}
      empresaId={empresa.id}
      aceitaRetirada={empresa.aceita_retirada}
      retiradaPrazoMin={empresa.retirada_prazo_min}
      enderecoEmpresa={enderecoEmpresa}
      horarioFuncionamento={empresa.horario_funcionamento}
      enderecoSalvo={enderecoSalvo}
      carrinhoInicial={carrinho}
    />
  );
}
