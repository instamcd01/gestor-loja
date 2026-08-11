import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { estornarPagamentoOnline } from "@/lib/mercadopago";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Chamada pelo app Gestor (Flutter), não pelo site — só o app tem a tela
 * de detalhe da venda com o botão "Estornar pagamento". Autentica via
 * Bearer token da própria sessão Supabase do app (o app já usa esse
 * mesmo access_token pra tudo), não por cookie (site) nem service role
 * (não tem como saber quem é o lojista sem isso). Rota global — o
 * middleware já trata qualquer coisa em `/api/*` como global, não
 * reescreve pro namespace de nenhuma loja.
 */
export async function POST(request: NextRequest) {
  const { pedidoId } = (await request.json().catch(() => ({}))) as { pedidoId?: string };
  if (!pedidoId) {
    return NextResponse.json({ erro: "pedidoId obrigatório." }, { status: 400 });
  }

  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  const supabaseAuth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const {
    data: { user },
    error: erroAuth,
  } = await supabaseAuth.auth.getUser(token);
  if (erroAuth || !user) {
    return NextResponse.json({ erro: "Sessão inválida." }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("empresa_id, papel, ativo")
    .eq("id", user.id)
    .maybeSingle();

  // Estorno é dinheiro saindo — mesma restrição de papel já usada pra
  // outras ações sensíveis no projeto (ex: ajuste manual de saldo).
  if (!usuario?.ativo || !["dono", "gerente"].includes(usuario.papel)) {
    return NextResponse.json({ erro: "Sem permissão pra estornar pagamentos." }, { status: 403 });
  }

  const resultado = await estornarPagamentoOnline(usuario.empresa_id, pedidoId);
  if (!resultado.ok) {
    return NextResponse.json({ erro: resultado.erro }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
