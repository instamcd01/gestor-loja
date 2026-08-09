import { NextRequest, NextResponse } from "next/server";
import { atualizarStatusPagamento, verificarAssinaturaWebhook } from "@/lib/mercadopago";

/**
 * `notification_url` configurada em cada pagamento criado (ver
 * `cobrarPagamentoOnline` em mercadopago.ts) e/ou no painel da
 * aplicação — o Mercado Pago faz POST aqui sempre que o status de um
 * pagamento muda (aprovado, recusado, Pix confirmado depois de
 * pendente...). `data.id` e `type` vêm como query string, não no corpo.
 *
 * Responde 200 rápido mesmo pra notificações que não usamos (ex:
 * type != "payment") — devolver erro faz o Mercado Pago ficar
 * reenviando a notificação sem necessidade.
 */
export async function POST(request: NextRequest) {
  const dataId = request.nextUrl.searchParams.get("data.id");
  const tipo = request.nextUrl.searchParams.get("type");

  if (!dataId || tipo !== "payment") {
    return NextResponse.json({ ok: true });
  }

  const assinaturaValida = verificarAssinaturaWebhook(
    request.headers.get("x-signature"),
    request.headers.get("x-request-id"),
    dataId,
  );
  if (!assinaturaValida) {
    return NextResponse.json({ erro: "Assinatura inválida" }, { status: 401 });
  }

  await atualizarStatusPagamento(dataId);
  return NextResponse.json({ ok: true });
}
