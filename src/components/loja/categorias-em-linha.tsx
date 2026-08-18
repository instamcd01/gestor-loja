import Link from "next/link";
import { ProdutoCard } from "@/components/produto-card";
import { getProdutosHomeAgrupados, getVariantesEmLote } from "@/lib/catalogo";

/**
 * Home do catálogo, tela de espécie (Cães/Gatos/Pássaros/Outros) ou "Tudo
 * em {departamento}" (sem categoria final escolhida ainda), estilo iFood:
 * cada categoria vira uma linha com scroll horizontal (só uma amostra de
 * produtos) + "Ver mais" pra tela filtrada daquela categoria — em vez da
 * grade vertical antiga, que renderizava o conjunto inteiro numa carga só.
 * Server Component assíncrono próprio (mesmo motivo de
 * `grade-de-produtos.tsx`: poder streamar dentro de um <Suspense> sem
 * bloquear o resto da página).
 */
export async function CategoriasEmLinha({
  slug,
  empresaId,
  moderno,
  especie,
  departamento,
}: {
  slug: string;
  empresaId: string;
  moderno: boolean;
  /** Restringe as linhas à espécie escolhida (Cães/Gatos/Pássaros/Outros) — mesma tela de casa, só filtrada. */
  especie?: string;
  /** Restringe as linhas às categorias do departamento escolhido ("Tudo em X" do menu). */
  departamento?: string;
}) {
  const produtos = await getProdutosHomeAgrupados(empresaId, 10, {
    especie,
    departamento,
  });
  const variantesPorPai = await getVariantesEmLote(empresaId, produtos);
  const destino = `/loja/${slug}`;
  const sufixoFiltros =
    (especie ? `&especie=${encodeURIComponent(especie)}` : "") +
    (departamento ? `&departamento=${encodeURIComponent(departamento)}` : "");

  const porCategoria = new Map<string, typeof produtos>();
  for (const produto of produtos) {
    const chave = produto.categoria ?? "Outros";
    porCategoria.set(chave, [...(porCategoria.get(chave) ?? []), produto]);
  }

  return (
    <div className="flex flex-col gap-8">
      {[...porCategoria.entries()].map(([categoria, itens]) => (
        <section key={categoria} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">{categoria}</h2>
            <Link
              href={`${destino}?categoria=${encodeURIComponent(categoria)}${sufixoFiltros}`}
              className="shrink-0 text-sm font-medium text-[var(--brand-primary)] hover:underline"
            >
              Ver mais →
            </Link>
          </div>
          <div className="scrollbar-none flex snap-x gap-4 overflow-x-auto pb-1">
            {itens.map((produto) => (
              <div
                key={produto.id}
                className="w-40 shrink-0 snap-start sm:w-48"
              >
                <ProdutoCard
                  produto={produto}
                  slug={slug}
                  variantes={variantesPorPai.get(produto.id)}
                  moderno={moderno}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
