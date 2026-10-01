/**
 * `ChunkLoadError` é ruído esperado de qualquer deploy do Next.js: o
 * navegador tinha a página aberta com o build anterior e, ao navegar, tenta
 * buscar um arquivo JS com hash que o build novo não serve mais. Não é bug
 * de código pra investigar — self-resolve com um reload da página. Detectar
 * e tratar à parte evita mostrar a tela de erro genérica pro cliente E
 * evita disparar alerta pro lojista por algo que ele não consegue agir
 * (ver `registrarErroSistema` em `lib/erros.ts`).
 *
 * Se falhar de novo logo depois do reload, o arquivo existe no build atual
 * (conferido 01/10: os ~10 casos desde 25/08 vieram horas depois de deploy)
 * — é a conexão do visitante ou um robô renderizando a página. Continua sem
 * alerta, mas fica registrado com navegador/conexão pra dar pra separar.
 */
const CHAVE_ULTIMO_RELOAD = "gestor-loja:chunk-reload-em";

export const TIPO_CHUNK_APOS_RELOAD = "chunk_load_apos_reload";

export function ehChunkLoadError(error: Error): boolean {
  return error.name === "ChunkLoadError" || /Failed to load chunk/i.test(error.message);
}

/**
 * Recarrega a página uma vez por janela de 10s. Retorna true se disparou o
 * reload (quem chamou não deve fazer mais nada). sessionStorage pode lançar
 * (navegador embutido, modo privado) — aí não recarrega sozinho (sem como
 * evitar loop) e a tela de erro oferece o botão de recarregar.
 */
export function recarregarPorChunkError(): boolean {
  let ultimoReload = 0;
  try {
    ultimoReload = Number(sessionStorage.getItem(CHAVE_ULTIMO_RELOAD) ?? 0);
  } catch {
    return false;
  }
  if (Date.now() - ultimoReload <= 10_000) return false;
  try {
    sessionStorage.setItem(CHAVE_ULTIMO_RELOAD, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export function contextoChunkError(): Record<string, unknown> {
  return {
    tipo: TIPO_CHUNK_APOS_RELOAD,
    userAgent: navigator.userAgent.slice(0, 300),
    online: navigator.onLine,
    conexao: (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType ?? null,
  };
}
