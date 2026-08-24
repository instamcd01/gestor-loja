import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/**
 * Card de vantagem do PetCash na página de produto — só existe (renderiza
 * algo) quando a loja tem PetCash ativo; sem isso não há nada real pra
 * anunciar, então não mostra nada em vez de um teaser vazio. Sem citar o
 * percentual, mesma decisão de tom discreto já tomada em `PetcashFaixaInfo`
 * (que substituiu um banner antigo considerado chamativo demais).
 *
 * No modelo clássico, a receita é a mesma de `SelosConfianca`/`entrar/page.tsx`
 * ("Vantagens da sua conta"): `Card` de superfície + círculo de ícone, não um
 * bloco de cor sólida — a versão anterior tinha inventado seu próprio visual
 * (borda tracejada + fundo tingido) fora desse padrão, daí destoar do resto
 * da página (que já usa `Card` no bloco de compra logo acima).
 */
export function ClubeEmBreve({ nome, moderno, petcashAtivo }: { nome: string; moderno: boolean; petcashAtivo: boolean }) {
  if (!petcashAtivo) return null;

  const titulo = "Você ganha PetCash comprando aqui";
  const subtitulo = `Um crédito que soma sozinho quando seu pedido for entregue — use em compras futuras na ${nome}.`;

  if (moderno) {
    return (
      <div className="flex items-center gap-4 rounded-[var(--radius-lg)] p-5" style={{ background: "var(--benefit-orange-bg)" }}>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/60"
          style={{ color: "var(--benefit-orange-fg)" }}
        >
          <IconePata className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold" style={{ color: "var(--benefit-orange-fg)" }}>
            {titulo}
          </p>
          <p className="text-xs" style={{ color: "var(--benefit-orange-fg-secondary)" }}>
            {subtitulo}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 border-current" style={{ color: "var(--benefit-orange-fg)" }}>
          🐾 Ativo
        </Badge>
      </div>
    );
  }

  return (
    <Card className="flex items-center gap-4 p-4 sm:p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
        <IconePata className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold">{titulo}</p>
        <p className="text-xs text-black/50 dark:text-white/50">{subtitulo}</p>
      </div>
      <Badge variant="outline" className="shrink-0">
        🐾 Ativo
      </Badge>
    </Card>
  );
}

function IconePata({ className }: { className?: string }) {
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
      <ellipse cx="12" cy="16.5" rx="5" ry="4" />
      <circle cx="5.5" cy="9.5" r="2" />
      <circle cx="10.2" cy="6" r="2" />
      <circle cx="15.3" cy="6" r="2" />
      <circle cx="18.5" cy="9.5" r="2" />
    </svg>
  );
}
