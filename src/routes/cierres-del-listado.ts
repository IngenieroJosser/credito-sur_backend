import { Prisma } from '@prisma/client';
import {
  formatBogotaOffsetIso,
  getBogotaStartEndOfDayFromKey,
} from '../utils/date-utils';

type RutaDeCierre = {
  id: string;
  nombre: string;
  cobrador: { id: string; nombres: string; apellidos: string } | null;
};

export function describirPendiente(
  ruta: RutaDeCierre,
  cajaId: string,
  fechaOperativa: string,
  fechaActivacion: Date,
  activacionId: string | null,
  hoy: string,
  legacy = false,
) {
  const diasPendiente = Math.max(
    (Date.parse(hoy) - Date.parse(fechaOperativa)) / 86_400_000,
    0,
  );
  return {
    rutaId: ruta.id,
    rutaNombre: ruta.nombre,
    cajaId,
    cobradorId: ruta.cobrador?.id ?? null,
    cobradorNombre: ruta.cobrador
      ? `${ruta.cobrador.nombres} ${ruta.cobrador.apellidos}`.trim()
      : null,
    activacionId,
    fechaOperativa,
    fechaActivacion: formatBogotaOffsetIso(fechaActivacion),
    diasPendiente,
    pendienteCierre: true,
    requiereRegularizacion: true,
    ...(legacy ? { origenDeteccion: 'TRANSACCION_ACTIVACION_LEGACY' } : {}),
    message: `La ruta tiene una jornada pendiente de cierre del ${fechaOperativa}.`,
  };
}

type Fila = {
  rutaId: string;
  cajaId: string;
  fechaOperativa: string;
  fechaActivacion: Date;
  activacionId: string | null;
  legacy: boolean;
};

// El listado proyecta el estado efectivo sin regularizar jornadas ni recalcular deudas.
// Los NOT EXISTS descartan dentro de Postgres el historial ya cerrado.
export async function leerCierresDelListado(
  db: Pick<Prisma.TransactionClient, '$queryRaw'>,
  rutas: RutaDeCierre[],
  hoy: string,
) {
  const porRuta = new Map(rutas.map((ruta) => [ruta.id, ruta]));
  const resumen = new Map(
    rutas.map((ruta) => [
      ruta.id,
      {
        cierresPendientes: [] as ReturnType<typeof describirPendiente>[],
        cierrePendienteAnterior: null as ReturnType<
          typeof describirPendiente
        > | null,
        totalCierresPendientes: 0,
        tieneCierrePendiente: false,
      },
    ]),
  );
  if (!rutas.length) return resumen;
  const { startDate } = getBogotaStartEndOfDayFromKey(hoy);
  const filas = await db.$queryRaw<Fila[]>(Prisma.sql`
    WITH cajas_ruta AS (
      SELECT id, "rutaId" FROM cajas WHERE activa AND tipo = 'RUTA'
      AND "rutaId" IN (${Prisma.join(rutas.map((ruta) => ruta.id))})
    ), activaciones AS (
      SELECT c."rutaId", c.id AS "cajaId", t.id, t."fechaTransaccion",
        (t."fechaTransaccion" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota')::date AS dia
      FROM cajas_ruta c JOIN "Transaccion" t ON t."cajaId" = c.id
      WHERE t."tipoReferencia" = 'ACTIVACION_RUTA'
        AND t."fechaTransaccion" < (${startDate}::timestamptz AT TIME ZONE 'UTC')
    )
    SELECT c."rutaId", c.id AS "cajaId", j."fechaOperativa",
      j."activadaEn" AS "fechaActivacion", j."activacionTransaccionId" AS "activacionId", false AS legacy
    FROM cajas_ruta c JOIN rutas_jornadas j ON j."rutaId" = c."rutaId"
    WHERE j.estado = 'PENDIENTE_CIERRE' OR (j.estado = 'ABIERTA' AND j."fechaOperativa" < ${hoy})
    UNION ALL
    SELECT a."rutaId", a."cajaId", to_char(a.dia, 'YYYY-MM-DD'), a."fechaTransaccion", a.id, true
    FROM activaciones a
    WHERE NOT EXISTS (
      SELECT 1 FROM rutas_jornadas j WHERE j."rutaId" = a."rutaId"
      AND j."fechaOperativa" = to_char(a.dia, 'YYYY-MM-DD')
    ) AND NOT EXISTS (
      SELECT 1 FROM "Transaccion" t WHERE t."cajaId" = a."cajaId" AND t."tipoReferencia" = 'CIERRE_RUTA'
      AND t."fechaTransaccion" >= (a.dia::timestamp AT TIME ZONE 'America/Bogota' AT TIME ZONE 'UTC')
      AND t."fechaTransaccion" < ((a.dia + 1)::timestamp AT TIME ZONE 'America/Bogota' AT TIME ZONE 'UTC')
    )
    ORDER BY "rutaId", "fechaOperativa", "fechaActivacion", "activacionId"
  `);
  for (const fila of filas) {
    const ruta = porRuta.get(fila.rutaId);
    const item = resumen.get(fila.rutaId);
    if (!ruta || !item) continue;
    const cierre = describirPendiente(
      ruta,
      fila.cajaId,
      fila.fechaOperativa,
      fila.fechaActivacion,
      fila.activacionId,
      hoy,
      fila.legacy,
    );
    item.cierresPendientes.push(cierre);
    item.cierrePendienteAnterior ??= cierre;
    item.totalCierresPendientes++;
    item.tieneCierrePendiente = true;
  }
  return resumen;
}
