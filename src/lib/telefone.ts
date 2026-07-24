/** Converte um número digitado em formato BR (com ou sem DDI) para E.164. */
export function paraE164(numeroBr: string): string {
  const digitos = numeroBr.replace(/\D/g, "");
  if (digitos.startsWith("55") && digitos.length >= 12) return `+${digitos}`;
  return `+55${digitos}`;
}

export function telefoneValido(numeroBr: string): boolean {
  const digitos = numeroBr.replace(/\D/g, "");
  return digitos.length === 10 || digitos.length === 11;
}

export function formatarTelefoneBr(numeroBr: string): string {
  const digitos = numeroBr.replace(/\D/g, "").slice(0, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}
