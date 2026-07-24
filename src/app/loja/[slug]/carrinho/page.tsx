import { notFound, redirect } from "next/navigation";
import { CheckoutForm } from "@/components/carrinho/checkout-form";
import { ItemCarrinhoRow } from "@/components/carrinho/item-carrinho-row";
import { getEmpresaPorSlug } from "@/lib/catalogo";
import { getCarrinho } from "@/lib/carrinho";
import { getEnderecoCliente } from "@/lib/cliente";
import { createClient } from "@/lib/supabase/server";
import { formatarPreco } from "@/lib/utils";

export const dynamic = "force-dynamic";

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
  if (!user) redirect(`/loja/${slug}/entrar`);

  const [carrinho, enderecoSalvo] = await Promise.all([
    getCarrinho(empresa.id),
    getEnderecoCliente(empresa.id),
  ]);

  if (!carrinho.id || carrinho.itens.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 py-16 text-center">
        <h1 className="text-xl font-semibold">Seu carrinho está vazio</h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          Volte ao catálogo e adicione alguns produtos.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-6">
      <h1 className="text-xl font-semibold">Seu carrinho</h1>

      <div className="divide-y divide-black/5 dark:divide-white/10">
        {carrinho.itens.map((item) => (
          <ItemCarrinhoRow key={item.id} slug={slug} carrinhoId={carrinho.id!} item={item} />
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-black/10 pt-4 dark:border-white/10">
        <span className="text-base font-medium">Total</span>
        <span className="text-xl font-bold">{formatarPreco(carrinho.valorTotal)}</span>
      </div>

      <CheckoutForm
        slug={slug}
        empresaId={empresa.id}
        metodosPagamento={empresa.metodos_pagamento_ativos ?? ["Dinheiro", "Pix"]}
        enderecoEmpresa={{
          endereco: empresa.endereco,
          cidade: empresa.cidade,
          estado: empresa.estado,
          cep: empresa.cep,
        }}
        subtotal={carrinho.valorTotal}
        enderecoSalvo={enderecoSalvo}
      />
    </div>
  );
}
