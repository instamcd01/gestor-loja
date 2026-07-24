import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AtalhosCategoria } from "@/components/catalogo/atalhos-categoria";
import { BuscaCatalogo } from "@/components/catalogo/busca-catalogo";
import { FiltroCategorias } from "@/components/catalogo/filtro-categorias";
import { FiltroMarca } from "@/components/catalogo/filtro-marca";
import { FiltroPreco } from "@/components/catalogo/filtro-preco";
import { OrdenarPor } from "@/components/catalogo/ordenar-por";
import { ProdutoCard } from "@/components/produto-card";
import { SelosConfianca } from "@/components/selos-confianca";
import {
  getCategoriasComContagem,
  getEmpresaPorSlug,
  getFaixasPrecoComContagem,
  getMarcasComContagem,
  getMenorValorFreteGratis,
  getProdutosCatalogo,
  getVariantesEmLote,
  type Ordenacao,
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
  searchParams: Promise<{
    q?: string;
    categoria?: string;
    marca?: string;
    precoMin?: string;
    precoMax?: string;
    ordenar?: Ordenacao;
  }>;
}) {
  const { slug } = await params;
  const { q, categoria, marca, precoMin, precoMax, ordenar } = await searchParams;
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) notFound();

  const filtroAtivo = !!q || !!categoria || !!marca || !!precoMin;

  const [produtos, categorias, marcas, faixasPreco, freteGratisMinimo] = await Promise.all([
    getProdutosCatalogo(empresa.id, {
      busca: q,
      categoria,
      marca,
      precoMin: precoMin ? Number(precoMin) : undefined,
      precoMax: precoMax ? Number(precoMax) : undefined,
      ordenar,
    }),
    getCategoriasComContagem(empresa.id),
    getMarcasComContagem(empresa.id),
    getFaixasPrecoComContagem(empresa.id),
    getMenorValorFreteGratis(empresa.id),
  ]);

  const variantesPorPai = await getVariantesEmLote(
    empresa.id,
    produtos.map((p) => p.id),
  );

  const faixaAtiva =
    precoMin != null ? { min: Number(precoMin), max: precoMax ? Number(precoMax) : undefined } : null;

  return (
    <div className="flex flex-col gap-6">
      <SelosConfianca
        freteGratisMinimo={freteGratisMinimo}
        metodosPagamento={empresa.metodos_pagamento_ativos}
      />

      {!filtroAtivo && (
        <AtalhosCategoria categorias={categorias} slug={slug} />
      )}

      <div className="flex flex-col gap-3">
        <BuscaCatalogo valorInicial={q ?? ""} />
        {categorias.length > 1 && (
          <FiltroCategorias categorias={categorias} categoriaAtiva={categoria ?? null} />
        )}
        {marcas.length > 1 && <FiltroMarca marcas={marcas} marcaAtiva={marca ?? null} />}
        {faixasPreco.length > 1 && <FiltroPreco faixas={faixasPreco} faixaAtiva={faixaAtiva} />}
        <div className="flex justify-end">
          <OrdenarPor ordenacaoAtiva={ordenar ?? "relevancia"} />
        </div>
      </div>

      {produtos.length === 0 ? (
        <p className="py-16 text-center text-black/50 dark:text-white/50">
          {filtroAtivo
            ? "Nenhum produto encontrado."
            : "Nenhum produto disponível no catálogo ainda."}
        </p>
      ) : filtroAtivo || ordenar ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {produtos.map((produto) => (
            <ProdutoCard
              key={produto.id}
              produto={produto}
              slug={slug}
              variantes={variantesPorPai.get(produto.id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {agruparPorCategoria(produtos).map(([cat, itens]) => (
            <section key={cat} className="flex flex-col gap-4">
              <h2 className="text-xl font-semibold">{cat}</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {itens.map((produto) => (
                  <ProdutoCard
                    key={produto.id}
                    produto={produto}
                    slug={slug}
                    variantes={variantesPorPai.get(produto.id)}
                  />
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
