import * as fs from 'fs';
import * as path from 'path';
import { moraDelListado } from './estadisticas-listado';
import type { DatosVisitas } from './datos-visitas';

/**
 * La mora de una ruta se calcula sobre la cartera DE ESA RUTA.
 *
 * ── Por qué existe esta prueba ─────────────────────────────────────────────
 *
 * El refactor del listado cambió exactamente UNA cifra de la respuesta —medido
 * campo por campo contra el código anterior: 340 campos, uno solo— y esa cifra
 * es `porcentajeMora`, de 71,41 a 67,91. Es una corrección: los 3 créditos de
 * diferencia tienen `rutaId` nulo, o sea que no son de ninguna ruta, y contarlos
 * ahí contradice la invariante del dominio (la ruta la lleva el CRÉDITO) y su
 * centinela `ruta-del-credito-no-del-cliente.spec.ts`.
 *
 * Y no la fijaba nada: `/code-review` sobre ese commit avisó de que ninguna
 * prueba nombraba `moraDelListado`, que las del listado doblan
 * `proyectarVisitas` y nunca llegan al cálculo, y que **revertir la corrección
 * dejaba la suite en verde**. Una cifra de dinero sin prueba vuelve sola.
 */
const cuota = (monto: number, vencimiento: string, estado = 'PENDIENTE') => ({
  monto,
  estado,
  fechaVencimiento: new Date(vencimiento),
});

const credito = (
  id: string,
  rutaId: string | null,
  saldo: number,
  cuotas: ReturnType<typeof cuota>[],
  estado = 'ACTIVO',
) => ({ id, rutaId, saldoPendiente: saldo, estado, cuotas });

const datos = (
  asignaciones: Array<{ cliente: { id: string; prestamos: unknown[] } }>,
  extra: Record<string, unknown> = {},
) =>
  ({
    asignaciones,
    pagosDeHoy: [],
    registrosVisitas: [],
    ...extra,
  }) as unknown as DatosVisitas;

const AYER = '2026-11-18T12:00:00.000Z';
const MANANA = '2026-11-20T12:00:00.000Z';
const HOY_INICIO = new Date('2026-11-19T05:00:00.000Z');

describe('la mora de la ruta sale de su propia cartera', () => {
  it('cuenta lo vencido sobre el saldo, en porcentaje', () => {
    const d = datos([
      {
        cliente: {
          id: 'c1',
          prestamos: [credito('p1', 'r1', 1000, [cuota(250, AYER)])],
        },
      },
    ]);

    expect(moraDelListado(d, HOY_INICIO)).toBeCloseTo(25, 2);
  });

  it('una cuota que vence mañana no es mora', () => {
    const d = datos([
      {
        cliente: {
          id: 'c1',
          prestamos: [credito('p1', 'r1', 1000, [cuota(250, MANANA)])],
        },
      },
    ]);

    expect(moraDelListado(d, HOY_INICIO)).toBe(0);
  });

  it('una cuota ya PAGADA no es mora aunque esté vencida', () => {
    const d = datos([
      {
        cliente: {
          id: 'c1',
          prestamos: [credito('p1', 'r1', 1000, [cuota(250, AYER, 'PAGADA')])],
        },
      },
    ]);

    expect(moraDelListado(d, HOY_INICIO)).toBe(0);
  });

  it('un cliente con DOS asignaciones no duplica su cartera', () => {
    /*
     * El indice unico es `(rutaId, clienteId) WHERE activa`, asi que el mismo
     * cliente puede estar activo en dos rutas y aparecer dos veces aqui. Sin el
     * deduplicado por id de credito, su saldo y su vencido se cuentan dos veces.
     *
     * El caso es ASIMETRICO a proposito: el credito repetido tiene mora y el
     * otro no. Con un fixture simetrico —el mismo credito dos veces y nada mas—
     * el doble conteo dobla saldo Y vencido, el porcentaje sale identico y la
     * prueba pasa en verde con el defecto puesto. Comprobado quitando el
     * `vistos.has(p.id)`: con el caso simetrico las once pruebas seguian
     * pasando.
     *
     *   con deduplicado:  250 / 2.000 = 12,5 %
     *   sin deduplicado:  500 / 3.000 = 16,67 %
     */
    const repetido = credito('p1', 'r1', 1000, [cuota(250, AYER)]);
    const alDia = credito('p2', 'r1', 1000, [cuota(250, MANANA)]);
    const d = datos([
      { cliente: { id: 'c1', prestamos: [repetido, alDia] } },
      { cliente: { id: 'c1', prestamos: [repetido] } },
    ]);

    expect(moraDelListado(d, HOY_INICIO)).toBeCloseTo(12.5, 2);
  });

  it('solo entran los créditos vivos: un PAGADO no pesa en la mora', () => {
    const d = datos([
      {
        cliente: {
          id: 'c1',
          prestamos: [
            credito('p1', 'r1', 1000, [cuota(250, AYER)]),
            credito('p2', 'r1', 5000, [cuota(5000, AYER)], 'PAGADO'),
          ],
        },
      },
    ]);

    // Si el PAGADO entrara, serían 5.250 / 6.000 = 87,5%.
    expect(moraDelListado(d, HOY_INICIO)).toBeCloseTo(25, 2);
  });

  it('el ausente de hoy no cuenta, pero sí si pagó', () => {
    const conCredito = {
      cliente: {
        id: 'c1',
        prestamos: [credito('p1', 'r1', 1000, [cuota(1000, AYER)])],
      },
    };

    const ausente = moraDelListado(
      datos([conCredito], {
        registrosVisitas: [{ clienteId: 'c1', estadoVisita: 'ausente' }],
      }),
      HOY_INICIO,
    );
    expect(ausente).toBe(0);

    const ausenteQuePago = moraDelListado(
      datos([conCredito], {
        registrosVisitas: [{ clienteId: 'c1', estadoVisita: 'ausente' }],
        pagosDeHoy: [{ clienteId: 'c1', origenGestion: null }],
      }),
      HOY_INICIO,
    );
    expect(ausenteQuePago).toBeCloseTo(100, 2);
  });

  it('sin saldo no divide por cero', () => {
    const d = datos([
      {
        cliente: {
          id: 'c1',
          prestamos: [credito('p1', 'r1', 0, [cuota(250, AYER)])],
        },
      },
    ]);

    expect(moraDelListado(d, HOY_INICIO)).toBe(0);
  });
});

/**
 * El detalle de la ruta y su fila del listado tienen que decir lo mismo.
 *
 * `/code-review` encontró que el refactor acotó la cartera en `findAll` y NO en
 * `findOne`: la misma ruta daba 67,91 en la lista y 71,41 en el detalle, y lo
 * mismo `totalDeuda` y `prestamosActivos`. Medido después del arreglo, con los
 * dos backends en marcha: de **2.113 campos de la respuesta del detalle, 3
 * cambian**, y los tres quedan de acuerdo con la lista.
 *
 * Es una centinela de código porque reproducirlo pide la cadena entera —dos
 * endpoints, su include y sus agregados—; lo que no puede volver es que uno de
 * los dos lea la cartera del CLIENTE.
 */
/**
 * Y la exclusion del credito SIN ruta, que es la correccion medida.
 *
 * Las pruebas de arriba fijan el deduplicado y los estados, pero NO esto: el
 * recorte por ruta no esta en `moraDelListado`, esta antes, en el `obtener` que
 * devuelve `cargarVisitas`. Sin esta centinela, quitar ese filtro deja la suite
 * en verde y la mora vuelve a inflarse con creditos que nadie cobra en esa ruta
 * —los 3 de `rutaId` nulo del caso medido, 1.665.000 de saldo—.
 */
describe('la jornada de una ruta solo lleva los creditos de esa ruta', () => {
  const FUENTE_DATOS = fs.readFileSync(
    path.join(__dirname, 'datos-visitas.ts'),
    'utf8',
  );

  it('la consulta pide solo los creditos de las rutas de la pagina', () => {
    expect(FUENTE_DATOS).toMatch(/rutaId: \{ in: ids \}/);
  });

  it('y el reparto por ruta vuelve a filtrarlos por la suya', () => {
    // Redundante con la consulta y a proposito: una pagina trae hasta 50 rutas
    // y cada una se queda con lo suyo. Si esto se fuera, cada ruta de la pagina
    // veria los creditos de las otras 49.
    expect(FUENTE_DATOS).toMatch(
      /prestamos\s*:\s*a\.cliente\.prestamos\.filter\(/,
    );
    expect(FUENTE_DATOS).toMatch(/p\.rutaId\s*===\s*rutaId/);
  });
});

describe('el detalle de la ruta acota su cartera igual que el listado', () => {
  const FUENTE = fs.readFileSync(
    path.join(__dirname, 'routes.service.ts'),
    'utf8',
  );

  const cuerpoDeFindOne = (() => {
    const inicio = FUENTE.indexOf('async findOne(');
    expect(inicio).toBeGreaterThan(0);
    const resto = FUENTE.slice(inicio + 10);
    const siguiente = resto.search(/\n {2}(?:private |protected )?async \w+\(/);
    const cuerpo = siguiente > 0 ? resto.slice(0, siguiente) : resto;
    // Piso medido: si el recorte sale corto, la centinela mira casi nada.
    expect(cuerpo.length).toBeGreaterThan(3000);
    return cuerpo;
  })();

  /**
   * El trozo del include que trae los creditos de cada asignacion.
   *
   * Se recorta a proposito en vez de buscar `rutaId: id` a secas: ese texto
   * aparece NUEVE veces dentro de `findOne` —cajas, jornadas, registros— y una
   * centinela que lo busque suelto pasa en verde aunque el include se quede sin
   * filtro. Comprobado quitandolo: con el `toMatch` suelto, las once pruebas
   * seguian pasando.
   */
  const includeDeLosCreditos = (() => {
    const inicio = cuerpoDeFindOne.indexOf('prestamos: {');
    expect(inicio).toBeGreaterThan(0);
    const trozo = cuerpoDeFindOne.slice(inicio, inicio + 1200);
    // Piso: el trozo tiene que llegar hasta los estados, o no esta mirando el
    // `where` completo.
    expect(trozo).toContain('EstadoPrestamo.ACTIVO');
    return trozo;
  })();

  it('el include del detalle filtra los creditos por la ruta', () => {
    expect(includeDeLosCreditos).toMatch(/rutaId: id,/);
  });

  it('y los pagos del dia tambien, por la ruta DEL CREDITO', () => {
    // Iba por `prestamo.cliente.asignacionesRuta`, así que un pago sobre un
    // crédito del mismo cliente en otra ruta entraba en esta cobranza.
    expect(cuerpoDeFindOne).toMatch(/prestamo: \{ rutaId: id \}/);
    expect(cuerpoDeFindOne).not.toMatch(
      /prestamo: \{\s*cliente: \{\s*asignacionesRuta/,
    );
  });
});

/**
 * El listado de rutas no manda la lista de clientes de cada ruta.
 *
 * ── Lo que pasaba ──────────────────────────────────────────────────────────
 *
 * La fila se armaba con `{ ...ruta, ... }`, y eso esparcía `asignaciones`
 * entera: los clientes de CADA ruta viajaban en el listado.
 *
 * ── Medido contra una base de carga ────────────────────────────────────────
 *
 * Se creó una base aparte (`credito_sur_carga`) con 20 rutas, 2.000 clientes,
 * 3.000 créditos, 90.000 cuotas y 30.000 pagos, y se midió el mismo endpoint:
 *
 *     desarrollo (1.629 cuotas):   13 KB   0,29 s
 *     carga      (90.000 cuotas): 635 KB   1,47 s   <- 33.764 bytes por ruta
 *     con el recorte:              15 KB   1,34 s
 *
 * O sea **un 97,6 % menos**, y la comparación campo por campo dio **0 campos
 * con valor distinto**: los 28.000 que desaparecen son todos de `asignaciones`.
 * Y crece con los clientes: con 10.000 serían megas, en la pantalla que el
 * coordinador tiene abierta todo el día.
 *
 * El listado solo necesita el número, y lo lee de `clientesAsignados`
 * (`RutasPageView.tsx`); la lista la pide el DETALLE a `findOne`. Lo comprobado
 * uno por uno: todos los consumidores de `ruta.asignaciones` son pantallas de
 * detalle.
 *
 * *El tiempo no es el mismo problema:* sigue en 1,34 s porque la consulta
 * todavía carga las asignaciones para contarlas. Eso queda anotado aparte.
 */
describe('el listado de rutas no arrastra los clientes de cada ruta', () => {
  const SERVICIO = fs.readFileSync(
    path.join(__dirname, 'routes.service.ts'),
    'utf8',
  );

  const CUERPO = (() => {
    const inicio = SERVICIO.indexOf('async findAll(');
    expect(inicio).toBeGreaterThan(0);
    const resto = SERVICIO.slice(inicio + 10);
    const siguiente = resto.search(/\n {2}(?:private |protected )?async \w+\(/);
    const cuerpo = siguiente > 0 ? resto.slice(0, siguiente) : resto;
    // Piso medido: si el recorte sale corto, la centinela mira casi nada.
    expect(cuerpo.length).toBeGreaterThan(5000);
    return cuerpo;
  })();

  it('la fila se arma SIN las asignaciones', () => {
    // Lo que no puede volver es el `...ruta` a secas.
    expect(CUERPO).toMatch(/\.\.\.rutaSinAsignaciones/);
    expect(CUERPO).not.toMatch(/return \{\s*\.\.\.ruta,/);
  });

  it('pero sigue contándolas para `clientesAsignados`', () => {
    // El número es lo único que el listado necesita: si esto se fuera, la
    // pantalla mostraría 0 clientes en cada ruta, que es un cero que miente.
    expect(CUERPO).toMatch(/clientesAsignados: new Set\(/);
    expect(CUERPO).toMatch(/asignacionesParaCalcular/);
  });

  it('y para los clientes nuevos de la semana', () => {
    expect(CUERPO).toMatch(
      /clientesNuevos: new Set\(\s*asignacionesParaCalcular/,
    );
  });
});
