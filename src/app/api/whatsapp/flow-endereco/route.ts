import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { geocodificarEndereco } from "@/lib/geocoding";
import { createServiceClient } from "@/lib/supabase/service";
import type { CandidatoEndereco } from "@/lib/types";

/**
 * Endpoint de data_exchange do WhatsApp Flow "Editar endereço" — mesma
 * ponte de criptografia do Flow de busca (flow-busca/route.ts), mas a
 * lógica de negócio fica aqui mesmo (não no n8n): geocodificação usa a
 * MESMA função do formulário de endereço do site (`geocodificarEndereco`),
 * garantindo paridade real de comportamento — e evita depender de uma
 * credencial de Google Maps no n8n que hoje está restrita só à Routes API.
 */

const PRIVATE_KEY = process.env.WHATSAPP_FLOW_PRIVATE_KEY_B64
  ? Buffer.from(process.env.WHATSAPP_FLOW_PRIVATE_KEY_B64, "base64").toString("utf-8")
  : undefined;

type FlowRequestBody = {
  encrypted_flow_data: string;
  encrypted_aes_key: string;
  initial_vector: string;
};

type FlowPayload = {
  version: string;
  action: "ping" | "INIT" | "data_exchange" | "BACK";
  screen?: string;
  data?: Record<string, unknown>;
  flow_token?: string;
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
    payload: JSON.parse(decrypted.toString("utf-8")) as FlowPayload,
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

function montarTitulo(c: CandidatoEndereco): string {
  return c.formattedAddress;
}

async function resolverEndereco(data: Record<string, unknown>) {
  // Cliente já escolheu um candidato numa rodada anterior desta mesma tela
  // (RadioButtonsGroup) — o valor vem como o próprio candidato serializado,
  // não precisa geocodificar de novo.
  const candidatoEscolhido = data.candidato_escolhido as string | undefined;
  if (candidatoEscolhido) {
    try {
      const c = JSON.parse(candidatoEscolhido) as CandidatoEndereco;
      return { candidatos: [c], erro: null as string | null };
    } catch {
      // cai pro fluxo normal de busca abaixo
    }
  }

  const rua = String(data.rua ?? "").trim();
  const bairro = String(data.bairro ?? "").trim();
  const cidade = String(data.cidade ?? "").trim();
  const estado = String(data.estado ?? "").trim();
  const cep = String(data.cep ?? "").trim();

  const query = [rua, bairro, cidade, estado, cep].filter(Boolean).join(", ");
  if (!query) return { candidatos: [] as CandidatoEndereco[], erro: "Preencha ao menos a rua e a cidade." };

  const candidatos = await geocodificarEndereco(query);
  if (candidatos.length === 0) {
    return { candidatos: [] as CandidatoEndereco[], erro: "Não encontramos esse endereço. Confira os dados e tente de novo." };
  }
  return { candidatos, erro: null as string | null };
}

async function resolverTela(payload: FlowPayload) {
  if (payload.action === "ping") {
    return { data: { status: "active" } };
  }

  if (payload.action === "INIT") {
    return {
      version: "3.0",
      screen: "ENDERECO",
      data: { error_message: "", candidatos: [], mostrar_candidatos: false },
    };
  }

  if (payload.action === "data_exchange" && payload.screen === "ENDERECO") {
    const { candidatos, erro } = await resolverEndereco(payload.data ?? {});

    if (erro) {
      return { version: "3.0", screen: "ENDERECO", data: { error_message: erro, candidatos: [], mostrar_candidatos: false } };
    }

    if (candidatos.length > 1) {
      return {
        version: "3.0",
        screen: "ENDERECO",
        data: {
          error_message: "",
          mostrar_candidatos: true,
          candidatos: candidatos.slice(0, 8).map((c) => ({ id: JSON.stringify(c), title: montarTitulo(c) })),
        },
      };
    }

    const c = candidatos[0];
    return {
      version: "3.0",
      screen: "CONFIRMAR",
      data: {
        endereco_resolvido: c.formattedAddress,
        rua: c.endereco ?? "",
        bairro: c.bairro ?? "",
        cidade: c.cidade ?? "",
        estado: c.estado ?? "",
        cep: c.cep ?? "",
        lat: c.lat,
        lng: c.lng,
      },
    };
  }

  if (payload.action === "data_exchange" && payload.screen === "CONFIRMAR") {
    const d = payload.data ?? {};
    let clienteId: string | undefined;
    try {
      clienteId = payload.flow_token ? (JSON.parse(payload.flow_token).cliente_id as string) : undefined;
    } catch {
      clienteId = undefined;
    }

    if (clienteId) {
      const supabase = createServiceClient();
      await supabase
        .from("clientes")
        .update({
          endereco: d.rua ?? null,
          numero: d.numero ?? null,
          complemento: d.complemento || null,
          bairro: d.bairro ?? null,
          cidade: d.cidade ?? null,
          estado: d.estado ?? null,
          cep: d.cep ?? null,
          latitude: d.lat ?? null,
          longitude: d.lng ?? null,
        })
        .eq("id", clienteId);
    }

    return {
      version: "3.0",
      screen: "CONFIRMAR",
      data: { endereco_resolvido: "Endereço atualizado! ✓" },
    };
  }

  return { version: "3.0", screen: payload.screen ?? "ENDERECO", data: payload.data ?? {} };
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
