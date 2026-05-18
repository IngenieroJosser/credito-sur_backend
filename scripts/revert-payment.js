#!/usr/bin/env node

try {
  require('dotenv').config();
} catch {}

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function arg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : undefined;
}

function money(value) {
  return Number(value || 0);
}

function cop(value) {
  return `$${Math.round(money(value)).toLocaleString('es-CO')}`;
}

function buildNumeroTransaccion(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function cuotaStateAfterRevert(cuota, nextPaid) {
  const amount = money(cuota.monto);
  if (nextPaid >= amount - 1) return { estado: 'PAGADA', fechaPago: cuota.fechaPago };
  if (nextPaid > 0) return { estado: 'PARCIAL', fechaPago: null };

  const dueDate = cuota.fechaVencimientoProrroga || cuota.fechaVencimiento;
  const isOverdue = dueDate ? new Date(dueDate).getTime() < Date.now() : false;
  return { estado: isOverdue ? 'VENCIDA' : 'PENDIENTE', fechaPago: null };
}

async function loadPaymentSummary(pagoId) {
  const pago = await prisma.pago.findUnique({
    where: { id: pagoId },
    include: {
      detalles: { include: { cuota: true } },
      cliente: { select: { nombres: true, apellidos: true } },
      prestamo: {
        select: {
          numeroPrestamo: true,
          estado: true,
          saldoPendiente: true,
          totalPagado: true,
          capitalPagado: true,
          interesPagado: true,
          interesMoraPagado: true,
        },
      },
    },
  });

  if (!pago) {
    throw new Error(`No existe un pago con id ${pagoId}`);
  }

  const transaccion = await prisma.transaccion.findFirst({
    where: { tipoReferencia: 'PAGO', referenciaId: pago.numeroPago },
    select: { id: true, cajaId: true, numeroTransaccion: true, monto: true },
  });

  const asiento = await prisma.journalEntry.findFirst({
    where: { referenceType: 'PAGO', referenceId: pago.id },
    include: { lines: true },
  });

  const reversoExistente = await prisma.journalEntry.findFirst({
    where: { referenceType: 'AJUSTE', referenceId: `REVERSO-${pago.id}` },
    select: { id: true, createdAt: true },
  });

  return { pago, transaccion, asiento, reversoExistente };
}

async function findCandidatePayments({ amount, from, to, cliente }) {
  const where = {};
  if (amount) where.montoTotal = Number(amount);
  if (from || to) {
    where.fechaPago = {};
    if (from) where.fechaPago.gte = new Date(`${from}T00:00:00-05:00`);
    if (to) where.fechaPago.lte = new Date(`${to}T23:59:59-05:00`);
  }
  if (cliente) {
    where.cliente = {
      OR: [
        { nombres: { contains: cliente, mode: 'insensitive' } },
        { apellidos: { contains: cliente, mode: 'insensitive' } },
      ],
    };
  }

  const pagos = await prisma.pago.findMany({
    where,
    include: {
      cliente: { select: { nombres: true, apellidos: true } },
      prestamo: { select: { numeroPrestamo: true } },
      detalles: { include: { cuota: { select: { numeroCuota: true } } } },
    },
    orderBy: { fechaPago: 'desc' },
    take: 25,
  });

  if (!pagos.length) {
    console.log('No encontré pagos con esos filtros.');
    return;
  }

  console.log(`Pagos candidatos (${pagos.length})`);
  for (const pago of pagos) {
    const nombre = `${pago.cliente?.nombres || ''} ${pago.cliente?.apellidos || ''}`.trim();
    const cuotas = pago.detalles.map((detalle) => detalle.cuota?.numeroCuota || '?').join(', ');
    console.log('');
    console.log(`- ID: ${pago.id}`);
    console.log(`  Numero: ${pago.numeroPago}`);
    console.log(`  Cliente: ${nombre || pago.clienteId}`);
    console.log(`  Prestamo: ${pago.prestamo?.numeroPrestamo || pago.prestamoId}`);
    console.log(`  Monto: ${cop(pago.montoTotal)} | Fecha: ${pago.fechaPago.toISOString()} | Cuotas: ${cuotas}`);
    console.log(`  Vista previa: npm run revert:payment -- --pagoId=${pago.id}`);
  }
}

function printSummary(summary) {
  const { pago, transaccion, asiento, reversoExistente } = summary;
  const cliente = `${pago.cliente?.nombres || ''} ${pago.cliente?.apellidos || ''}`.trim() || pago.clienteId;

  console.log('Pago a reversar');
  console.log(`- ID: ${pago.id}`);
  console.log(`- Numero: ${pago.numeroPago}`);
  console.log(`- Cliente: ${cliente}`);
  console.log(`- Prestamo: ${pago.prestamo?.numeroPrestamo || pago.prestamoId}`);
  console.log(`- Monto: ${cop(pago.montoTotal)}`);
  console.log(`- Fecha: ${pago.fechaPago.toISOString()}`);
  console.log(`- Detalles: ${pago.detalles.length}`);
  for (const detalle of pago.detalles) {
    const cuota = detalle.cuota;
    const paidNow = money(cuota?.montoPagado);
    const nextPaid = Math.max(0, paidNow - money(detalle.monto));
    const nextState = cuota ? cuotaStateAfterRevert(cuota, nextPaid).estado : 'SIN_CUOTA';
    console.log(
      `  * Cuota ${cuota?.numeroCuota || detalle.cuotaId}: ${cop(detalle.monto)} | pagado ${cop(paidNow)} -> ${cop(nextPaid)} | estado -> ${nextState}`,
    );
  }
  console.log(`- Transaccion caja: ${transaccion ? transaccion.numeroTransaccion : 'no encontrada'}`);
  console.log(`- Asiento contable: ${asiento ? asiento.id : 'no encontrado'}`);
  console.log(`- Reverso existente: ${reversoExistente ? reversoExistente.id : 'no'}`);
}

async function revertPayment(pagoId) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Pago" WHERE id = ${pagoId} FOR UPDATE`;

      const pago = await tx.pago.findUnique({
        where: { id: pagoId },
        include: { detalles: true, prestamo: true },
      });
      if (!pago) throw new Error(`No existe un pago con id ${pagoId}`);

      const existingReverse = await tx.journalEntry.findFirst({
        where: { referenceType: 'AJUSTE', referenceId: `REVERSO-${pago.id}` },
        select: { id: true },
      });
      if (existingReverse) {
        throw new Error(`Este pago ya tiene reverso contable: ${existingReverse.id}`);
      }

      await tx.$queryRaw`SELECT id FROM "Prestamo" WHERE id = ${pago.prestamoId} FOR UPDATE`;

      const detalles = await tx.detallePago.findMany({
        where: { pagoId: pago.id },
        include: { cuota: true },
      });
      if (!detalles.length) {
        throw new Error('El pago no tiene detalles; no se puede reversar de forma segura.');
      }

      const montoTotal = money(pago.montoTotal);
      const capitalTotal = detalles.reduce((sum, item) => sum + money(item.montoCapital), 0);
      const interesTotal = detalles.reduce((sum, item) => sum + money(item.montoInteres), 0);
      const moraTotal = detalles.reduce((sum, item) => sum + money(item.montoInteresMora), 0);

      for (const detalle of detalles) {
        await tx.$queryRaw`SELECT id FROM "cuotas" WHERE id = ${detalle.cuotaId} FOR UPDATE`;
        const cuota = await tx.cuota.findUnique({ where: { id: detalle.cuotaId } });
        if (!cuota) throw new Error(`No existe la cuota ${detalle.cuotaId}`);

        const nextPaid = Math.max(0, money(cuota.montoPagado) - money(detalle.monto));
        const next = cuotaStateAfterRevert(cuota, nextPaid);
        await tx.cuota.update({
          where: { id: cuota.id },
          data: {
            montoPagado: nextPaid,
            estado: next.estado,
            fechaPago: next.fechaPago,
          },
        });
      }

      const cuotasVencidas = await tx.cuota.count({
        where: { prestamoId: pago.prestamoId, estado: 'VENCIDA' },
      });
      const saldoDespues = money(pago.prestamo.saldoPendiente) + montoTotal;
      const estadoDespues =
        pago.prestamo.estado === 'INCUMPLIDO' || pago.prestamo.estado === 'PERDIDA'
          ? pago.prestamo.estado
          : cuotasVencidas > 0
            ? 'EN_MORA'
            : 'ACTIVO';

      await tx.prestamo.update({
        where: { id: pago.prestamoId },
        data: {
          totalPagado: Math.max(0, money(pago.prestamo.totalPagado) - montoTotal),
          capitalPagado: Math.max(0, money(pago.prestamo.capitalPagado) - capitalTotal),
          interesPagado: Math.max(0, money(pago.prestamo.interesPagado) - interesTotal),
          interesMoraPagado: Math.max(0, money(pago.prestamo.interesMoraPagado) - moraTotal),
          saldoPendiente: saldoDespues,
          estado: estadoDespues,
          version: { increment: 1 },
          estadoSincronizacion: 'PENDIENTE',
        },
      });

      const originalTransaccion = await tx.transaccion.findFirst({
        where: { tipoReferencia: 'PAGO', referenciaId: pago.numeroPago },
      });
      if (originalTransaccion) {
        await tx.transaccion.create({
          data: {
            numeroTransaccion: buildNumeroTransaccion('TRX-REV'),
            cajaId: originalTransaccion.cajaId,
            tipo: 'EGRESO',
            monto: montoTotal,
            descripcion: `Reverso pago duplicado ${pago.numeroPago}`,
            notas: `Reversado por scripts/revert-payment.js para corregir pago duplicado.`,
            creadoPorId: pago.cobradorId,
            tipoReferencia: 'REVERSO_PAGO',
            referenciaId: pago.numeroPago,
          },
        });
      }

      const originalEntry = await tx.journalEntry.findFirst({
        where: { referenceType: 'PAGO', referenceId: pago.id },
        include: { lines: true },
      });
      if (originalEntry) {
        await tx.journalEntry.create({
          data: {
            referenceType: 'AJUSTE',
            referenceId: `REVERSO-${pago.id}`,
            description: `Reverso de pago duplicado ${pago.numeroPago}`,
            createdBy: pago.cobradorId,
            lines: {
              create: originalEntry.lines.map((line) => ({
                accountCode: line.accountCode,
                debitAmount: line.creditAmount || null,
                creditAmount: line.debitAmount || null,
                cajaId: line.cajaId || null,
              })),
            },
          },
        });

        for (const line of originalEntry.lines) {
          if (!line.cajaId) continue;
          const originalDelta = money(line.debitAmount) - money(line.creditAmount);
          if (originalDelta === 0) continue;
          await tx.caja.update({
            where: { id: line.cajaId },
            data: { saldoActual: { decrement: originalDelta } },
          });
        }
      } else if (originalTransaccion) {
        await tx.caja.update({
          where: { id: originalTransaccion.cajaId },
          data: { saldoActual: { decrement: montoTotal } },
        });
      }

      await tx.recibo.deleteMany({ where: { pagoId: pago.id } });
      await tx.multimedia.deleteMany({ where: { pagoId: pago.id } });
      await tx.detallePago.deleteMany({ where: { pagoId: pago.id } });
      await tx.pago.delete({ where: { id: pago.id } });

      return {
        pagoId: pago.id,
        numeroPago: pago.numeroPago,
        montoReversado: montoTotal,
        cuotasAfectadas: detalles.length,
        saldoPrestamo: saldoDespues,
      };
    },
    { timeout: 30000 },
  );
}

async function main() {
  const pagoId = arg('pagoId') || process.env.PAGO_ID;
  const confirm = arg('confirm') || process.env.CONFIRM_REVERT_PAYMENT;

  if (!pagoId) {
    const findAmount = arg('findAmount') || process.env.FIND_AMOUNT;
    if (findAmount) {
      await findCandidatePayments({
        amount: findAmount,
        from: arg('from') || process.env.FIND_FROM,
        to: arg('to') || process.env.FIND_TO,
        cliente: arg('cliente') || process.env.FIND_CLIENTE,
      });
      return;
    }

    throw new Error('Falta --pagoId=<id> o PAGO_ID=<id>. Para buscar: --findAmount=540000 --from=2026-05-18 --to=2026-05-18 --cliente=Glenfor');
  }

  const summary = await loadPaymentSummary(pagoId);
  printSummary(summary);

  if (summary.reversoExistente) {
    throw new Error('El pago ya fue reversado anteriormente. No se hará nada.');
  }

  if (confirm !== pagoId) {
    console.log('');
    console.log('Vista previa solamente. No se modificó la base de datos.');
    console.log(`Para ejecutar el reverso: npm run revert:payment -- --pagoId=${pagoId} --confirm=${pagoId}`);
    return;
  }

  const result = await revertPayment(pagoId);
  console.log('');
  console.log('Reverso aplicado correctamente');
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
