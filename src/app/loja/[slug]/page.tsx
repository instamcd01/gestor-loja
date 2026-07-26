import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FiltrosDrawer } from "@/components/catalogo/filtros-drawer";
import { OrdenarPor } from "@/components/catalogo/ordenar-por";
import { ClubeEmBreve } from "@/components/loja/clube-em-breve";
import { HeroBanner } from "@/components/loja/hero-banner";
import { ProdutoCard } from "@/components/produto-card";
import { SelosConfianca } from "@/components/selos-confianca";
import {
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

  const [produtos, marcas, faixasPreco, freteGratisMinimo] = await Promise.all([
    getProdutosCatalogo(empresa.id, {
      busca: q,
      categoria,
      marca,
      precoMin: precoMin ? Number(precoMin) : undefined,
      precoMax: precoMax ? Number(precoMax) : undefined,
      ordenar,
    }),
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
      {!filtroAtivo && <HeroBanner nome={empresa.nome} tagline={empresa.catalogo_info_extra} />}

      <SelosConfianca
        freteGratisMinimo={freteGratisMinimo}
        metodosPagamento={empresa.metodos_pagamento_ativos}
      />

      {!filtroAtivo && <ClubeEmBreve nome={empresa.nome} />}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-black/50 dark:text-white/50">
          {produtos.length} produto{produtos.length === 1 ? "" : "s"}
          {categoria ? ` em ${categoria}` : ""}
        </p>
        <div className="flex items-center gap-2">
          <FiltrosDrawer marcas={marcas} marcaAtiva={marca ?? null} faixasPreco={faixasPreco} faixaAtiva={faixaAtiva} />
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
