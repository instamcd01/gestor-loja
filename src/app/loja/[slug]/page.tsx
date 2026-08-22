import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FiltrosDrawer } from "@/components/catalogo/filtros-drawer";
import { OrdenarPor } from "@/components/catalogo/ordenar-por";
import { SugestaoProduto } from "@/components/catalogo/sugestao-produto";
import { BannerCarousel } from "@/components/loja/banner-carousel";
import { CategoriasEmLinha } from "@/components/loja/categorias-em-linha";
import { CategoriasEspecie } from "@/components/loja/categorias-especie";
import {
  GradeDeProdutos,
  GradeSkeleton,
} from "@/components/loja/grade-de-produtos";
import { HeroBanner } from "@/components/loja/hero-banner";
import { MaisVendidos, PromocoesDoDia } from "@/components/loja/linha-produtos-destaque";
import { MarcasParceiras } from "@/components/loja/marcas-parceiras";
import { PetcashFaixaInfo } from "@/components/loja/petcash-faixa-info";
import {
  getBannersCatalogo,
  getContagemProdutosCatalogo,
  getEmpresaPorSlug,
  getFiltrosCatalogo,
  getProdutosCatalogo,
  type Ordenacao,
} from "@/lib/catalogo";

// Sem isso, o Next.js trata a home como estática e serve a página em cache
// indefinidamente — banner trocado no banco (ex: Configurações > Banners)
// não aparecia pros visitantes até o próximo deploy. Achado 22/08/2026: um
// banner de vídeo de 22MB, já trocado por uma imagem, continuou sendo
// baixado por visitantes reais por dias por causa disso, estourando a cota
// de cached egress do Supabase. 60s (mais curto que o revalidate=300 do
// layout, que é só pra branding) equilibra frescor com cache de verdade.
export const revalidate = 60;

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
    description:
      empresa.catalogo_info_extra ?? `Peça online na ${empresa.nome}`,
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
  const {
    q,
    departamento,
    categoria,
    marca,
    especie,
    fase,
    precoMin,
    precoMax,
    ordenar,
  } = await searchParams;
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) notFound();

  const filtroAtivo =
    !!q ||
    !!departamento ||
    !!categoria ||
    !!marca ||
    !!especie ||
    !!fase ||
    !!precoMin;
  const moderno = empresa.catalogo_modelo === "moderno";

  // Linhas por categoria (CategoriasEmLinha) valem pra home solta, pra tela
  // de espécie (Cães/Gatos/Pássaros/Outros) E pra "Tudo em {departamento}"
  // (departamento setado mas sem categoria final escolhida ainda) — nos 3
  // casos ainda não há um recorte fino o bastante pra justificar buscar a
  // lista completa só pra jogar fora e usar apenas a contagem. Só quando
  // uma CATEGORIA final (ou busca/marca/fase/faixa de preço/ordenação) é
  // escolhida a grade plana precisa da lista real (é o que ela renderiza).
  const exigeGradeFinal =
    !!q || !!categoria || !!marca || !!fase || !!precoMin || !!ordenar;
  const usaLinhasPorCategoria = !exigeGradeFinal;

  const [
    produtos,
    totalSemOutrosFiltros,
    { marcas, especies, fases, faixasPreco },
    banners,
  ] = await Promise.all([
    usaLinhasPorCategoria
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
    usaLinhasPorCategoria
      ? getContagemProdutosCatalogo(empresa.id, { especie, departamento })
      : Promise.resolve(0),
    getFiltrosCatalogo(empresa.id),
    getBannersCatalogo(empresa.id),
  ]);

  const totalProdutos = usaLinhasPorCategoria
    ? totalSemOutrosFiltros
    : produtos.length;

  const faixaAtiva =
    precoMin != null
      ? { min: Number(precoMin), max: precoMax ? Number(precoMax) : undefined }
      : null;

  return (
    <div className="flex flex-col gap-6">
      {!filtroAtivo && (
        // -mx-4 cancela o padding do <main>, mesmo truque do BannerCarousel
        // logo abaixo — fica colada no header, sem borda, como uma linha só.
        <div className="-mx-4 -mt-6">
          <PetcashFaixaInfo petcashAtivo={empresa.petcash_ativo} />
        </div>
      )}

      {!filtroAtivo && <CategoriasEspecie slug={slug} />}

      {!filtroAtivo && (
        // -mx-4 cancela o padding horizontal do <main> (layout.tsx) só pro
        // banner — preenche a tela de ponta a ponta no mobile em vez de
        // deixar aquela faixa de espaço nas laterais, mantendo os cantos
        // arredondados (o recorte continua vindo do rounded-xl interno do
        // BannerCarousel/HeroBanner, só não sobra espaço fora dele).
        <div className="-mx-4">
          {banners.length > 0 ? (
            <BannerCarousel banners={banners} />
          ) : (
            <HeroBanner
              nome={empresa.nome}
              tagline={empresa.catalogo_info_extra}
              moderno={moderno}
            />
          )}
        </div>
      )}

      {!filtroAtivo && moderno && <MarcasParceiras marcas={marcas} />}

      {!filtroAtivo && (
        <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-lg)] bg-black/5 dark:bg-white/5" />}>
          <PromocoesDoDia slug={slug} empresaId={empresa.id} moderno={moderno} />
        </Suspense>
      )}

      {!filtroAtivo && (
        <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-lg)] bg-black/5 dark:bg-white/5" />}>
          <MaisVendidos slug={slug} empresaId={empresa.id} moderno={moderno} />
        </Suspense>
      )}

      <div id="produtos" className="flex items-center justify-between gap-3">
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

      {totalProdutos === 0 ? (
        <div className="py-16 text-center">
          <p className="text-black/50 dark:text-white/50">
            {filtroAtivo
              ? "Nenhum produto encontrado."
              : "Nenhum produto disponível no catálogo ainda."}
          </p>
          {q && <SugestaoProduto empresaId={empresa.id} termoBuscado={q} />}
        </div>
      ) : usaLinhasPorCategoria ? (
        // Isolado num Server Component próprio + Suspense pelo mesmo motivo
        // da grade plana abaixo: o resto da página não depende dela pra
        // streamar primeiro.
        <Suspense fallback={<GradeSkeleton />}>
          <CategoriasEmLinha
            slug={slug}
            empresaId={empresa.id}
            moderno={moderno}
            especie={especie}
            departamento={departamento}
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
            moderno={moderno}
          />
        </Suspense>
      )}
    </div>
  );
}
