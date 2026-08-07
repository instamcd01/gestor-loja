import { notFound, redirect } from "next/navigation";
import { ProdutoCard } from "@/components/produto-card";
import { ButtonLink } from "@/components/ui/button";
import { getEmpresaPorSlug, getVariantesEmLote } from "@/lib/catalogo";
import { getProdutosFavoritos } from "@/lib/favoritos";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function FavoritosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/loja/${slug}/entrar`);

  const produtos = await getProdutosFavoritos(empresa.id);
  const variantesPorPai = await getVariantesEmLote(empresa.id, produtos);
  const enderecoEmpresa = {
    endereco: empresa.endereco,
    cidade: empresa.cidade,
    estado: empresa.estado,
    cep: empresa.cep,
  };
  const moderno = empresa.catalogo_modelo === "moderno";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Meus favoritos</h1>

      {produtos.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-black/50 dark:text-white/50">
            Você ainda não favoritou nenhum produto.
          </p>
          <ButtonLink href={`/loja/${slug}`}>Ver catálogo</ButtonLink>
        </div>
      ) : (
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
      )}
    </div>
  );
}
