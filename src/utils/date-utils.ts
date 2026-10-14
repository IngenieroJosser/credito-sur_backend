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
    if (
      !map.year ||
      !map.month ||
      !map.day ||
      !map.hour ||
      !map.minute ||
      !map.second
    )
      return null;
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

/**
 * Solo la hora, en reloj de 24 horas y en Bogota: `20:30`.
 *
 * Para las columnas de 'hora' de los tableros. `toLocaleTimeString` a secas usa
 * el reloj del proceso: en el servidor, que corre en UTC, una aprobacion de las
 * 8:30 de la noche se mostraba como `01:30`.
 *
 * 24 horas y no am/pm a proposito: sin el sufijo, un `08:30` de la tarde es
 * indistinguible de uno de la manana.
 */
export function formatBogotaHora(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  const p = getBogotaPartsIntl(date);
  if (!p) return '';
  return `${p.hour}:${p.minute}`;
}

const MESES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * Fecha con el mes escrito, en Bogota: `13 de octubre de 2026`.
 *
 * Es el formato de los documentos que se imprimen —el contrato de un credito de
 * articulo, las cabeceras de las exportaciones—. Ahi estaba escrito a mano con
 * `d.getDate()` y `d.getMonth()`, o sea el reloj del proceso, y en el servidor
 * un credito firmado de noche quedaba fechado al dia siguiente.
 */
export function formatBogotaFechaLarga(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  const p = getBogotaPartsIntl(date);
  if (!p) return '';
  const mes = MESES_ES[Number(p.month) - 1];
  if (!mes) return '';
  return `${Number(p.day)} de ${mes} de ${p.year}`;
}
/**
 * Igual que `formatBogotaFecha` pero con dia y mes a DOS DIGITOS:
 * `13/10/2026`, y `01/10/2026` donde la otra daria `1/10/2026`.
 *
 * Existe para las exportaciones, donde una columna de fechas de ancho fijo se
 * lee y se ordena mejor que una de ancho variable. El respaldo en Excel tenia
 * su propia version de esto escrita a mano con `d.getDate()`, que es el reloj
 * del proceso: en el servidor, que corre en UTC, fechaba un dia DESPUES todo lo
 * registrado despues de las 7 p. m. de Bogota. No se notaba en una maquina en
 * hora de Colombia.
 */
export function formatBogotaFechaPad2(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  const p = getBogotaPartsIntl(date);
  if (!p) return '';
  return `${p.day}/${p.month}/${p.year}`;
}

/**
 * `formatBogotaFechaPad2` con la hora completa: `13/10/2026 20:00:00`.
 *
 * Lleva los segundos a proposito: es el sello de un movimiento de dinero en una
 * exportacion, y dos pagos del mismo minuto hay que poder distinguirlos.
 */
export function formatBogotaFechaHoraPad2(
  value: Date | string | number,
): string {
  const date = value instanceof Date ? value : new Date(value);
  const p = getBogotaPartsIntl(date);
  if (!p) return '';
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}
/**
 * Fecha en formato colombiano (d/m/aaaa) SIEMPRE en hora de Bogota.
 *
 * `toLocaleDateString('es-CO')` a secas usa el reloj del proceso, y en el
 * servidor ese reloj es UTC: todo lo registrado despues de las 7 p. m. de
 * Bogota ya es el dia siguiente en UTC y salia "corrido" un dia en los
 * reportes y las exportaciones.
 */
export function formatBogotaFecha(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TZ,
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(date);
}

/** Igual que `formatBogotaFecha` pero con la hora, para sellos de "generado el". */
export function formatBogotaFechaHora(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TZ,
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function getBogotaDayKey(date: Date = new Date()): string {
  const parts = getBogotaPartsIntl(date);
  if (!parts) return '';
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function parseBogotaDayKey(
  key: string,
): { year: number; month: number; day: number } | null {
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(key);
  if (!m) return null;
  const [year, month, day] = key.split('-').map((n) => Number(n));
  if (!year || !month || !day) return null;
  return { year, month, day };
}

export function getBogotaStartEndOfDay(date: Date = new Date()): {
  startDate: Date;
  endDate: Date;
} {
  const key = getBogotaDayKey(date);
  return getBogotaStartEndOfDayFromKey(key);
}

export function getBogotaStartEndOfDayFromKey(key: string): {
  startDate: Date;
  endDate: Date;
} {
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
        const startKey =
          customStart && /^\d{4}-\d{2}-\d{2}$/.test(customStart)
            ? customStart
            : getBogotaDayKey(now);
        const endKey =
          customEnd && /^\d{4}-\d{2}-\d{2}$/.test(customEnd)
            ? customEnd
            : getBogotaDayKey(now);
        const s = getBogotaStartEndOfDayFromKey(startKey);
        const e = getBogotaStartEndOfDayFromKey(endKey);
        startDate = s.startDate;
        endDate = e.endDate;
      }
      break;
    default: {
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
