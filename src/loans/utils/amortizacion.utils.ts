/**
 * Utilidades de amortización para créditos — Créditos del Sur
 * Extraídas de loans.service.ts como funciones puras reutilizables.
 */
import { FrecuenciaPago } from '@prisma/client';
import { getBogotaDayKey, getBogotaWeekday } from '../../utils/date-utils';

// ── Tipos ──────────────────────────────────────────────────────────────────────

export interface FilaAmortizacion {
  numeroCuota: number;
  montoCapital: number;
  montoInteres: number;
  monto: number;
  saldoRestante: number;
}

export interface ResultadoAmortizacion {
  cuotaFija: number;
  interesTotal: number;
  tabla: FilaAmortizacion[];
}

// ── Helpers internos ───────────────────────────────────────────────────────────

/**
 * Convierte la tasa mensual (%) a tasa por período de forma compuesta:
 * i_periodo = (1 + i_mensual)^(fracción_mes) - 1
 */
export function tasaPorPeriodo(
  tasaMensualPct: number,
  frecuencia: FrecuenciaPago,
): number {
  const tasaMensual = tasaMensualPct / 100;
  let fraccionMes: number;
  switch (frecuencia) {
    case FrecuenciaPago.DIARIO:
      fraccionMes = 1 / 30;
      break;
    case FrecuenciaPago.SEMANAL:
      fraccionMes = 1 / 4;
      break;
    case FrecuenciaPago.QUINCENAL:
      fraccionMes = 1 / 2;
      break;
    case FrecuenciaPago.MENSUAL:
    default:
      fraccionMes = 1;
      break;
  }
  return Math.pow(1 + tasaMensual, fraccionMes) - 1;
}

// ── Amortización (cuota fija) ─────────────────────────────────────────

/**
 * Genera tabla de cuotas con interés plano.
 *
 * NOTA: En CrediSur, este método conserva el nombre histórico de "francesa",
 * pero por decisión de negocio calcula interés plano:
 * total = capital + interés total
 * cuota = total / cantidadCuotas
 */
export function calcularAmortizacionFrancesa(
  capital: number,
  tasaTotal: number, // tasaPct
  numCuotas: number,
  _plazoMeses: number,
  _frecuencia: FrecuenciaPago,
): ResultadoAmortizacion {
  if (numCuotas <= 0 || capital <= 0) {
    return { cuotaFija: 0, interesTotal: 0, tabla: [] };
  }

  const tasaPlana = tasaTotal / 100;
  const interesTotal = Math.round(capital * tasaPlana);
  const totalFinanciado = capital + interesTotal;

  const cuotaBase = Math.floor(totalFinanciado / numCuotas);

  let saldo = totalFinanciado;
  const tabla: FilaAmortizacion[] = [];

  for (let i = 0; i < numCuotas; i++) {
    const esUltima = i === numCuotas - 1;
    const monto = esUltima ? saldo : cuotaBase;

    saldo = Math.max(0, saldo - monto);

    tabla.push({
      numeroCuota: i + 1,
      montoCapital: 0, // No aplica desglose tradicional
      montoInteres: 0, // No aplica desglose tradicional
      monto,
      saldoRestante: saldo,
    });
  }

  return {
    cuotaFija: cuotaBase,
    interesTotal,
    tabla,
  };
}

// ── Interés Simple (cuota fija = capital/n + interés sobre capital total) ──────

/**
 * Genera tabla de amortización por interés simple.
 * Cuota = capital/n + (capital × tasa%)
 */
export function calcularInteresSimple(
  capital: number,
  tasaMensualPct: number,
  numCuotas: number,
  frecuencia: FrecuenciaPago,
): ResultadoAmortizacion {
  if (numCuotas <= 0 || capital <= 0) {
    return { cuotaFija: 0, interesTotal: 0, tabla: [] };
  }

  const tasaPeriodo = tasaPorPeriodo(tasaMensualPct, frecuencia);
  const interesTotal = Math.round(capital * tasaPeriodo * numCuotas);

  const baseCapital = Math.floor(capital / numCuotas);
  const baseInteres = Math.floor(interesTotal / numCuotas);
  const cuotaFija = baseCapital + baseInteres;

  let saldo = capital;
  const tabla: FilaAmortizacion[] = [];

  for (let i = 0; i < numCuotas; i++) {
    const esUltima = i === numCuotas - 1;

    const montoCapital = esUltima ? saldo : baseCapital;
    const montoInteres = esUltima
      ? interesTotal - baseInteres * (numCuotas - 1)
      : baseInteres;

    saldo = Math.max(0, saldo - montoCapital);

    tabla.push({
      numeroCuota: i + 1,
      montoCapital,
      montoInteres,
      monto: montoCapital + montoInteres,
      saldoRestante: saldo,
    });
  }

  return {
    cuotaFija,
    interesTotal,
    tabla,
  };
}

// ── Fecha de vencimiento por cuota ─────────────────────────────────────────────
//
// Estas dos funciones vivian como metodos privados de LoansService, y este
// archivo tenia ademas una tercera version que no saltaba domingos ni manejaba la
// zona de Bogota, que nadie importaba. approvals.service.ts tenia una cuarta,
// declarada "duplicada brevemente aqui para el tx". Con cuatro copias, un credito
// recibia fechas distintas segun por donde pasara. Ahora hay una sola y las dos
// rutas (crear el prestamo y aprobarlo con cambios) llaman a esta.

/**
 * Avanza la fecha al siguiente día hábil si cae en domingo.
 * Para pagos DIARIO: si cae en domingo, se mueve al lunes siguiente.
 * Para SEMANAL/QUINCENAL: si cae en domingo, se mueve al sábado anterior.
 * Para MENSUAL: si cae en domingo, se mueve al lunes siguiente.
 */
export function saltarDomingo(fecha: Date, frecuencia: FrecuenciaPago): Date {
  // 0 = Domingo (en Bogotá)
  if (getBogotaWeekday(fecha) !== 0) return fecha;

  const key = getBogotaDayKey(fecha);
  if (!key) return fecha;

  const shiftDays = (days: number) =>
    new Date(`${key}T12:00:00-05:00`).getTime() + days * 86_400_000;

  // Para diario/mensual: mover al lunes (siguiente día hábil)
  if (
    frecuencia === FrecuenciaPago.DIARIO ||
    frecuencia === FrecuenciaPago.MENSUAL
  ) {
    return new Date(shiftDays(1));
  }

  // Para semanal/quincenal: mover al sábado (día hábil anterior)
  return new Date(shiftDays(-1));
}

export function calcularFechaVencimiento(
  fechaBase: Date,
  numeroCuota: number,
  frecuencia: FrecuenciaPago,
): Date {
  const baseKey = getBogotaDayKey(fechaBase);
  if (!baseKey) return fechaBase;

  const offset = Math.max(0, numeroCuota - 1);

  const toNoonBogota = (key: string) => new Date(`${key}T12:00:00-05:00`);

  const addDaysSkippingSunday = (
    startKey: string,
    daysToAdd: number,
  ): string => {
    let key = startKey;
    let added = 0;
    while (added < daysToAdd) {
      const next = new Date(toNoonBogota(key).getTime() + 86_400_000);
      const nextKey = getBogotaDayKey(next);
      if (!nextKey) break;
      key = nextKey;
      if (getBogotaWeekday(next) !== 0) added++;
    }
    return key;
  };

  const addDaysPlain = (startKey: string, daysToAdd: number): string => {
    const next = new Date(
      toNoonBogota(startKey).getTime() + daysToAdd * 86_400_000,
    );
    return getBogotaDayKey(next);
  };

  const addMonths = (startKey: string, monthsToAdd: number): string => {
    const [yStr, mStr, dStr] = startKey.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    if (!y || !m || !d) return startKey;

    const totalMonths = m - 1 + monthsToAdd;
    const newY = y + Math.floor(totalMonths / 12);
    const newM0 = ((totalMonths % 12) + 12) % 12;
    const newM = newM0 + 1;

    // Clamp del día al último del mes
    const firstNextMonth =
      newM === 12
        ? new Date(`${newY + 1}-01-01T12:00:00-05:00`)
        : new Date(`${newY}-${padStart2(newM + 1)}-01T12:00:00-05:00`);
    const lastDay = new Date(firstNextMonth.getTime() - 86_400_000);
    const lastKey = getBogotaDayKey(lastDay);
    const lastDayNum = Number(lastKey.split('-')[2] || '0');
    const safeDay = Math.min(d, lastDayNum || d);
    return `${newY}-${padStart2(newM)}-${padStart2(safeDay)}`;
  };

  const padStart2 = (n: number) => String(n).padStart(2, '0');

  let targetKey = baseKey;

  switch (frecuencia) {
    case FrecuenciaPago.DIARIO:
      targetKey = addDaysSkippingSunday(baseKey, offset);
      break;
    case FrecuenciaPago.SEMANAL:
      targetKey = addDaysPlain(baseKey, offset * 7);
      break;
    case FrecuenciaPago.QUINCENAL:
      targetKey = addDaysPlain(baseKey, offset * 15);
      break;
    case FrecuenciaPago.MENSUAL:
      targetKey = addMonths(baseKey, offset);
      break;
    default:
      targetKey = baseKey;
  }

  // devolver un instante al mediodía Bogotá; el consumidor compara por día con helpers Bogotá
  return saltarDomingo(toNoonBogota(targetKey), frecuencia);
}
