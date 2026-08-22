import Link from "next/link";
import { linkWhatsApp } from "@/lib/utils";

/**
 * `empresas.instagram`/`.facebook` guardam só o @handle (o form de
 * "Catálogo Online" no app mostra um prefixo "@" fixo pro Instagram, não
 * pede URL) — sem isso, um <a href={handle}> vira um link relativo quebrado
 * em vez de ir pro Instagram/Facebook de verdade. Se algum dia alguém colar
 * a URL completa em vez do handle, usa ela direto (não duplica o domínio).
 */
function linkRedeSocial(base: string, valor: string): string {
  const limpo = valor.trim().replace(/^@/, "");
  return limpo.startsWith("http") ? limpo : `${base}${limpo}`;
}

function TituloColuna({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-wider text-black/40 uppercase dark:text-white/40">
      {children}
    </p>
  );
}

function LinkColuna({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-black/60 transition-colors hover:text-black dark:text-white/60 dark:hover:text-white">
      {children}
    </Link>
  );
}

/**
 * Rodapé de verdade — antes era só uma linha "{nome} · powered by Gestor",
 * sem nenhum link (nem pro /termos, que já existia). Layout em 3 colunas
 * (marca / atendimento / políticas) em vez de tudo empilhado num canto só —
 * pedido explícito do usuário depois de ver a 1ª versão.
 */
export function LojaFooter({
  slug,
  nome,
  whatsapp,
  instagram,
  facebook,
}: {
  slug: string;
  nome: string;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
}) {
  const temRedeSocial = Boolean(whatsapp || instagram || facebook);

  return (
    <footer className="border-t border-black/5 bg-black/[0.015] px-4 py-12 text-sm dark:border-white/10 dark:bg-white/[0.02]">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 sm:grid-cols-3">
        <div className="flex flex-col gap-3">
          <p className="text-base font-semibold text-black dark:text-white">{nome}</p>
          {temRedeSocial && (
            <div className="flex items-center gap-3">
              {whatsapp && (
                <a
                  href={linkWhatsApp(whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-black/50 transition-colors hover:border-[#25D366] hover:text-[#25D366] dark:border-white/10 dark:text-white/50"
                >
                  <IconeWhatsApp />
                </a>
              )}
              {instagram && (
                <a
                  href={linkRedeSocial("https://instagram.com/", instagram)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-black/50 transition-colors hover:border-[#E1306C] hover:text-[#E1306C] dark:border-white/10 dark:text-white/50"
                >
                  <IconeInstagram />
                </a>
              )}
              {facebook && (
                <a
                  href={linkRedeSocial("https://facebook.com/", facebook)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-black/50 transition-colors hover:border-[#1877F2] hover:text-[#1877F2] dark:border-white/10 dark:text-white/50"
                >
                  <IconeFacebook />
                </a>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <TituloColuna>Atendimento</TituloColuna>
          {whatsapp && (
            <a
              href={linkWhatsApp(whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-black/60 transition-colors hover:text-black dark:text-white/60 dark:hover:text-white"
            >
              WhatsApp: {whatsapp}
            </a>
          )}
          <LinkColuna href={`/loja/${slug}/perguntas-frequentes`}>Perguntas frequentes</LinkColuna>
        </div>

        <div className="flex flex-col gap-3">
          <TituloColuna>Políticas</TituloColuna>
          <LinkColuna href={`/loja/${slug}/entrega`}>Política de entrega</LinkColuna>
          <LinkColuna href={`/loja/${slug}/trocas-e-devolucoes`}>Trocas e devoluções</LinkColuna>
          <LinkColuna href={`/loja/${slug}/privacidade`}>Política de privacidade</LinkColuna>
          <LinkColuna href={`/loja/${slug}/termos`}>Termos e condições</LinkColuna>
        </div>
      </div>

      <p className="mx-auto mt-10 max-w-6xl border-t border-black/5 pt-6 text-center text-xs text-black/30 dark:border-white/10 dark:text-white/30">
        {nome} · powered by Gestor
      </p>
    </footer>
  );
}

function IconeWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4.5 w-4.5">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.71.45 3.38 1.3 4.85L2.05 22l5.36-1.4a9.9 9.9 0 0 0 4.63 1.18h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.87 9.87 0 0 0 12.04 2Zm5.8 14.14c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.11.11-1.79-.11-.41-.13-.94-.3-1.62-.6-2.85-1.23-4.71-4.1-4.85-4.29-.14-.19-1.16-1.54-1.16-2.94s.72-2.08.98-2.37c.24-.27.53-.34.71-.34l.51.01c.16.01.38-.06.6.46.24.57.79 1.98.86 2.12.07.14.11.31.02.5-.09.19-.14.31-.27.47-.14.16-.29.36-.41.48-.14.14-.28.29-.12.56.16.27.71 1.17 1.52 1.9 1.05.94 1.93 1.23 2.2 1.37.27.14.43.11.59-.07.16-.18.68-.79.87-1.06.18-.27.36-.22.6-.13.24.09 1.55.73 1.82.86.27.14.44.2.51.32.07.12.07.68-.17 1.36Z" />
    </svg>
  );
}

function IconeInstagram() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4.5 w-4.5">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconeFacebook() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4.5 w-4.5">
      <path d="M14 9h3V5h-3c-2.21 0-4 1.79-4 4v2H8v4h2v6h4v-6h3l1-4h-4V9c0-.55.45-1 1-1Z" />
    </svg>
  );
}
