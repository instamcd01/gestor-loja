import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

// Log de diagnóstico temporário (29/08) -- Flow travando em "Carregando..."
// mesmo com o endpoint validado isoladamente. Remover depois de resolvido.
async function logDebug(etapa: string, payload: unknown, erro?: string) {
  try {
    await createServiceClient()
      .from("whatsapp_flow_debug_log")
      .insert({ etapa, payload: payload as object, erro: erro ?? null });
  } catch {
    // log nunca pode derrubar a resposta real ao WhatsApp
  }
}

/**
 * Endpoint de data_exchange do WhatsApp Flow "Buscar produto" (teste ao
 * vivo). Só faz a ponte de criptografia (RSA-OAEP + AES-128-GCM, exigida
 * pela Meta) — a lógica de negócio (buscar_produto, consultar_estoque)
 * fica no n8n, reaproveitando as mesmas tools já construídas/testadas
 * pro agente conversacional. Roda aqui (não no n8n) porque o Code node
 * do n8n bloqueia `require('crypto')` neste ambiente.
 */

// Vem em base64 (não como PEM cru) pra sobreviver copy/paste no painel do
// Easypanel sem risco de barras/quebras de linha se perderem no caminho.
const PRIVATE_KEY = process.env.WHATSAPP_FLOW_PRIVATE_KEY_B64
  ? Buffer.from(process.env.WHATSAPP_FLOW_PRIVATE_KEY_B64, "base64").toString("utf-8")
  : undefined;
const N8N_FLOW_WEBHOOK_URL = process.env.N8N_WEBHOOK_WHATSAPP_FLOW_URL;

type FlowRequestBody = {
  encrypted_flow_data: string;
  encrypted_aes_key: string;
  initial_vector: string;
};

function decryptRequest(body: FlowRequestBody) {
  const encryptedAesKey = Buffer.from(body.encrypted_aes_key, "base64");
  const flowDataBuffer = Buffer.from(body.encrypted_flow_data, "base64");
  const initialVector = Buffer.from(body.initial_vector, "base64");

  const aesKey = crypto.privateDecrypt(
    {
      key: PRIVATE_KEY as string,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    encryptedAesKey,
  );

  const authTag = flowDataBuffer.subarray(flowDataBuffer.length - 16);
  const cipherText = flowDataBuffer.subarray(0, flowDataBuffer.length - 16);

  const decipher = crypto.createDecipheriv("aes-128-gcm", aesKey, initialVector);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);

  return {
    payload: JSON.parse(decrypted.toString("utf-8")) as {
      version: string;
      action: "ping" | "INIT" | "data_exchange" | "BACK";
      screen?: string;
      data?: Record<string, unknown>;
      flow_token?: string;
    },
    aesKey,
    initialVector,
  };
}

function encryptResponse(payload: unknown, aesKey: Buffer, initialVector: Buffer) {
  const flippedIv = Buffer.from(initialVector.map((byte) => byte ^ 0xff));
  const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, flippedIv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([encrypted, authTag]).toString("base64");
}

async function buscarViaN8n(screen: string, data: Record<string, unknown>, flowToken?: string) {
  if (!N8N_FLOW_WEBHOOK_URL) {
    // "FILTROS" aqui é só o sinal interno pro n8n rodar a busca (ver
    // resolverTela) -- nunca é uma tela real do flow_json, então o
    // fallback de erro sempre devolve a tela de resultados de verdade.
    return {
      version: "3.0",
      screen: screen === "FILTROS" ? "RESULTADOS_A" : screen,
      data: { error_message: "Serviço indisponível no momento, tenta de novo em instantes." },
    };
  }

  const resposta = await fetch(N8N_FLOW_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ screen, data, flow_token: flowToken }),
  }).then((r) => r.json());

  return { version: "3.0", screen: resposta.screen, data: resposta.data };
}

async function resolverTela(payload: {
  action: string;
  screen?: string;
  data?: Record<string, unknown>;
  flow_token?: string;
}) {
  if (payload.action === "ping") {
    return { data: { status: "active" } };
  }

  if (payload.action === "INIT") {
    // Esse Flow só tem telas de resultado -- sem seletor de categoria nem
    // de filtro. A tela RESULTADOS_A é a única tela de abertura permitida
    // pela Meta, então o INIT sempre roda a busca com os filtros que já
    // vieram prontos no flow_token (definidos pelo agente na conversa) e
    // devolve RESULTADOS_A com os produtos direto.
    let filtros: Record<string, unknown> = {};
    try {
      const token = payload.flow_token ? JSON.parse(payload.flow_token) : null;
      filtros = token?.filtros ?? {};
    } catch {
      filtros = {};
    }

    return buscarViaN8n("FILTROS", filtros, payload.flow_token);
  }

  if (payload.action === "data_exchange") {
    return buscarViaN8n(payload.screen ?? "RESULTADOS_A", payload.data ?? {}, payload.flow_token);
  }

  return { version: "3.0", screen: payload.screen ?? "RESULTADOS_A", data: payload.data ?? {} };
}

export async function POST(request: NextRequest) {
  await logDebug("requisicao_recebida", { headers: Object.fromEntries(request.headers) });

  if (!PRIVATE_KEY) {
    await logDebug("erro_config", null, "chave de criptografia não configurada");
    return NextResponse.json({ erro: "chave de criptografia do Flow não configurada" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as FlowRequestBody | null;
  if (!body?.encrypted_flow_data || !body?.encrypted_aes_key || !body?.initial_vector) {
    await logDebug("erro_payload_invalido", body);
    return NextResponse.json({ erro: "payload inválido" }, { status: 400 });
  }

  let decrypted;
  try {
    decrypted = decryptRequest(body);
  } catch (e) {
    await logDebug("erro_descriptografia", null, e instanceof Error ? e.message : String(e));
    // A Meta espera 421 quando a descriptografia falha (ex: chave pública
    // desatualizada do lado dela) — ela refaz o handshake sozinha.
    return new NextResponse(null, { status: 421 });
  }

  const { payload, aesKey, initialVector } = decrypted;
  await logDebug("payload_decriptografado", payload);

  let responsePayload;
  try {
    responsePayload = await resolverTela(payload);
  } catch (e) {
    await logDebug("erro_resolver_tela", payload, e instanceof Error ? e.message : String(e));
    throw e;
  }
  await logDebug("resposta_montada", responsePayload);

  const encryptedBody = encryptResponse(responsePayload, aesKey, initialVector);

  return new NextResponse(encryptedBody, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
