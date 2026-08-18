"use client";

import { usePathname } from "next/navigation";

/**
 * O que sobra da gaveta de confirmação (MiniCarrinhoDrawer) quando ela é
 * minimizada — pelo × ou "Continuar comprando" (as duas ações minimizam
 * agora, a pedido do lojista, em vez de fechar de vez), ou revelada
 * sozinha quando a página carrega e o carrinho já tinha itens de antes
 * (ver a sincronização em `useCarrinhoRapido`, que não depende de um
 * "adicionar" recente nesta página). Toque em qualquer parte reabre a
 * gaveta cheia.
 *
 * Some nas páginas de carrinho/checkout — já se está vendo o carrinho ali,
 * o convite pra abri-lo de novo seria redundante (mesmo raciocínio já
 * usado pelo WhatsappSuporteButton pra não competir com a barra de total
 * daquela tela).
 */
export function CarrinhoMiniBarra({
  quantidadeItens,
  onExpandir,
}: {
  quantidadeItens: number;
  onExpandir: () => void;
}) {
  const pathname = usePathname();
  if (pathname?.includes("/carrinho")) return null;

  const texto = `Adicionado ao carrinho (${quantidadeItens} ${quantidadeItens === 1 ? "item" : "itens"})`;

  return (
    // Embaixo, ocupando a tela toda, no mobile; lateral direita (pílula
    // flutuante) a partir do sm — mesma origem de onde a gaveta cheia
    // desliza em cada tamanho de tela (ver MiniCarrinhoDrawer).
    <button
      type="button"
      onClick={onExpandir}
      aria-label={`${texto} — toque para ver o carrinho`}
      className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-center gap-2 bg-[var(--brand-primary)] px-4 py-3 text-sm font-semibold text-white shadow-[0_-2px_10px_rgba(0,0,0,0.15)] sm:inset-x-auto sm:right-5 sm:bottom-24 sm:rounded-full sm:px-5 sm:py-3 sm:shadow-lg"
    >
      <IconeCarrinho />
      {texto}
      <IconeSeta />
    </button>
  );
}

function IconeCarrinho() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4.5 w-4.5 shrink-0"
    >
      <path d="M3 4h2l1 3m0 0 2.2 8.4a2 2 0 0 0 1.94 1.6h7.32a2 2 0 0 0 1.94-1.52L21 8H6" />
      <circle cx="9.5" cy="20" r="1.4" />
      <circle cx="17.5" cy="20" r="1.4" />
    </svg>
  );
}

function IconeSeta() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
    >
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}
