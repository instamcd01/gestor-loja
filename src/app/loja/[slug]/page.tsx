import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FiltrosDrawer } from "@/components/catalogo/filtros-drawer";
import { OrdenarPor } from "@/components/catalogo/ordenar-por";
import { BannerCarousel } from "@/components/loja/banner-carousel";
import { CategoriasEspecie } from "@/components/loja/categorias-especie";
import { ClubeEmBreve } from "@/components/loja/clube-em-breve";
import { HeroBanner } from "@/components/loja/hero-banner";
import { MarcasParceiras } from "@/components/loja/marcas-parceiras";
import { ProdutoCard } from "@/components/produto-card";
import { SelosConfianca } from "@/components/selos-confianca";
import {
  getBannersCatalogo,
  getEmpresaPorSlug,
  getEspeciesComContagem,
  getFaixasPrecoComContagem,
  getFasesComContagem,
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
    departamento?: string;
    categoria?: string;
    marca?: string;
    especie?: string;
    fase?: string;
    precoMin?: string;
    precoMax?: string;
    ordenar?: Ordenacao;
  }>;
}) {
  const { slug } = await params;
  const { q, departamento, categoria, marca, especie, fase, precoMin, precoMax, ordenar } = await searchParams;
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) notFound();

  const filtroAtivo = !!q || !!departamento || !!categoria || !!marca || !!especie || !!fase || !!precoMin;
  const moderno = empresa.catalogo_modelo === "moderno";

  const [produtos, marcas, especies, fases, faixasPreco, freteGratisMinimo, banners] = await Promise.all([
    getProdutosCatalogo(empresa.id, {
      busca: q,
      departamento,
      categoria,
      marca,
      especie,
      fase,
      precoMin: precoMin ? Number(precoMin) : undefined,
      precoMax: precoMax ? Number(precoMax) : undefined,
      ordenar,
    }),
    getMarcasComContagem(empresa.id),
    getEspeciesComContagem(empresa.id),
    getFasesComContagem(empresa.id),
    getFaixasPrecoComContagem(empresa.id),
    getMenorValorFreteGratis(empresa.id),
    getBannersCatalogo(empresa.id),
  ]);

  const variantesPorPai = await getVariantesEmLote(empresa.id, produtos);
  const enderecoEmpresa = {
    endereco: empresa.endereco,
    cidade: empresa.cidade,
    estado: empresa.estado,
    cep: empresa.cep,
  };

  const faixaAtiva =
    precoMin != null ? { min: Number(precoMin), max: precoMax ? Number(precoMax) : undefined } : null;

  return (
    <div className="flex flex-col gap-6">
      {!filtroAtivo &&
        (banners.length > 0 ? (
          <BannerCarousel banners={banners} />
        ) : (
          <HeroBanner nome={empresa.nome} tagline={empresa.catalogo_info_extra} moderno={moderno} />
        ))}

      {!filtroAtivo && <CategoriasEspecie slug={slug} />}

      <SelosConfianca
        freteGratisMinimo={freteGratisMinimo}
        metodosPagamento={empresa.metodos_pagamento_ativos}
        moderno={moderno}
      />

      {!filtroAtivo && <ClubeEmBreve nome={empresa.nome} moderno={moderno} />}

      {!filtroAtivo && moderno && <MarcasParceiras marcas={marcas} />}

      <div id="produtos" className="flex items-center justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-sm text-black/50 dark:text-white/50">
          {produtos.length} produto{produtos.length === 1 ? "" : "s"}
          {categoria ? ` em ${categoria}` : departamento ? ` em ${departamento}` : ""}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <FiltrosDrawer
            marcas={marcas}
            marcaAtiva={marca ?? null}
            especies={especies}
            especieAtiva={especie ?? null}
            fases={fases}
            faseAtiva={fase ?? null}
            faixasPreco={faixasPreco}
            faixaAtiva={faixaAtiva}
          />
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
              empresaId={empresa.id}
              enderecoEmpresa={enderecoEmpresa}
              variantes={variantesPorPai.get(produto.id)}
              moderno={moderno}
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
                    empresaId={empresa.id}
                    enderecoEmpresa={enderecoEmpresa}
                    variantes={variantesPorPai.get(produto.id)}
                    moderno={moderno}
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
