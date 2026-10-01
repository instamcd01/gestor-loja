"use client";

import { createContext, useContext, type ReactNode } from "react";
import { linkWhatsApp } from "@/lib/utils";

/** Mensagem inicial de suporte — a mesma no botão flutuante e no da barra do checkout. */
export function linkSuporteWhatsApp(whatsapp: string, nomeEmpresa: string): string {
  return linkWhatsApp(whatsapp, `Olá! Vim do site da ${nomeEmpresa} e preciso de ajuda.`);
}

export function IconeWhatsApp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.71.45 3.38 1.3 4.85L2.05 22l5.36-1.4a9.9 9.9 0 0 0 4.63 1.18h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.87 9.87 0 0 0 12.04 2Zm5.8 14.14c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.11.11-1.79-.11-.41-.13-.94-.3-1.62-.6-2.85-1.23-4.71-4.1-4.85-4.29-.14-.19-1.16-1.54-1.16-2.94s.72-2.08.98-2.37c.24-.27.53-.34.71-.34l.51.01c.16.01.38-.06.6.46.24.57.79 1.98.86 2.12.07.14.11.31.02.5-.09.19-.14.31-.27.47-.14.16-.29.36-.41.48-.14.14-.28.29-.12.56.16.27.71 1.17 1.52 1.9 1.05.94 1.93 1.23 2.2 1.37.27.14.43.11.59-.07.16-.18.68-.79.87-1.06.18-.27.36-.22.6-.13.24.09 1.55.73 1.82.86.27.14.44.2.51.32.07.12.07.68-.17 1.36Z" />
    </svg>
  );
}

type ContatoLoja = { nomeEmpresa: string; whatsapp: string | null };

const ContatoLojaContext = createContext<ContatoLoja | null>(null);

/** Nome e WhatsApp da loja pras páginas da loja (layout loja/[slug]). */
export function ContatoLojaProvider({ children, ...contato }: ContatoLoja & { children: ReactNode }) {
  return <ContatoLojaContext.Provider value={contato}>{children}</ContatoLojaContext.Provider>;
}

/**
 * Botão do WhatsApp dentro da barra fixa do checkout, ao lado do botão
 * principal e da mesma altura (h-12 = altura do botão py-3 text-base) —
 * substitui o flutuante nessas telas (ele some enquanto a barra existe,
 * ver altura-barra-fixa-carrinho.ts), que antes flutuava no meio da tela
 * acima da barra (pedido do usuário 30/09).
 */
export function WhatsappBotaoBarra() {
  const contato = useContext(ContatoLojaContext);
  if (!contato?.whatsapp) return null;
  return (
    <a
      href={linkSuporteWhatsApp(contato.whatsapp, contato.nomeEmpresa)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a loja no WhatsApp"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white transition-transform hover:scale-105"
    >
      <IconeWhatsApp className="h-6 w-6" />
    </a>
  );
}
