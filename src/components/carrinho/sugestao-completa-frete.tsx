"use client";

import { useEffect, useState } from "react";
import { ProdutoImagem } from "@/components/produto-imagem";
import { buscarProdutoParaFreteGratis } from "@/lib/produtos-sugeridos";
import type { ProdutoCatalogo } from "@/lib/types";
import { formatarPreco } from "@/lib/utils";

/**
 * Em vez de só avisar "faltam RX pra frete grátis", sugere um produto
 * específico que fecharia essa conta — resolve a fricção na hora em vez
 * de deixar o cliente adivinhar o que comprar a mais. Cada tela do
 * carrinho passa sua PRÓPRIA função de adicionar (`onAdicionar`) — não
 * usa o hook de adicionar-rápido do catálogo de propósito, porque esse
 * hook devolve o carrinho pra uma gaveta separada em vez de atualizar a
 * lista que já está na tela (mesma classe de bug de "duas fontes de
 * verdade" já corrigida nesta sessão, ver memória do projeto).
 */
export function SugestaoCompletaFrete({
  empresaId,
  falta,
  onAdicionar,
}: {
  empresaId: string;
  falta: number;
  onAdicionar: (produto: ProdutoCatalogo) => void | Promise<void>;
}) {
  const [produto, setProduto] = useState<ProdutoCatalogo | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [adicionado, setAdicionado] = useState(false);

  // Arredonda a faixa (múltiplos de R$5) antes de refazer a busca — sem
  // isso, cada centavo que o "falta" muda (ex: cliente mexeu na
  // quantidade de outro item) disparava uma busca nova.
  const faixaFalta = Math.ceil(falta / 5) * 5;

  useEffect(() => {
    let cancelado = false;
    // Não reseta `adicionado` aqui de propósito: uma vez que o cliente
    // aceitou a sugestão, não volta a insistir só porque o valor que
    // falta mudou de novo (ex: ele mexeu na quantidade de outro item).
    buscarProdutoParaFreteGratis(empresaId, faixaFalta).then((encontrado) => {
      if (!cancelado) setProduto(encontrado);
    });
    return () => {
      cancelado = true;
    };
  }, [empresaId, faixaFalta]);

  if (!produto || adicionado) return null;

  const preco = produto.preco_promocional ?? produto.preco;

  async function adicionar() {
    setAdicionando(true);
    await onAdicionar(produto!);
    setAdicionando(false);
    setAdicionado(true);
  }

  return (
    <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--brand-primary)]/40 bg-[var(--brand-primary)]/5 p-2.5">
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-black/5 dark:bg-white/5">
        <ProdutoImagem src={produto.imagem_url} alt={produto.nome} categoria={produto.categoria} className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{produto.nome}</p>
        <p className="text-xs text-black/50 dark:text-white/50">{formatarPreco(preco)} — completa o frete grátis</p>
      </div>
      <button
        type="button"
        onClick={adicionar}
        disabled={adicionando}
        className="shrink-0 rounded-full bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
      >
        {adicionando ? "..." : "Adicionar"}
      </button>
    </div>
  );
}
