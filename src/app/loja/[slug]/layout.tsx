import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { AccountLink } from "@/components/auth/account-link";
import { BuscaCatalogo } from "@/components/catalogo/busca-catalogo";
import { CarrinhoLink } from "@/components/carrinho/carrinho-link";
import { FavoritosLink } from "@/components/favoritos/favoritos-link";
import { FavoritosProvider } from "@/components/favoritos/favoritos-provider";
import { Sidebar, SidebarProvider, SidebarToggleButton } from "@/components/loja/sidebar";
import { WhatsappSuporteButton } from "@/components/loja/whatsapp-suporte-button";
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
  const moderno = empresa.catalogo_modelo === "moderno";

  return (
    <div
      data-modelo={empresa.catalogo_modelo}
      style={
        {
          "--brand-primary": corPrimaria,
          "--brand-secondary": corSecundaria,
        } as React.CSSProperties
      }
      className="flex min-h-screen"
    >
      <FavoritosProvider slug={slug} empresaId={empresa.id}>
        <SidebarProvider>
          <Sidebar departamentos={departamentos} slug={slug} moderno={moderno} />

          <div className="flex min-h-screen flex-1 flex-col">
            <header className="sticky top-0 z-10 border-b border-black/5 bg-[var(--surface)]/90 backdrop-blur dark:border-white/10">
              <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3">
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                  <div className="flex items-center gap-1 justify-self-start">
                    <SidebarToggleButton />
                    <AccountLink slug={slug} />
                  </div>

                  <Link href={`/loja/${slug}`} className="flex min-w-0 items-center justify-center gap-2 justify-self-center">
                    {empresa.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={empresa.logo_url}
                        alt={empresa.nome}
                        className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-black/5 dark:ring-white/10"
                      />
                    ) : (
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ background: corPrimaria }}
                      >
                        {empresa.nome.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span className="min-w-0 truncate text-sm font-semibold sm:text-lg">{empresa.nome}</span>
                  </Link>

                  <div className="flex shrink-0 items-center gap-1 justify-self-end">
                    <FavoritosLink slug={slug} />
                    <CarrinhoLink slug={slug} empresaId={empresa.id} />
                  </div>
                </div>

                <BuscaCatalogo slug={slug} />
              </div>
            </header>

            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>

            <footer className="border-t border-black/5 px-4 py-6 text-center text-xs text-black/40 dark:border-white/10 dark:text-white/40">
              {empresa.nome} · powered by Gestor
            </footer>
          </div>
        </SidebarProvider>
      </FavoritosProvider>

      <WhatsappSuporteButton nomeEmpresa={empresa.nome} whatsapp={empresa.whatsapp_catalogo} />
    </div>
  );
}
