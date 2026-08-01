import { Badge } from "@/components/ui/badge";

/**
 * Teaser de um programa de vantagens que ainda não existe de verdade —
 * a pedido do lojista, pra ser revelado depois. Por isso não promete
 * mecânica nenhuma (sem %, sem pontos), só avisa que algo vem por aí.
 */
export function ClubeEmBreve({ nome, moderno }: { nome: string; moderno: boolean }) {
  if (moderno) {
    return (
      <div className="flex items-center gap-4 rounded-[var(--radius-lg)] p-5" style={{ background: "var(--benefit-orange-bg)" }}>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/60"
          style={{ color: "var(--benefit-orange-fg)" }}
        >
          <IconeEstrela className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold" style={{ color: "var(--benefit-orange-fg)" }}>
            Um jeito novo de economizar está chegando
          </p>
          <p className="text-xs" style={{ color: "var(--benefit-orange-fg-secondary)" }}>
            Em breve, mais vantagens pra quem compra sempre na {nome}.
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 border-current" style={{ color: "var(--benefit-orange-fg)" }}>
          Em breve
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--brand-primary)]/40 bg-[var(--brand-primary)]/5 p-4 sm:p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)]/15 text-[var(--brand-primary)]">
        <IconeEstrela className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold">Um jeito novo de economizar está chegando</p>
        <p className="text-xs text-black/50 dark:text-white/50">
          Em breve, mais vantagens pra quem compra sempre na {nome}.
        </p>
      </div>
      <Badge variant="outline" className="shrink-0">
        Em breve
      </Badge>
    </div>
  );
}

function IconeEstrela({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3.5 14.4 9l6 .6-4.5 4 1.3 5.9L12 16.6 6.8 19.5l1.3-5.9-4.5-4 6-.6Z" />
    </svg>
  );
}
