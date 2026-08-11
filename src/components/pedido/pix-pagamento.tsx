"use client";

import { useState } from "react";

export function PixPagamento({
  qrCodeDataUrl,
  copiaECola,
  mensagemRodape = "Escaneie o QR Code ou copie o código no app do seu banco. A loja confirma o recebimento manualmente.",
}: {
  qrCodeDataUrl: string;
  copiaECola: string;
  mensagemRodape?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    await navigator.clipboard.writeText(copiaECola);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-black/5 p-4 dark:border-white/10">
      <p className="text-sm font-medium">Pague com Pix</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrCodeDataUrl} alt="QR Code Pix" className="h-48 w-48" />
      <button
        type="button"
        onClick={copiar}
        className="w-full rounded-full border border-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-[var(--brand-primary)]"
      >
        {copiado ? "Código copiado!" : "Pix Copia e Cola"}
      </button>
      <p className="text-center text-xs text-black/40 dark:text-white/40">{mensagemRodape}</p>
    </div>
  );
}
