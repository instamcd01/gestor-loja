"use client";

import { useEffect, useState } from "react";
import { type ItemMiniCarrinho, MiniCarrinhoDrawer } from "@/components/carrinho/mini-carrinho-drawer";
import { Button } from "@/components/ui/button";
import { adicionarAoCarrinho, atualizarQuantidade } from "@/lib/carrinho";
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
  enderecoEmpresa,
  produtoId,
  produto,
}: {
  slug: string;
  empresaId: string;
  enderecoEmpresa: { endereco: string | null; cidade: string | null; estado: string | null; cep: string | null };
  produtoId: string;
  produto: { nome: string; imagemUrl: string | null; categoria: string | null; preco: number; estoqueDisponivel: number };
}) {
  const [quantidade, setQuantidade] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
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
    setErro(null);

    // Sem login, o carrinho fica só no navegador — login só é pedido na
    // hora de finalizar o pedido (ver mesclarCarrinhoConvidado).
    if (!logado) {
      if (quantidade > produto.estoqueDisponivel) {
        setCarregando(false);
        setErro(`Só temos ${produto.estoqueDisponivel} em estoque.`);
        return;
      }
      const itensConvidado = adicionarItemConvidado(empresaId, {
        produtoId,
        nome: produto.nome,
        imagemUrl: produto.imagemUrl,
        categoria: produto.categoria,
        preco: produto.preco,
        quantidade,
        estoqueDisponivel: produto.estoqueDisponivel,
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
          estoqueDisponivel: item.estoqueDisponivel,
        })),
        valorTotal: itensConvidado.reduce((soma, item) => soma + item.preco * item.quantidade, 0),
        idRecemAdicionado: produtoId,
      });
      return;
    }

    const resultado = await adicionarAoCarrinho(slug, empresaId, produtoId, quantidade);
    if (!resultado.ok) {
      setCarregando(false);
      setErro(
        resultado.erro === "sem_estoque"
          ? `Só temos ${resultado.disponivel} em estoque.`
          : "Não foi possível adicionar. Tente de novo.",
      );
      return;
    }
    if (resultado.limitado) {
      setErro(`Só tinha ${resultado.disponivel} em estoque — ajustamos a quantidade.`);
    }

    // adicionarAoCarrinho já devolve o carrinho inteiro (não só o item
    // que acabou de entrar), pra gaveta mostrar tudo que já está lá sem
    // precisar de uma segunda ida ao servidor só pra buscar de novo.
    const carrinho = resultado.carrinho;
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
        estoqueDisponivel: item.produto?.estoque_disponivel ?? item.quantidade,
      })),
      valorTotal: carrinho.valorTotal,
      idRecemAdicionado: carrinho.itens.find((item) => item.produto_id === produtoId)?.id ?? "",
    });
  }

  // Editar quantidade (ou remover, quando novaQuantidade <= 0) direto na
  // gaveta — sem isso, corrigir um engano de quantidade exigia ir até a
  // página do carrinho. atualizarQuantidade já devolve o carrinho fresco
  // (a gaveta não faz parte da árvore de Server Components da página do
  // carrinho, então o `revalidatePath` de dentro dela não atualiza esse
  // estado local sozinho) — usa o retorno direto em vez de buscar tudo
  // de novo numa segunda chamada.
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
                estoqueDisponivel: item.estoqueDisponivel,
              })),
              valorTotal: itensConvidado.reduce((soma, item) => soma + item.preco * item.quantidade, 0),
              idRecemAdicionado: drawer.idRecemAdicionado,
            },
      );
      setItemProcessando(null);
      return;
    }

    const carrinho = await atualizarQuantidade(slug, drawer.carrinhoId, itemId, novaQuantidade);
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
              estoqueDisponivel: item.produto?.estoque_disponivel ?? item.quantidade,
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
            disabled={quantidade >= produto.estoqueDisponivel}
            onClick={() => setQuantidade((q) => Math.min(produto.estoqueDisponivel, q + 1))}
            className="px-3 py-2 text-lg leading-none disabled:opacity-30"
            aria-label="Aumentar quantidade"
          >
            +
          </button>
        </div>

        <Button
          onClick={adicionar}
          disabled={carregando || logado === null || produto.estoqueDisponivel === 0}
          className="flex-1 py-3 text-base"
        >
          {produto.estoqueDisponivel === 0
            ? "Sem estoque"
            : carregando
              ? "Adicionando..."
              : "Adicionar ao carrinho"}
        </Button>
      </div>

      {produto.estoqueDisponivel > 0 && produto.estoqueDisponivel <= 5 && (
        <p className="text-xs text-black/50 dark:text-white/50">Só restam {produto.estoqueDisponivel} em estoque.</p>
      )}

      {erro && <p className="text-sm text-[var(--color-danger)]">{erro}</p>}

      {drawer && (
        <MiniCarrinhoDrawer
          slug={slug}
          empresaId={empresaId}
          enderecoEmpresa={enderecoEmpresa}
          itens={drawer.itens}
          valorTotal={drawer.valorTotal}
          idRecemAdicionado={drawer.idRecemAdicionado}
          itemProcessando={itemProcessando}
          onAlterarQuantidade={alterarQuantidade}
          onFechar={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
