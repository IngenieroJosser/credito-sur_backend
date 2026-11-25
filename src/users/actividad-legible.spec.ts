import * as fs from 'fs';
import * as path from 'path';
import {
  FRASES,
  comoPesos,
  frasePorAccion,
  normalizarEntidad,
  resolverNombres,
  tipoPorAccion,
  type ClienteDeConsulta,
} from './actividad-legible';

/**
 * La actividad del usuario se lee en español y sin identificadores.
 *
 * ── Lo que enseñaba la pantalla ───────────────────────────────────────────
 *
 *     ACTUALIZAR_USUARIO   Usuario fe3e3d3f-00ff-44f9-9f68-fdc40305cffc
 *     CREAR_PRESTAMO       Prestamo b86ee359-c87c-4b7f-8c50-44c620bb5e2e
 *
 * El nombre del enum y un UUID. Ni qué pasó, ni sobre quién. Venía de esta
 * línea del servicio:
 *
 *     detail: `${item.entidad || ''} ${item.entidadId || ''}`.trim()
 *
 * ── Lo que vigila esta prueba ─────────────────────────────────────────────
 *
 * Sobre todo, que **ninguna acción se quede sin frase**. El barrido lee todo
 * `src/` buscando los `accion: '...'` que el backend escribe de verdad y
 * exige que cada uno esté en la tabla. Si alguien añade una acción nueva y no
 * la traduce, esto lo dice antes de que llegue a producción.
 */
const RAIZ = path.join(process.cwd(), 'src');

/** Las acciones que el backend escribe, leídas del propio código. */
const accionesDelCodigo = (() => {
  const encontradas = new Set<string>();
  const recorrer = (dir: string) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const completo = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        if (entrada.name === 'node_modules' || entrada.name === 'migrations')
          continue;
        recorrer(completo);
        continue;
      }
      if (!entrada.name.endsWith('.ts')) continue;
      if (entrada.name.endsWith('.spec.ts')) continue;
      const fuente = fs.readFileSync(completo, 'utf8');
      for (const m of fuente.matchAll(/accion:\s*'([A-Z_]+)'/g)) {
        encontradas.add(m[1]);
      }
    }
  };
  recorrer(RAIZ);
  return [...encontradas].sort();
})();

describe('ninguna acción llega a la pantalla en mayúsculas', () => {
  it('el barrido encuentra las acciones del código', () => {
    /*
     * Piso medido: hay 57. Sin esto, un fallo del barrido dejaría la lista
     * vacía y la prueba de abajo pasaría sin comprobar nada.
     */
    expect(accionesDelCodigo.length).toBeGreaterThanOrEqual(50);
    expect(accionesDelCodigo).toContain('REGISTRAR_PAGO');
  });

  it('todas tienen su frase en español', () => {
    const sinFrase = accionesDelCodigo.filter((a) => !FRASES[a]);

    expect(sinFrase).toEqual([]);
  });

  it('y ninguna frase es el enum disfrazado', () => {
    for (const [accion, frase] of Object.entries(FRASES)) {
      expect(frase).not.toBe(accion);
      expect(frase).not.toMatch(/_/);
      // Empieza en mayúscula y sigue en minúsculas: es una frase, no un enum.
      expect(frase).toMatch(/^[A-ZÁÉÍÓÚ][^A-Z]*$/);
    }
  });
});

describe('una acción desconocida tampoco sale en crudo', () => {
  it('convierte el enum en algo legible', () => {
    /*
     * El respaldo importa: el día que alguien registre una acción nueva sin
     * pasar por aquí, lo peor que puede salir es «Algo raro», no «ALGO_RARO».
     */
    expect(frasePorAccion('ALGO_RARO_NUEVO')).toBe('Algo raro nuevo');
  });

  it('y sin acción dice algo, no una cadena vacía', () => {
    expect(frasePorAccion('')).toBe('Actividad');
  });
});

describe('el dinero se marca como entra o sale', () => {
  it.each([
    ['REGISTRAR_PAGO', 'in'],
    ['REVERSAR_PAGO', 'out'],
    ['CREAR_PRESTAMO', 'out'],
    ['CREAR_RUTA', 'neutral'],
    ['LO_QUE_SEA', 'neutral'],
  ])('%s → %s', (accion, esperado) => {
    expect(tipoPorAccion(accion)).toBe(esperado);
  });
});

describe('los importes', () => {
  it('se escriben en pesos con puntos de miles', () => {
    expect(comoPesos(1234567)).toBe('$ 1.234.567');
  });

  it('un cero o un nulo no se muestran', () => {
    /*
     * «$ 0» en una línea de actividad se lee como «movió cero pesos». Si no
     * hay importe, no se pinta nada: la regla de siempre aquí.
     */
    expect(comoPesos(0)).toBeUndefined();
    expect(comoPesos(null)).toBeUndefined();
    expect(comoPesos(undefined)).toBeUndefined();
  });
});

describe('las entidades se comparan normalizadas', () => {
  it('`Prestamo` y `PRESTAMO` son la misma cosa', () => {
    /*
     * En la base conviven las dos formas porque los módulos no se pusieron de
     * acuerdo. Sin normalizar, la mitad de los registros se quedaban sin
     * resolver y la pantalla seguía mostrando el identificador.
     */
    expect(normalizarEntidad('Prestamo')).toBe(normalizarEntidad('PRESTAMO'));
    expect(normalizarEntidad(' Pago ')).toBe('PAGO');
    expect(normalizarEntidad(null)).toBe('');
  });
});

describe('resolver nombres en bloque', () => {
  const sinFilas = () => jest.fn().mockResolvedValue([]);

  const dobleCon = (overrides: Partial<ClienteDeConsulta>) => ({
    prestamo: { findMany: sinFilas() },
    pago: { findMany: sinFilas() },
    cliente: { findMany: sinFilas() },
    ruta: { findMany: sinFilas() },
    usuario: { findMany: sinFilas() },
    transaccion: { findMany: sinFilas() },
    gasto: { findMany: sinFilas() },
    ...overrides,
  });

  it('devuelve el número del crédito y el nombre del cliente', async () => {
    const db = dobleCon({
      prestamo: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'p1',
            numeroPrestamo: 'CR-0012',
            monto: 1_500_000,
            cliente: { nombres: 'Juan', apellidos: 'Pérez' },
          },
        ]),
      },
    });

    const r = await resolverNombres(db, [
      { entidad: 'Prestamo', entidadId: 'p1' },
    ]);

    expect(r.get('PRESTAMO:p1')).toEqual({
      texto: 'Crédito CR-0012 · Juan Pérez',
      importe: '$ 1.500.000',
    });
  });

  it('una consulta por TIPO de entidad, no una por fila', async () => {
    /*
     * Con doce registros de actividad, resolver uno a uno serían doce viajes
     * a la base. Se mide llamando con tres créditos y comprobando que la
     * consulta se hizo UNA vez.
     */
    const findMany = jest.fn().mockResolvedValue([]);
    const db = dobleCon({ prestamo: { findMany } });

    await resolverNombres(db, [
      { entidad: 'Prestamo', entidadId: 'p1' },
      { entidad: 'PRESTAMO', entidadId: 'p2' },
      { entidad: 'Prestamo', entidadId: 'p3' },
    ]);

    expect(findMany).toHaveBeenCalledTimes(1);
    const args = findMany.mock.calls[0][0] as {
      where: { id: { in: string[] } };
    };
    expect(args.where.id.in.sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('no consulta las entidades que no aparecen', async () => {
    const pago = jest.fn().mockResolvedValue([]);
    const db = dobleCon({ pago: { findMany: pago } });

    await resolverNombres(db, [{ entidad: 'Ruta', entidadId: 'r1' }]);

    expect(pago).not.toHaveBeenCalled();
  });

  it('lo que no se resuelve se queda fuera, sin UUID', async () => {
    const db = dobleCon({});

    const r = await resolverNombres(db, [
      { entidad: 'Prestamo', entidadId: 'no-existe' },
      { entidad: null, entidadId: 'x' },
      { entidad: 'Ruta', entidadId: null },
    ]);

    expect(r.size).toBe(0);
  });
});
