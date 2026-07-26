const props = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconePagamento({ metodo, className }: { metodo: string; className?: string }) {
  if (metodo === "Pix") {
    return (
      <svg {...props} className={className}>
        <rect x="4" y="4" width="7" height="7" rx="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  if (metodo === "Dinheiro") {
    return (
      <svg {...props} className={className}>
        <rect x="2.5" y="6" width="19" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.6" />
        <path d="M6 9v.01M18 15v.01" />
      </svg>
    );
  }
  if (metodo.startsWith("Cartão")) {
    return (
      <svg {...props} className={className}>
        <rect x="2.5" y="5" width="19" height="14" rx="2" />
        <path d="M2.5 10h19" />
        <path d="M6 14.5h4" />
      </svg>
    );
  }
  return (
    <svg {...props} className={className}>
      <path d="M3 7h18v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18Z" />
      <path d="M3 7 12 3l9 4" />
    </svg>
  );
}
