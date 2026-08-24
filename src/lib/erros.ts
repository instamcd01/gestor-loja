import "server-only";
import { createHash } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Rastreamento de erro caseiro (sem Sentry): agrupa ocorrências pelo hash de
 * mensagem+rota via RPC `registrar_erro_sistema` (upsert atômico no Postgres,
 * evita race condition entre requisições concorrentes) e só dispara alerta
 * de WhatsApp (via webhook do n8n, que segura a credencial da API — nunca
 * exposta aqui) na primeira ocorrência de cada grupo, ou de novo depois de
 * 1h sem repetir — não um WhatsApp por erro, que viraria spam num pico.
 */
export async function registrarErroSistema(params: {
  mensagem: string;
  rota?: string;
  stack?: string;
  contexto?: Record<string, unknown>;
}): Promise<void> {
  const rota = params.rota ?? "";
  const hash = createHash("sha256")
    .update(`${params.mensagem.slice(0, 300)}|${rota}`)
    .digest("hex");

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("registrar_erro_sistema", {
    p_hash: hash,
    p_mensagem: params.mensagem.slice(0, 2000),
    p_rota: rota || null,
    p_stack: params.stack?.slice(0, 4000) ?? null,
    p_origem: "site",
    p_contexto: params.contexto ?? null,
  });

  if (error) {
    console.error("Erro ao registrar erro do sistema:", error.message);
    return;
  }

  const linha = data?.[0] as { deve_alertar: boolean; contagem: number } | undefined;
  if (!linha?.deve_alertar) return;

  const webhookUrl = process.env.N8N_WEBHOOK_ERRO_SISTEMA_URL;
  if (!webhookUrl) return;

  // Fire-and-forget: nunca deixa o alerta atrasar/derrubar o fluxo que
  // originou o erro (já está quebrado, não pode depender de mais uma rede).
  fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mensagem: rota ? `${params.mensagem.slice(0, 200)} em ${rota}` : params.mensagem.slice(0, 200),
      contagem: linha.contagem,
    }),
  }).catch((e) => console.error("Falha ao notificar erro via n8n:", e));
}
