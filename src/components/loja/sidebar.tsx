"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { DepartamentoComContagem } from "@/lib/catalogo";
import type { MarcaPosicaoCatalogo } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Estado de aberta/fechada da gaveta mobile mora aqui, compartilhado entre
 * o botão de hambúrguer (no header) e a própria barra lateral (renderizada
 * em outro ponto da árvore) — sem contexto, layout.tsx (Server Component,
 * não pode ter useState) teria que repassar um par estado/setter que só
 * existe no cliente, o que não é possível entre os dois pontos distantes
 * do JSX de forma direta.
 */
const SidebarContext = createContext<{
  aberta: boolean;
  montada: boolean;
  abrir: () => void;
  fechar: () => void;
} | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [aberta, setAberta] = useState(false);
  // "montada" só vira true dentro do clique que abre a gaveta pela primeira
  // vez (nunca num efeito) — assim o painel simplesmente não existe no DOM
  // no carregamento inicial, ver comentário em cima do <Sidebar>.
  const [montada, setMontada] = useState(false);
  return (
    <SidebarContext.Provider
      value={{
        aberta,
        montada,
        abrir: () => {
          setAberta(true);
          setMontada(true);
        },
        fechar: () => setAberta(false),
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

function useSidebarContext() {
  const contexto = useContext(SidebarContext);
  if (!contexto) throw new Error("useSidebarContext precisa estar dentro de um SidebarProvider");
  return contexto;
}

/** Topo da sidebar — imagem configurada pro Kit de Marca (posição "Barra lateral do site") ou o nome da loja em texto. */
function MarcaSidebar({ marca, nomeEmpresa }: { marca: MarcaPosicaoCatalogo; nomeEmpresa: string }) {
  if (!marca.url) {
    return <span className="min-w-0 truncate text-sm font-semibold">{nomeEmpresa}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={marca.url} alt={nomeEmpresa} className="h-9 max-w-[160px] shrink-0 object-contain" />
  );
}

/** Ícone de hambúrguer no header — só visível no mobile (desktop já mostra a barra fixa). */
export function SidebarToggleButton() {
  const { abrir } = useSidebarContext();
  return (
    <button
      type="button"
      onClick={abrir}
      aria-label="Abrir menu"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-black/5 lg:hidden dark:hover:bg-white/10"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-5 w-5">
        <path d="M3 6h18M3 12h18M3 18h18" />
      </svg>
    </button>
  );
}

function useLogado() {
  const [logado, setLogado] = useState<boolean | null>(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setLogado(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLogado(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return logado;
}

export function Sidebar({
  departamentos,
  slug,
  moderno,
  marca,
  nomeEmpresa,
}: {
  departamentos: DepartamentoComContagem[];
  slug: string;
  moderno: boolean;
  marca: MarcaPosicaoCatalogo;
  nomeEmpresa: string;
}) {
  // "montada" só vira true dentro do clique que abre a gaveta pela primeira
  // vez (ver SidebarProvider.abrir) — no carregamento inicial o painel nem
  // existe no DOM. Antes ele ficava sempre montado, só deslocado pra fora da
  // tela via -translate-x-full (left: -288px) enquanto fechado; mesmo com
  // overflow-hidden no wrapper, esse elemento fixed+transform presente desde
  // o primeiro paint é exatamente a classe de configuração que navegadores
  // mobile têm bugs conhecidos de recalcular errado o viewport/zoom inicial.
  // Não montar até precisar elimina o risco por completo, não só cobre com CSS.
  const { aberta, montada, fechar } = useSidebarContext();

  const conteudo = <SidebarConteudo departamentos={departamentos} slug={slug} moderno={moderno} onNavegar={fechar} />;

  return (
    <>
      {/* Mobile — backdrop + gaveta deslizante. */}
      {montada && (
        <div className={cn("fixed inset-0 z-40 overflow-hidden lg:hidden", aberta ? "" : "pointer-events-none")}>
          <div
            onClick={fechar}
            className={cn(
              "absolute inset-0 bg-black/40 transition-opacity",
              aberta ? "opacity-100" : "opacity-0",
            )}
          />
          <aside
            className={cn(
              "absolute top-0 left-0 flex h-full w-72 flex-col bg-[var(--surface)] shadow-xl transition-transform duration-200",
              aberta ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <div className="flex items-center justify-between border-b border-black/5 p-4 dark:border-white/10">
              <MarcaSidebar marca={marca} nomeEmpresa={nomeEmpresa} />
              <button
                type="button"
                onClick={fechar}
                aria-label="Fechar menu"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-4.5 w-4.5">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {conteudo}
          </aside>
        </div>
      )}

      {/* Desktop — coluna fixa, sempre visível. */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-black/5 lg:flex dark:border-white/10">
        <div className="border-b border-black/5 p-4 dark:border-white/10">
          <MarcaSidebar marca={marca} nomeEmpresa={nomeEmpresa} />
        </div>
        {conteudo}
      </aside>
    </>
  );
}

function SidebarConteudo({
  departamentos,
  slug,
  moderno,
  onNavegar,
}: {
  departamentos: DepartamentoComContagem[];
  slug: string;
  moderno: boolean;
  onNavegar: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const logado = useLogado();
  const [saindo, setSaindo] = useState(false);

  const destino = `/loja/${slug}`;
  const noCatalogo = pathname === destino;
  const departamentoAtivo = noCatalogo ? searchParams.get("departamento") : null;
  const categoriaAtiva = noCatalogo ? searchParams.get("categoria") : null;
  const temBusca = noCatalogo && !!searchParams.get("q");

  const sair = useCallback(async () => {
    setSaindo(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    onNavegar();
    router.push(destino);
    router.refresh();
  }, [destino, onNavegar, router]);

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
      {departamentos.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <Link href={destino} onClick={onNavegar} className={linkClasse(!departamentoAtivo && !temBusca, moderno)}>
            Todos os produtos
          </Link>
          {departamentos.map((d) => {
            const ativo = departamentoAtivo === d.nome;
            return (
              <div key={d.nome}>
                <Link
                  href={`${destino}?departamento=${encodeURIComponent(d.nome)}`}
                  // Só fecha a gaveta se não houver subcategoria pra revelar — clicar num
                  // departamento com mais de 1 categoria deve abrir o refinamento abaixo
                  // dele, não sumir com o menu antes da pessoa conseguir escolher.
                  onClick={d.categorias.length > 1 ? undefined : onNavegar}
                  className={linkClasse(ativo, moderno)}
                >
                  {d.nome}
                </Link>
                {ativo && d.categorias.length > 1 && (
                  <div className="mt-0.5 mb-1 ml-3 flex flex-col gap-0.5 border-l border-black/10 pl-3 dark:border-white/10">
                    <Link
                      href={`${destino}?departamento=${encodeURIComponent(d.nome)}`}
                      onClick={onNavegar}
                      className={subLinkClasse(!categoriaAtiva)}
                    >
                      Tudo em {d.nome}
                    </Link>
                    {d.categorias.map(({ categoria }) => (
                      <Link
                        key={categoria}
                        href={`${destino}?departamento=${encodeURIComponent(d.nome)}&categoria=${encodeURIComponent(categoria)}`}
                        onClick={onNavegar}
                        className={subLinkClasse(categoriaAtiva === categoria)}
                      >
                        {categoria}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sem mt-auto de propósito: a coluna é sticky h-screen (altura da tela
          inteira), então empurrar esse bloco pro fundo deixava um vão enorme
          no meio sempre que a lista de departamentos era mais curta que a
          tela — menu agora segue direto depois dos departamentos. */}
      <div className="mt-4 flex flex-col gap-0.5 border-t border-black/5 pt-3 dark:border-white/10">
        <Link href={`/loja/${slug}/${logado ? "conta" : "entrar"}`} onClick={onNavegar} className={linkClasse(false, moderno)}>
          {logado ? "Minha conta" : "Entrar"}
        </Link>
        <Link href={`/loja/${slug}/favoritos`} onClick={onNavegar} className={linkClasse(false, moderno)}>
          Favoritos
        </Link>
        {logado && (
          <Link href={`/loja/${slug}/pedidos`} onClick={onNavegar} className={linkClasse(false, moderno)}>
            Pedidos
          </Link>
        )}
        {logado && (
          <button type="button" onClick={sair} disabled={saindo} className={cn(linkClasse(false, moderno), "text-left disabled:opacity-50")}>
            {saindo ? "Saindo..." : "Sair"}
          </button>
        )}
      </div>
    </nav>
  );
}

function linkClasse(ativo: boolean, moderno: boolean) {
  const pesoFonte = moderno ? "font-bold" : "font-medium";
  return cn(
    "rounded-[var(--radius-sm)] px-3 py-2 text-sm transition-colors",
    pesoFonte,
    ativo
      ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
      : "text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10",
  );
}

function subLinkClasse(ativo: boolean) {
  return cn(
    "rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs font-medium transition-colors",
    ativo
      ? "bg-[var(--brand-primary)] text-white"
      : "text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10",
  );
}
