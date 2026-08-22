import Link from "next/link";
import { linkWhatsApp } from "@/lib/utils";

/**
 * Rodapé de verdade — antes era só uma linha "{nome} · powered by Gestor",
 * sem nenhum link (nem pro /termos, que já existia). Agora leva os links
 * legais (Termos, Privacidade, Trocas e devoluções) e contato — sem
 * endereço de loja física de propósito, a operação é só delivery.
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
  return (
    <footer className="border-t border-black/5 px-4 py-8 text-xs text-black/60 dark:border-white/10 dark:text-white/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <p className="font-semibold text-black/80 dark:text-white/80">{nome}</p>
          <p className="text-black/40 dark:text-white/40">Loja 100% delivery — sem unidade física pra visitar.</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {whatsapp && (
              <a href={linkWhatsApp(whatsapp)} target="_blank" rel="noopener noreferrer" className="hover:underline">
                WhatsApp: {whatsapp}
              </a>
            )}
            {instagram && (
              <a href={instagram} target="_blank" rel="noopener noreferrer" className="hover:underline">
                Instagram
              </a>
            )}
            {facebook && (
              <a href={facebook} target="_blank" rel="noopener noreferrer" className="hover:underline">
                Facebook
              </a>
            )}
          </div>
        </div>

        <nav className="flex flex-col gap-1.5 sm:items-end">
          <Link href={`/loja/${slug}/termos`} className="hover:underline">
            Termos e condições
          </Link>
          <Link href={`/loja/${slug}/privacidade`} className="hover:underline">
            Política de privacidade
          </Link>
          <Link href={`/loja/${slug}/trocas-e-devolucoes`} className="hover:underline">
            Trocas e devoluções
          </Link>
        </nav>
      </div>

      <p className="mx-auto mt-6 max-w-6xl text-center text-black/30 dark:text-white/30">
        {nome} · powered by Gestor
      </p>
    </footer>
  );
}
