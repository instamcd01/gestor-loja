import { formatarPreco } from "@/lib/utils";

/**
 * Versão honesta do bloco "Vantagens de comprar" da Petz: só mostra o que é
 * de fato verdade pra essa empresa (frete grátis só aparece se existir zona
 * configurada com valor mínimo; não existe "3x sem juros" aqui porque não
 * há gateway de cartão — só Pix e pagamento na retirada).
 */
export function SelosConfianca({
  freteGratisMinimo,
  metodosPagamento,
}: {
  freteGratisMinimo: number | null;
  metodosPagamento: string[] | null;
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

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {selos.map((selo) => (
        <div
          key={selo.titulo}
          className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-black/5 bg-[var(--surface)] px-4 py-3.5 shadow-[var(--shadow-card)] dark:border-white/10"
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

function IconeSelo({ tipo, className }: { tipo: "caminhao" | "loja" | "pix"; className?: string }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
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
