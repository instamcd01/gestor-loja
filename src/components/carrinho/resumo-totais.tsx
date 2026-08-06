import { formatarPreco } from "@/lib/utils";

/**
 * Bloco de totais único, reaproveitado na gaveta, carrinho de visitante,
 * checkout e confirmação de pedido — antes cada tela tinha seu próprio
 * bloco copiado/adaptado, e isso deixava fácil corrigir um rótulo/valor
 * num lugar e esquecer os outros (foi exatamente o que aconteceu com o
 * frete: corrigido no checkout, mas a gaveta e o carrinho de visitante
 * continuaram somando só os produtos). Mesma ordem e rótulos do resumo
 * de venda do app Gestor (carrinho_screen.dart: Subtotal → Entrega →
 * aviso de frete grátis → Total), pra manter o mesmo padrão nos dois.
 */
export function ResumoTotais({
  subtotal,
  entregaLabel,
  entregaValor,
  entregaValorOriginal,
  faltaParaFreteGratis,
  descontoCupom,
  saldoAplicado,
  total,
}: {
  subtotal: number;
  /** Rótulo da linha de entrega — "Retirada na loja", "Entrega", "Entrega (Zona Sul)", etc. */
  entregaLabel: string;
  /** null = ainda não sabemos (endereço não informado); 0 = grátis; N = valor a cobrar. */
  entregaValor: number | null;
  /** Quanto a entrega custaria sem o frete grátis — mostrado riscado do lado de "Grátis" (estilo "isso aqui é um desconto", igual iFood), só quando entregaValor é 0 e esse valor é conhecido e > 0. */
  entregaValorOriginal?: number | null;
  /** Só exibido quando > 0 — mesma regra do app, não mostra nada se não houver mínimo configurado. */
  faltaParaFreteGratis?: number | null;
  descontoCupom?: number;
  saldoAplicado?: number;
  total: number;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <div className="flex justify-between">
        <span className="text-black/50 dark:text-white/50">Subtotal</span>
        <span>{formatarPreco(subtotal)}</span>
      </div>

      <div className="flex justify-between">
        <span className="text-black/50 dark:text-white/50">{entregaLabel}</span>
        {entregaValor == null ? (
          <span>—</span>
        ) : entregaValor === 0 ? (
          <span className="flex items-center gap-1.5 font-medium text-[var(--color-success)]">
            {!!entregaValorOriginal && entregaValorOriginal > 0 && (
              <span className="text-black/40 line-through dark:text-white/40">{formatarPreco(entregaValorOriginal)}</span>
            )}
            Grátis
          </span>
        ) : (
          <span>{formatarPreco(entregaValor)}</span>
        )}
      </div>

      {!!faltaParaFreteGratis && faltaParaFreteGratis > 0 && (
        <p className="text-xs text-[var(--color-danger)]">
          Faltam {formatarPreco(faltaParaFreteGratis)} pra frete grátis
        </p>
      )}

      {!!descontoCupom && descontoCupom > 0 && (
        <div className="flex justify-between text-[var(--color-success)]">
          <span>Cupom de desconto</span>
          <span>-{formatarPreco(descontoCupom)}</span>
        </div>
      )}

      {!!saldoAplicado && saldoAplicado > 0 && (
        <div className="flex justify-between text-[var(--color-success)]">
          <span>Saldo aplicado</span>
          <span>-{formatarPreco(saldoAplicado)}</span>
        </div>
      )}

      <div className="mt-1 flex justify-between border-t border-black/10 pt-2 text-base font-semibold dark:border-white/10">
        <span>Total</span>
        <span>{formatarPreco(total)}</span>
      </div>
    </div>
  );
}
