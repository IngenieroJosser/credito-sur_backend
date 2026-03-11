export type TimeFilterPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';

export interface DateRange {
  startDate: Date;
  endDate: Date;
  days: number;
}

export function calculateDateRange(
  period: TimeFilterPeriod,
  customStart?: string,
  customEnd?: string,
): DateRange {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = new Date();

  switch (period) {
    case 'today':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      endDate = new Date(now.setHours(23, 59, 59, 999));
      break;
    case 'week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setDate(now.getDate() + (6 - now.getDay()));
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    case 'custom':
      startDate = customStart ? new Date(customStart) : new Date(now.setHours(0, 0, 0, 0));
      endDate = customEnd ? new Date(customEnd) : new Date();
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
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