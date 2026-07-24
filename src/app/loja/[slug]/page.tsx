import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProdutoCard } from "@/components/produto-card";
import { getCategoriasCatalogo, getEmpresaPorSlug, getProdutosCatalogo } from "@/lib/catalogo";

export const revalidate = 60; // catálogo pode mudar preço/estoque a qualquer momento

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) return {};
  return {
    title: empresa.nome,
    description: empresa.catalogo_info_extra ?? `Peça online na ${empresa.nome}`,
  };
}

export default async function LojaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) notFound();

  const [produtos, categorias] = await Promise.all([
    getProdutosCatalogo(empresa.id),
    getCategoriasCatalogo(empresa.id),
  ]);

  const porCategoria = new Map<string, typeof produtos>();
  for (const produto of produtos) {
    const chave = produto.categoria ?? "Outros";
    porCategoria.set(chave, [...(porCategoria.get(chave) ?? []), produto]);
  }

  if (produtos.length === 0) {
    return (
      <p className="py-16 text-center text-black/50 dark:text-white/50">
        Nenhum produto disponível no catálogo ainda.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {categorias.length > 0 ? (
        [...porCategoria.entries()].map(([categoria, itens]) => (
          <section key={categoria} className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">{categoria}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {itens.map((produto) => (
                <ProdutoCard key={produto.id} produto={produto} slug={slug} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {produtos.map((produto) => (
            <ProdutoCard key={produto.id} produto={produto} slug={slug} />
          ))}
        </div>
      )}
    </div>
  );
}
