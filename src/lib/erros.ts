import "server-only";
import { createHash } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Rastreamento de erro caseiro (sem Sentry): agrupa ocorrências pelo hash de
 * mensagem+rota via RPC `registrar_erro_sistema` (upsert atômico no Postgres,
 * evita race condition entre requisições concorrentes) e só alerta na
 * primeira ocorrência de cada grupo, ou de novo depois de 1h sem repetir —
 * não um alerta por erro, que viraria spam num pico.
 *
 * O alerta é uma notificação dentro do próprio Gestor (tabela `notificacoes`,
 * mesma usada por estoque baixo/pedido parado/etc — dispara push sozinha via
 * `notificar_push_notificacao`), não mais WhatsApp: o lojista pediu pra
 * tirar do WhatsApp porque virava ruído misturado com conversa de cliente.
 */
export async function registrarErroSistema(params: {
  mensagem: string;
  rota?: string;
  stack?: string;
  contexto?: Record<string, unknown>;
}): Promise<void> {
  const rota = params.rota ?? "";
  const hash = createHash("sha256")
    .update(`${params.mensagem.slice(0, 300)}|${rota}`)
    .digest("hex");

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("registrar_erro_sistema", {
    p_hash: hash,
    p_mensagem: params.mensagem.slice(0, 2000),
    p_rota: rota || null,
    p_stack: params.stack?.slice(0, 4000) ?? null,
    p_origem: "site",
    p_contexto: params.contexto ?? null,
  });

  if (error) {
    console.error("Erro ao registrar erro do sistema:", error.message);
    return;
  }

  const linha = data?.[0] as { deve_alertar: boolean; contagem: number } | undefined;
  if (!linha?.deve_alertar) return;

  // O site é multi-tenant (`/loja/{slug}/...`) — a notificação precisa saber
  // de qual empresa pra `notificacoes.empresa_id` (RLS/push são por
  // empresa). Rotas fora de `/loja/{slug}` (webhook do Mercado Pago, etc)
  // não têm como resolver isso, então ficam só no rastreamento por hash
  // acima, sem virar notificação — não tem dono óbvio pra avisar.
  const slugMatch = rota.match(/^\/loja\/([^/]+)/);
  if (!slugMatch) return;

  const { data: empresa } = await supabase
    .from("empresas")
    .select("id")
    .eq("catalogo_slug", slugMatch[1])
    .maybeSingle();
  if (!empresa) return;

  // Campos de contexto conhecidos que valem a pena destacar pro lojista
  // agir rápido (quem é o cliente, qual pedido) — nunca confiado como
  // dado estruturado de negócio, só passado adiante como texto de apoio.
  const contexto = params.contexto ?? {};
  const clienteNome = typeof contexto.clienteNome === "string" ? contexto.clienteNome.slice(0, 200) : null;
  const pedidoId = typeof contexto.pedidoId === "string" ? contexto.pedidoId : null;

  const detalhes = [clienteNome ? `Cliente: ${clienteNome}` : null, pedidoId ? `Pedido: ${pedidoId}` : null]
    .filter(Boolean)
    .join(" · ");

  const { error: erroNotificacao } = await supabase.from("notificacoes").insert({
    empresa_id: empresa.id,
    tipo: "erro_sistema",
    titulo: "Erro no site",
    mensagem: [
      rota ? `${params.mensagem.slice(0, 200)} em ${rota}` : params.mensagem.slice(0, 200),
      linha.contagem > 1 ? `(${linha.contagem}ª ocorrência)` : null,
      detalhes || null,
    ]
      .filter(Boolean)
      .join(" — "),
  });
  if (erroNotificacao) {
    console.error("Erro ao criar notificação de erro do sistema:", erroNotificacao.message);
  }
}
