import "server-only";
import { NextRequest, NextResponse } from "next/server";

// Rota temporária de apoio à página /loja/[slug]/wpp-signup — troca o
// "code" do Cadastro Incorporado por um token, o que finaliza de fato a
// reconexão do número à Cloud API do lado da Meta. Precisa de
// WHATSAPP_APP_SECRET (server-only, nunca prefixado NEXT_PUBLIC_).
// Remover junto com a página de teste depois do uso.
// Diagnóstico rápido, sem gastar um code de 30s: confirma se a env var
// está carregada e sem espaços acidentais, sem nunca expor o valor.
export async function GET() {
  const appSecret = process.env.WHATSAPP_APP_SECRET ?? "";
  return NextResponse.json({
    definida: appSecret.length > 0,
    tamanho: appSecret.length,
    temEspacoNasBordas: appSecret !== appSecret.trim(),
  });
}

export async function POST(req: NextRequest) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json({ error: "WHATSAPP_APP_SECRET não configurado" }, { status: 500 });
  }

  const { code } = await req.json();
  if (!code) {
    return NextResponse.json({ error: "code ausente" }, { status: 400 });
  }

  // Chamada mínima documentada pra code emitido via FB.login() com
  // config_id (Embedded Signup) — sem redirect_uri, é um parâmetro de
  // fluxo de popup/postMessage, não de redirect real.
  const url = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  url.searchParams.set("client_id", "792354710007372");
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("code", code);

  const resposta = await fetch(url, { cache: "no-store" });
  const dados = await resposta.json();

  return NextResponse.json(dados, { status: resposta.status });
}
