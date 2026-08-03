"use client";

import { useEffect, useState } from "react";
import { type ItemMiniCarrinho, MiniCarrinhoDrawer } from "@/components/carrinho/mini-carrinho-drawer";
import { Button } from "@/components/ui/button";
import { adicionarAoCarrinho, atualizarQuantidade, getCarrinho } from "@/lib/carrinho";
import { adicionarItemConvidado, atualizarItemConvidado } from "@/lib/carrinho-convidado";
import { notificarCarrinhoAtualizado } from "@/lib/carrinho-eventos";
import { createClient } from "@/lib/supabase/client";

interface EstadoDrawer {
  carrinhoId: string | null; // null = carrinho de convidado (sem linha no banco ainda)
  itens: ItemMiniCarrinho[];
  valorTotal: number;
  idRecemAdicionado: string;
}

export function AdicionarCarrinhoButton({
  slug,
  empresaId,
  produtoId,
  produto,
  freteGratisMinimo,
}: {
  slug: string;
  empresaId: string;
  produtoId: string;
  produto: { nome: string; imagemUrl: string | null; categoria: string | null; preco: number };
  freteGratisMinimo?: number | null;
}) {
  const [quantidade, setQuantidade] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const [drawer, setDrawer] = useState<EstadoDrawer | null>(null);
  const [itemProcessando, setItemProcessando] = useState<string | null>(null);

  // Mesmo motivo do AccountLink: a página de produto é ISR compartilhada
  // entre visitantes, então o estado de login é resolvido no browser, não
  // no servidor — senão perderia o cache.
  const [logado, setLogado] = useState<boolean | null>(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setLogado(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLogado(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function adicionar() {
    setCarregando(true);
    setErro(false);

    // Sem login, o carrinho fica só no navegador — login só é pedido na
    // hora de finalizar o pedido (ver mesclarCarrinhoConvidado).
    if (!logado) {
      const itensConvidado = adicionarItemConvidado(empresaId, {
        produtoId,
        nome: produto.nome,
        imagemUrl: produto.imagemUrl,
        categoria: produto.categoria,
        preco: produto.preco,
        quantidade,
      });
      setCarregando(false);
      setQuantidade(1);
      setDrawer({
        carrinhoId: null,
        itens: itensConvidado.map((item) => ({
          id: item.produtoId,
          nome: item.nome,
          imagemUrl: item.imagemUrl,
          categoria: item.categoria,
          preco: item.preco,
          quantidade: item.quantidade,
        })),
        valorTotal: itensConvidado.reduce((soma, item) => soma + item.preco * item.quantidade, 0),
        idRecemAdicionado: produtoId,
      });
      return;
    }

    const resultado = await adicionarAoCarrinho(slug, empresaId, produtoId, quantidade);
    if (!resultado.ok) {
      setCarregando(false);
      setErro(true);
      return;
    }

    // Busca o carrinho completo (não só o item que acabou de entrar) pra
    // gaveta de confirmação mostrar tudo que já está lá — antes só
    // mostrava o item novo, dando a falsa impressão de que os outros
    // produtos tinham sumido.
    const carrinho = await getCarrinho(empresaId);
    setCarregando(false);
    setQuantidade(1);
    notificarCarrinhoAtualizado();
    setDrawer({
      carrinhoId: carrinho.id,
      itens: carrinho.itens.map((item) => ({
        id: item.id,
        nome: item.produto?.nome ?? "Produto",
        imagemUrl: item.produto?.imagem_url ?? null,
        categoria: item.produto?.categoria ?? null,
        preco: item.preco_unitario,
        quantidade: item.quantidade,
      })),
      valorTotal: carrinho.valorTotal,
      idRecemAdicionado: carrinho.itens.find((item) => item.produto_id === produtoId)?.id ?? "",
    });
  }

  // Editar quantidade (ou remover, quando novaQuantidade <= 0) direto na
  // gaveta — sem isso, corrigir um engano de quantidade exigia ir até a
  // página do carrinho. A gaveta não faz parte da árvore de Server
  // Components da página do carrinho, então o `revalidatePath` de dentro
  // de `atualizarQuantidade` não atualiza esse estado local sozinho — por
  // isso busca o carrinho de novo depois de alterar, igual ao fluxo de
  // adicionar.
  async function alterarQuantidade(itemId: string, novaQuantidade: number) {
    if (!drawer) return;
    setItemProcessando(itemId);

    if (drawer.carrinhoId === null) {
      const itensConvidado = atualizarItemConvidado(empresaId, itemId, novaQuantidade);
      setDrawer(
        itensConvidado.length === 0
          ? null
          : {
              carrinhoId: null,
              itens: itensConvidado.map((item) => ({
                id: item.produtoId,
                nome: item.nome,
                imagemUrl: item.imagemUrl,
                categoria: item.categoria,
                preco: item.preco,
                quantidade: item.quantidade,
              })),
              valorTotal: itensConvidado.reduce((soma, item) => soma + item.preco * item.quantidade, 0),
              idRecemAdicionado: drawer.idRecemAdicionado,
            },
      );
      setItemProcessando(null);
      return;
    }

    await atualizarQuantidade(slug, drawer.carrinhoId, itemId, novaQuantidade);
    const carrinho = await getCarrinho(empresaId);
    notificarCarrinhoAtualizado();
    setDrawer(
      carrinho.itens.length === 0
        ? null
        : {
            carrinhoId: carrinho.id,
            itens: carrinho.itens.map((item) => ({
              id: item.id,
              nome: item.produto?.nome ?? "Produto",
              imagemUrl: item.produto?.imagem_url ?? null,
              categoria: item.produto?.categoria ?? null,
              preco: item.preco_unitario,
              quantidade: item.quantidade,
            })),
            valorTotal: carrinho.valorTotal,
            idRecemAdicionado: drawer.idRecemAdicionado,
          },
    );
    setItemProcessando(null);
  }

  return (
    <div className="flex flex-col gap-3">
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
            onClick={() => setQuantidade((q) => q + 1)}
            className="px-3 py-2 text-lg leading-none"
            aria-label="Aumentar quantidade"
          >
            +
          </button>
        </div>

        <Button
          onClick={adicionar}
          disabled={carregando || logado === null}
          className="flex-1 py-3 text-base"
        >
          {carregando ? "Adicionando..." : "Adicionar ao carrinho"}
        </Button>
      </div>

      {erro && (
        <p className="text-sm text-[var(--color-danger)]">Não foi possível adicionar. Tente de novo.</p>
      )}

      {drawer && (
        <MiniCarrinhoDrawer
          slug={slug}
          itens={drawer.itens}
          valorTotal={drawer.valorTotal}
          idRecemAdicionado={drawer.idRecemAdicionado}
          itemProcessando={itemProcessando}
          freteGratisMinimo={freteGratisMinimo}
          onAlterarQuantidade={alterarQuantidade}
          onFechar={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
