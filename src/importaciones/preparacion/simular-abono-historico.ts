import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService, type TransaccionPrisma } from '../../prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import { aplicarAvanceHistorico } from '../avance-historico';

async function soloLectura(tx: TransaccionPrisma) {
  await tx.$executeRaw`SET TRANSACTION READ ONLY`;
  const [db] = await tx.$queryRaw<{ nombre: string; puerto: number }[]>`
    SELECT current_database() AS nombre, inet_server_port() AS puerto
  `;
  if (db?.nombre !== 'fase3_pruebas' || db.puerto !== 55483) {
    throw new ForbiddenException('La conexión no corresponde a la base aislada.');
  }
}

function creditosDePrueba(expedienteId: string): Prisma.PrestamoWhereInput {
  return { estado: 'BORRADOR', soloPruebaHistorica: true, eliminadoEn: null,
    loteImportacion: { cargaHistorica: { expedienteId, revertidaEn: null } } };
}

export function listarCreditosDePrueba(prisma: PrismaService, expedienteId: string) {
  return prisma.$transaction(async tx => {
    await soloLectura(tx);
    const creditos = await tx.prestamo.findMany({
      where: creditosDePrueba(expedienteId),
      select: { id: true, numeroPrestamo: true, tipoPrestamo: true, saldoPendiente: true },
      orderBy: { numeroPrestamo: 'asc' },
    });
    return creditos.map(c => ({ ...c, saldoPendiente: Number(c.saldoPendiente) }));
  });
}

export function proyectarAbonoDePrueba(prisma: PrismaService, id: string, prestamoId: string, monto: unknown) {
  if (typeof monto !== 'number' || !Number.isSafeInteger(monto) || monto <= 0) {
    throw new BadRequestException('Indique un monto positivo en pesos enteros.');
  }
  return prisma.$transaction(async (tx) => {
    await soloLectura(tx);

    const prestamo = await tx.prestamo.findFirst({
      where: { ...creditosDePrueba(id), id: prestamoId },
      select: { saldoPendiente: true, totalPagado: true, capitalPagado: true, interesPagado: true,
        cuotas: { orderBy: { numeroCuota: 'asc' }, select: { numeroCuota: true, fechaVencimiento: true,
          monto: true, montoCapital: true, montoInteres: true, montoPagado: true } } },
    });
    if (!prestamo) throw new BadRequestException('El crédito no pertenece a una carga de prueba vigente.');
    const saldoAnterior = Number(prestamo.saldoPendiente);
    if (monto > saldoAnterior) throw new BadRequestException('El abono supera el saldo de prueba.');
    const plan = prestamo.cuotas.map(cuota => ({
      numeroCuota: cuota.numeroCuota, fechaVencimiento: cuota.fechaVencimiento,
      monto: Number(cuota.monto), montoCapital: Number(cuota.montoCapital), montoInteres: Number(cuota.montoInteres),
      montoPagado: 0, capitalPagado: 0, interesPagado: 0, estado: 'PENDIENTE' as const, fechaPago: null,
    }));
    const avance = aplicarAvanceHistorico(plan, 0, Number(prestamo.totalPagado) + monto, null);
    if (avance.montoNoAplicado || avance.totalPagado - Number(prestamo.totalPagado) !== monto) {
      throw new ConflictException('La simulación no concilia con el plan registrado.');
    }
    return {
      soloSimulacion: true, saldoAnterior, saldoProyectado: saldoAnterior - monto,
      capital: avance.capitalPagado - Number(prestamo.capitalPagado),
      interes: avance.interesPagado - Number(prestamo.interesPagado),
      cuotasAfectadas: plan.filter((c, i) => c.montoPagado !== Number(prestamo.cuotas[i].montoPagado)).length,
    };
  }, { isolationLevel: 'RepeatableRead' });
}
