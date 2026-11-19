import { Prisma } from '@prisma/client';
import { Client } from 'pg';
import { comoPrisma } from '../common/testing/dobles';
import { leerCierresDelListado } from './cierres-del-listado';

const ruta = (id: string) => ({ id, nombre: id, cobrador: null });
const hoy = '2026-06-04';

it.each([0, 1, 50])(
  'lee cierres para %i rutas sin escribir ni consultar por ruta',
  async (cantidad) => {
    const rutas = Array.from({ length: cantidad }, (_, i) => ruta(String(i)));
    const consulta = jest.fn().mockResolvedValue([]);
    const resumen = await leerCierresDelListado(
      comoPrisma({ $queryRaw: consulta }),
      rutas,
      hoy,
    );
    expect(consulta).toHaveBeenCalledTimes(cantidad ? 1 : 0);
    expect(resumen.size).toBe(cantidad);
    for (const item of resumen.values()) {
      expect(item).toEqual({
        cierresPendientes: [],
        cierrePendienteAnterior: null,
        totalCierresPendientes: 0,
        tieneCierrePendiente: false,
      });
    }
  },
);

// La misma sentencia que ejecuta Prisma, contra relaciones sintéticas sin escribir en BD.
const itPostgres = process.env.PROBAR_CIERRES_POSTGRES === '1' ? it : it.skip;
itPostgres(
  'combina jornadas y activaciones antiguas por caja y día de Bogotá',
  async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
      throw new Error('Esta prueba requiere PostgreSQL local');
    const pg = new Client({ connectionString: url.href });
    await pg.connect();
    try {
      const consulta = jest.fn(
        async (sql: Prisma.Sql) =>
          (
            await pg.query(
              `
      WITH cajas(id, "rutaId", activa, tipo) AS (VALUES
        ('c1','r1',true,'RUTA'), ('c2','r2',true,'RUTA'), ('c3','r3',false,'RUTA')),
      rutas_jornadas("rutaId","fechaOperativa",estado,"activadaEn","activacionTransaccionId") AS (VALUES
        ('r1','2026-06-01','ABIERTA',timestamp '2026-06-01 16:00','j1'),
        ('r1','2026-06-02','CERRADA',timestamp '2026-06-02 16:00','j2'),
        ('r1','2026-06-04','ABIERTA',timestamp '2026-06-04 16:00','j4'),
        ('r2','2026-06-03','PENDIENTE_CIERRE',timestamp '2026-06-03 16:00','j3')),
      "Transaccion"(id,"cajaId","tipoReferencia","fechaTransaccion") AS (VALUES
        ('duplicada','c1','ACTIVACION_RUTA',timestamp '2026-06-02 04:59'),
        ('cerrada','c1','ACTIVACION_RUTA',timestamp '2026-06-02 05:01'),
        ('antigua','c1','ACTIVACION_RUTA',timestamp '2026-06-04 04:59'),
        ('cierre-otra-caja','c2','CIERRE_RUTA',timestamp '2026-06-03 12:00'),
        ('de-hoy','c1','ACTIVACION_RUTA',timestamp '2026-06-04 05:00'),
        ('regularizada','c1','ACTIVACION_RUTA',timestamp '2026-05-30 06:00'),
        ('cierre-misma-caja','c1','CIERRE_RUTA',timestamp '2026-05-31 04:00'),
        ('inactiva','c3','ACTIVACION_RUTA',timestamp '2026-06-03 14:00'))
      SELECT * FROM (${sql.text}) seleccion
      ORDER BY "rutaId","fechaOperativa","fechaActivacion","activacionId"`,
              sql.values,
            )
          ).rows,
      );
      const leer = (ids: string[]) =>
        leerCierresDelListado(
          comoPrisma({ $queryRaw: consulta }),
          ids.map(ruta),
          hoy,
        );
      const resumen = await leer(['r1', 'r2', 'r3']);
      expect(
        resumen.get('r1')?.cierresPendientes.map((c) => c.activacionId),
      ).toEqual(['j1', 'antigua']);
      expect(resumen.get('r1')?.cierrePendienteAnterior?.diasPendiente).toBe(3);
      expect(resumen.get('r1')?.cierresPendientes[1]).toMatchObject({
        fechaOperativa: '2026-06-03',
        diasPendiente: 1,
        origenDeteccion: 'TRANSACCION_ACTIVACION_LEGACY',
      });
      expect(resumen.get('r2')?.cierrePendienteAnterior?.activacionId).toBe(
        'j3',
      );
      expect(resumen.get('r3')?.tieneCierrePendiente).toBe(false);
      expect([...(await leer(['r2'])).keys()]).toEqual(['r2']);
    } finally {
      await pg.end();
    }
  },
);
