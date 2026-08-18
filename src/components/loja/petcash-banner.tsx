/**
 * Substitui o antigo teaser "um jeito novo de economizar está chegando"
 * (`ClubeEmBreve`) — o PetCash já existe de verdade (cashback creditado
 * automaticamente quando um pedido é entregue, gasto em compras futuras),
 * então não faz sentido continuar anunciando ele como "em breve". Só
 * aparece se a loja realmente tem PetCash ativo com um percentual
 * configurado — sem isso, `moderno`/não-moderno somem o bloco (mesmo
 * padrão do `SelosConfianca`, que também esconde selo que não se aplica).
 */
export function PetcashBanner({
  nome,
  moderno,
  petcashAtivo,
  petcashPercentual,
}: {
  nome: string;
  moderno: boolean;
  petcashAtivo: boolean;
  petcashPercentual: number | null;
}) {
  if (!petcashAtivo || !petcashPercentual) return null;

  if (moderno) {
    return (
      <div className="flex items-center gap-4 rounded-[var(--radius-lg)] p-5" style={{ background: "var(--benefit-green-bg)" }}>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/60 text-xl"
          style={{ color: "var(--benefit-green-fg)" }}
        >
          🐾
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold" style={{ color: "var(--benefit-green-fg)" }}>
            Ganhe {petcashPercentual}% de volta em PetCash
          </p>
          <p className="text-xs" style={{ color: "var(--benefit-green-fg)", opacity: 0.85 }}>
            Use como desconto nas próximas compras na {nome}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/5 p-4 sm:p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)]/15 text-xl">
        🐾
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold">Ganhe {petcashPercentual}% de volta em PetCash</p>
        <p className="text-xs text-black/50 dark:text-white/50">
          Use como desconto nas próximas compras na {nome}.
        </p>
      </div>
    </div>
  );
}
