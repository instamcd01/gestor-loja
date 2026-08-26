import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Chamada pelo beacon do site (WhatsappRefBeacon) quando a página abre com
 * ?wa_ref=<mensagem_id> — marca em `mensagens.clicado_em` que o botão
 * enviado pelo WhatsApp (cta_url) foi de fato aberto. A Cloud API não avisa
 * a empresa quando um botão desse tipo é tocado (só existe webhook pra
 * quick_reply/list_reply/flow), então esse é o único jeito de medir taxa de
 * abertura por envio. Idempotente (só grava a primeira vez) e nunca deve
 * afetar a navegação do cliente.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { mensagem_id?: string } | null;

  if (!body?.mensagem_id || !UUID_RE.test(body.mensagem_id)) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  try {
    const supabase = createServiceClient();
    await supabase
      .from("mensagens")
      .update({ clicado_em: new Date().toISOString() })
      .eq("id", body.mensagem_id)
      .is("clicado_em", null);
  } catch {
    // Só métrica — nunca deve quebrar a navegação do cliente.
  }

  return NextResponse.json({ ok: true });
}
