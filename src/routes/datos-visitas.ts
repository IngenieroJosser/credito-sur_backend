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

/**
 * Las columnas de cuota que necesita la proyeccion del LISTADO.
 *
 * No es una lista escrita de memoria: el tipo de retorno de `cargarVisitas`
 * pasa a ser la UNION de las dos formas, asi que `proyectarVisitas` y
 * `moraDelListado` solo compilan si se conforman con estas. Si alguien añade
 * una lectura de otra columna, `tsc` lo dice antes de que llegue a produccion.
 */
const CUOTA_PARA_EL_RESUMEN = {
  id: true,
  prestamoId: true,
  numeroCuota: true,
  fechaVencimiento: true,
  fechaVencimientoProrroga: true,
  monto: true,
  montoPagado: true,
  estado: true,
} as const;

export async function cargarVisitas(
  // `Prisma.TransactionClient` es el cliente SIN extender, y el de este
  // proyecto lleva la extension que intercepta las escrituras: con ese tipo,
  // pasarle `this.prisma` no compila. El alias del repo es `TransaccionPrisma`,
  // y su comentario en `prisma.service.ts` describe exactamente este error.
  db: TransaccionPrisma,
  ids: string[],
  fechaKey: string,
  /**
   * Que columnas de cada cuota traer.
   *
   * ── Por que existe esta opcion ────────────────────────────────────────────
   *
   * El `include` de `cuotas` no llevaba ni `select` ni `where`: traia las 15
   * columnas de TODAS las cuotas de cada credito. Medido con la base de carga
   * (20 rutas, 2.000 clientes, 3.000 creditos, 90.000 cuotas), esta consulta
   * es el **97% del tiempo de `cargarVisitas`**, y `cargarVisitas` es el **97%
   * de `GET /routes`**:
   *
   *     SONDA proyectarRutas  consultas=4462ms  proyectar=206ms  rutas=20
   *
   *     1 rutaJornada                   2 ms      5 registroVisita     6 ms
   *     2 pago.findMany                30 ms      6 gastos             2 ms
   *     3 historial (raw)              26 ms      7 aprobaciones       3 ms
   *     4 asignaciones+...+cuotas    2860 ms   <-- aqui
   *
   * Y no es la base de datos: `explain (analyze, buffers)` lee las 90.000
   * cuotas en **73 ms** sin tocar disco. El resto es Prisma materializando
   * 90.000 objetos, que es CPU.
   *
   * Medido por **tiempo de CPU del proceso** y no de reloj —con reloj la misma
   * configuracion daba de 1.369 a 4.312 ms en esta maquina y no se podia
   * decidir nada—:
   *
   *     15 columnas, todas las filas    CPU mediana 3.187 ms  (2.391-3.969)
   *     8 columnas,  todas las filas    CPU mediana 2.172 ms  (1.921-2.625)
   *
   * Los rangos no se solapan: **un 32% menos de CPU**, y crece con la cartera.
   *
   * ── Por que NO se recorta siempre ─────────────────────────────────────────
   *
   * Porque `getDailyVisits` manda estas cuotas **al navegador del cobrador y a
   * su copia offline**, y el tipo `CuotaOperativa` del frontend declara
   * **once** de las quince columnas —`montoCapital`, `montoInteres` y
   * `montoInteresMora` entre ellas, con un comentario que dice que son columnas
   * del modelo del backend—. Recortarlas ahi dejaria campos en `undefined` que
   * un `?? 0` absorberia sin que nada fallara.
   *
   * El LISTADO, en cambio, no manda ninguna cuota: de toda la proyeccion solo
   * usa `resumen` y la mora. Por eso el recorte va aqui y no alla.
   *
   * ── Lo que NO se hizo, y por que ──────────────────────────────────────────
   *
   * Tambien se midio excluir las cuotas PAGADA (CPU mediana 1.687 ms, un 47%
   * menos). **No se aplica**: `proximaCuota` se resuelve con
   * `cuotasSorted.find(noPagada) || cuotasSorted[0]`, asi que un credito con
   * todas las cuotas pagadas pasaria de tener cuota a no tenerla, y eso mueve
   * `total` y `efectividad` del resumen. Es un cambio de comportamiento en una
   * pantalla de dinero, no una optimizacion.
   */
  opciones?: { cuotasSoloParaElResumen?: boolean },
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
                  cuotas: opciones?.cuotasSoloParaElResumen
                    ? {
                        orderBy: { fechaVencimiento: 'asc' },
                        select: CUOTA_PARA_EL_RESUMEN,
                      }
                    : { orderBy: { fechaVencimiento: 'asc' } },
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
