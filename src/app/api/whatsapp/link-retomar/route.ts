import { NextRequest, NextResponse } from "next/server";

/**
 * Chamada pelo próprio LoginForm (fire-and-forget) logo depois do código
 * ser enviado — manda uma mensagem de WhatsApp com um botão que volta
 * direto pra tela de confirmação (mesmo telefone, sem reenviar código
 * novo). Sem isso, o único link que o cliente tem no WhatsApp pra voltar
 * ao site é o do catálogo, que reabre a home e força reiniciar o login
 * inteiro — loop real reportado pelo usuário. Nunca bloqueia o login se
 * falhar: é só uma conveniência de navegação, não uma etapa obrigatória.
 */
const N8N_URL = process.env.N8N_WEBHOOK_LINK_RETOMAR_URL;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { telefone?: string; slug?: string } | null;

  if (!N8N_URL || !body?.telefone || !body?.slug) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const url = new URL(`/loja/${body.slug}/entrar`, request.nextUrl.origin);
  url.searchParams.set("retomar", "1");
  url.searchParams.set("telefone", body.telefone);

  try {
    await fetch(N8N_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefone: body.telefone, url: url.toString() }),
    });
  } catch {
    // Só uma conveniência — o login continua funcionando normalmente
    // mesmo se essa mensagem extra não sair.
  }

  return NextResponse.json({ ok: true });
}
