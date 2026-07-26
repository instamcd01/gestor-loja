import { formatarPreco } from "@/lib/utils";

/**
 * Barra motivacional baseada no menor limite de frete grátis entre as
 * zonas ativas (mesmo valor do selo na home) — o frete de verdade só é
 * confirmado por zona depois que o endereço é calculado no checkout.
 */
export function FreteGratisProgresso({ subtotal, minimo }: { subtotal: number; minimo: number }) {
  const falta = minimo - subtotal;
  const progresso = Math.min(100, Math.round((subtotal / minimo) * 100));

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-black/5 bg-[var(--surface)] p-4 dark:border-white/10">
      <p className="text-xs font-medium">
        {falta > 0 ? (
          <>
            Faltam <span className="font-semibold text-[var(--brand-primary)]">{formatarPreco(falta)}</span>{" "}
            pra frete grátis
          </>
        ) : (
          <span className="font-semibold text-[var(--color-success)]">Frete grátis desbloqueado!</span>
        )}
      </p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-[var(--brand-primary)] transition-all"
          style={{ width: `${progresso}%` }}
        />
      </div>
    </div>
  );
}
