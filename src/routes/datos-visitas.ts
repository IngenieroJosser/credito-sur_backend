import { Prisma, EstadoAprobacion, TipoAprobacion } from '@prisma/client';
import type { TransaccionPrisma } from '../prisma/prisma.service';
import { getBogotaStartEndOfDayFromKey } from '../utils/date-utils';

function agrupar<T>(filas: T[], clave: (fila: T) => string | null) {
  const mapa = new Map<string, T[]>();
  for (const fila of filas) {
    const id = clave(fila);
    if (!id) continue;
    const grupo = mapa.get(id);
    if (grupo) grupo.push(fila);
    else mapa.set(id, [fila]);
  }
  return mapa;
}

export async function cargarVisitas(
  // `Prisma.TransactionClient` es el cliente SIN extender, y el de este
  // proyecto lleva la extension que intercepta las escrituras: con ese tipo,
  // pasarle `this.prisma` no compila. El alias del repo es `TransaccionPrisma`,
  // y su comentario en `prisma.service.ts` describe exactamente este error.
  db: TransaccionPrisma,
  ids: string[],
  fechaKey: string,
) {
  const { startDate: fInicio, endDate: fFin } =
    getBogotaStartEndOfDayFromKey(fechaKey);
  const [jornadas, pagos, historial, asignaciones, registros, gastos] =
    await Promise.all([
      db.rutaJornada.findMany({
        where: { rutaId: { in: ids }, fechaOperativa: fechaKey },
        select: {
          id: true,
          rutaId: true,
          estado: true,
          cerradaEn: true,
          regularizadaEn: true,
        },
      }),
      db.pago.findMany({
        where: {
          prestamo: { rutaId: { in: ids } },
          OR: [
            {
              fechaPago: { gte: fInicio, lte: fFin },
              OR: [
                { origenGestion: null },
                { origenGestion: { not: 'CIERRE_PENDIENTE' } },
              ],
            },
            { fechaOperativaRuta: fechaKey, origenGestion: 'CIERRE_PENDIENTE' },
          ],
        },
        select: {
          prestamo: { select: { rutaId: true } },
          id: true,
          clienteId: true,
          prestamoId: true,
          montoTotal: true,
          fechaPago: true,
          fechaOperativaRuta: true,
          origenGestion: true,
          metodoPago: true,
          /*
           * Quien quedo acreditado con el pago.
           *
           * No siempre es el cobrador de la ruta: cuando un SUPERVISOR registra
           * un pago, `payments.service` le pone SU id al `cobradorId` —lo hace
           * en dos sitios, de forma explicita, pisando lo que mande el
           * frontend—, porque el dinero entra a su caja.
           *
           * El recaudo de la ruta igual lo cuenta: esta consulta filtra por
           * `prestamo.rutaId`, no por cobrador. Lo que faltaba era DECIRLO: el
           * cobrador veia al cliente ya pagado, sin rastro de quien paso por
           * ahi, y su informe por cobrador no cuadraba con el avance de su ruta.
           */
          cobradorId: true,
          cobrador: {
            select: { id: true, nombres: true, apellidos: true, rol: true },
          },
          detalles: {
            select: {
              monto: true,
              cuota: {
                select: {
                  id: true,
                  numeroCuota: true,
                  estado: true,
                  fechaVencimiento: true,
                  fechaVencimientoProrroga: true,
                  monto: true,
                  montoPagado: true,
                },
              },
            },
          },
        },
      }),
      db.$queryRaw<
        {
          rutaId: string;
          prestamoId: string;
          ultimoPago: Date;
          totalPagado: number;
        }[]
      >`
      SELECT c."rutaId", p."prestamoId", MAX(COALESCE(p."fechaPago", p."creadoEn")) AS "ultimoPago",
             SUM(p."montoTotal")::float8 AS "totalPagado"
      FROM "Pago" p JOIN "Prestamo" c ON c.id = p."prestamoId"
      WHERE c."rutaId" IN (${Prisma.join(ids)})
      GROUP BY c."rutaId", p."prestamoId"
    `,
      db.asignacionRuta.findMany({
        where: { rutaId: { in: ids }, activa: true },
        include: {
          cliente: {
            include: {
              prestamos: {
                where: {
                  // Solo los creditos de ESTA ruta: el cliente puede tener
                  // otros en otra ruta y no son de esta jornada.
                  rutaId: { in: ids },
                  estado: {
                    in: ['ACTIVO', 'EN_MORA', 'PAGADO', 'PENDIENTE_APROBACION'],
                  },
                  eliminadoEn: null,
                  estadoAprobacion: { not: EstadoAprobacion.RECHAZADO },
                },

                include: {
                  cuotas: {
                    orderBy: { fechaVencimiento: 'asc' },
                  },
                },
              },
            },
          },
        },

        orderBy: { ordenVisita: 'asc' },
      }),
      db.registroVisita.findMany({
        where: { rutaId: { in: ids }, fechaVisita: fechaKey },
      }),
      db.$queryRaw<{ rutaId: string; monto: number }[]>`
      SELECT c."rutaId",SUM(g.monto)::float8 AS monto FROM "Gasto" g JOIN cajas c ON c.id=g."cajaId"
      WHERE c."rutaId" IN (${Prisma.join(ids)}) AND g."fechaGasto" BETWEEN ${fInicio} AND ${fFin}
      GROUP BY c."rutaId"
    `,
    ]);

  const idsRegularizados = [
    ...new Set(
      pagos
        .filter((p) => p.origenGestion === 'CIERRE_PENDIENTE')
        .map((p) => p.clienteId),
    ),
  ];
  const [reprogramacionesJornada, clientes] = await Promise.all([
    asignaciones.length
      ? db.aprobacion.findMany({
          where: {
            tipoAprobacion: TipoAprobacion.REPROGRAMACION_CUOTA,
            estado: {
              in: [EstadoAprobacion.PENDIENTE, EstadoAprobacion.APROBADO],
            },
            OR: [
              {
                datosSolicitud: {
                  path: ['fechaOperativaRuta'],
                  equals: fechaKey,
                },
              },
              {
                datosSolicitud: {
                  path: ['fechaGestionOriginal'],
                  equals: fechaKey,
                },
              },
            ],
          },
          orderBy: { creadoEn: 'desc' },
          select: {
            id: true,
            referenciaId: true,
            estado: true,
            datosSolicitud: true,
            creadoEn: true,
          },
        })
      : [],
    idsRegularizados.length
      ? db.cliente.findMany({
          where: { id: { in: idsRegularizados } },
          select: {
            id: true,
            codigo: true,
            dni: true,
            nombres: true,
            apellidos: true,
            telefono: true,
            direccion: true,
            nivelRiesgo: true,
            prestamos: {
              where: { eliminadoEn: null, rutaId: { in: ids } },
              include: { cuotas: { orderBy: { fechaVencimiento: 'asc' } } },
            },
          },
        })
      : [],
  ]);

  const jornadaRuta = new Map(jornadas.map((j) => [j.rutaId, j]));
  const pagosRuta = agrupar(pagos, (p) => p.prestamo.rutaId);
  const historialRuta = agrupar(historial, (h) => h.rutaId);
  const registrosRuta = agrupar(registros, (r) => r.rutaId);
  const asignacionesRuta = agrupar(asignaciones, (a) => a.rutaId);
  const gastosRuta = new Map(gastos.map((g) => [g.rutaId, Number(g.monto)]));
  const clientesPorId = new Map(clientes.map((c) => [c.id, c]));

  return (rutaId: string) => ({
    jornada: jornadaRuta.get(rutaId),
    pagosDeHoy: pagosRuta.get(rutaId) ?? [],
    resumenPagosPorPrestamo: historialRuta.get(rutaId) ?? [],
    registrosVisitas: registrosRuta.get(rutaId) ?? [],
    asignaciones: (asignacionesRuta.get(rutaId) ?? []).map((a) => ({
      ...a,
      cliente: {
        ...a.cliente,
        prestamos: a.cliente.prestamos.filter((p) => p.rutaId === rutaId),
      },
    })),
    reprogramacionesJornada,
    gastosFinal: gastosRuta.get(rutaId) ?? 0,
    clienteRegularizado: (id: string) => {
      const c = clientesPorId.get(id);
      return (
        c && { ...c, prestamos: c.prestamos.filter((p) => p.rutaId === rutaId) }
      );
    },
  });
}

export type DatosVisitas = ReturnType<
  Awaited<ReturnType<typeof cargarVisitas>>
>;
