import { NextRequest, NextResponse } from "next/server";
import { gerarPixCopiaECola } from "@/lib/pix";

/**
 * Chamada pelo n8n (Tool - Criar Pedido do agente WhatsApp), não pelo
 * site. Reaproveita o MESMO gerador de Pix estático já usado na página
 * de confirmação do pedido (`gerarPixCopiaECola`), pra não duplicar a
 * lógica de CRC16/EMV em outra linguagem. Não exige autenticação: é uma
 * computação pura sobre dados já públicos (chave Pix e valor do pedido
 * já aparecem sem login na própria página de confirmação do site).
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    chavePix?: string;
    nomeRecebedor?: string;
    cidade?: string;
    valor?: number;
    txid?: string;
  } | null;

  if (
    !body?.chavePix ||
    !body?.nomeRecebedor ||
    !body?.cidade ||
    typeof body?.valor !== "number" ||
    !body?.txid
  ) {
    return NextResponse.json({ erro: "parâmetros inválidos" }, { status: 400 });
  }

  const copiaCola = gerarPixCopiaECola({
    chavePix: body.chavePix,
    nomeRecebedor: body.nomeRecebedor,
    cidade: body.cidade,
    valor: body.valor,
    txid: body.txid,
  });

  return NextResponse.json({ copiaCola });
}
