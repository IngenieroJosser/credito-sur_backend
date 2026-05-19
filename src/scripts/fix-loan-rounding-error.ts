import { PrismaClient, EstadoCuota, EstadoPrestamo, TipoAmortizacion, FrecuenciaPago } from '@prisma/client';
import { Logger } from '@nestjs/common';

const prisma = new PrismaClient();
const logger = new Logger('FixLoanRoundingError');

/**
 * Script de migración para corregir el error de redondeo en préstamos existentes.
 * 
 * PROBLEMA: La suma de montoCapital de las cuotas no es igual al monto del préstamo
 * debido a trunc2() en la generación de cuotas, dejando un saldo residual (ej: $1).
 * 
 * SOLUCIÓN: Recalcular las cuotas afectadas usando la lógica corregida donde
 * la última cuota absorbe el residuo de redondeo.
 * 
 * EJECUCIÓN:
 * 1. Identificar préstamos con el bug
 * 2. Recalcular cuotas con fix
 * 3. Actualizar cuotas y saldos pendientes
 * 4. Manejar préstamos con pagos realizados (solo ajustar cuotas futuras)
 */

// Helper functions copiadas de loans.service.ts
function trunc2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n * 100) / 100;
}

interface CuotaRecalculada {
  numeroCuota: number;
  monto: number;
  montoCapital: number;
  montoInteres: number;
}

function calcularAmortizacionFrancesaCorregida(
  capital: number,
  tasaTotal: number,
  numCuotas: number,
  plazoMeses: number,
  frecuencia: FrecuenciaPago,
): CuotaRecalculada[] {
  if (numCuotas <= 0 || capital <= 0) {
    return [];
  }

  const tasaMensual = tasaTotal / 100;

  let fraccionMes = 1;
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

  const tasaPeriodo = Math.pow(1 + tasaMensual, fraccionMes) - 1;

  if (tasaPeriodo === 0) {
    const cuotaFija = capital / numCuotas;
    return Array.from({ length: numCuotas }, (_, i) => ({
      numeroCuota: i + 1,
      montoCapital: trunc2((capital / numCuotas)),
      montoInteres: 0,
      monto: trunc2(cuotaFija),
    }));
  }

  const cuotaFija = (capital * tasaPeriodo) / (1 - Math.pow(1 + tasaPeriodo, -numCuotas));

  let saldo = capital;
  const tabla: CuotaRecalculada[] = [];

  for (let i = 0; i < numCuotas; i++) {
    const interesPeriodo = saldo * tasaPeriodo;
    let capitalPeriodo = cuotaFija - interesPeriodo;

    if (i === numCuotas - 1) {
      capitalPeriodo = saldo;
    }

    saldo = Math.max(0, saldo - capitalPeriodo);

    const montoCuota = capitalPeriodo + interesPeriodo;

    tabla.push({
      numeroCuota: i + 1,
      montoCapital: trunc2(capitalPeriodo),
      montoInteres: trunc2(interesPeriodo),
      monto: i === numCuotas - 1 ? capitalPeriodo + interesPeriodo : trunc2(montoCuota),
    });
  }

  return tabla;
}

function calcularAmortizacionSimpleCorregida(
  monto: number,
  tasaInteres: number,
  cantidadCuotas: number,
  plazoMeses: number,
): CuotaRecalculada[] {
  const mesesInteres = Math.max(1, plazoMeses);
  const interesTotal = (monto * tasaInteres * mesesInteres) / 100;
  const montoTotalSimple = monto + interesTotal;
  const montoCuota = cantidadCuotas > 0 ? montoTotalSimple / cantidadCuotas : 0;
  const montoCapitalCuota = cantidadCuotas > 0 ? monto / cantidadCuotas : 0;
  const montoInteresCuota = cantidadCuotas > 0 ? interesTotal / cantidadCuotas : 0;

  const capitalTruncado = trunc2(montoCapitalCuota);
  const interesTruncado = trunc2(montoInteresCuota);
  const cuotaTruncada = trunc2(montoCuota);

  return Array.from({ length: cantidadCuotas }, (_, i) => {
    const esUltima = i === cantidadCuotas - 1;

    const capitalAcumulado = capitalTruncado * (cantidadCuotas - 1);
    const capitalUltima = esUltima ? monto - capitalAcumulado : capitalTruncado;

    const interesAcumulado = interesTruncado * (cantidadCuotas - 1);
    const interesUltima = esUltima ? interesTotal - interesAcumulado : interesTruncado;

    const montoUltima = capitalUltima + interesUltima;

    return {
      numeroCuota: i + 1,
      monto: esUltima ? montoUltima : cuotaTruncada,
      montoCapital: capitalUltima,
      montoInteres: interesUltima,
    };
  });
}

async function main() {
  logger.log('🚀 Iniciando migración para corregir error de redondeo en préstamos...');

  // 1. Identificar préstamos con el bug
  logger.log('📊 Identificando préstamos afectados...');
  
  const prestamos = await prisma.prestamo.findMany({
    where: {
      eliminadoEn: null,
      estado: { in: [EstadoPrestamo.ACTIVO, EstadoPrestamo.EN_MORA] },
    },
    include: {
      cuotas: {
        orderBy: { numeroCuota: 'asc' },
        select: {
          id: true,
          numeroCuota: true,
          monto: true,
          montoCapital: true,
          montoInteres: true,
          montoPagado: true,
          estado: true,
        },
      },
    },
  });

  logger.log(`🔍 Encontrados ${prestamos.length} préstamos activos`);

  const prestamosAfectados: Array<{
    prestamo: any;
    diferenciaCapital: number;
    cuotasRecalculadas: CuotaRecalculada[];
  }> = [];

  for (const prestamo of prestamos) {
    const montoPrestamo = Number(prestamo.monto);
    const capitalTotalCuotas = prestamo.cuotas.reduce(
      (sum, c) => sum + Number(c.montoCapital),
      0
    );

    // Verificar si hay diferencia de redondeo (más de 0.01 indica bug)
    const diferencia = Math.abs(capitalTotalCuotas - montoPrestamo);
    
    if (diferencia > 0.01) {
      logger.log(`⚠️  Préstamo ${prestamo.numeroPrestamo} afectado: diferencia de capital = $${diferencia.toFixed(2)}`);
      
      // Recalcular cuotas con el fix
      let cuotasRecalculadas: CuotaRecalculada[] = [];
      
      if (prestamo.tipoAmortizacion === TipoAmortizacion.FRANCESA) {
        cuotasRecalculadas = calcularAmortizacionFrancesaCorregida(
          montoPrestamo,
          Number(prestamo.tasaInteres),
          prestamo.cantidadCuotas,
          prestamo.plazoMeses,
          prestamo.frecuenciaPago,
        );
      } else {
        cuotasRecalculadas = calcularAmortizacionSimpleCorregida(
          montoPrestamo,
          Number(prestamo.tasaInteres),
          prestamo.cantidadCuotas,
          prestamo.plazoMeses,
        );
      }

      prestamosAfectados.push({
        prestamo,
        diferenciaCapital: diferencia,
        cuotasRecalculadas,
      });
    }
  }

  logger.log(`✅ Encontrados ${prestamosAfectados.length} préstamos con el bug de redondeo`);

  if (prestamosAfectados.length === 0) {
    logger.log('🎉 No se encontraron préstamos afectados. Migración completa.');
    await prisma.$disconnect();
    return;
  }

  // 2. Mostrar resumen y pedir confirmación
  logger.log('📋 Resumen de préstamos a corregir:');
  for (const { prestamo, diferenciaCapital } of prestamosAfectados) {
    const pagosRealizados = prestamo.cuotas.filter(c => c.estado === EstadoCuota.PAGADA).length;
    logger.log(
      `  - ${prestamo.numeroPrestamo}: diferencia $${diferenciaCapital.toFixed(2)}, ` +
      `${pagosRealizados}/${prestamo.cantidadCuotas} cuotas pagadas`
    );
  }

  // 3. Ejecutar corrección
  logger.log('🔧 Iniciando corrección de cuotas...');
  
  let corregidos = 0;
  let omitidos = 0;

  for (const { prestamo, cuotasRecalculadas } of prestamosAfectados) {
    try {
      // Verificar si hay pagos realizados
      const cuotasPagadas = prestamo.cuotas.filter(c => c.estado === EstadoCuota.PAGADA);
      const cuotasPendientes = prestamo.cuotas.filter(c => c.estado !== EstadoCuota.PAGADA);

      if (cuotasPagadas.length > 0) {
        logger.warn(`⚠️  Préstamo ${prestamo.numeroPrestamo} tiene ${cuotasPagadas.length} cuotas pagadas - OMITIENDO por seguridad`);
        omitidos++;
        continue;
      }

      // Solo corregir préstamos sin pagos para evitar inconsistencias
      logger.log(`🔄 Corrigiendo préstamo ${prestamo.numeroPrestamo}...`);

      await prisma.$transaction(async (tx) => {
        // Actualizar cada cuota
        for (const cuotaRecalculada of cuotasRecalculadas) {
          await tx.cuota.updateMany({
            where: {
              prestamoId: prestamo.id,
              numeroCuota: cuotaRecalculada.numeroCuota,
            },
            data: {
              monto: cuotaRecalculada.monto,
              montoCapital: cuotaRecalculada.montoCapital,
              montoInteres: cuotaRecalculada.montoInteres,
            },
          });
        }

        // Recalcular saldo pendiente
        const nuevoSaldoPendiente = cuotasRecalculadas.reduce(
          (sum, c) => sum + (c.montoCapital + c.montoInteres),
          0
        );

        await tx.prestamo.update({
          where: { id: prestamo.id },
          data: {
            saldoPendiente: nuevoSaldoPendiente,
          },
        });
      });

      corregidos++;
      logger.log(`✅ Préstamo ${prestamo.numeroPrestamo} corregido exitosamente`);

    } catch (error) {
      logger.error(`❌ Error corrigiendo préstamo ${prestamo.numeroPrestamo}:`, error);
    }
  }

  logger.log('📊 Resumen final:');
  logger.log(`  - Préstamos afectados: ${prestamosAfectados.length}`);
  logger.log(`  - Corregidos: ${corregidos}`);
  logger.log(`  - Omitidos (con pagos): ${omitidos}`);
  logger.log(`  - Fallidos: ${prestamosAfectados.length - corregidos - omitidos}`);

  await prisma.$disconnect();
  logger.log('🎉 Migración completada');
}

main()
  .catch((error) => {
    logger.error('❌ Error fatal en la migración:', error);
    process.exit(1);
  });
