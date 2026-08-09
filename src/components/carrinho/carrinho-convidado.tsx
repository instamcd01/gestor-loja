"use client";

import { useState, useSyncExternalStore } from "react";
import { EstimarFreteGratis } from "@/components/carrinho/estimar-frete-gratis";
import { LimparCarrinhoButton } from "@/components/carrinho/limpar-carrinho-button";
import { ResumoTotais } from "@/components/carrinho/resumo-totais";
import { IconeLixeira } from "@/components/icone-lixeira";
import { ProdutoImagem } from "@/components/produto-imagem";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  adicionarItemConvidado,
  assinarCarrinhoConvidado,
  atualizarItemConvidado,
  limparCarrinhoConvidado,
  obterSnapshotCarrinhoConvidado,
  obterSnapshotServidorCarrinhoConvidado,
} from "@/lib/carrinho-convidado";
import {
  assinarEnderecoEstimado,
  obterSnapshotEnderecoEstimado,
  obterSnapshotServidorEnderecoEstimado,
} from "@/lib/endereco-estimado";
import type { ProdutoCatalogo } from "@/lib/types";
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

  const [confirmandoRemocaoId, setConfirmandoRemocaoId] = useState<string | null>(null);

  function mudarQuantidade(produtoId: string, quantidade: number) {
    atualizarItemConvidado(empresaId, produtoId, quantidade);
  }

  // Mesmo mecanismo do carrinho logado (ver CarrinhoLogado.adicionarSugestao)
  // — grava direto no MESMO storage que `itens` já lê via useSyncExternalStore,
  // então a lista reage sozinha, sem precisar de gaveta/popup separado.
  function adicionarSugestao(produto: ProdutoCatalogo) {
    const emPromocao = produto.preco_promocional != null && produto.preco_promocional < produto.preco;
    adicionarItemConvidado(empresaId, {
      produtoId: produto.id,
      nome: produto.nome,
      imagemUrl: produto.imagem_url,
      categoria: produto.categoria,
      preco: emPromocao ? produto.preco_promocional! : produto.preco,
      precoOriginal: emPromocao ? produto.preco : null,
      estoqueDisponivel: produto.estoque_disponivel,
      quantidade: 1,
    });
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
    !!estimado &&
    (estimado.valorMinimoFreteGratis != null ? total >= estimado.valorMinimoFreteGratis : estimado.freteGratis);
  // valorCheio, não `valor` (ver mesmo comentário em mini-carrinho-drawer.tsx)
  // — `valor` vem zerado da RPC quando o subtotal de QUANDO O ENDEREÇO FOI
  // CONFIRMADO já batia o mínimo, e fica preso nesse 0 mesmo que o
  // carrinho depois caia abaixo do mínimo de novo. Fallback pro `valor`
  // antigo cobre um cache já salvo no navegador antes desse campo existir.
  const entregaValor = estimado ? (entregaGratis ? 0 : (estimado.valorCheio ?? estimado.valor)) : null;
  const faltaParaFreteGratis =
    estimado?.valorMinimoFreteGratis != null && !entregaGratis ? estimado.valorMinimoFreteGratis - total : null;
  const descontoProdutos = itens.reduce(
    (soma, item) => (item.precoOriginal != null ? soma + (item.precoOriginal - item.preco) * item.quantidade : soma),
    0,
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Seu carrinho</h1>
        <LimparCarrinhoButton onConfirmar={() => limparCarrinhoConvidado(empresaId)} />
      </div>

      <EstimarFreteGratis
        empresaId={empresaId}
        enderecoEmpresa={enderecoEmpresa}
        subtotal={total}
        categoriasCarrinho={[...new Set(itens.map((item) => item.categoria).filter((c): c is string => !!c))]}
        idsNoCarrinho={itens.map((item) => item.produtoId)}
        onAdicionarSugestao={adicionarSugestao}
      />

      <Card className="divide-y divide-black/5 px-4 dark:divide-white/10">
        {itens.map((item) => (
          <div key={item.produtoId} className="flex gap-3 py-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-black/5 dark:bg-white/5">
              <ProdutoImagem
                src={item.imagemUrl}
                alt={item.nome}
                categoria={item.categoria}
                className="object-cover"
              />
            </div>

            {/* Mesmo layout do ItemCarrinhoRow (carrinho logado): nome em
                cima ocupando a largura toda, quantidade e subtotal numa
                segunda linha embaixo — evita nome grande apertar/desalinhar
                o resto quando quebra em mais de uma linha. */}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div>
                <p className="text-sm leading-snug font-medium">{item.nome}</p>
                <p className="flex items-baseline gap-1.5 text-xs text-black/50 dark:text-white/50">
                  {formatarPreco(item.preco)} cada
                  {item.precoOriginal != null && (
                    <span className="text-black/40 line-through dark:text-white/40">
                      {formatarPreco(item.precoOriginal)}
                    </span>
                  )}
                </p>
              </div>

              {confirmandoRemocaoId === item.produtoId ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-black/60 dark:text-white/60">Remover item?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmandoRemocaoId(null);
                      mudarQuantidade(item.produtoId, 0);
                    }}
                    className="rounded-full bg-[var(--color-danger)] px-2.5 py-1 font-medium text-white"
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoRemocaoId(null)}
                    className="rounded-full border border-black/10 px-2.5 py-1 font-medium dark:border-white/10"
                  >
                    Não
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center rounded-full border border-black/10 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() =>
                        item.quantidade === 1
                          ? setConfirmandoRemocaoId(item.produtoId)
                          : mudarQuantidade(item.produtoId, item.quantidade - 1)
                      }
                      className="flex h-7 w-7 items-center justify-center text-lg leading-none"
                      aria-label={item.quantidade === 1 ? "Remover item" : "Diminuir quantidade"}
                    >
                      {item.quantidade === 1 ? <IconeLixeira /> : "−"}
                    </button>
                    <span className="w-6 text-center text-sm">{item.quantidade}</span>
                    <button
                      type="button"
                      onClick={() => mudarQuantidade(item.produtoId, item.quantidade + 1)}
                      disabled={item.quantidade >= item.estoqueDisponivel}
                      className="flex h-7 w-7 items-center justify-center text-lg leading-none disabled:opacity-30"
                      aria-label="Aumentar quantidade"
                    >
                      +
                    </button>
                  </div>

                  <span className="text-sm font-semibold">{formatarPreco(item.preco * item.quantidade)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </Card>

      <div className="px-1">
        <ResumoTotais
          subtotal={total}
          entregaLabel="Entrega"
          entregaValor={entregaValor}
          entregaValorOriginal={estimado?.valorCheio ?? estimado?.valor}
          faltaParaFreteGratis={faltaParaFreteGratis}
          descontoProdutos={descontoProdutos}
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
