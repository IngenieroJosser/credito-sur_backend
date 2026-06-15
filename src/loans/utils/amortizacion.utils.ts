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
 * Genera tabla de amortización (cuota fija).
 * La tasa que recibe se aplica directamente por periodo.
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

export function calcularFechaVencimiento(
  fechaBase: Date,
  numeroCuota: number,
  frecuencia: FrecuenciaPago,
): Date {
  const fecha = new Date(fechaBase);
  const offset = Math.max(0, numeroCuota - 1);
  switch (frecuencia) {
    case FrecuenciaPago.DIARIO:
      fecha.setDate(fecha.getDate() + offset);
      break;
    case FrecuenciaPago.SEMANAL:
      fecha.setDate(fecha.getDate() + offset * 7);
      break;
    case FrecuenciaPago.QUINCENAL:
      fecha.setDate(fecha.getDate() + offset * 15);
      break;
    case FrecuenciaPago.MENSUAL:
      fecha.setMonth(fecha.getMonth() + offset);
      break;
  }
  return fecha;
}
