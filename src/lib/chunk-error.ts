/**
 * `ChunkLoadError` é ruído esperado de qualquer deploy do Next.js: o
 * navegador tinha a página aberta com o build anterior e, ao navegar, tenta
 * buscar um arquivo JS com hash que o build novo não serve mais. Não é bug
 * de código pra investigar — self-resolve com um reload da página. Detectar
 * e tratar à parte evita mostrar a tela de erro genérica pro cliente E
 * evita disparar alerta de WhatsApp pro lojista por algo que ele não
 * consegue agir (ver `registrarErroSistema` em `lib/erros.ts`).
 */
export function ehChunkLoadError(error: Error): boolean {
  return error.name === "ChunkLoadError" || /Failed to load chunk/i.test(error.message);
}
