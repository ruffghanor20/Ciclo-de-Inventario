export type CurvaABC = 'A' | 'B' | 'C';

const DAY_MS = 24 * 60 * 60 * 1000;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function normalizeCurvaABC(value: unknown): CurvaABC {
  const raw = String(value ?? '').trim().toUpperCase();
  if (raw === 'A' || raw === 'B' || raw === 'C') return raw;
  return 'C';
}

export function formatDateBr(isoDate: string | null | undefined): string {
  if (!isoDate) return '-';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return '-';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

export function adjustToBusinessDay(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  const day = date.getUTCDay(); // 0 Sunday, 6 Saturday
  if (day === 6) {
    date.setUTCDate(date.getUTCDate() + 2);
  } else if (day === 0) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return toIsoDate(date);
}

export function calculateNextCountDate(contadoIsoDate: string, curva: CurvaABC): string {
  const intervalDays = curva === 'A' ? 30 : curva === 'B' ? 90 : 365;
  const targetDate = addDays(contadoIsoDate, intervalDays);
  return adjustToBusinessDay(targetDate);
}

function fromExcelSerial(value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const excelEpoch = Date.UTC(1899, 11, 30);
  const date = new Date(excelEpoch + Math.round(value) * DAY_MS);
  return toIsoDate(date);
}

export function parseDateToIso(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    return fromExcelSerial(value);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toIsoDate(value);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // yyyy-mm-dd or yyyy/mm/dd
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(raw);
  if (m) {
    const mm = String(m[2]).padStart(2, '0');
    const dd = String(m[3]).padStart(2, '0');
    return `${m[1]}-${mm}-${dd}`;
  }

  // dd/mm/yyyy or dd-mm-yyyy
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(raw);
  if (m) {
    const dd = String(m[1]).padStart(2, '0');
    const mm = String(m[2]).padStart(2, '0');
    return `${m[3]}-${mm}-${dd}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return toIsoDate(parsed);
  }

  return null;
}

export function todayIsoDate(): string {
  return toIsoDate(new Date());
}
