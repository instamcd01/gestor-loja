import { formatarPreco } from "@/lib/utils";

/**
 * Versão honesta do bloco "Vantagens de comprar" da Petz: só mostra o que é
 * de fato verdade pra essa empresa (frete grátis só aparece se existir zona
 * configurada com valor mínimo; não existe "3x sem juros" aqui porque não
 * há gateway de cartão — só Pix e pagamento na retirada).
 */
const paleta = {
  caminhao: { bg: "var(--benefit-blue-bg)", fg: "var(--benefit-blue-fg)" },
  loja: { bg: "var(--benefit-green-bg)", fg: "var(--benefit-green-fg)" },
  pix: { bg: "var(--benefit-orange-bg)", fg: "var(--benefit-orange-fg)" },
} as const;

export function SelosConfianca({
  freteGratisMinimo,
  metodosPagamento,
  moderno,
}: {
  freteGratisMinimo: number | null;
  metodosPagamento: string[] | null;
  moderno: boolean;
}) {
  const temPix = metodosPagamento?.includes("Pix") ?? false;

  const selos = [
    freteGratisMinimo != null && {
      titulo: `Frete grátis acima de ${formatarPreco(freteGratisMinimo)}`,
      icone: "caminhao" as const,
    },
    { titulo: "Retire na loja sem custo", icone: "loja" as const },
    temPix && { titulo: "Pagamento via Pix", icone: "pix" as const },
  ].filter((selo): selo is { titulo: string; icone: "caminhao" | "loja" | "pix" } => !!selo);

  if (selos.length === 0) return null;

  if (moderno) {
    return (
      <div className="scrollbar-none -mx-1 flex snap-x gap-3 overflow-x-auto px-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
        {selos.map((selo) => {
          const cor = paleta[selo.icone];
          return (
            <div
              key={selo.titulo}
              className="w-[78%] shrink-0 snap-start rounded-[var(--radius-lg)] p-4 sm:w-auto"
              style={{ background: cor.bg }}
            >
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/60">
                <IconeSelo tipo={selo.icone} className="h-4.5 w-4.5" style={{ color: cor.fg }} />
              </div>
              <p className="text-sm font-bold" style={{ color: cor.fg }}>
                {selo.titulo}
              </p>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="scrollbar-none -mx-1 flex snap-x gap-3 overflow-x-auto px-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
      {selos.map((selo) => (
        <div
          key={selo.titulo}
          className="flex w-[78%] shrink-0 snap-start items-center gap-3 rounded-[var(--radius-lg)] border border-black/5 bg-[var(--surface)] px-4 py-3.5 shadow-[var(--shadow-card)] sm:w-auto dark:border-white/10"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)]/10">
            <IconeSelo tipo={selo.icone} className="h-4.5 w-4.5 text-[var(--brand-primary)]" />
          </div>
          <span className="text-xs font-semibold">{selo.titulo}</span>
        </div>
      ))}
    </div>
  );
}

function IconeSelo({
  tipo,
  className,
  style,
}: {
  tipo: "caminhao" | "loja" | "pix";
  className?: string;
  style?: React.CSSProperties;
}) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    style,
  };

  switch (tipo) {
    case "caminhao":
      return (
        <svg {...props}>
          <path d="M2 8h11v9H2zM13 11h4l3 3v3h-7z" />
          <circle cx="6" cy="19" r="1.6" />
          <circle cx="16.5" cy="19" r="1.6" />
        </svg>
      );
    case "loja":
      return (
        <svg {...props}>
          <path d="M4 9.5 5 4h14l1 5.5" />
          <path d="M4 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
          <path d="M5 9.5V20h14V9.5" />
        </svg>
      );
    case "pix":
      return (
        <svg {...props}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </svg>
      );
  }
}
