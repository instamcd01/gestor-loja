/**
 * Gera o payload Pix "copia e cola" (BR Code, padrão EMV do Banco
 * Central) — string TLV (id + tamanho + valor) terminada em CRC16.
 * Sem gateway/API nenhuma: é um padrão público, o QR/código só
 * carrega os dados de recebimento, quem confirma o pagamento
 * continua sendo o lojista (mesma coisa que já acontece hoje na
 * venda presencial do Gestor, só que lá só mostra a chave crua).
 *
 * Referência: Manual do BR Code (Banco Central) + validado contra o
 * vetor de teste padrão do CRC-16/CCITT-FALSE ("123456789" -> 0x29B1)
 * antes de usar em produção.
 */

function campo(id: string, valor: string): string {
  return `${id}${valor.length.toString().padStart(2, "0")}${valor}`;
}

function sanitizarTexto(texto: string, tamanhoMax: number): string {
  const semAcento = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "");
  return (semAcento.trim() || "LOJA").slice(0, tamanhoMax);
}

function sanitizarTxid(texto: string): string {
  const limpo = texto.replace(/[^A-Za-z0-9]/g, "");
  return (limpo || "PEDIDO").slice(0, 25);
}

function crc16CcittFalse(texto: string): string {
  let crc = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function gerarPixCopiaECola(params: {
  chavePix: string;
  nomeRecebedor: string;
  cidade: string;
  valor: number;
  txid: string;
}): string {
  const merchantAccountInfo = campo("00", "BR.GOV.BCB.PIX") + campo("01", params.chavePix);

  const semCrc =
    campo("00", "01") +
    campo("01", "11") + // método de iniciação: 11 = estático (reutilizável)
    campo("26", merchantAccountInfo) +
    campo("52", "0000") +
    campo("53", "986") + // BRL, ISO 4217
    campo("54", params.valor.toFixed(2)) +
    campo("58", "BR") +
    campo("59", sanitizarTexto(params.nomeRecebedor, 25)) +
    campo("60", sanitizarTexto(params.cidade, 15)) +
    campo("62", campo("05", sanitizarTxid(params.txid))) +
    "6304";

  return semCrc + crc16CcittFalse(semCrc);
}
