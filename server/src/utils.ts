/** Minúsculas y sin acentos: "Providencia" y "providéncia" comparan igual. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export const collapseSpaces = (value: string) => value.trim().replace(/\s+/g, ' ');

export const nowIso = () => new Date().toISOString();

/** Fecha local de hoy como YYYY-MM-DD (se compara como texto con las fechas de visita). */
export function todayLocal(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
