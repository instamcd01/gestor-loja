"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { EstimarFreteGratis } from "@/components/carrinho/estimar-frete-gratis";
import { ResumoTotais } from "@/components/carrinho/resumo-totais";
import { ProdutoImagem } from "@/components/produto-imagem";
import { Button } from "@/components/ui/button";
import { IconeLixeira } from "@/components/icone-lixeira";
import {
  assinarEnderecoEstimado,
  obterSnapshotEnderecoEstimado,
  obterSnapshotServidorEnderecoEstimado,
} from "@/lib/endereco-estimado";
import { useDrawerA11y } from "@/lib/use-drawer-a11y";
import { formatarPreco } from "@/lib/utils";

export interface ItemMiniCarrinho {
  id: string;
  nome: string;
  imagemUrl: string | null;
  categoria: string | null;
  preco: number;
  quantidade: number;
  estoqueDisponivel: number;
}

/**
 * Mostra o carrinho INTEIRO (não só o item que acabou de ser adicionado) —
 * antes só mostrava o item novo, dando a falsa impressão de que os outros
 * produtos tinham sumido a cada vez que algo era adicionado (relatado
 * como "não consigo adicionar outros produtos", mas o carrinho de verdade
 * sempre acumulou certo — só a confirmação visual escondia isso).
 */
export function MiniCarrinhoDrawer({
  slug,
  empresaId,
  enderecoEmpresa,
  itens,
  valorTotal,
  idRecemAdicionado,
  onAlterarQuantidade,
  onAntesDeNavegar,
  onFechar,
}: {
  slug: string;
  empresaId: string;
  enderecoEmpresa: { endereco: string | null; cidade: string | null; estado: string | null; cep: string | null };
  itens: ItemMiniCarrinho[];
  valorTotal: number;
  idRecemAdicionado: string;
  onAlterarQuantidade: (itemId: string, novaQuantidade: number) => void;
  /** Garante que qualquer alteração de quantidade ainda pendente (dentro da janela de debounce) chegue no banco antes de sair da gaveta — sem isso, ir pro carrinho logo depois de mexer na quantidade podia mostrar o valor antigo lá. */
  onAntesDeNavegar: () => Promise<void>;
  onFechar: () => void;
}) {
  const painelRef = useDrawerA11y(true, onFechar);
  const router = useRouter();
  const [confirmandoRemocaoId, setConfirmandoRemocaoId] = useState<string | null>(null);
  const [indoParaCarrinho, setIndoParaCarrinho] = useState(false);

  async function irParaCarrinho() {
    setIndoParaCarrinho(true);
    await onAntesDeNavegar();
    router.push(`/loja/${slug}/carrinho`);
  }

  const estimado = useSyncExternalStore(
    assinarEnderecoEstimado,
    () => obterSnapshotEnderecoEstimado(empresaId),
    obterSnapshotServidorEnderecoEstimado,
  );
  // Mesma regra do CarrinhoProvider.valorEntregaCalculado no app: zero
  // quando o subtotal atual já bate o mínimo da zona, mesmo que a
  // estimativa salva tenha sido calculada com um subtotal menor.
  const entregaGratis =
    !!estimado &&
    (estimado.valorMinimoFreteGratis != null
      ? valorTotal >= estimado.valorMinimoFreteGratis
      : estimado.freteGratis);
  const entregaValor = estimado ? (entregaGratis ? 0 : estimado.valor) : null;
  const faltaParaFreteGratis =
    estimado?.valorMinimoFreteGratis != null && !entregaGratis
      ? estimado.valorMinimoFreteGratis - valorTotal
      : null;

  return (
    // No mobile é gaveta inferior (mais fácil de alcançar com o polegar,
    // igual ao modal de confirmar variante); no desktop (sm+) continua
    // gaveta lateral em tela cheia, como sempre foi.
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 bg-black/40"
      />
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Adicionado ao carrinho"
        className="relative flex max-h-[85vh] w-full max-w-sm flex-col gap-4 rounded-t-[var(--radius-lg)] bg-[var(--surface)] p-5 shadow-xl sm:h-full sm:max-h-full sm:rounded-none"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            Adicionado ao carrinho ({itens.length} {itens.length === 1 ? "item" : "itens"})
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="text-lg text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
          >
            ×
          </button>
        </div>

        <EstimarFreteGratis empresaId={empresaId} enderecoEmpresa={enderecoEmpresa} />

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {itens.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 rounded-[var(--radius-md)] border p-3 ${
                item.id === idRecemAdicionado
                  ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5"
                  : "border-black/5 dark:border-white/10"
              }`}
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-black/5 dark:bg-white/5">
                <ProdutoImagem
                  src={item.imagemUrl}
                  alt={item.nome}
                  categoria={item.categoria}
                  className="object-cover"
                />
              </div>
              <div className="flex-1">
                <p className="line-clamp-2 text-sm font-medium">{item.nome}</p>
                <p className="text-xs text-black/50 dark:text-white/50">{formatarPreco(item.preco)}</p>
              </div>
              {confirmandoRemocaoId === item.id ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-black/60 dark:text-white/60">Remover?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmandoRemocaoId(null);
                      onAlterarQuantidade(item.id, 0);
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
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      item.quantidade === 1
                        ? setConfirmandoRemocaoId(item.id)
                        : onAlterarQuantidade(item.id, item.quantidade - 1)
                    }
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 leading-none dark:border-white/10"
                    aria-label={item.quantidade === 1 ? "Remover item" : "Diminuir quantidade"}
                  >
                    {item.quantidade === 1 ? <IconeLixeira /> : "−"}
                  </button>
                  <span className="w-5 text-center text-sm">{item.quantidade}</span>
                  <button
                    type="button"
                    disabled={item.quantidade >= item.estoqueDisponivel}
                    onClick={() => onAlterarQuantidade(item.id, item.quantidade + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 text-sm leading-none disabled:opacity-50 dark:border-white/10"
                    aria-label="Aumentar quantidade"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-black/5 pt-3 dark:border-white/10">
          <ResumoTotais
            subtotal={valorTotal}
            entregaLabel="Entrega"
            entregaValor={entregaValor}
            entregaValorOriginal={estimado?.valor}
            faltaParaFreteGratis={faltaParaFreteGratis}
            total={valorTotal + (entregaValor ?? 0)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={irParaCarrinho} disabled={indoParaCarrinho} className="w-full">
            {indoParaCarrinho ? "Abrindo carrinho..." : "Ir para o carrinho"}
          </Button>
          <button
            type="button"
            onClick={onFechar}
            className="text-center text-sm text-black/50 hover:underline dark:text-white/50"
          >
            Continuar comprando
          </button>
        </div>
      </div>
    </div>
  );
}
