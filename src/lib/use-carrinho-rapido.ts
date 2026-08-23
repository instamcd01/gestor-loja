"use client";

import { useEffect, useRef, useState } from "react";
import type { ItemMiniCarrinho } from "@/components/carrinho/mini-carrinho-drawer";
import { useSessao } from "@/components/auth/sessao-provider";
import {
  adicionarAoCarrinho,
  atualizarQuantidade,
  getCarrinho,
} from "@/lib/carrinho";
import {
  adicionarItemConvidado,
  atualizarItemConvidado,
  lerCarrinhoConvidado,
} from "@/lib/carrinho-convidado";
import {
  assinarCarrinhoAtualizado,
  notificarCarrinhoAtualizado,
} from "@/lib/carrinho-eventos";
import type { ItemCarrinho } from "@/lib/types";
import { precoExibicao } from "@/lib/utils";
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
  /** Preço de catálogo original quando `preco` já é o promocional — null = não está em promoção. */
  precoOriginal: number | null;
  estoqueDisponivel: number;
};

function precoOriginalDoItem(item: ItemCarrinho, usarPrecoAncoraMarketplace: boolean): number | null {
  const produto = item.produto;
  if (!produto) return null;
  const exibicao = precoExibicao(produto, usarPrecoAncoraMarketplace);
  return exibicao.temComparativo ? exibicao.precoDe : null;
}

/**
 * Lógica de "adicionar ao carrinho + abrir a gaveta de confirmação",
 * compartilhada entre o botão da página do produto e o botão rápido "+"
 * no card do catálogo — mesmo comportamento nos dois lugares, sem
 * duplicar a parte de convidado/logado/estoque/debounce.
 */
export function useCarrinhoRapido(slug: string, empresaId: string, usarPrecoAncoraMarketplace = false) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<EstadoDrawerCarrinho | null>(null);
  // Minimizada = só a barrinha fina na borda ("Adicionado ao carrinho (N
  // itens)"); o cliente reabre a gaveta cheia tocando nela. Separado de
  // `drawer` de propósito: `drawer` é "tem alguma coisa pra mostrar",
  // `minimizado` é só o modo de exibição — os dois mudam por motivos
  // diferentes (drawer muda quando o carrinho muda, minimizado muda
  // quando o cliente toca em "×"/"Continuar comprando"/na própria barra).
  const [minimizado, setMinimizado] = useState(false);
  const { agendar: agendarSync, flushTudo } = useDebounceQuantidade();
  // Só a resposta da requisição mais recente pode atualizar a UI — sem
  // isso, a resposta de um clique mais antigo podia chegar depois e
  // sobrescrever um estado já mais novo.
  const ultimaRequisicao = useRef(0);
  // true assim que a barra já foi revelada uma vez nesta sessão de página
  // (por adicionar() OU pela sincronização abaixo) — evita que o
  // sincronizador reabra em modo minimizado de novo toda vez que o evento
  // de "carrinho mudou" disparar (inclusive o disparado pelo próprio
  // adicionar()/alterarQuantidade() deste hook), o que faria a gaveta
  // recém-aberta pelo cliente encolher sozinha um instante depois.
  const carrinhoJaRevelado = useRef(false);

  // Mesmo motivo do AccountLink: as páginas de produto/catálogo são ISR
  // compartilhadas entre visitantes, então o estado de login é resolvido
  // no browser, não no servidor — senão perderia o cache. `useSessao`
  // (SessaoProvider) resolve isso UMA VEZ pra página inteira — antes esse
  // hook (chamado por CARD de produto, um por vez num catálogo com
  // centenas de itens) fazia sua própria checagem independente, virando
  // centenas de chamadas simultâneas a cada troca de filtro/departamento.
  const logado = useSessao();

  // Sincroniza com o carrinho de verdade ao entrar na página (não só
  // depois de um "adicionar" desta sessão) e a cada mudança em qualquer
  // outro lugar (ex: página /carrinho) — a pedido do lojista, a barra
  // minimizada deve aparecer sempre que houver algo no carrinho, não só
  // logo após clicar em adicionar.
  useEffect(() => {
    if (logado === null) return; // ainda não sabemos se está logado — espera resolver
    let cancelado = false;

    async function sincronizar() {
      if (logado) {
        const carrinho = await getCarrinho(empresaId);
        if (cancelado) return;
        if (carrinho.itens.length === 0) {
          carrinhoJaRevelado.current = false;
          setDrawer(null);
          return;
        }
        if (!carrinhoJaRevelado.current) setMinimizado(true);
        carrinhoJaRevelado.current = true;
        setDrawer({
          carrinhoId: carrinho.id,
          itens: carrinho.itens.map((item) => ({
            id: item.id,
            nome: item.produto?.nome ?? "Produto",
            imagemUrl: item.produto?.imagem_url ?? null,
            categoria: item.produto?.categoria ?? null,
            preco: item.preco_unitario,
            precoOriginal: precoOriginalDoItem(item, usarPrecoAncoraMarketplace),
            quantidade: item.quantidade,
            estoqueDisponivel:
              item.produto?.estoque_disponivel ?? item.quantidade,
          })),
          valorTotal: carrinho.valorTotal,
          idRecemAdicionado: "",
        });
      } else {
        const itensConvidado = lerCarrinhoConvidado(empresaId);
        if (itensConvidado.length === 0) {
          carrinhoJaRevelado.current = false;
          setDrawer(null);
          return;
        }
        if (!carrinhoJaRevelado.current) setMinimizado(true);
        carrinhoJaRevelado.current = true;
        setDrawer({
          carrinhoId: null,
          itens: itensConvidado.map((item) => ({
            id: item.produtoId,
            nome: item.nome,
            imagemUrl: item.imagemUrl,
            categoria: item.categoria,
            preco: item.preco,
            precoOriginal: item.precoOriginal,
            quantidade: item.quantidade,
            estoqueDisponivel: item.estoqueDisponivel,
          })),
          valorTotal: itensConvidado.reduce(
            (soma, item) => soma + item.preco * item.quantidade,
            0,
          ),
          idRecemAdicionado: "",
        });
      }
    }

    sincronizar();
    const cancelarAssinatura = assinarCarrinhoAtualizado(sincronizar);
    return () => {
      cancelado = true;
      cancelarAssinatura();
    };
  }, [logado, empresaId, usarPrecoAncoraMarketplace]);

  async function adicionar(
    produtoId: string,
    quantidade: number,
    produto: ProdutoParaAdicionar,
  ) {
    setCarregando(true);
    setErro(null);

    // Sem login, o carrinho fica só no navegador — login só é pedido na
    // hora de finalizar o pedido (ver mesclarCarrinhoConvidado). Lê a
    // quantidade já no carrinho ANTES de adicionar pra saber se já
    // estava no limite (mesma distinção "sem_estoque" vs "limitado" do
    // lado logado) — sem isso, o caso "já no limite" ficava mudo (a
    // gaveta até abria, mas sem dizer por que a quantidade não mudou).
    if (!logado) {
      const quantidadeAtual =
        lerCarrinhoConvidado(empresaId).find((i) => i.produtoId === produtoId)
          ?.quantidade ?? 0;
      const jaNoLimite = quantidadeAtual >= produto.estoqueDisponivel;

      const itensConvidado = adicionarItemConvidado(empresaId, {
        produtoId,
        nome: produto.nome,
        imagemUrl: produto.imagemUrl,
        categoria: produto.categoria,
        preco: produto.preco,
        precoOriginal: produto.precoOriginal,
        quantidade,
        estoqueDisponivel: produto.estoqueDisponivel,
      });
      setCarregando(false);
      if (jaNoLimite) {
        setErro(`Só temos ${produto.estoqueDisponivel} em estoque.`);
      } else {
        const novaQuantidade =
          itensConvidado.find((i) => i.produtoId === produtoId)?.quantidade ??
          0;
        if (novaQuantidade < quantidadeAtual + quantidade) {
          setErro(
            `Só tinha ${produto.estoqueDisponivel} em estoque — ajustamos a quantidade.`,
          );
        }
      }
      carrinhoJaRevelado.current = true;
      setMinimizado(false);
      setDrawer({
        carrinhoId: null,
        itens: itensConvidado.map((item) => ({
          id: item.produtoId,
          nome: item.nome,
          imagemUrl: item.imagemUrl,
          categoria: item.categoria,
          preco: item.preco,
          precoOriginal: item.precoOriginal,
          quantidade: item.quantidade,
          estoqueDisponivel: item.estoqueDisponivel,
        })),
        valorTotal: itensConvidado.reduce(
          (soma, item) => soma + item.preco * item.quantidade,
          0,
        ),
        idRecemAdicionado: produtoId,
      });
      return;
    }

    const resultado = await adicionarAoCarrinho(
      slug,
      empresaId,
      produtoId,
      quantidade,
    );
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
      setErro(
        `Só tinha ${resultado.disponivel} em estoque — ajustamos a quantidade.`,
      );
    } else {
      notificarCarrinhoAtualizado();
    }

    // adicionarAoCarrinho já devolve o carrinho inteiro (não só o item
    // que acabou de entrar), pra gaveta mostrar tudo que já está lá sem
    // precisar de uma segunda ida ao servidor só pra buscar de novo.
    const carrinho = resultado.carrinho;
    carrinhoJaRevelado.current = true;
    setMinimizado(false);
    setDrawer({
      carrinhoId: carrinho.id,
      itens: carrinho.itens.map((item) => ({
        id: item.id,
        nome: item.produto?.nome ?? "Produto",
        imagemUrl: item.produto?.imagem_url ?? null,
        categoria: item.produto?.categoria ?? null,
        preco: item.preco_unitario,
        precoOriginal: precoOriginalDoItem(item, usarPrecoAncoraMarketplace),
        quantidade: item.quantidade,
        estoqueDisponivel: item.produto?.estoque_disponivel ?? item.quantidade,
      })),
      valorTotal: carrinho.valorTotal,
      idRecemAdicionado:
        carrinho.itens.find((item) => item.produto_id === produtoId)?.id ?? "",
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
      const itensConvidado = atualizarItemConvidado(
        empresaId,
        itemId,
        novaQuantidade,
      );
      if (itensConvidado.length === 0) {
        carrinhoJaRevelado.current = false;
        setDrawer(null);
        return;
      }
      setDrawer({
        carrinhoId: null,
        itens: itensConvidado.map((item) => ({
          id: item.produtoId,
          nome: item.nome,
          imagemUrl: item.imagemUrl,
          categoria: item.categoria,
          preco: item.preco,
          precoOriginal: item.precoOriginal,
          quantidade: item.quantidade,
          estoqueDisponivel: item.estoqueDisponivel,
        })),
        valorTotal: itensConvidado.reduce(
          (soma, item) => soma + item.preco * item.quantidade,
          0,
        ),
        idRecemAdicionado: drawer.idRecemAdicionado,
      });
      return;
    }

    const carrinhoId = drawer.carrinhoId;
    const item = drawer.itens.find((i) => i.id === itemId);
    if (!item) return;
    const quantidadeFinal =
      novaQuantidade <= 0
        ? 0
        : Math.min(novaQuantidade, item.estoqueDisponivel);

    const itensNovos =
      quantidadeFinal <= 0
        ? drawer.itens.filter((i) => i.id !== itemId)
        : drawer.itens.map((i) =>
            i.id === itemId ? { ...i, quantidade: quantidadeFinal } : i,
          );
    if (itensNovos.length === 0) {
      carrinhoJaRevelado.current = false;
      setDrawer(null);
    } else {
      setDrawer({
        ...drawer,
        itens: itensNovos,
        valorTotal: itensNovos.reduce(
          (soma, i) => soma + i.preco * i.quantidade,
          0,
        ),
      });
    }
    notificarCarrinhoAtualizado();

    agendarSync(itemId, async () => {
      const minhaRequisicao = ++ultimaRequisicao.current;
      const carrinho = await atualizarQuantidade(
        slug,
        carrinhoId,
        itemId,
        novaQuantidade,
      );
      if (minhaRequisicao !== ultimaRequisicao.current) return;
      notificarCarrinhoAtualizado();
      setDrawer((atual) => {
        if (!atual || atual.carrinhoId !== carrinhoId) return atual;
        if (carrinho.itens.length === 0) {
          carrinhoJaRevelado.current = false;
          return null;
        }
        return {
          carrinhoId: carrinho.id,
          itens: carrinho.itens.map((item) => ({
            id: item.id,
            nome: item.produto?.nome ?? "Produto",
            imagemUrl: item.produto?.imagem_url ?? null,
            categoria: item.produto?.categoria ?? null,
            preco: item.preco_unitario,
            precoOriginal: precoOriginalDoItem(item, usarPrecoAncoraMarketplace),
            quantidade: item.quantidade,
            estoqueDisponivel:
              item.produto?.estoque_disponivel ?? item.quantidade,
          })),
          valorTotal: carrinho.valorTotal,
          idRecemAdicionado: atual.idRecemAdicionado,
        };
      });
    });
  }

  return {
    carregando,
    erro,
    drawer,
    minimizado,
    logado,
    adicionar,
    alterarQuantidade,
    flushTudo,
    minimizarDrawer: () => setMinimizado(true),
    expandirDrawer: () => setMinimizado(false),
  };
}
