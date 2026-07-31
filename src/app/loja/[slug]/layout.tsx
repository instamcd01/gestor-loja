import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { AccountLink } from "@/components/auth/account-link";
import { BuscaCatalogo } from "@/components/catalogo/busca-catalogo";
import { NavCategorias } from "@/components/loja/nav-categorias";
import { getDepartamentosComContagem, getEmpresaPorSlug } from "@/lib/catalogo";

export const revalidate = 300; // dados de branding mudam raramente

export default async function LojaLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);

  if (!empresa) notFound();

  const departamentos = await getDepartamentosComContagem(empresa.id);

  const corPrimaria = empresa.cor_primaria ?? "#0087FD";
  const corSecundaria = empresa.cor_secundaria ?? "#F74D05";

  return (
    <div
      style={
        {
          "--brand-primary": corPrimaria,
          "--brand-secondary": corSecundaria,
        } as React.CSSProperties
      }
      className="flex min-h-screen flex-col"
    >
      <header className="sticky top-0 z-10 border-b border-black/5 bg-[var(--surface)]/90 backdrop-blur dark:border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href={`/loja/${slug}`} className="flex shrink-0 items-center gap-3">
              {empresa.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={empresa.logo_url}
                  alt={empresa.nome}
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-black/5 dark:ring-white/10"
                />
              ) : (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: corPrimaria }}
                >
                  {empresa.nome.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="hidden text-lg font-semibold sm:inline">{empresa.nome}</span>
            </Link>

            <div className="hidden flex-1 sm:block sm:max-w-md">
              <BuscaCatalogo slug={slug} />
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-4">
              <Link href={`/loja/${slug}/carrinho`} className="text-sm font-medium hover:underline">
                Carrinho
              </Link>
              <AccountLink slug={slug} />
            </div>
          </div>

          <div className="sm:hidden">
            <BuscaCatalogo slug={slug} />
          </div>
        </div>

        {departamentos.length > 0 && <NavCategorias departamentos={departamentos} slug={slug} />}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-black/5 px-4 py-6 text-center text-xs text-black/40 dark:border-white/10 dark:text-white/40">
        {empresa.nome} · powered by Gestor
      </footer>
    </div>
  );
}
