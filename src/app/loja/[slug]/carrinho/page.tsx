import { notFound } from "next/navigation";
import { CarrinhoConvidado } from "@/components/carrinho/carrinho-convidado";
import { CarrinhoLogado } from "@/components/carrinho/carrinho-logado";
import { getEmpresaPorSlug } from "@/lib/catalogo";
import { getCarrinho } from "@/lib/carrinho";
import { getEnderecoCliente } from "@/lib/cliente";
import { createClient } from "@/lib/supabase/server";

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

  const [carrinho, enderecoSalvo] = await Promise.all([getCarrinho(empresa.id), getEnderecoCliente(empresa.id)]);

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
      aceitaRetirada={empresa.aceita_retirada}
      retiradaPrazoMin={empresa.retirada_prazo_min}
      enderecoEmpresa={enderecoEmpresa}
      horarioFuncionamento={empresa.horario_funcionamento}
      enderecoSalvo={enderecoSalvo}
      carrinhoInicial={carrinho}
    />
  );
}
