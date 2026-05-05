export type TimeFilterPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';

export interface DateRange {
  startDate: Date;
  endDate: Date;
  days: number;
}

const BOGOTA_TZ = 'America/Bogota';

type BogotaParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

const getBogotaPartsIntl = (date: Date): BogotaParts | null => {
  try {
    if (isNaN(date.getTime())) return null;
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: BOGOTA_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const map: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== 'literal') map[p.type] = p.value;
    }
    if (!map.year || !map.month || !map.day || !map.hour || !map.minute || !map.second) return null;
    return {
      year: map.year,
      month: map.month,
      day: map.day,
      hour: map.hour,
      minute: map.minute,
      second: map.second,
    };
  } catch {
    return null;
  }
};

const pad2 = (n: number) => String(n).padStart(2, '0');

export function getBogotaWeekday(date: Date = new Date()): number {
  // 0=Domingo ... 6=Sábado
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: BOGOTA_TZ,
    weekday: 'short',
  });
  const w = fmt.format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[w] ?? 0;
}

const buildDateFromBogotaKey = (key: string, time: string): Date => {
  // La fecha resultante es un instante real (UTC) correspondiente a la hora Bogotá indicada.
  return new Date(`${key}T${time}-05:00`);
};

const shiftBogotaDayKey = (key: string, days: number): string => {
  const base = buildDateFromBogotaKey(key, '12:00:00.000');
  if (isNaN(base.getTime())) return '';
  const shifted = new Date(base.getTime() + days * 86_400_000);
  return getBogotaDayKey(shifted);
};

const getLastDayOfMonthKey = (year: number, month1to12: number): string => {
  const nextMonth = month1to12 === 12 ? 1 : month1to12 + 1;
  const nextYear = month1to12 === 12 ? year + 1 : year;
  const firstNextKey = `${nextYear}-${pad2(nextMonth)}-01`;
  const firstNextNoon = buildDateFromBogotaKey(firstNextKey, '12:00:00.000');
  const lastNoon = new Date(firstNextNoon.getTime() - 86_400_000);
  return getBogotaDayKey(lastNoon);
};

export function formatBogotaOffsetIso(date: Date): string {
  const p = getBogotaPartsIntl(date);
  if (!p) return '';
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.000-05:00`;
}

export function formatBogotaDateTimeLocalInput(date: Date): string {
  const p = getBogotaPartsIntl(date);
  if (!p) return '';
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function getBogotaDayKey(date: Date = new Date()): string {
  const parts = getBogotaPartsIntl(date);
  if (!parts) return '';
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function parseBogotaDayKey(key: string): { year: number; month: number; day: number } | null {
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(key);
  if (!m) return null;
  const [year, month, day] = key.split('-').map((n) => Number(n));
  if (!year || !month || !day) return null;
  return { year, month, day };
}

export function getBogotaStartEndOfDay(date: Date = new Date()): { startDate: Date; endDate: Date } {
  const key = getBogotaDayKey(date);
  return getBogotaStartEndOfDayFromKey(key);
}

export function getBogotaStartEndOfDayFromKey(key: string): { startDate: Date; endDate: Date } {
  const parsed = parseBogotaDayKey(key);
  if (!parsed) {
    return getBogotaStartEndOfDay(new Date());
  }
  return {
    startDate: buildDateFromBogotaKey(key, '00:00:00.000'),
    endDate: buildDateFromBogotaKey(key, '23:59:59.999'),
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
        const nowKey = getBogotaDayKey(now);
        const weekday = getBogotaWeekday(now); // 0=dom
        const startKey = shiftBogotaDayKey(nowKey, -weekday);
        const endKey = shiftBogotaDayKey(startKey, 6);
        startDate = getBogotaStartEndOfDayFromKey(startKey).startDate;
        endDate = getBogotaStartEndOfDayFromKey(endKey).endDate;
      }
      break;
    case 'month':
      {
        const parts = getBogotaPartsIntl(now);
        const y = Number(parts?.year || 0);
        const m = Number(parts?.month || 0);
        const startKey = `${y}-${pad2(m)}-01`;
        const endKey = getLastDayOfMonthKey(y, m);
        startDate = getBogotaStartEndOfDayFromKey(startKey).startDate;
        endDate = getBogotaStartEndOfDayFromKey(endKey).endDate;
      }
      break;
    case 'year':
      {
        const parts = getBogotaPartsIntl(now);
        const y = Number(parts?.year || 0);
        const startKey = `${y}-01-01`;
        const endKey = `${y}-12-31`;
        startDate = getBogotaStartEndOfDayFromKey(startKey).startDate;
        endDate = getBogotaStartEndOfDayFromKey(endKey).endDate;
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
        const parts = getBogotaPartsIntl(now);
        const y = Number(parts?.year || 0);
        const m = Number(parts?.month || 0);
        const startKey = `${y}-${pad2(m)}-01`;
        const endKey = getLastDayOfMonthKey(y, m);
        startDate = getBogotaStartEndOfDayFromKey(startKey).startDate;
        endDate = getBogotaStartEndOfDayFromKey(endKey).endDate;
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