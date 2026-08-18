"use client";

import Link from "next/link";
import { useState } from "react";
import { ModalConfirmarAdicionar } from "@/components/carrinho/modal-confirmar-adicionar";
import { Badge } from "@/components/ui/badge";
import { FavoritoButton } from "@/components/favoritos/favorito-button";
import { ProdutoImagem } from "@/components/produto-imagem";
import type { ProdutoCatalogo, VarianteProduto } from "@/lib/types";
import { useCarrinhoRapidoContext } from "@/components/carrinho/carrinho-rapido-provider";
import { formatarPreco, percentualDesconto } from "@/lib/utils";
import { extrairPeso } from "@/lib/variantes";

export function ProdutoCard({
  produto,
  slug,
  variantes,
  moderno,
}: {
  produto: ProdutoCatalogo;
  slug: string;
  variantes?: VarianteProduto[];
  moderno: boolean;
}) {
  const opcoes: VarianteProduto[] = [
    {
      id: produto.id,
      nome: produto.nome,
      rotulo:
        produto.variante_label ||
        extrairPeso(produto.nome)?.rotulo ||
        produto.unidade_medida ||
        "",
      preco: produto.preco,
      preco_promocional: produto.preco_promocional,
      estoque_disponivel: produto.estoque_disponivel,
    },
    ...(variantes ?? []),
  ];
  const temVariantes = (variantes?.length ?? 0) > 0;

  // Mostra por padrão a própria opção do card (índice 0 — sempre "eu mesmo",
  // ver `opcoes` acima), não a mais barata da família. Em busca, a mesma
  // família aparece como vários cards soltos (um por variante) — se todos
  // pulassem pra mostrar a opção mais barata, todos mostrariam o mesmo
  // preço/pill em vez de cada um representar honestamente o produto que
  // ele é. No catálogo agrupado, "eu mesmo" já é o produto-pai escolhido.
  const [ativa, setAtiva] = useState(0);
  const selecionada = opcoes[ativa];
  const temPromocao =
    selecionada.preco_promocional != null &&
    selecionada.preco_promocional < selecionada.preco;
  const percentualOff = percentualDesconto(
    selecionada.preco,
    selecionada.preco_promocional,
  );

  // Adicionar ao carrinho sem precisar abrir o produto — pra quem quer
  // continuar navegando o catálogo em vez de interromper pra visitar cada
  // página. Estado compartilhado com a página inteira via contexto (ver
  // CarrinhoRapidoProvider) — a gaveta/barra de confirmação é renderizada
  // uma vez só, lá, não aqui dentro de cada card.
  const carrinhoRapido = useCarrinhoRapidoContext();
  // Abre sempre (mesmo sem variante) em vez de adicionar 1 unidade direto —
  // deixa escolher a quantidade e some com o delay perceptível do clique
  // "sem feedback" (o modal abre na hora; a ida ao servidor só acontece ao
  // confirmar). Só entra em jogo aqui na grade/relacionados/favoritos — na
  // página do próprio produto, o SeletorVariante (navega pra URL da
  // variante) + o card de quantidade já cumprem esse papel.
  const [modalAberto, setModalAberto] = useState(false);

  function abrirAdicionar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setModalAberto(true);
  }

  async function confirmarAdicionar(varianteId: string, quantidade: number) {
    const opcao = opcoes.find((o) => o.id === varianteId);
    if (!opcao) return;
    const opcaoTemPromocao =
      opcao.preco_promocional != null && opcao.preco_promocional < opcao.preco;
    await carrinhoRapido.adicionar(opcao.id, quantidade, {
      nome: opcao.nome,
      imagemUrl: produto.imagem_url,
      categoria: produto.categoria,
      preco: opcaoTemPromocao ? opcao.preco_promocional! : opcao.preco,
      precoOriginal: opcaoTemPromocao ? opcao.preco : null,
      estoqueDisponivel: opcao.estoque_disponivel,
    });
    setModalAberto(false);
  }

  return (
    <>
      <Link
        href={`/loja/${slug}/produto/${selecionada.id}`}
        className="group flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-black/5 bg-[var(--surface)] shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-black/5 dark:bg-white/5">
          <ProdutoImagem
            src={produto.imagem_url}
            alt={produto.nome}
            categoria={produto.categoria}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {percentualOff > 0 && (
              <Badge variant="secondary">{percentualOff}% OFF</Badge>
            )}
            {produto.destaque && <Badge variant="neutral">Destaque</Badge>}
          </div>

          <FavoritoButton
            produtoId={selecionada.id}
            className="absolute top-2 right-2 h-8 w-8"
          />

          {/* Fica na foto (não no rodapé do card) de propósito — o botão
              flutuante de WhatsApp é fixo no canto inferior direito da
              TELA, então qualquer coisa que more no canto inferior do
              CARD passa por baixo dele durante o scroll (relatado como
              cards "cortados"). Aqui, bem mais alto, o cruzamento é raro. */}
          <button
            type="button"
            onClick={abrirAdicionar}
            disabled={selecionada.estoque_disponivel === 0}
            aria-label="Adicionar ao carrinho"
            className="absolute right-2 bottom-2 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-primary)] text-lg leading-none text-white shadow-md transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            +
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-1 p-3">
          <h3 className="line-clamp-2 text-sm font-medium">{produto.nome}</h3>

          {temVariantes && (
            <div className="mt-1 flex flex-wrap gap-1">
              {opcoes.map((opcao, i) => (
                <button
                  key={opcao.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setAtiva(i);
                  }}
                  className={`rounded border px-1.5 py-0.5 text-[11px] ${
                    i === ativa
                      ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 font-medium text-[var(--brand-primary)]"
                      : "border-black/10 text-black/50 dark:border-white/10 dark:text-white/50"
                  }`}
                >
                  {opcao.rotulo}
                </button>
              ))}
            </div>
          )}

          <div className="mt-auto flex items-baseline gap-2 pt-1">
            <span
              className={
                moderno ? "text-lg font-extrabold" : "text-base font-semibold"
              }
            >
              {formatarPreco(
                temPromocao
                  ? selecionada.preco_promocional!
                  : selecionada.preco,
              )}
            </span>
            {temPromocao && (
              <span className="text-xs text-black/40 line-through dark:text-white/40">
                {formatarPreco(selecionada.preco)}
              </span>
            )}
          </div>

          {carrinhoRapido.erro && (
            <p className="text-[11px] text-[var(--color-danger)]">
              {carrinhoRapido.erro}
            </p>
          )}
        </div>
      </Link>

      {modalAberto && (
        <ModalConfirmarAdicionar
          nome={produto.nome}
          imagemUrl={produto.imagem_url}
          categoria={produto.categoria}
          opcoes={opcoes}
          varianteInicialId={selecionada.id}
          carregando={carrinhoRapido.carregando}
          onConfirmar={confirmarAdicionar}
          onFechar={() => setModalAberto(false)}
        />
      )}
    </>
  );
}
