import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BuscaCatalogo } from "@/components/catalogo/busca-catalogo";
import { FiltroCategorias } from "@/components/catalogo/filtro-categorias";
import { ProdutoCard } from "@/components/produto-card";
import {
  getCategoriasComContagem,
  getEmpresaPorSlug,
  getProdutosCatalogo,
} from "@/lib/catalogo";

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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; categoria?: string }>;
}) {
  const { slug } = await params;
  const { q, categoria } = await searchParams;
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) notFound();

  const filtroAtivo = !!q || !!categoria;

  const [produtos, categorias] = await Promise.all([
    getProdutosCatalogo(empresa.id, { busca: q, categoria }),
    getCategoriasComContagem(empresa.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BuscaCatalogo valorInicial={q ?? ""} />
        {categorias.length > 1 && (
          <FiltroCategorias categorias={categorias} categoriaAtiva={categoria ?? null} />
        )}
      </div>

      {produtos.length === 0 ? (
        <p className="py-16 text-center text-black/50 dark:text-white/50">
          {filtroAtivo
            ? "Nenhum produto encontrado."
            : "Nenhum produto disponível no catálogo ainda."}
        </p>
      ) : filtroAtivo ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {produtos.map((produto) => (
            <ProdutoCard key={produto.id} produto={produto} slug={slug} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {agruparPorCategoria(produtos).map(([cat, itens]) => (
            <section key={cat} className="flex flex-col gap-4">
              <h2 className="text-xl font-semibold">{cat}</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {itens.map((produto) => (
                  <ProdutoCard key={produto.id} produto={produto} slug={slug} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function agruparPorCategoria<T extends { categoria: string | null }>(produtos: T[]) {
  const porCategoria = new Map<string, T[]>();
  for (const produto of produtos) {
    const chave = produto.categoria ?? "Outros";
    porCategoria.set(chave, [...(porCategoria.get(chave) ?? []), produto]);
  }
  return [...porCategoria.entries()];
}
