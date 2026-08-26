"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Marca que o cliente abriu um link enviado por botão do WhatsApp (cta_url)
 * — a Cloud API não avisa a empresa quando esse tipo de botão é tocado, só
 * quando o link é de fato aberto no navegador é que dá pra saber. `wa_ref`
 * é o id da linha em `mensagens` que representa aquele envio específico
 * (ver tools "Enviar Link Site" e "Gerar Link Carrinho" no n8n).
 */
export function WhatsappRefBeacon() {
  const searchParams = useSearchParams();
  const waRef = searchParams.get("wa_ref");
  const jaEnviadoRef = useRef<string | null>(null);

  useEffect(() => {
    if (!waRef || jaEnviadoRef.current === waRef) return;
    jaEnviadoRef.current = waRef;

    fetch("/api/whatsapp/link-clique", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem_id: waRef }),
    }).catch(() => {
      // Só métrica — nunca deve afetar a navegação do cliente.
    });
  }, [waRef]);

  return null;
}
