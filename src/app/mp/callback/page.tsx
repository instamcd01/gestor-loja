import { trocarCodigoPorToken } from "@/lib/mercadopago";

export const dynamic = "force-dynamic";

/**
 * Destino do redirect_uri do OAuth do Mercado Pago (ver
 * mercado_pago_conectar_screen.dart no app — é ele quem monta a URL de
 * autorização com `state=<empresaId>`). Não tem nenhuma UI de verdade,
 * só confirma a conexão — o lojista volta pro app manualmente depois
 * (a tela de lá reconsulta o status sozinha ao voltar pro primeiro plano).
 */
export default async function MercadoPagoCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; state?: string; error?: string }>;
}) {
  const { code, state: empresaId, error } = await searchParams;

  const resultado =
    error || !code || !empresaId
      ? { ok: false as const, erro: error ? "Conexão cancelada." : "Link inválido." }
      : await trocarCodigoPorToken(code, empresaId);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 py-24 text-center">
      {resultado.ok ? (
        <>
          <h1 className="text-xl font-semibold text-[var(--color-success)]">Conta conectada!</h1>
          <p className="text-sm text-black/50 dark:text-white/50">Pode fechar essa aba e voltar pro app.</p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold text-[var(--color-danger)]">Não foi possível conectar</h1>
          <p className="text-sm text-black/50 dark:text-white/50">{resultado.erro} Volte ao app e tente de novo.</p>
        </>
      )}
    </div>
  );
}
