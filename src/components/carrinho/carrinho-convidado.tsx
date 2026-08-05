"use client";

import { useSyncExternalStore } from "react";
import { EstimarFreteGratis } from "@/components/carrinho/estimar-frete-gratis";
import { ResumoTotais } from "@/components/carrinho/resumo-totais";
import { ProdutoImagem } from "@/components/produto-imagem";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  assinarCarrinhoConvidado,
  atualizarItemConvidado,
  obterSnapshotCarrinhoConvidado,
  obterSnapshotServidorCarrinhoConvidado,
} from "@/lib/carrinho-convidado";
import {
  assinarEnderecoEstimado,
  obterSnapshotEnderecoEstimado,
  obterSnapshotServidorEnderecoEstimado,
} from "@/lib/endereco-estimado";
import { formatarPreco } from "@/lib/utils";

/**
 * Carrinho de quem ainda não fez login — lido do navegador (ver
 * carrinho-convidado.ts). O botão de finalizar manda pro login; os
 * itens são levados pro carrinho de verdade assim que o OTP é
 * confirmado (LoginForm chama mesclarCarrinhoConvidado).
 *
 * useSyncExternalStore em vez de useState+useEffect: localStorage não
 * existe no servidor, então o snapshot do servidor é sempre "vazio" e
 * o real só chega depois de montar no cliente — sem isso, um setState
 * direto dentro do efeito dispara um render em cascata.
 */
export function CarrinhoConvidado({
  slug,
  empresaId,
  enderecoEmpresa,
}: {
  slug: string;
  empresaId: string;
  enderecoEmpresa: { endereco: string | null; cidade: string | null; estado: string | null; cep: string | null };
}) {
  const itens = useSyncExternalStore(
    assinarCarrinhoConvidado,
    () => obterSnapshotCarrinhoConvidado(empresaId),
    obterSnapshotServidorCarrinhoConvidado,
  );
  const estimado = useSyncExternalStore(
    assinarEnderecoEstimado,
    () => obterSnapshotEnderecoEstimado(empresaId),
    obterSnapshotServidorEnderecoEstimado,
  );

  function mudarQuantidade(produtoId: string, quantidade: number) {
    atualizarItemConvidado(empresaId, produtoId, quantidade);
  }

  if (itens.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 py-16 text-center">
        <h1 className="text-xl font-semibold">Seu carrinho está vazio</h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          Volte ao catálogo e adicione alguns produtos.
        </p>
      </div>
    );
  }

  const total = itens.reduce((soma, item) => soma + item.preco * item.quantidade, 0);

  const entregaGratis =
    !!estimado && (estimado.freteGratis || (estimado.valorMinimoFreteGratis != null && total >= estimado.valorMinimoFreteGratis));
  const entregaValor = estimado ? (entregaGratis ? 0 : estimado.valor) : null;
  const faltaParaFreteGratis =
    estimado?.valorMinimoFreteGratis != null && !entregaGratis ? estimado.valorMinimoFreteGratis - total : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-6">
      <h1 className="text-xl font-semibold">Seu carrinho</h1>

      <EstimarFreteGratis
        empresaId={empresaId}
        enderecoEmpresa={enderecoEmpresa}
        subtotal={total}
        mostrarProgresso={false}
      />

      <Card className="divide-y divide-black/5 px-4 dark:divide-white/10">
        {itens.map((item) => (
          <div key={item.produtoId} className="flex items-center gap-4 py-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-black/5 dark:bg-white/5">
              <ProdutoImagem
                src={item.imagemUrl}
                alt={item.nome}
                categoria={item.categoria}
                className="object-cover"
              />
            </div>

            <div className="flex-1">
              <p className="text-sm font-medium">{item.nome}</p>
              <p className="text-xs text-black/50 dark:text-white/50">{formatarPreco(item.preco)} cada</p>
            </div>

            <div className="flex items-center rounded-full border border-black/10 dark:border-white/10">
              <button
                type="button"
                onClick={() => mudarQuantidade(item.produtoId, item.quantidade - 1)}
                className="px-3 py-1.5 text-lg leading-none"
                aria-label="Diminuir quantidade"
              >
                −
              </button>
              <span className="w-6 text-center text-sm">{item.quantidade}</span>
              <button
                type="button"
                onClick={() => mudarQuantidade(item.produtoId, item.quantidade + 1)}
                className="px-3 py-1.5 text-lg leading-none"
                aria-label="Aumentar quantidade"
              >
                +
              </button>
            </div>

            <span className="w-20 text-right text-sm font-semibold">
              {formatarPreco(item.preco * item.quantidade)}
            </span>
          </div>
        ))}
      </Card>

      <div className="px-1">
        <ResumoTotais
          subtotal={total}
          entregaLabel="Entrega"
          entregaValor={entregaValor}
          faltaParaFreteGratis={faltaParaFreteGratis}
          total={total + (entregaValor ?? 0)}
        />
      </div>

      <ButtonLink href={`/loja/${slug}/entrar?redirect=carrinho`} className="w-full py-3 text-base">
        Finalizar pedido
      </ButtonLink>
      <p className="text-center text-xs text-black/40 dark:text-white/40">
        Confirme seu telefone só nessa última etapa, pra gente saber pra quem é o pedido.
      </p>
    </div>
  );
}
