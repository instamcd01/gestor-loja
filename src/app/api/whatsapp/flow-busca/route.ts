import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

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
    return {
      version: "3.0",
      screen,
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
    // A Meta só permite abrir o Flow na tela CATEGORIA (nunca é possível
    // pedir pra ela renderizar RESULTADOS_A direto na mensagem inicial —
    // erro 131009 confirmado em produção 28/08). Quando o agente já sabe
    // categoria/espécie/etc (embutido no flow_token na hora de mandar a
    // mensagem), a gente pula a etapa CATEGORIA/FILTROS aqui dentro, no
    // exato momento em que o Flow abre — o cliente nunca vê a tela vazia.
    let filtros: Record<string, unknown> | null = null;
    try {
      const token = payload.flow_token ? JSON.parse(payload.flow_token) : null;
      filtros = token?.filtros ?? null;
    } catch {
      filtros = null;
    }

    if (filtros && Object.keys(filtros).length > 0) {
      return buscarViaN8n("FILTROS", filtros, payload.flow_token);
    }

    return { version: "3.0", screen: "CATEGORIA", data: { error_message: "" } };
  }

  if (payload.action === "data_exchange") {
    return buscarViaN8n(payload.screen ?? "CATEGORIA", payload.data ?? {}, payload.flow_token);
  }

  return { version: "3.0", screen: payload.screen ?? "CATEGORIA", data: payload.data ?? {} };
}

export async function POST(request: NextRequest) {
  if (!PRIVATE_KEY) {
    return NextResponse.json({ erro: "chave de criptografia do Flow não configurada" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as FlowRequestBody | null;
  if (!body?.encrypted_flow_data || !body?.encrypted_aes_key || !body?.initial_vector) {
    return NextResponse.json({ erro: "payload inválido" }, { status: 400 });
  }

  let decrypted;
  try {
    decrypted = decryptRequest(body);
  } catch {
    // A Meta espera 421 quando a descriptografia falha (ex: chave pública
    // desatualizada do lado dela) — ela refaz o handshake sozinha.
    return new NextResponse(null, { status: 421 });
  }

  const { payload, aesKey, initialVector } = decrypted;

  const responsePayload = await resolverTela(payload);
  const encryptedBody = encryptResponse(responsePayload, aesKey, initialVector);

  return new NextResponse(encryptedBody, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
