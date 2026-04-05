export type TimeFilterPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';

export interface DateRange {
  startDate: Date;
  endDate: Date;
  days: number;
}

const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

function toBogotaPseudo(date: Date) {
  // Convierte una fecha real (UTC) a una fecha "pseudo" donde los campos UTC representan hora Colombia.
  // Colombia no tiene DST actualmente, offset fijo UTC-5.
  return new Date(date.getTime() + BOGOTA_OFFSET_MS);
}

function fromBogotaPseudo(pseudo: Date) {
  return new Date(pseudo.getTime() - BOGOTA_OFFSET_MS);
}

export function getBogotaDayKey(date: Date = new Date()): string {
  const p = toBogotaPseudo(date);
  const yyyy = p.getUTCFullYear();
  const mm = String(p.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(p.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function parseBogotaDayKey(key: string): { year: number; month: number; day: number } | null {
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(key);
  if (!m) return null;
  const [year, month, day] = key.split('-').map((n) => Number(n));
  if (!year || !month || !day) return null;
  return { year, month, day };
}

export function getBogotaStartEndOfDay(date: Date = new Date()): { startDate: Date; endDate: Date } {
  const p = toBogotaPseudo(date);

  const startPseudo = new Date(p);
  startPseudo.setUTCHours(0, 0, 0, 0);

  const endPseudo = new Date(p);
  endPseudo.setUTCHours(23, 59, 59, 999);

  return {
    startDate: fromBogotaPseudo(startPseudo),
    endDate: fromBogotaPseudo(endPseudo),
  };
}

export function getBogotaStartEndOfDayFromKey(key: string): { startDate: Date; endDate: Date } {
  const parsed = parseBogotaDayKey(key);
  if (!parsed) {
    return getBogotaStartEndOfDay(new Date());
  }
  const { year, month, day } = parsed;
  const startPseudo = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const endPseudo = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  return {
    startDate: fromBogotaPseudo(startPseudo),
    endDate: fromBogotaPseudo(endPseudo),
  };
}

export function getBogotaStartEndOfDayUTC(date: Date = new Date()): { startDate: Date; endDate: Date } {
  const p = toBogotaPseudo(date);
  return {
    startDate: new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate(), 0, 0, 0, 0)),
    endDate: new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate(), 23, 59, 59, 999))
  };
}

export function calculateDateRange(
  period: TimeFilterPeriod,
  customStart?: string,
  customEnd?: string,
): DateRange {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  switch (period) {
    case 'today':
      ({ startDate, endDate } = getBogotaStartEndOfDay(now));
      break;
    case 'week':
      {
        const p = toBogotaPseudo(now);
        const startPseudo = new Date(p);
        startPseudo.setUTCDate(p.getUTCDate() - p.getUTCDay());
        startPseudo.setUTCHours(0, 0, 0, 0);
        const endPseudo = new Date(startPseudo);
        endPseudo.setUTCDate(startPseudo.getUTCDate() + 6);
        endPseudo.setUTCHours(23, 59, 59, 999);
        startDate = fromBogotaPseudo(startPseudo);
        endDate = fromBogotaPseudo(endPseudo);
      }
      break;
    case 'month':
      {
        const p = toBogotaPseudo(now);
        const startPseudo = new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), 1, 0, 0, 0, 0));
        const endPseudo = new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth() + 1, 0, 23, 59, 59, 999));
        startDate = fromBogotaPseudo(startPseudo);
        endDate = fromBogotaPseudo(endPseudo);
      }
      break;
    case 'year':
      {
        const p = toBogotaPseudo(now);
        const startPseudo = new Date(Date.UTC(p.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
        const endPseudo = new Date(Date.UTC(p.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
        startDate = fromBogotaPseudo(startPseudo);
        endDate = fromBogotaPseudo(endPseudo);
      }
      break;
    case 'custom':
      {
        const startKey = customStart && /^\d{4}-\d{2}-\d{2}$/.test(customStart) ? customStart : getBogotaDayKey(now);
        const endKey = customEnd && /^\d{4}-\d{2}-\d{2}$/.test(customEnd) ? customEnd : getBogotaDayKey(now);
        const s = getBogotaStartEndOfDayFromKey(startKey);
        const e = getBogotaStartEndOfDayFromKey(endKey);
        startDate = s.startDate;
        endDate = e.endDate;
      }
      break;
    default:
      {
        const p = toBogotaPseudo(now);
        const startPseudo = new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), 1, 0, 0, 0, 0));
        const endPseudo = new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth() + 1, 0, 23, 59, 59, 999));
        startDate = fromBogotaPseudo(startPseudo);
        endDate = fromBogotaPseudo(endPseudo);
      }
  }

  // Asegurar que las fechas sean válidas
  if (isNaN(startDate.getTime())) startDate = new Date();
  if (isNaN(endDate.getTime())) endDate = new Date();

  // Calcular diferencia en días
  const timeDiff = endDate.getTime() - startDate.getTime();
  const days = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

  return { startDate, endDate, days };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    minimumFractionDigits: 0,
  }).format(amount);
}