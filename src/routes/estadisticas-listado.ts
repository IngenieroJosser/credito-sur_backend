import { Prisma } from '@prisma/client';
import type { TransaccionPrisma } from '../prisma/prisma.service';
import type { DatosVisitas } from './datos-visitas';

// Las visitas ya cargaron cuotas, pagos y ausencias de ESTA ruta.
// Un cliente con dos asignaciones no duplica la cartera.
export function moraDelListado(datos: DatosVisitas, inicio: Date) {
  const conPago = new Set(
    datos.pagosDeHoy
      .filter((p) => p.origenGestion !== 'CIERRE_PENDIENTE')
      .map((p) => p.clienteId),
  );
  const excluidos = new Set(
    datos.registrosVisitas
      .filter(
        (v) =>
          [
            'ausente',
            'reprogramado',
            'reprogramada',
            'reprogramacion',
            'reprogramación',
          ].includes(v.estadoVisita.toLowerCase()) && !conPago.has(v.clienteId),
      )
      .map((v) => v.clienteId),
  );
  const vistos = new Set<string>();
  let vencido = 0,
    saldo = 0;
  for (const a of datos.asignaciones) {
    if (excluidos.has(a.cliente.id)) continue;
    for (const p of a.cliente.prestamos) {
      if (
        vistos.has(p.id) ||
        !(p.estado === 'ACTIVO' || p.estado === 'EN_MORA')
      )
        continue;
      vistos.add(p.id);
      saldo += Number(p.saldoPendiente);
      for (const c of p.cuotas)
        if (c.estado !== 'PAGADA' && c.fechaVencimiento < inicio)
          vencido += Number(c.monto);
    }
  }
  return saldo > 0 ? (vencido / saldo) * 100 : 0;
}

// La fecha contable es la del movimiento, no la fecha operativa que se regulariza.
export async function leerRecaudoContable(
  // `Prisma.TransactionClient` es el cliente SIN extender, y el de este proyecto
  // lleva la extension que intercepta las escrituras: con ese tipo, pasarle
  // `this.prisma` no compila. El alias del repo es `TransaccionPrisma`, y su
  // comentario en `prisma.service.ts` describe exactamente este error.
  db: TransaccionPrisma,
  ids: string[],
  inicio: Date,
  fin: Date,
) {
  if (!ids.length)
    return new Map<string, { contable: number; regularizado: number }>();
  const filas = await db.$queryRaw<
    { rutaId: string; contable: number; regularizado: number }[]
  >`
    SELECT "rutaId", SUM(monto)::float8 AS contable, SUM(regularizado)::float8 AS regularizado FROM (
      SELECT l."rutaId", p."montoTotal" AS monto,
        CASE WHEN p."origenGestion"='CIERRE_PENDIENTE' THEN p."montoTotal" ELSE 0 END AS regularizado
      FROM "Pago" p JOIN "Prestamo" l ON l.id=p."prestamoId"
      WHERE l."rutaId" IN (${Prisma.join(ids)}) AND p."fechaPago" BETWEEN ${inicio} AND ${fin}
      UNION ALL
      SELECT c."rutaId", t.monto, 0 FROM "Transaccion" t JOIN cajas c ON c.id=t."cajaId"
      WHERE c."rutaId" IN (${Prisma.join(ids)}) AND c.activa AND t.tipo='INGRESO'
        AND t."tipoReferencia"='CUOTA_INICIAL' AND t."fechaTransaccion" BETWEEN ${inicio} AND ${fin}
    ) movimientos GROUP BY "rutaId"
  `;
  return new Map(filas.map((f) => [f.rutaId, f]));
}
