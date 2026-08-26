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

const PRIVATE_KEY = process.env.WHATSAPP_FLOW_PRIVATE_KEY?.replace(/\\n/g, "\n");
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
    return { version: "3.0", screen: "BUSCAR", data: { error_message: "" } };
  }

  if (payload.action === "data_exchange") {
    if (!N8N_FLOW_WEBHOOK_URL) {
      return {
        version: "3.0",
        screen: payload.screen ?? "BUSCAR",
        data: { error_message: "Serviço indisponível no momento, tenta de novo em instantes." },
      };
    }

    const resposta = await fetch(N8N_FLOW_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        screen: payload.screen,
        data: payload.data ?? {},
        flow_token: payload.flow_token,
      }),
    }).then((r) => r.json());

    return { version: "3.0", screen: resposta.screen, data: resposta.data };
  }

  return { version: "3.0", screen: payload.screen ?? "BUSCAR", data: payload.data ?? {} };
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
