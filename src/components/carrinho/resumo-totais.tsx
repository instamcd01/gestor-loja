import { formatarData, formatarPreco } from "@/lib/utils";

/**
 * Bloco de totais único, reaproveitado na gaveta, carrinho de visitante,
 * checkout (etapas de entrega e pagamento) e confirmação de pedido — antes
 * cada tela tinha seu próprio bloco copiado/adaptado, e isso deixava fácil
 * corrigir um rótulo/valor num lugar e esquecer os outros (foi exatamente
 * o que aconteceu com o frete: corrigido no checkout, mas a gaveta e o
 * carrinho de visitante continuaram somando só os produtos). Mesma ordem e
 * rótulos do resumo de venda do app Gestor (carrinho_screen.dart: Subtotal
 * → Entrega → aviso de frete grátis → Total), pra manter o mesmo padrão
 * nos dois.
 *
 * Os campos novos (quantidadeItens, enderecoLabel, prazoEntregaLabel,
 * taxaServicoValor, descontoProdutos) são todos opcionais de propósito —
 * a etapa de entrega do checkout usa uma versão parcial (sem cupom/taxa,
 * que só existem depois de chegar na etapa de pagamento), e telas mais
 * simples (gaveta, confirmação de pedido) continuam passando só o básico.
 */
export function ResumoTotais({
  subtotal,
  quantidadeItens,
  enderecoLabel,
  prazoEntregaLabel,
  entregaLabel,
  entregaValor,
  entregaValorOriginal,
  faltaParaFreteGratis,
  taxaServicoValor,
  descontoCupom,
  descontoProdutos,
  saldoAplicado,
  petcashAplicado,
  petcashPrevisto,
  petcashRecebido,
  petcashValidadeEm,
  total,
}: {
  subtotal: number;
  /** Soma das quantidades dos itens — só exibida quando informada. */
  quantidadeItens?: number;
  /** Endereço formatado (ver formatarEnderecoCompleto) — só exibido quando a entrega é por endereço. */
  enderecoLabel?: string | null;
  /** Texto já pronto pro prazo, ex: "Chega em 20–35 min" / "Pronto em até 30 min". */
  prazoEntregaLabel?: string | null;
  /** Rótulo da linha de entrega — "Retirada na loja", "Entrega", "Entrega (Zona Sul)", etc. */
  entregaLabel: string;
  /** null = ainda não sabemos (endereço não informado); 0 = grátis; N = valor a cobrar. */
  entregaValor: number | null;
  /** Quanto a entrega custaria sem o frete grátis — usado pra linha "Frete grátis" no bloco de descontos, só quando entregaValor é 0 e esse valor é conhecido e > 0. */
  entregaValorOriginal?: number | null;
  /** Só exibido quando > 0 — mesma regra do app, não mostra nada se não houver mínimo configurado. */
  faltaParaFreteGratis?: number | null;
  /** null/0 = loja não cobra taxa de serviço, linha não aparece. */
  taxaServicoValor?: number | null;
  descontoCupom?: number;
  /** Soma de (preço de catálogo − preço promocional) × quantidade dos itens que estão em promoção. */
  descontoProdutos?: number;
  saldoAplicado?: number;
  /** Quanto de PetCash foi usado como pagamento nesse pedido — some do total, mesma linha visual do saldo. */
  petcashAplicado?: number;
  /** Prévia informativa (não afeta o total) de quanto o pedido vai gerar em PetCash quando entregue — só exibida quando a loja tem PetCash ativo. */
  petcashPrevisto?: number;
  /** Crédito de PetCash já concedido de verdade (pedido entregue) — substitui a prévia. */
  petcashRecebido?: number;
  /** Data de expiração do crédito acima (ISO) — só faz sentido junto de petcashRecebido. */
  petcashValidadeEm?: string | null;
  total: number;
}) {
  const freteGratisComoDesconto = entregaValor === 0 && !!entregaValorOriginal && entregaValorOriginal > 0;
  // Saldo aplicado é crédito do próprio cliente sendo usado como
  // pagamento, não uma vantagem dada pela loja — por isso não entra na
  // soma de "você economizou" (efeito iFood: mostrar como se o cliente
  // estivesse levando vantagem), só cupom, desconto de produto e o frete
  // que teria sido cobrado.
  const totalEconomizado =
    (freteGratisComoDesconto ? entregaValorOriginal! : 0) + (descontoCupom ?? 0) + (descontoProdutos ?? 0);

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <div className="flex justify-between">
        <span className="text-black/50 dark:text-white/50">Subtotal</span>
        <span>{formatarPreco(subtotal)}</span>
      </div>

      {quantidadeItens != null && (
        <div className="flex justify-between">
          <span className="text-black/50 dark:text-white/50">Quantidade de itens</span>
          <span>{quantidadeItens}</span>
        </div>
      )}

      {enderecoLabel && (
        <div className="flex justify-between gap-2">
          <span className="shrink-0 text-black/50 dark:text-white/50">Endereço</span>
          <span className="truncate text-right">{enderecoLabel}</span>
        </div>
      )}

      {prazoEntregaLabel && (
        <div className="flex justify-between">
          <span className="text-black/50 dark:text-white/50">Prazo</span>
          <span>{prazoEntregaLabel}</span>
        </div>
      )}

      <div className="flex justify-between">
        <span className="text-black/50 dark:text-white/50">{entregaLabel}</span>
        {entregaValor == null ? (
          <span>—</span>
        ) : entregaValor === 0 ? (
          <span className="font-medium text-[var(--color-success)]">Grátis</span>
        ) : (
          <span>{formatarPreco(entregaValor)}</span>
        )}
      </div>

      {!!faltaParaFreteGratis && faltaParaFreteGratis > 0 && (
        <p className="text-xs text-[var(--color-danger)]">
          Faltam {formatarPreco(faltaParaFreteGratis)} pra frete grátis
        </p>
      )}

      {!!taxaServicoValor && taxaServicoValor > 0 && (
        <div className="flex justify-between">
          <span className="text-black/50 dark:text-white/50">Taxa de serviço</span>
          <span>{formatarPreco(taxaServicoValor)}</span>
        </div>
      )}

      {(freteGratisComoDesconto || (!!descontoCupom && descontoCupom > 0) || (!!descontoProdutos && descontoProdutos > 0)) && (
        <div className="flex flex-col gap-1 border-t border-black/10 pt-1.5 dark:border-white/10">
          <p className="text-xs font-medium text-black/50 dark:text-white/50">Descontos</p>
          {freteGratisComoDesconto && (
            <div className="flex justify-between text-[var(--color-success)]">
              <span>Valor da entrega</span>
              <span>-{formatarPreco(entregaValorOriginal!)}</span>
            </div>
          )}
          {!!descontoProdutos && descontoProdutos > 0 && (
            <div className="flex justify-between text-[var(--color-success)]">
              <span>Desconto nos produtos</span>
              <span>-{formatarPreco(descontoProdutos)}</span>
            </div>
          )}
          {!!descontoCupom && descontoCupom > 0 && (
            <div className="flex justify-between text-[var(--color-success)]">
              <span>Cupom de desconto</span>
              <span>-{formatarPreco(descontoCupom)}</span>
            </div>
          )}
          {totalEconomizado > 0 && (
            <div className="mt-0.5 flex justify-between border-t border-black/10 pt-1 font-semibold text-[var(--color-success)] dark:border-white/10">
              <span>Você economizou</span>
              <span>{formatarPreco(totalEconomizado)}</span>
            </div>
          )}
        </div>
      )}

      {!!saldoAplicado && saldoAplicado > 0 && (
        <div className="flex justify-between text-[var(--color-success)]">
          <span>Saldo aplicado</span>
          <span>-{formatarPreco(saldoAplicado)}</span>
        </div>
      )}

      {!!petcashAplicado && petcashAplicado > 0 && (
        <div className="flex justify-between text-[var(--color-success)]">
          <span>🐾 PetCash aplicado</span>
          <span>-{formatarPreco(petcashAplicado)}</span>
        </div>
      )}

      <div className="mt-1 flex justify-between border-t border-black/10 pt-2 text-base font-semibold dark:border-white/10">
        <span>Total</span>
        <span>{formatarPreco(total)}</span>
      </div>

      {!!petcashRecebido && petcashRecebido > 0 ? (
        <p className="mt-0.5 text-xs font-medium text-[var(--color-success)]">
          🐾 Você ganhou {formatarPreco(petcashRecebido)} em PetCash
          {petcashValidadeEm ? ` — válido até ${formatarData(petcashValidadeEm)}` : ""}
        </p>
      ) : (
        !!petcashPrevisto &&
        petcashPrevisto > 0 && (
          <p className="mt-0.5 text-xs font-medium text-[var(--brand-primary)]">
            🐾 Você vai ganhar {formatarPreco(petcashPrevisto)} em PetCash quando esse pedido for entregue
          </p>
        )
      )}
    </div>
  );
}
