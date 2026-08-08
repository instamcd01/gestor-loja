import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FiltrosDrawer } from "@/components/catalogo/filtros-drawer";
import { OrdenarPor } from "@/components/catalogo/ordenar-por";
import { BannerCarousel } from "@/components/loja/banner-carousel";
import { CategoriasEmLinha } from "@/components/loja/categorias-em-linha";
import { CategoriasEspecie } from "@/components/loja/categorias-especie";
import { ClubeEmBreve } from "@/components/loja/clube-em-breve";
import { GradeDeProdutos, GradeSkeleton } from "@/components/loja/grade-de-produtos";
import { HeroBanner } from "@/components/loja/hero-banner";
import { MarcasParceiras } from "@/components/loja/marcas-parceiras";
import { SelosConfianca } from "@/components/selos-confianca";
import {
  getBannersCatalogo,
  getContagemProdutosCatalogo,
  getEmpresaPorSlug,
  getFiltrosCatalogo,
  getMenorValorFreteGratis,
  getProdutosCatalogo,
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
  const semFiltro = !filtroAtivo && !ordenar;
  const moderno = empresa.catalogo_modelo === "moderno";

  // Sem filtro/ordenação, a home usa `CategoriasEmLinha` (amostra por
  // categoria via RPC) em vez da grade plana — não faz sentido buscar os
  // ~424 produtos-pai da empresa inteira só pra jogar fora a lista e usar
  // apenas a contagem. Com filtro/ordenação ativos, a grade plana precisa
  // da lista real (é o que ela renderiza), então busca completa mesmo.
  const [produtos, totalSemFiltro, { marcas, especies, fases, faixasPreco }, freteGratisMinimo, banners] =
    await Promise.all([
      semFiltro
        ? Promise.resolve([])
        : getProdutosCatalogo(empresa.id, {
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
      semFiltro ? getContagemProdutosCatalogo(empresa.id) : Promise.resolve(0),
      getFiltrosCatalogo(empresa.id),
      getMenorValorFreteGratis(empresa.id),
      getBannersCatalogo(empresa.id),
    ]);

  const totalProdutos = semFiltro ? totalSemFiltro : produtos.length;

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
          {totalProdutos} produto{totalProdutos === 1 ? "" : "s"}
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

      {totalProdutos === 0 ? (
        <p className="py-16 text-center text-black/50 dark:text-white/50">
          {filtroAtivo
            ? "Nenhum produto encontrado."
            : "Nenhum produto disponível no catálogo ainda."}
        </p>
      ) : semFiltro ? (
        // Isolado num Server Component próprio + Suspense pelo mesmo motivo
        // da grade plana abaixo: o resto da página não depende dela pra
        // streamar primeiro.
        <Suspense fallback={<GradeSkeleton />}>
          <CategoriasEmLinha
            slug={slug}
            empresaId={empresa.id}
            enderecoEmpresa={enderecoEmpresa}
            moderno={moderno}
          />
        </Suspense>
      ) : (
        // Isolado num Server Component próprio + Suspense: a busca de variantes
        // (getVariantesEmLote) é a parte mais lenta do carregamento desta página,
        // mas nada acima dela (banners, filtros, contagem) depende do resultado.
        // Sem isso o await bloqueava o streaming da página inteira até resolver.
        <Suspense fallback={<GradeSkeleton />}>
          <GradeDeProdutos
            produtos={produtos}
            slug={slug}
            empresaId={empresa.id}
            enderecoEmpresa={enderecoEmpresa}
            moderno={moderno}
          />
        </Suspense>
      )}
    </div>
  );
}
