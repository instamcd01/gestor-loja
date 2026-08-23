"use client";

import { useState } from "react";
import { ProdutoImagem } from "@/components/produto-imagem";
import { Button } from "@/components/ui/button";
import type { VarianteProduto } from "@/lib/types";
import { useDrawerA11y } from "@/lib/use-drawer-a11y";
import { formatarPreco, precoExibicao } from "@/lib/utils";

/**
 * Confirmação exibida ao clicar o "+" rápido pelo card do catálogo (grade,
 * relacionados, favoritos) — sempre, não só quando o produto tem variantes.
 * Abre na hora (sem esperar rede), então o clique nunca parece travado; a
 * ida ao servidor só acontece quando o cliente confirma dentro do modal.
 * Quando há mais de uma variante, mesmo a já pré-selecionada no card, o
 * cliente pode não ter reparado nas opções — mostra a lista de novo com
 * preço de cada uma. Com uma opção só, pula direto pra quantidade. Não se
 * aplica na página do próprio produto (ali o `SeletorVariante` + o card de
 * quantidade já cumprem esse papel).
 */
export function ModalConfirmarAdicionar({
  nome,
  imagemUrl,
  categoria,
  opcoes,
  varianteInicialId,
  carregando,
  usarPrecoAncoraMarketplace = false,
  onConfirmar,
  onFechar,
}: {
  nome: string;
  imagemUrl: string | null;
  categoria: string | null;
  opcoes: VarianteProduto[];
  varianteInicialId: string;
  carregando: boolean;
  usarPrecoAncoraMarketplace?: boolean;
  onConfirmar: (varianteId: string, quantidade: number) => void;
  onFechar: () => void;
}) {
  const painelRef = useDrawerA11y(true, onFechar);
  const [varianteId, setVarianteId] = useState(varianteInicialId);
  const [quantidade, setQuantidade] = useState(1);
  const temOpcoes = opcoes.length > 1;

  const escolhida = opcoes.find((o) => o.id === varianteId) ?? opcoes[0];
  const exibicaoEscolhida = precoExibicao(escolhida, usarPrecoAncoraMarketplace);

  function selecionar(opcao: VarianteProduto) {
    setVarianteId(opcao.id);
    setQuantidade((q) => Math.min(q, Math.max(1, opcao.estoque_disponivel)));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Fechar" onClick={onFechar} className="absolute inset-0 bg-black/40" />
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Adicionar ao carrinho"
        className="relative flex w-full max-w-sm flex-col gap-4 rounded-t-[var(--radius-lg)] bg-[var(--surface)] p-5 shadow-xl sm:rounded-[var(--radius-lg)]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{temOpcoes ? "Qual você gostaria?" : "Adicionar ao carrinho"}</h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="text-lg text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
          >
            ×
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-black/5 dark:bg-white/5">
            <ProdutoImagem src={imagemUrl} alt={nome} categoria={categoria} className="object-cover" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{escolhida.nome}</p>
            <span className="flex items-baseline gap-1.5">
              <span className="font-semibold">{formatarPreco(exibicaoEscolhida.precoAtual)}</span>
              {exibicaoEscolhida.temComparativo && (
                <span className="text-xs text-black/40 line-through dark:text-white/40">
                  {formatarPreco(exibicaoEscolhida.precoDe)}
                </span>
              )}
            </span>
          </div>
        </div>

        {temOpcoes && (
          <div className="flex flex-col gap-2">
            {opcoes.map((opcao) => {
              const exibicaoOpcao = precoExibicao(opcao, usarPrecoAncoraMarketplace);
              const semEstoque = opcao.estoque_disponivel === 0;
              return (
                <button
                  key={opcao.id}
                  type="button"
                  disabled={semEstoque}
                  onClick={() => selecionar(opcao)}
                  className={`flex items-center justify-between rounded-[var(--radius-md)] border px-3 py-2 text-left text-sm disabled:opacity-40 ${
                    opcao.id === varianteId
                      ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10"
                      : "border-black/10 dark:border-white/10"
                  }`}
                >
                  <span className="font-medium">
                    {opcao.rotulo}
                    {semEstoque ? " (sem estoque)" : ""}
                  </span>
                  <span className="flex items-baseline gap-1.5">
                    <span className="font-semibold">{formatarPreco(exibicaoOpcao.precoAtual)}</span>
                    {exibicaoOpcao.temComparativo && (
                      <span className="text-xs text-black/40 line-through dark:text-white/40">
                        {formatarPreco(exibicaoOpcao.precoDe)}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-full border border-black/10 dark:border-white/10">
            <button
              type="button"
              onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
              className="px-3 py-2 text-lg leading-none"
              aria-label="Diminuir quantidade"
            >
              −
            </button>
            <span className="w-8 text-center text-sm">{quantidade}</span>
            <button
              type="button"
              disabled={quantidade >= escolhida.estoque_disponivel}
              onClick={() => setQuantidade((q) => Math.min(escolhida.estoque_disponivel, q + 1))}
              className="px-3 py-2 text-lg leading-none disabled:opacity-30"
              aria-label="Aumentar quantidade"
            >
              +
            </button>
          </div>

          <Button
            onClick={() => onConfirmar(varianteId, quantidade)}
            disabled={carregando || escolhida.estoque_disponivel === 0}
            className="flex-1"
          >
            {carregando ? "Adicionando..." : "Adicionar ao carrinho"}
          </Button>
        </div>
      </div>
    </div>
  );
}
