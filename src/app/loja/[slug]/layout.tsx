import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { AccountLink } from "@/components/auth/account-link";
import { SessaoProvider } from "@/components/auth/sessao-provider";
import { BuscaCatalogo } from "@/components/catalogo/busca-catalogo";
import { CarrinhoLink } from "@/components/carrinho/carrinho-link";
import { CarrinhoRapidoProvider } from "@/components/carrinho/carrinho-rapido-provider";
import { FavoritosLink } from "@/components/favoritos/favoritos-link";
import { FavoritosProvider } from "@/components/favoritos/favoritos-provider";
import { LojaFooter } from "@/components/loja/loja-footer";
import {
  Sidebar,
  SidebarProvider,
  SidebarToggleButton,
} from "@/components/loja/sidebar";
import { WhatsappSuporteButton } from "@/components/loja/whatsapp-suporte-button";
import {
  getDepartamentosComContagem,
  getEmpresaPorSlug,
  getMarcaCatalogo,
} from "@/lib/catalogo";

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

  const [departamentos, marca] = await Promise.all([
    getDepartamentosComContagem(empresa.id),
    getMarcaCatalogo(empresa.id),
  ]);

  const corPrimaria = empresa.cor_primaria ?? "#0087FD";
  const corSecundaria = empresa.cor_secundaria ?? "#F74D05";
  const moderno = empresa.catalogo_modelo === "moderno";
  const enderecoEmpresa = {
    endereco: empresa.endereco,
    cidade: empresa.cidade,
    estado: empresa.estado,
    cep: empresa.cep,
  };

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
      <SessaoProvider>
        <CarrinhoRapidoProvider
          slug={slug}
          empresaId={empresa.id}
          enderecoEmpresa={enderecoEmpresa}
        >
          <FavoritosProvider slug={slug} empresaId={empresa.id}>
            <SidebarProvider>
              <Sidebar
                departamentos={departamentos}
                slug={slug}
                moderno={moderno}
                marca={marca.site_sidebar}
                nomeEmpresa={empresa.nome}
              />

              {/* min-w-0 é obrigatório aqui: item flex numa linha não encolhe abaixo do
              min-content do próprio conteúdo por padrão (min-width:auto), então sem
              isso essa coluna força a página inteira a ficar mais larga que a tela
              no mobile assim que qualquer coisa lá dentro (grid de produtos, nomes
              longos) pede mais espaço — a causa real do "zoom" no carregamento. */}
              <div className="flex min-h-screen min-w-0 flex-1 flex-col">
                {/* Fundo sólido na cor de marca (a pedido do lojista) — texto e
                ícones do header viram brancos pra continuar legíveis em cima
                (mesmo tratamento que o HeroBanner já usa), independente do
                tema claro/escuro do site: a cor de marca em si não muda com
                o tema. A busca (BuscaCatalogo) mantém o fundo neutro de
                sempre — o contraste dela flutuando sobre a barra colorida é
                intencional, não um esquecimento. */}
                <header className="sticky top-0 z-10 bg-[var(--brand-primary)] text-white shadow-sm">
                  <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3">
                    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                      <div className="flex items-center gap-1 justify-self-start">
                        <SidebarToggleButton />
                        <AccountLink slug={slug} />
                      </div>

                      <Link
                        href={`/loja/${slug}`}
                        className="flex min-w-0 items-center justify-center justify-self-center"
                      >
                        {marca.site_header.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={marca.site_header.url}
                            alt={empresa.nome}
                            className="h-10 max-w-[160px] shrink-0 object-contain"
                          />
                        ) : (
                          <span className="min-w-0 truncate text-sm font-semibold text-white sm:text-lg">
                            {empresa.nome}
                          </span>
                        )}
                      </Link>

                      <div className="flex shrink-0 items-center gap-1 justify-self-end">
                        <FavoritosLink slug={slug} />
                        <CarrinhoLink slug={slug} empresaId={empresa.id} />
                      </div>
                    </div>

                    <BuscaCatalogo slug={slug} />
                  </div>
                </header>

                <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
                  {children}
                </main>

                <LojaFooter
                  slug={slug}
                  nome={empresa.nome}
                  whatsapp={empresa.whatsapp_catalogo}
                  instagram={empresa.instagram}
                  facebook={empresa.facebook}
                />
              </div>
            </SidebarProvider>
          </FavoritosProvider>
        </CarrinhoRapidoProvider>
      </SessaoProvider>

      <WhatsappSuporteButton
        nomeEmpresa={empresa.nome}
        whatsapp={empresa.whatsapp_catalogo}
      />
    </div>
  );
}
