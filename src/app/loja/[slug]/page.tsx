import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FiltrosDrawer } from "@/components/catalogo/filtros-drawer";
import { OrdenarPor } from "@/components/catalogo/ordenar-por";
import { BannerCarousel } from "@/components/loja/banner-carousel";
import { CategoriasEmLinha } from "@/components/loja/categorias-em-linha";
import { CategoriasEspecie } from "@/components/loja/categorias-especie";
import {
  GradeDeProdutos,
  GradeSkeleton,
} from "@/components/loja/grade-de-produtos";
import { HeroBanner } from "@/components/loja/hero-banner";
import { MarcasParceiras } from "@/components/loja/marcas-parceiras";
import { PetcashBanner } from "@/components/loja/petcash-banner";
import {
  getBannersCatalogo,
  getContagemProdutosCatalogo,
  getEmpresaPorSlug,
  getFiltrosCatalogo,
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

  const enderecoEmpresa = {
    endereco: empresa.endereco,
    cidade: empresa.cidade,
    estado: empresa.estado,
    cep: empresa.cep,
  };

  const faixaAtiva =
    precoMin != null
      ? { min: Number(precoMin), max: precoMax ? Number(precoMax) : undefined }
      : null;

  return (
    <div className="flex flex-col gap-6">
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

      {!filtroAtivo && (
        <PetcashBanner
          nome={empresa.nome}
          moderno={moderno}
          petcashAtivo={empresa.petcash_ativo}
          petcashPercentual={empresa.petcash_percentual}
        />
      )}

      {!filtroAtivo && moderno && <MarcasParceiras marcas={marcas} />}

      <div id="produtos" className="flex items-center justify-end gap-3">
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
      ) : usaLinhasPorCategoria ? (
        // Isolado num Server Component próprio + Suspense pelo mesmo motivo
        // da grade plana abaixo: o resto da página não depende dela pra
        // streamar primeiro.
        <Suspense fallback={<GradeSkeleton />}>
          <CategoriasEmLinha
            slug={slug}
            empresaId={empresa.id}
            enderecoEmpresa={enderecoEmpresa}
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
            enderecoEmpresa={enderecoEmpresa}
            moderno={moderno}
          />
        </Suspense>
      )}
    </div>
  );
}
