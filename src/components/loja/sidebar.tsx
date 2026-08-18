"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useSessao } from "@/components/auth/sessao-provider";
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
  if (!contexto)
    throw new Error(
      "useSidebarContext precisa estar dentro de um SidebarProvider",
    );
  return contexto;
}

/** Topo da sidebar — imagem configurada pro Kit de Marca (posição "Barra lateral do site") ou o nome da loja em texto. */
function MarcaSidebar({
  marca,
  nomeEmpresa,
}: {
  marca: MarcaPosicaoCatalogo;
  nomeEmpresa: string;
}) {
  if (!marca.url) {
    // text-white fixo: as duas únicas chamadas deste componente (drawer
    // mobile e coluna fixa desktop) vivem dentro do bloco de topo com fundo
    // sólido na cor de marca — ver <Sidebar>.
    return (
      <span className="min-w-0 truncate text-sm font-semibold text-white">
        {nomeEmpresa}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={marca.url}
      alt={nomeEmpresa}
      className="h-16 max-w-[200px] shrink-0 object-contain"
    />
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
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/15 lg:hidden"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        className="h-5 w-5"
      >
        <path d="M3 6h18M3 12h18M3 18h18" />
      </svg>
    </button>
  );
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

  const conteudo = (
    <SidebarConteudo
      departamentos={departamentos}
      slug={slug}
      moderno={moderno}
      onNavegar={fechar}
    />
  );

  return (
    <>
      {/* Mobile — backdrop + gaveta deslizante. */}
      {montada && (
        <div
          className={cn(
            "fixed inset-0 z-40 overflow-hidden lg:hidden",
            aberta ? "" : "pointer-events-none",
          )}
        >
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
            {/* h-[118px]: mesma altura do <header> principal (layout.tsx) —
                medida ao vivo (duas linhas: ícones + busca, py-3 + gap-3),
                não deriva de nenhum token do design system porque o header
                também não deriva (soma de padding + duas linhas de conteúdo
                de altura variável). Se o header mudar de forma visível
                (nova linha, padding diferente), remedir e atualizar aqui
                junto — não há vínculo automático entre os dois. */}
            <div className="grid h-[118px] grid-cols-[1fr_auto_1fr] items-center bg-[var(--brand-primary)] px-4">
              <span />
              <MarcaSidebar marca={marca} nomeEmpresa={nomeEmpresa} />
              <button
                type="button"
                onClick={fechar}
                aria-label="Fechar menu"
                className="flex h-8 w-8 shrink-0 items-center justify-center justify-self-end rounded-full text-white hover:bg-white/15"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  className="h-4.5 w-4.5"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {conteudo}
          </aside>
        </div>
      )}

      {/* Desktop — coluna fixa, sempre visível, `h-screen` (não
          `self-start`/`max-h-screen` como antes): altura EXPLÍCITA de
          100vh evita o esticamento pelo irmão (`align-items: stretch` do
          `<div className="flex">` em layout.tsx bateria na altura da
          coluna de conteúdo, bem mais alta que a tela, sem precisar de
          `self-start` pra escapar disso — altura explícita já ganha de
          stretch por definição do flexbox). E, diferente do
          `self-start` (que encolhia a sidebar pro tamanho do próprio
          conteúdo quando a lista de departamentos era curta, deixando
          "Minha conta/Favoritos/Pedidos/Sair" flutuando logo abaixo da
          lista em vez de grudado no rodapé da tela), `h-screen` mantém a
          coluna sempre do tamanho da tela — o rodapé (fora do `<nav>`,
          `shrink-0`) fica sempre colado embaixo, e só o `<nav>` do meio
          (`flex-1 min-h-0 overflow-y-auto`) rola por dentro quando a
          lista é longa. `sticky` continua funcionando igual. */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-black/5 lg:flex dark:border-white/10">
        {/* h-[118px]: mesma altura do <header> principal — ver comentário
            equivalente no bloco de topo da gaveta mobile, acima. */}
        <div className="flex h-[118px] items-center justify-center bg-[var(--brand-primary)] px-4">
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
  const logado = useSessao();
  const [saindo, setSaindo] = useState(false);

  const destino = `/loja/${slug}`;
  const noCatalogo = pathname === destino;
  const departamentoAtivo = noCatalogo
    ? searchParams.get("departamento")
    : null;
  const categoriaAtiva = noCatalogo ? searchParams.get("categoria") : null;
  const temBusca = noCatalogo && !!searchParams.get("q");

  // Expandir/recolher a lista de subcategorias é só um toggle local, sem
  // navegação — clicar no nome do departamento não deve mais disparar uma
  // ida ao servidor (era a causa real da demora: mudar a URL pra `?departamento=X`
  // reprocessava a página inteira, incluindo a busca de produtos, só pra
  // revelar o menu; escolher a subcategoria final navegava de novo, dobrando
  // o trabalho). Inicializa a partir da URL (chega direto numa categoria
  // filtrada já expandida), depois só o clique manual muda.
  const [departamentoExpandido, setDepartamentoExpandido] = useState<
    string | null
  >(() => departamentoAtivo);

  const sair = useCallback(async () => {
    setSaindo(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    onNavegar();
    router.push(destino);
    router.refresh();
  }, [destino, onNavegar, router]);

  return (
    <>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
        {departamentos.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <Link
              href={destino}
              onClick={onNavegar}
              className={linkClasse(!departamentoAtivo && !temBusca, moderno)}
            >
              Todos os produtos
            </Link>
            {departamentos.map((d) => {
              const ativo = departamentoAtivo === d.nome;
              const temSubcategorias = d.categorias.length > 1;
              const expandido = departamentoExpandido === d.nome;
              return (
                <div key={d.nome}>
                  {temSubcategorias ? (
                    <button
                      type="button"
                      onClick={() =>
                        setDepartamentoExpandido((atual) =>
                          atual === d.nome ? null : d.nome,
                        )
                      }
                      className={cn(
                        linkClasse(ativo, moderno),
                        "flex w-full items-center justify-between gap-2 text-left",
                      )}
                    >
                      {d.nome}
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 transition-transform",
                          expandido && "rotate-180",
                        )}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  ) : (
                    <Link
                      href={`${destino}?departamento=${encodeURIComponent(d.nome)}`}
                      onClick={onNavegar}
                      className={linkClasse(ativo, moderno)}
                    >
                      {d.nome}
                    </Link>
                  )}
                  {temSubcategorias && expandido && (
                    <div className="mt-0.5 mb-1 ml-3 flex flex-col gap-0.5 border-l border-black/10 pl-3 dark:border-white/10">
                      <Link
                        href={`${destino}?departamento=${encodeURIComponent(d.nome)}`}
                        onClick={onNavegar}
                        className={subLinkClasse(ativo && !categoriaAtiva)}
                      >
                        Tudo em {d.nome}
                      </Link>
                      {d.categorias.map(({ categoria }) => (
                        <Link
                          key={categoria}
                          href={`${destino}?departamento=${encodeURIComponent(d.nome)}&categoria=${encodeURIComponent(categoria)}`}
                          onClick={onNavegar}
                          className={subLinkClasse(
                            ativo && categoriaAtiva === categoria,
                          )}
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
      </nav>

      {/* Fora do <nav> rolável, de propósito: fica sempre visível colado no
          rodapé do menu (não sai de vista quando a lista de departamentos é
          longa/expandida), enquanto só os departamentos rolam por dentro.
          Fundo na cor de marca (a pedido do lojista) — usa linkClasseColorida
          em vez de linkClasse porque estes 4 links nunca têm estado "ativo"
          (sempre chamavam linkClasse(false, ...)), então não precisam da
          variante de destaque, só do texto branco pra contrastar aqui. */}
      <div className="flex shrink-0 flex-col gap-0.5 bg-[var(--brand-primary)] p-3">
        <Link
          href={`/loja/${slug}/${logado ? "conta" : "entrar"}`}
          onClick={onNavegar}
          className={linkClasseColorida(moderno)}
        >
          {logado ? "Minha conta" : "Entrar"}
        </Link>
        <Link
          href={`/loja/${slug}/favoritos`}
          onClick={onNavegar}
          className={linkClasseColorida(moderno)}
        >
          Favoritos
        </Link>
        {logado && (
          <Link
            href={`/loja/${slug}/pedidos`}
            onClick={onNavegar}
            className={linkClasseColorida(moderno)}
          >
            Pedidos
          </Link>
        )}
        {logado && (
          <button
            type="button"
            onClick={sair}
            disabled={saindo}
            className={cn(
              linkClasseColorida(moderno),
              "text-left disabled:opacity-50",
            )}
          >
            {saindo ? "Saindo..." : "Sair"}
          </button>
        )}
      </div>
    </>
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

/** Mesmo estilo de link do menu, mas pro bloco de fundo colorido (topo/rodapé da sidebar) — texto branco em vez do preto/cinza padrão. */
function linkClasseColorida(moderno: boolean) {
  const pesoFonte = moderno ? "font-bold" : "font-medium";
  return cn(
    "rounded-[var(--radius-sm)] px-3 py-2 text-sm text-white transition-colors hover:bg-white/15",
    pesoFonte,
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
