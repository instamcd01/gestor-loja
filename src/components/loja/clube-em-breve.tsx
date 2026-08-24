import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/**
 * Card de vantagem na página de produto. Quando a loja tem PetCash ativo,
 * avisa sobre ele (sem citar o percentual — mesma decisão de tom discreto
 * já tomada em `PetcashFaixaInfo`, que substituiu um banner antigo
 * considerado chamativo demais). Sem PetCash configurado, cai no teaser
 * genérico original ("programa de vantagens" ainda sem mecânica definida),
 * pra lojas que ainda não ligaram nada.
 *
 * No modelo clássico, a receita é a mesma de `SelosConfianca`/`entrar/page.tsx`
 * ("Vantagens da sua conta"): `Card` de superfície + círculo de ícone, não um
 * bloco de cor sólida — a versão anterior tinha inventado seu próprio visual
 * (borda tracejada + fundo tingido) fora desse padrão, daí destoar do resto
 * da página (que já usa `Card` no bloco de compra logo acima).
 */
export function ClubeEmBreve({ nome, moderno, petcashAtivo }: { nome: string; moderno: boolean; petcashAtivo: boolean }) {
  const titulo = petcashAtivo ? "Você ganha PetCash comprando aqui" : "Um jeito novo de economizar está chegando";
  const subtitulo = petcashAtivo
    ? `Um crédito que soma sozinho quando seu pedido for entregue — use em compras futuras na ${nome}.`
    : `Em breve, mais vantagens pra quem compra sempre na ${nome}.`;
  const selo = petcashAtivo ? "🐾 Ativo" : "Em breve";
  const Icone = petcashAtivo ? IconePata : IconeEstrela;

  if (moderno) {
    return (
      <div className="flex items-center gap-4 rounded-[var(--radius-lg)] p-5" style={{ background: "var(--benefit-orange-bg)" }}>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/60"
          style={{ color: "var(--benefit-orange-fg)" }}
        >
          <Icone className="h-5 w-5" />
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
          {selo}
        </Badge>
      </div>
    );
  }

  return (
    <Card className="flex items-center gap-4 p-4 sm:p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
        <Icone className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold">{titulo}</p>
        <p className="text-xs text-black/50 dark:text-white/50">{subtitulo}</p>
      </div>
      <Badge variant="outline" className="shrink-0">
        {selo}
      </Badge>
    </Card>
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
