/**
 * Utilidades de amortización para créditos — Créditos del Sur
 * Extraídas de loans.service.ts como funciones puras reutilizables.
 */
import { FrecuenciaPago } from '@prisma/client';

function trunc2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n * 100) / 100;
}

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
export function tasaPorPeriodo(tasaMensualPct: number, frecuencia: FrecuenciaPago): number {
  const tasaMensual = tasaMensualPct / 100;
  let fraccionMes: number;
  switch (frecuencia) {
    case FrecuenciaPago.DIARIO:    fraccionMes = 1 / 30; break;
    case FrecuenciaPago.SEMANAL:   fraccionMes = 1 / 4;  break;
    case FrecuenciaPago.QUINCENAL: fraccionMes = 1 / 2;  break;
    case FrecuenciaPago.MENSUAL:
    default:                        fraccionMes = 1;       break;
  }
  return Math.pow(1 + tasaMensual, fraccionMes) - 1;
}

// ── Amortización Francesa (cuota fija) ─────────────────────────────────────────

/**
 * Genera tabla de amortización francesa (cuota fija).
 * La tasa que recibe es la tasa MENSUAL del crédito (ej: 10 = 10% mensual).
 */
export function calcularAmortizacionFrancesa(
  capital: number,
  tasaTotal: number,
  numCuotas: number,
  _plazoMeses: number,
  frecuencia: FrecuenciaPago,
): ResultadoAmortizacion {
  if (numCuotas <= 0 || capital <= 0) {
    return { cuotaFija: 0, interesTotal: 0, tabla: [] };
  }

  const tasaPeriodo = tasaPorPeriodo(tasaTotal, frecuencia);

  if (tasaPeriodo === 0) {
    const cuotaFija = capital / numCuotas;
    return {
      cuotaFija: trunc2(cuotaFija),
      interesTotal: 0,
      tabla: Array.from({ length: numCuotas }, (_, i) => ({
        numeroCuota: i + 1,
        montoCapital: trunc2((capital / numCuotas)),
        montoInteres: 0,
        monto: trunc2(cuotaFija),
        saldoRestante: trunc2((capital - (capital / numCuotas) * (i + 1))),
      })),
    };
  }

  // Fórmula francesa: C = P × r / (1 - (1+r)^-n)
  const cuotaFija = (capital * tasaPeriodo) / (1 - Math.pow(1 + tasaPeriodo, -numCuotas));

  let saldo = capital;
  let interesTotalAcumulado = 0;
  const tabla: FilaAmortizacion[] = [];

  for (let i = 0; i < numCuotas; i++) {
    const interesPeriodo = saldo * tasaPeriodo;
    let capitalPeriodo = cuotaFija - interesPeriodo;
    if (i === numCuotas - 1) capitalPeriodo = saldo; // Ajuste última cuota
    saldo = Math.max(0, saldo - capitalPeriodo);
    interesTotalAcumulado += interesPeriodo;
    tabla.push({
      numeroCuota: i + 1,
      montoCapital: trunc2(capitalPeriodo),
      montoInteres: trunc2(interesPeriodo),
      monto: trunc2((capitalPeriodo + interesPeriodo)),
      saldoRestante: trunc2(saldo),
    });
  }

  return {
    cuotaFija: trunc2(cuotaFija),
    interesTotal: trunc2(interesTotalAcumulado),
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
  const interesPorCuota = capital * tasaPeriodo;
  const capitalPorCuota = capital / numCuotas;
  const cuotaFija = capitalPorCuota + interesPorCuota;

  let saldo = capital;
  const tabla: FilaAmortizacion[] = [];

  for (let i = 0; i < numCuotas; i++) {
    const montoInteres = trunc2(interesPorCuota);
    const montoCapital = trunc2(capitalPorCuota);
    saldo = Math.max(0, saldo - montoCapital);
    tabla.push({
      numeroCuota: i + 1,
      montoCapital,
      montoInteres,
      monto: trunc2(cuotaFija),
      saldoRestante: trunc2(saldo),
    });
  }

  return {
    cuotaFija: trunc2(cuotaFija),
    interesTotal: trunc2(interesPorCuota * numCuotas),
    tabla,
  };
}

// ── Fecha de vencimiento por cuota ─────────────────────────────────────────────

export function calcularFechaVencimiento(
  fechaBase: Date,
  numeroCuota: number,
  frecuencia: FrecuenciaPago,
): Date {
  const fecha = new Date(fechaBase);
  const offset = Math.max(0, numeroCuota - 1);
  switch (frecuencia) {
    case FrecuenciaPago.DIARIO:    fecha.setDate(fecha.getDate() + offset);         break;
    case FrecuenciaPago.SEMANAL:   fecha.setDate(fecha.getDate() + offset * 7);     break;
    case FrecuenciaPago.QUINCENAL: fecha.setDate(fecha.getDate() + offset * 15);    break;
    case FrecuenciaPago.MENSUAL:   fecha.setMonth(fecha.getMonth() + offset);       break;
  }
  return fecha;
}
