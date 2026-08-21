/** Mesmo algoritmo de dígito verificador usado no banco (validar_cpf/validar_cnpj,
 * migration cadastro_unificado_pf_pj_email_senha) — validação aqui é só UX (feedback
 * na hora); o banco sempre revalida antes de gravar, nunca confia só nesta checagem. */

export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function cpfValido(valor: string): boolean {
  const digitos = apenasDigitos(valor);
  if (digitos.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digitos)) return false;

  const calcularDigito = (base: string, pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const dv1 = calcularDigito(digitos.slice(0, 9), 10);
  if (dv1 !== Number(digitos[9])) return false;
  const dv2 = calcularDigito(digitos.slice(0, 10), 11);
  if (dv2 !== Number(digitos[10])) return false;

  return true;
}

export function cnpjValido(valor: string): boolean {
  const digitos = apenasDigitos(valor);
  if (digitos.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digitos)) return false;

  const calcularDigito = (base: string, pesos: number[]): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * pesos[i];
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const dv1 = calcularDigito(digitos.slice(0, 12), pesos1);
  if (dv1 !== Number(digitos[12])) return false;
  const dv2 = calcularDigito(digitos.slice(0, 13), pesos2);
  if (dv2 !== Number(digitos[13])) return false;

  return true;
}

export function formatarCpf(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatarCnpj(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
