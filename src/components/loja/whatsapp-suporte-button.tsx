"use client";

import { IconeWhatsApp, linkSuporteWhatsApp } from "@/components/loja/contato-loja";

/**
 * Botão flutuante de suporte — só renderiza quando a loja tem WhatsApp
 * configurado. Sempre no canto de baixo. Nas telas com barra fixa do
 * checkout (carrinho com itens, entrega, pagamento) ele some e o WhatsApp
 * passa a ficar DENTRO da barra, ao lado do botão principal
 * (WhatsappBotaoBarra) — a barra marca `data-barra-checkout` no <html>
 * enquanto está na tela (ver altura-barra-fixa-carrinho.ts e a regra
 * `.wa-flutuante` em globals.css). Antes ele subia pra cima da barra e
 * ficava flutuando no meio da tela (achado real 30/09).
 *
 * z-40 (acima da barrinha "adicionado ao carrinho"/CarrinhoMiniBarra, z-30)
 * — nas outras telas, com item no carrinho, a barrinha cheia (mobile,
 * full-width) cobria o botão por completo; abaixo só da gaveta cheia do
 * carrinho (MiniCarrinhoDrawer, z-50), que é modal e deve mesmo cobrir
 * tudo quando aberta.
 */
export function WhatsappSuporteButton({ nomeEmpresa, whatsapp }: { nomeEmpresa: string; whatsapp: string | null }) {
  if (!whatsapp) return null;

  return (
    <a
      href={linkSuporteWhatsApp(whatsapp, nomeEmpresa)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a loja no WhatsApp"
      className="wa-flutuante fixed right-5 bottom-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105"
    >
      <IconeWhatsApp className="h-7 w-7" />
    </a>
  );
}
