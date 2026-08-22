import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GradeDeProdutos, GradeSkeleton } from "@/components/loja/grade-de-produtos";
import { getEmpresaPorSlug, getMaisVendidos } from "@/lib/catalogo";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  return { title: empresa ? `Mais vendidos — ${empresa.nome}` : "Mais vendidos" };
}

export default async function MaisVendidosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) notFound();

  const moderno = empresa.catalogo_modelo === "moderno";
  const produtos = await getMaisVendidos(empresa.id, 60);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Mais vendidos</h1>
        <Link
          href={`/loja/${slug}`}
          className="shrink-0 text-sm font-medium text-[var(--brand-primary)] hover:underline"
        >
          ← Ver tudo
        </Link>
      </div>

      {produtos.length === 0 ? (
        <p className="py-16 text-center text-black/50 dark:text-white/50">
          Nenhum produto vendido nos últimos 90 dias ainda.
        </p>
      ) : (
        <Suspense fallback={<GradeSkeleton />}>
          <GradeDeProdutos produtos={produtos} slug={slug} empresaId={empresa.id} moderno={moderno} />
        </Suspense>
      )}
    </div>
  );
}
