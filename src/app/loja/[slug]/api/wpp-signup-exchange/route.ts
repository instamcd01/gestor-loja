import "server-only";
import { NextRequest, NextResponse } from "next/server";

// Rota temporária de apoio à página /loja/[slug]/wpp-signup — troca o
// "code" do Cadastro Incorporado por um token, o que finaliza de fato a
// reconexão do número à Cloud API do lado da Meta. Precisa de
// WHATSAPP_APP_SECRET (server-only, nunca prefixado NEXT_PUBLIC_).
// Remover junto com a página de teste depois do uso.
export async function POST(req: NextRequest) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json({ error: "WHATSAPP_APP_SECRET não configurado" }, { status: 500 });
  }

  const { code, redirectUri } = await req.json();
  if (!code) {
    return NextResponse.json({ error: "code ausente" }, { status: 400 });
  }

  const url = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  url.searchParams.set("client_id", "792354710007372");
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("code", code);
  // FB.login() usa implicitamente a URL da página como redirect_uri —
  // precisa bater exatamente, senão a Meta rejeita com error_subcode 36008.
  url.searchParams.set("redirect_uri", redirectUri ?? "");

  const resposta = await fetch(url);
  const dados = await resposta.json();

  return NextResponse.json(dados, { status: resposta.status });
}
