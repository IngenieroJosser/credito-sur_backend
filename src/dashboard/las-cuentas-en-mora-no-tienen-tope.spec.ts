import * as fs from 'fs';
import * as path from 'path';
import { DashboardService } from './dashboard.service';
import { comoPrisma, type DobleDePrisma } from '../common/testing/dobles';

/**
 * El tablero decia 500 cuentas en mora habiendo 3.000.
 *
 * ── El defecto ─────────────────────────────────────────────────────────────
 *
 * `delinquentAccounts` —la cifra de cuentas en mora del panel— se calculaba
 * con un `findMany` de hasta **500** creditos (`take: 500`, con el comentario
 * «mantenemos un limite razonable para no degradar el dashboard») y hasta
 * **50** cuotas de cada uno (`take: 50`, sin `orderBy`), que luego se contaban
 * en memoria.
 *
 * O sea que el numero **no podia pasar de 500**. Medido contra la base de carga
 * (20 rutas, 2.000 clientes, 3.000 creditos, 90.000 cuotas):
 *
 *     el tablero decia:    500
 *     la base dice:      3.000
 *
 * Y 500 es una cifra lo bastante creible para que nadie la dude: es la peor
 * clase de fallo, el que no falla sino que miente. El `take: 50` era igual de
 * silencioso: sin orden, un credito con muchas cuotas impagas podia no traer
 * la vencida y quedar fuera del conteo.
 *
 * ── El arreglo ────────────────────────────────────────────────────────────
 *
 * Un `count(*)` en SQL con la misma regla: credito no borrado, ACTIVO o
 * EN_MORA, que pase el pre-filtro de antes y que tenga alguna cuota impaga
 * cuya fecha EFECTIVA —la prorroga si la hay— sea anterior a hoy.
 *
 * Medido despues, mismo volumen: el tablero dice 3.000, y de los 191 valores
 * que devuelve el endpoint **cambia exactamente uno**, el que estaba mal. De
 * paso, `/dashboard` paso de 4,4-5,2 s a 2,7-3,8 s.
 *
 * ── Lo que esta prueba vigila, y lo que no ────────────────────────────────
 *
 * Vigila que la cifra venga del conteo y **no se recorte**, ejercitando el
 * metodo con un doble. **No ejecuta el SQL**: eso necesita una base, y la
 * verificacion esta hecha contra la de carga y anotada arriba con los numeros.
 * Por eso ademas se mira el TEXTO de la consulta —sin `least`, sin `limit`—:
 * con el tope metido dentro del SQL, el doble lo dejaba pasar en verde.
 */
describe('las cuentas en mora del panel no tienen tope', () => {
  function doble(total: number, overrides: DobleDePrisma = {}) {
    return {
      aprobacion: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { montoSolicitud: 0 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      prestamo: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 0 } }),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      pago: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { montoTotal: 0 } }),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
      },
      transaccion: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 0 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      cuota: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 0 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      usuario: { findUnique: jest.fn().mockResolvedValue(null) },
      journalLine: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { debitAmount: 0 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ total }]),
      ...overrides,
    };
  }

  it.each([0, 1, 499, 500, 501, 3000, 47_123])(
    'con %s cuentas en mora, el panel dice ese mismo numero',
    async (total) => {
      const prisma = doble(total);
      const r = (await new DashboardService(
        comoPrisma(prisma),
      ).getDashboardData('today')) as {
        metrics: { delinquentAccounts: number };
      };

      // Lo que importa: 501 y 3.000 son justo los casos que el `take: 500`
      // convertia en 500.
      expect(r.metrics.delinquentAccounts).toBe(total);
    },
  );

  it('devuelve el saldo completo aunque el detalle solo muestre diez créditos', async () => {
    const prisma = doble(12);
    prisma.$queryRaw.mockResolvedValue([{ total: 12, monto: 1550 }]);
    prisma.prestamo.findMany.mockResolvedValueOnce(
      Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        cliente: {
          nombres: 'Cliente',
          apellidos: String(i),
          asignacionesRuta: [],
        },
        saldoPendiente: 100,
        cuotas: [{ fechaVencimiento: new Date('2025-01-01T00:00:00Z') }],
      })),
    );
    const r = await new DashboardService(comoPrisma(prisma)).getDashboardData(
      'today',
    );
    expect(r.delinquentAccounts).toHaveLength(10);
    expect(r.delinquentAccounts.reduce((s, c) => s + c.amountDue, 0)).toBe(
      1000,
    );
    expect(r.metrics).toMatchObject({
      delinquentAccounts: 12,
      delinquentAmount: 1550,
    });
    const consulta = prisma.prestamo.findMany.mock.calls[0][0];
    expect(consulta.take).toBe(10);
    expect(consulta.where.cuotas.some.OR).toEqual([
      { fechaVencimientoProrroga: { lt: expect.any(Date) } },
      {
        fechaVencimientoProrroga: null,
        fechaVencimiento: { lt: expect.any(Date) },
      },
    ]);
    expect(consulta.include.cuotas.where).toEqual(consulta.where.cuotas.some);
  });

  it('la cifra sale de un conteo en la base, no de contar filas traidas', async () => {
    const prisma = doble(3000);
    await new DashboardService(comoPrisma(prisma)).getDashboardData('today');

    /*
     * `$queryRaw` tiene que haberse llamado: si alguien volviera al `findMany`
     * con `take`, esta asercion caeria aunque el numero de arriba cuadrara por
     * casualidad.
     */
    const queryRaw = prisma.$queryRaw;
    expect(queryRaw).toHaveBeenCalled();

    const sql = String(queryRaw.mock.calls[0]?.[0] ?? '');
    expect(sql).toMatch(/count\(\*\)/i);
    expect(sql).toMatch(/sum\(p\."saldoPendiente"\)/i);
    // La prorroga es lo que antes se resolvia en memoria y es facil de perder
    // al reescribir la consulta.
    expect(sql).toMatch(/fechaVencimientoProrroga/);

    /*
     * Y que la consulta no traiga un tope propio.
     *
     * Esto se agrego por lo que enseño la comprobacion al reves: metiendo el
     * tope DENTRO del SQL —`least(count(*), 500)`— las 19 pruebas seguian en
     * verde, porque el doble devuelve lo que se le diga y el SQL no se ejecuta
     * aqui. Mirar el texto de la consulta no es tan bueno como ejecutarla,
     * pero cierra el hueco de la regresion realista.
     */
    expect(sql).not.toMatch(/least[ ]*\(/i);
    expect(sql).not.toMatch(/limit/i);
  });
});

describe('el codigo ya no lleva el tope que mentia', () => {
  const FUENTE = fs
    .readFileSync(path.join(__dirname, 'dashboard.service.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(new RegExp('\\/\\/[^\\n]*', 'g'), ' ');

  it('no queda ningun `take: 500`', () => {
    // Era el tope del conteo. Se comprueba sobre el archivo SIN comentarios,
    // porque el comentario que explica el defecto nombra el `take: 500`.
    expect(FUENTE).not.toMatch(/take:\s*500/);
  });

  it('y el barrido mira algo: el archivo sigue teniendo consultas', () => {
    // Piso medido: si la lectura fallara o el archivo cambiara de sitio, la
    // asercion de arriba pasaria en verde sin haber comprobado nada.
    expect(FUENTE.length).toBeGreaterThan(20_000);
    expect(FUENTE).toMatch(/findMany/);
  });
});
