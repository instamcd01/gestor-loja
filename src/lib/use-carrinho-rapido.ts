"use client";

import { useRef, useState } from "react";
import type { ItemMiniCarrinho } from "@/components/carrinho/mini-carrinho-drawer";
import { useSessao } from "@/components/auth/sessao-provider";
import { adicionarAoCarrinho, atualizarQuantidade } from "@/lib/carrinho";
import { adicionarItemConvidado, atualizarItemConvidado, lerCarrinhoConvidado } from "@/lib/carrinho-convidado";
import { notificarCarrinhoAtualizado } from "@/lib/carrinho-eventos";
import { useDebounceQuantidade } from "@/lib/use-debounce-quantidade";

export interface EstadoDrawerCarrinho {
  carrinhoId: string | null; // null = carrinho de convidado (sem linha no banco ainda)
  itens: ItemMiniCarrinho[];
  valorTotal: number;
  idRecemAdicionado: string;
}

type ProdutoParaAdicionar = {
  nome: string;
  imagemUrl: string | null;
  categoria: string | null;
  preco: number;
  estoqueDisponivel: number;
};

/**
 * Lógica de "adicionar ao carrinho + abrir a gaveta de confirmação",
 * compartilhada entre o botão da página do produto e o botão rápido "+"
 * no card do catálogo — mesmo comportamento nos dois lugares, sem
 * duplicar a parte de convidado/logado/estoque/debounce.
 */
export function useCarrinhoRapido(slug: string, empresaId: string) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<EstadoDrawerCarrinho | null>(null);
  const { agendar: agendarSync, flushTudo } = useDebounceQuantidade();
  // Só a resposta da requisição mais recente pode atualizar a UI — sem
  // isso, a resposta de um clique mais antigo podia chegar depois e
  // sobrescrever um estado já mais novo.
  const ultimaRequisicao = useRef(0);

  // Mesmo motivo do AccountLink: as páginas de produto/catálogo são ISR
  // compartilhadas entre visitantes, então o estado de login é resolvido
  // no browser, não no servidor — senão perderia o cache. `useSessao`
  // (SessaoProvider) resolve isso UMA VEZ pra página inteira — antes esse
  // hook (chamado por CARD de produto, um por vez num catálogo com
  // centenas de itens) fazia sua própria checagem independente, virando
  // centenas de chamadas simultâneas a cada troca de filtro/departamento.
  const logado = useSessao();

  async function adicionar(produtoId: string, quantidade: number, produto: ProdutoParaAdicionar) {
    setCarregando(true);
    setErro(null);

    // Sem login, o carrinho fica só no navegador — login só é pedido na
    // hora de finalizar o pedido (ver mesclarCarrinhoConvidado). Lê a
    // quantidade já no carrinho ANTES de adicionar pra saber se já
    // estava no limite (mesma distinção "sem_estoque" vs "limitado" do
    // lado logado) — sem isso, o caso "já no limite" ficava mudo (a
    // gaveta até abria, mas sem dizer por que a quantidade não mudou).
    if (!logado) {
      const quantidadeAtual = lerCarrinhoConvidado(empresaId).find((i) => i.produtoId === produtoId)?.quantidade ?? 0;
      const jaNoLimite = quantidadeAtual >= produto.estoqueDisponivel;

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
      if (jaNoLimite) {
        setErro(`Só temos ${produto.estoqueDisponivel} em estoque.`);
      } else {
        const novaQuantidade = itensConvidado.find((i) => i.produtoId === produtoId)?.quantidade ?? 0;
        if (novaQuantidade < quantidadeAtual + quantidade) {
          setErro(`Só tinha ${produto.estoqueDisponivel} em estoque — ajustamos a quantidade.`);
        }
      }
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
    setCarregando(false);

    if (!resultado.ok && resultado.erro !== "sem_estoque") {
      setErro("Não foi possível adicionar. Tente de novo.");
      return;
    }

    if (!resultado.ok) {
      // Carrinho já tinha o máximo do estoque — nada foi adicionado, mas
      // a gaveta abre igual mostrando o que já está lá (era exatamente o
      // bug relatado: clicar "adicionar" nesse caso não abria nada, só
      // aparecia a mensagem e parava).
      setErro(`Só temos ${resultado.disponivel} em estoque.`);
    } else if (resultado.limitado) {
      setErro(`Só tinha ${resultado.disponivel} em estoque — ajustamos a quantidade.`);
    } else {
      notificarCarrinhoAtualizado();
    }

    // adicionarAoCarrinho já devolve o carrinho inteiro (não só o item
    // que acabou de entrar), pra gaveta mostrar tudo que já está lá sem
    // precisar de uma segunda ida ao servidor só pra buscar de novo.
    const carrinho = resultado.carrinho;
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
  // página do carrinho. A UI muda na hora (otimista); a sincronização com
  // o servidor só dispara ~450ms depois do último clique no mesmo item
  // (agrupa cliques rápidos numa chamada só) — antes cada clique esperava
  // a ida ao servidor terminar antes da UI mudar, sensivelmente mais lento.
  function alterarQuantidade(itemId: string, novaQuantidade: number) {
    if (!drawer) return;

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
      return;
    }

    const carrinhoId = drawer.carrinhoId;
    const item = drawer.itens.find((i) => i.id === itemId);
    if (!item) return;
    const quantidadeFinal = novaQuantidade <= 0 ? 0 : Math.min(novaQuantidade, item.estoqueDisponivel);

    const itensNovos =
      quantidadeFinal <= 0
        ? drawer.itens.filter((i) => i.id !== itemId)
        : drawer.itens.map((i) => (i.id === itemId ? { ...i, quantidade: quantidadeFinal } : i));
    setDrawer(
      itensNovos.length === 0
        ? null
        : {
            ...drawer,
            itens: itensNovos,
            valorTotal: itensNovos.reduce((soma, i) => soma + i.preco * i.quantidade, 0),
          },
    );
    notificarCarrinhoAtualizado();

    agendarSync(itemId, async () => {
      const minhaRequisicao = ++ultimaRequisicao.current;
      const carrinho = await atualizarQuantidade(slug, carrinhoId, itemId, novaQuantidade);
      if (minhaRequisicao !== ultimaRequisicao.current) return;
      notificarCarrinhoAtualizado();
      setDrawer((atual) => {
        if (!atual || atual.carrinhoId !== carrinhoId) return atual;
        return carrinho.itens.length === 0
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
              idRecemAdicionado: atual.idRecemAdicionado,
            };
      });
    });
  }

  return { carregando, erro, drawer, logado, adicionar, alterarQuantidade, flushTudo, fecharDrawer: () => setDrawer(null) };
}
