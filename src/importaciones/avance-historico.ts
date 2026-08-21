/**
 * Estado de avance de un crédito importado.
 *
 * Al migrar cartera que ya se venía cobrando, el Excel indica cuántas cuotas
 * canceló el cliente y cuánto abonó de más. Aquí se traduce eso al estado real
 * de cada cuota y a los acumulados del préstamo.
 *
 * No se generan pagos ni asientos contables: ese dinero se recibió antes de que
 * existiera el sistema y no debe mover caja hoy.
 */

/** Cuota calculada en memoria antes de persistirse, con su estado de avance. */
export interface PlanCuota {
  numeroCuota: number;
  fechaVencimiento: Date;
  montoCapital: number;
  montoInteres: number;
  monto: number;
  montoPagado: number;
  capitalPagado: number;
  interesPagado: number;
  estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADA';
  fechaPago: Date | null;
}

export interface ResultadoAvanceHistorico {
  totalPagado: number;
  capitalPagado: number;
  interesPagado: number;
  cuotasPagadas: number;
  montoNoAplicado: number;
}

import {
  construirTablaCuotas,
  TipoAmortizacionImportacion,
} from './interes-credito';

const redondear = (valor: number) => Math.round(valor * 100) / 100;

/**
 * Construye el plan de cuotas del crédito.
 *
 * El reparto lo hace `construirTablaCuotas`, que replica exactamente el cálculo
 * del sistema al crear un crédito desde el modal. Aquí solo se le agregan las
 * fechas y el estado de avance.
 */
export function construirPlanCuotas(params: {
  tipoAmortizacion: TipoAmortizacionImportacion;
  monto: number;
  interesTotal: number;
  cantidadCuotas: number;
  fechasVencimiento: Date[];
}): PlanCuota[] {
  const {
    tipoAmortizacion,
    monto,
    interesTotal,
    cantidadCuotas,
    fechasVencimiento,
  } = params;

  return construirTablaCuotas(
    tipoAmortizacion,
    monto,
    interesTotal,
    cantidadCuotas,
  ).map((cuota) => ({
    numeroCuota: cuota.numeroCuota,
    fechaVencimiento: fechasVencimiento[cuota.numeroCuota - 1],
    montoCapital: cuota.montoCapital,
    montoInteres: cuota.montoInteres,
    monto: cuota.monto,
    montoPagado: 0,
    capitalPagado: 0,
    interesPagado: 0,
    estado: 'PENDIENTE' as const,
    fechaPago: null,
  }));
}

/**
 * Aplica sobre el plan lo que el cliente ya había abonado: las primeras
 * `cuotasPagadas` quedan canceladas y el `abonoAdicional` se distribuye en
 * cascada sobre las siguientes.
 *
 * El reparto dentro de cada cuota respeta el mismo orden que usa el registro de
 * pagos del sistema (interés antes que capital; no hay mora en importaciones),
 * de modo que los acumulados queden consistentes con un pago real.
 *
 * Muta `planCuotas`.
 */
export function aplicarAvanceHistorico(
  planCuotas: PlanCuota[],
  cuotasPagadas: number,
  abonoAdicional: number,
  fechaUltimoPago: Date | null,
): ResultadoAvanceHistorico {
  const cuotasCompletas = Math.max(
    0,
    Math.min(Math.trunc(cuotasPagadas || 0), planCuotas.length),
  );

  const totalCuotasCompletas = planCuotas
    .slice(0, cuotasCompletas)
    .reduce((suma, cuota) => suma + cuota.monto, 0);

  let restante = redondear(
    totalCuotasCompletas + Math.max(0, abonoAdicional || 0),
  );

  let totalPagado = 0;
  let capitalPagado = 0;
  let interesPagado = 0;
  let ultimaCuotaAbonada: PlanCuota | null = null;

  for (const cuota of planCuotas) {
    if (restante <= 0) break;

    const aplicadoInteres = Math.min(restante, cuota.montoInteres);
    restante = redondear(restante - aplicadoInteres);

    const aplicadoCapital = Math.min(restante, cuota.montoCapital);
    restante = redondear(restante - aplicadoCapital);

    const aplicadoCuota = redondear(aplicadoInteres + aplicadoCapital);
    if (aplicadoCuota <= 0) continue;

    cuota.montoPagado = aplicadoCuota;
    cuota.interesPagado = aplicadoInteres;
    cuota.capitalPagado = aplicadoCapital;
    cuota.estado = aplicadoCuota >= cuota.monto ? 'PAGADA' : 'PARCIAL';
    cuota.fechaPago = cuota.fechaVencimiento;
    ultimaCuotaAbonada = cuota;

    totalPagado = redondear(totalPagado + aplicadoCuota);
    capitalPagado = redondear(capitalPagado + aplicadoCapital);
    interesPagado = redondear(interesPagado + aplicadoInteres);
  }

  // La fecha informada corresponde al último abono recibido.
  if (fechaUltimoPago && ultimaCuotaAbonada) {
    ultimaCuotaAbonada.fechaPago = fechaUltimoPago;
  }

  return {
    totalPagado,
    capitalPagado,
    interesPagado,
    cuotasPagadas: planCuotas.filter((c) => c.estado === 'PAGADA').length,
    montoNoAplicado: Math.max(0, restante),
  };
}

/**
 * Estado con el que nace un préstamo importado: PAGADO si ya no queda saldo,
 * EN_MORA si tiene cuotas vencidas sin cancelar y ACTIVO en cualquier otro caso.
 */
export function resolverEstadoPrestamoImportado(
  planCuotas: PlanCuota[],
  saldoPendiente: number,
  hoy: Date = new Date(),
): 'PAGADO' | 'EN_MORA' | 'ACTIVO' {
  if (saldoPendiente <= 0) return 'PAGADO';

  const tieneCuotaVencida = planCuotas.some(
    (cuota) => cuota.estado !== 'PAGADA' && cuota.fechaVencimiento < hoy,
  );

  return tieneCuotaVencida ? 'EN_MORA' : 'ACTIVO';
}
