import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { AccountLink } from "@/components/auth/account-link";
import { getEmpresaPorSlug } from "@/lib/catalogo";

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
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
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
          <span className="text-lg font-semibold">{empresa.nome}</span>
          <div className="ml-auto flex items-center gap-4">
            <Link href={`/loja/${slug}/carrinho`} className="text-sm font-medium hover:underline">
              Carrinho
            </Link>
            <AccountLink slug={slug} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-black/5 px-4 py-6 text-center text-xs text-black/40 dark:border-white/10 dark:text-white/40">
        {empresa.nome} · powered by Gestor
      </footer>
    </div>
  );
}
