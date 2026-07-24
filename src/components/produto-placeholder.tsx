type IconeCategoria =
  | "medico"
  | "comida"
  | "higiene"
  | "areia"
  | "conforto"
  | "brinquedo"
  | "pata";

function detectarIcone(categoria: string | null): IconeCategoria {
  const c = (categoria ?? "").toUpperCase();

  if (/FARM[ÁA]|DERMATOL|VERM[ÍI]FUG|ANTIPULG|DEDETIZ/.test(c)) return "medico";
  if (/RA[ÇC][ÃA]O|PETISCO|SACH[ÊE]/.test(c)) return "comida";
  if (/SHAMPOO|PERFUME|LIMPEZA/.test(c)) return "higiene";
  if (/AREIA/.test(c)) return "areia";
  if (/TAPETE|EDUCADOR|CAMA|COLCH[ÃA]O/.test(c)) return "conforto";
  if (/BRINQUEDO/.test(c)) return "brinquedo";
  return "pata";
}

function IconeSvg({ tipo, className }: { tipo: IconeCategoria; className?: string }) {
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
    case "medico":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
    case "comida":
      return (
        <svg {...props}>
          <path d="M4 11a8 8 0 0 0 16 0Z" />
          <path d="M4 11h16" />
          <ellipse cx="12" cy="7" rx="3" ry="1.4" />
        </svg>
      );
    case "higiene":
      return (
        <svg {...props}>
          <path d="M10 3h4l1 3.2c1.8 1.5 3 3.8 3 6.3a6 6 0 0 1-12 0c0-2.5 1.2-4.8 3-6.3Z" />
          <path d="M9 13.5h6" />
        </svg>
      );
    case "areia":
      return (
        <svg {...props}>
          <path d="M12 3v3M12 3l1.6 2.4M12 3l-1.6 2.4" />
          <path d="M6 10v3M6 10l1.4 2.1M6 10l-1.4 2.1" />
          <path d="M18 10v3M18 10l1.4 2.1M18 10l-1.4 2.1" />
          <path d="M4 20h16" />
        </svg>
      );
    case "conforto":
      return (
        <svg {...props}>
          <rect x="3.5" y="7" width="17" height="11" rx="2" />
          <path d="M3.5 11.5h17" />
        </svg>
      );
    case "brinquedo":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4c2.2 2.2 2.2 13.8 0 16M4 12c2.2-2.2 13.8-2.2 16 0" />
        </svg>
      );
    case "pata":
    default:
      return (
        <svg {...props}>
          <ellipse cx="12" cy="15.5" rx="4.5" ry="3.5" />
          <ellipse cx="6" cy="9" rx="1.8" ry="2.2" />
          <ellipse cx="10.5" cy="6" rx="1.8" ry="2.3" />
          <ellipse cx="15.5" cy="6" rx="1.8" ry="2.3" />
          <ellipse cx="18" cy="9" rx="1.8" ry="2.2" />
        </svg>
      );
  }
}

/** Placeholder pra produto sem foto — ícone por categoria em vez da
 * caixa cinza genérica "sem foto", enquanto fotos reais não chegam
 * (ver README: fotos oficiais pedidas direto aos fornecedores). */
export function ProdutoPlaceholder({ categoria }: { categoria: string | null }) {
  const icone = detectarIcone(categoria);

  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--brand-primary) 12%, transparent), color-mix(in srgb, var(--brand-secondary) 12%, transparent))",
      }}
    >
      <IconeSvg
        tipo={icone}
        className="h-1/3 w-1/3 text-[var(--brand-primary)] opacity-70"
      />
    </div>
  );
}
