"use client";

import { useRef, useState } from "react";
import { EntregaForm } from "@/components/carrinho/entrega-form";
import { EstimarFreteGratis } from "@/components/carrinho/estimar-frete-gratis";
import { ItemCarrinhoRow } from "@/components/carrinho/item-carrinho-row";
import { LimparCarrinhoButton } from "@/components/carrinho/limpar-carrinho-button";
import { Card } from "@/components/ui/card";
import { adicionarAoCarrinho, atualizarQuantidade, limparCarrinho } from "@/lib/carrinho";
import { notificarCarrinhoAtualizado } from "@/lib/carrinho-eventos";
import type { Carrinho, EmpresaCatalogo, EnderecoCliente, ProdutoCatalogo } from "@/lib/types";
import { useDebounceQuantidade } from "@/lib/use-debounce-quantidade";

/**
 * Dono do estado do carrinho de um cliente logado — muda a UI na hora ao
 * clicar +/- (otimista) e só sincroniza com o servidor ~450ms depois do
 * último clique no mesmo item, agrupando cliques rápidos numa chamada só.
 * Antes cada clique esperava terminar uma ida ao servidor E o
 * revalidatePath recarregar a página inteira de Server Component antes
 * da UI mudar — sensivelmente mais lento, e era exatamente o padrão
 * reportado como "muito lento" pra ajustar quantidade.
 */
export function CarrinhoLogado({
  slug,
  empresaId,
  aceitaRetirada,
  retiradaPrazoMin,
  enderecoEmpresa,
  horarioFuncionamento,
  enderecoSalvo,
  carrinhoInicial,
}: {
  slug: string;
  empresaId: string;
  aceitaRetirada: boolean;
  retiradaPrazoMin: number | null;
  enderecoEmpresa: { endereco: string | null; cidade: string | null; estado: string | null; cep: string | null };
  horarioFuncionamento: EmpresaCatalogo["horario_funcionamento"];
  enderecoSalvo: EnderecoCliente | null;
  carrinhoInicial: Carrinho;
}) {
  const [carrinho, setCarrinho] = useState(carrinhoInicial);
  const { agendar: agendarSync, flushTudo } = useDebounceQuantidade();
  // Só a resposta da requisição mais recente pode atualizar a UI — sem
  // isso, a resposta de um item que demorou mais podia chegar depois e
  // sobrescrever um estado já mais novo (de outro item alterado nesse meio-tempo).
  const ultimaRequisicao = useRef(0);

  function alterarQuantidade(itemId: string, novaQuantidade: number) {
    if (!carrinho.id) return;
    const carrinhoId = carrinho.id;
    const item = carrinho.itens.find((i) => i.id === itemId);
    if (!item) return;

    const quantidadeFinal =
      novaQuantidade <= 0 ? 0 : Math.min(novaQuantidade, item.produto?.estoque_disponivel ?? novaQuantidade);

    const itensNovos =
      quantidadeFinal <= 0
        ? carrinho.itens.filter((i) => i.id !== itemId)
        : carrinho.itens.map((i) =>
            i.id === itemId
              ? { ...i, quantidade: quantidadeFinal, subtotal: quantidadeFinal * i.preco_unitario }
              : i,
          );
    setCarrinho({ ...carrinho, itens: itensNovos, valorTotal: itensNovos.reduce((soma, i) => soma + i.subtotal, 0) });
    notificarCarrinhoAtualizado();

    agendarSync(itemId, async () => {
      const minhaRequisicao = ++ultimaRequisicao.current;
      const carrinhoAtualizado = await atualizarQuantidade(slug, carrinhoId, itemId, novaQuantidade);
      if (minhaRequisicao !== ultimaRequisicao.current) return;
      setCarrinho(carrinhoAtualizado);
      notificarCarrinhoAtualizado();
    });
  }

  // Usada pela sugestão "completa o frete grátis" (ver EstimarFreteGratis)
  // — chama o mesmo RPC que o resto da tela já usa e atualiza o MESMO
  // estado `carrinho` local, em vez do hook de adicionar-rápido do
  // catálogo (que devolve o resultado pra uma gaveta separada e nunca
  // atualizaria a lista que já está renderizada aqui).
  async function adicionarSugestao(produto: ProdutoCatalogo) {
    const resultado = await adicionarAoCarrinho(slug, empresaId, produto.id, 1);
    if ("carrinho" in resultado) {
      setCarrinho(resultado.carrinho);
      notificarCarrinhoAtualizado();
    }
  }

  async function esvaziar() {
    if (!carrinho.id) return;
    const carrinhoId = carrinho.id;
    setCarrinho({ ...carrinho, itens: [], valorTotal: 0 });
    notificarCarrinhoAtualizado();
    await limparCarrinho(slug, carrinhoId);
  }

  if (carrinho.itens.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 py-16 text-center">
        <h1 className="text-xl font-semibold">Seu carrinho está vazio</h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          Volte ao catálogo e adicione alguns produtos.
        </p>
      </div>
    );
  }

  return (
    // pb-44 reserva espaço pra barra fixa de total/"Ir para pagamento" do
    // EntregaForm não cobrir o fim do conteúdo — a barra é `fixed`, então
    // não empurra o layout sozinha. Generoso de propósito porque a barra
    // cresce quando leva o indicador de progresso de frete grátis
    // embutido (ver comentário em entrega-form.tsx).
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-44 pt-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Seu carrinho</h1>
        <LimparCarrinhoButton onConfirmar={esvaziar} />
      </div>

      <EstimarFreteGratis
        empresaId={empresaId}
        enderecoEmpresa={enderecoEmpresa}
        subtotal={carrinho.valorTotal}
        categoriasCarrinho={[
          ...new Set(carrinho.itens.map((item) => item.produto?.categoria).filter((c): c is string => !!c)),
        ]}
        idsNoCarrinho={carrinho.itens.map((item) => item.produto_id)}
        onAdicionarSugestao={adicionarSugestao}
      />

      <Card className="divide-y divide-black/5 px-4 dark:divide-white/10">
        {carrinho.itens.map((item) => (
          <ItemCarrinhoRow key={item.id} item={item} onAlterarQuantidade={alterarQuantidade} />
        ))}
      </Card>

      <EntregaForm
        slug={slug}
        empresaId={empresaId}
        aceitaRetirada={aceitaRetirada}
        retiradaPrazoMin={retiradaPrazoMin}
        enderecoEmpresa={enderecoEmpresa}
        horarioFuncionamento={horarioFuncionamento}
        subtotal={carrinho.valorTotal}
        itens={carrinho.itens}
        enderecoSalvo={enderecoSalvo}
        aoConfirmarAntes={flushTudo}
      />
    </div>
  );
}
