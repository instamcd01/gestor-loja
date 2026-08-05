import { notFound } from "next/navigation";
import { CarrinhoConvidado } from "@/components/carrinho/carrinho-convidado";
import { CarrinhoLogado } from "@/components/carrinho/carrinho-logado";
import { getEmpresaPorSlug } from "@/lib/catalogo";
import { getCarrinho } from "@/lib/carrinho";
import { getEnderecoCliente, getSaldoCliente } from "@/lib/cliente";
import { createClient } from "@/lib/supabase/server";

// "Link de Pagamento" e "Outros" só fazem sentido com um atendente
// mediando (gerar/enviar link, decidir o que é "outros") — no
// autoatendimento do site, o cliente escolhe sozinho, então só faz
// sentido oferecer os métodos que se resolvem na entrega/retirada.
const METODOS_SEM_MEDIACAO_DE_ATENDENTE = new Set(["Dinheiro", "Pix", "Cartão de Débito", "Cartão de Crédito"]);

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

  const [carrinho, enderecoSalvo, saldoCliente] = await Promise.all([
    getCarrinho(empresa.id),
    getEnderecoCliente(empresa.id),
    getSaldoCliente(empresa.id),
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
    <CarrinhoLogado
      slug={slug}
      empresaId={empresa.id}
      metodosPagamento={(empresa.metodos_pagamento_ativos ?? ["Dinheiro", "Pix"]).filter((m) =>
        METODOS_SEM_MEDIACAO_DE_ATENDENTE.has(m),
      )}
      aceitaRetirada={empresa.aceita_retirada}
      enderecoEmpresa={enderecoEmpresa}
      enderecoSalvo={enderecoSalvo}
      saldoCliente={saldoCliente}
      carrinhoInicial={carrinho}
    />
  );
}
