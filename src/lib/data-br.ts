/** DD/MM/AAAA — só digitação, sem seletor nativo (pedido explícito do
 * usuário: `<input type="date">` abre um calendário que ele não queria). */
export function formatarDataBr(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Converte DD/MM/AAAA pra AAAA-MM-DD (formato que o Postgres `date` espera),
 * validando que é uma data de calendário real (dia existe nesse mês/ano,
 * ano dentro de uma faixa razoável) — não só o formato dos dígitos. */
export function dataBrParaIso(valor: string): string | null {
  const m = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dia, mes, ano] = m;
  const d = Number(dia);
  const mo = Number(mes);
  const y = Number(ano);
  if (mo < 1 || mo > 12) return null;
  const diasNoMes = new Date(y, mo, 0).getDate();
  if (d < 1 || d > diasNoMes) return null;
  const anoAtual = new Date().getFullYear();
  if (y < 1900 || y > anoAtual) return null;
  return `${ano}-${mes}-${dia}`;
}

export function dataBrValida(valor: string): boolean {
  return valor === "" || dataBrParaIso(valor) !== null;
}
