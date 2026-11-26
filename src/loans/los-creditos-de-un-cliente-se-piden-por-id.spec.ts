/**
 * Los créditos de un cliente se piden por su id, no buscándolo por texto.
 *
 * ── Lo que pasaba ───────────────────────────────────────────────────────────
 *
 * Lo reportó el dueño con el caso delante: la pantalla de cobrar en la
 * oficina decía
 *
 *     «No hay un crédito al que abonar
 *      No se encontró ningún crédito activo de Elsy Maritza Chaverra Copete.»
 *
 * mientras la ficha de esa misma clienta mostraba CUATRO créditos en mora por
 * 9.230.000 pesos.
 *
 * La pantalla pedía los créditos así:
 *
 *     obtenerPrestamos({ search: clienteId, limit: 1 })
 *
 * y `search` compara —leyendo `getAllLoans`— contra `numeroPrestamo`, y
 * contra `nombres`, `apellidos` y `dni` del cliente, y contra el nombre del
 * producto. Nunca contra el id. Un UUID no se parece a ninguno de esos
 * campos, así que la respuesta venía vacía SIEMPRE: no era un fallo de datos
 * ni de permisos, era que esa consulta no podía encontrar nada nunca.
 *
 * El respaldo sin conexión de esa misma pantalla sí lo hacía bien, con el
 * índice `by-clienteId` de IndexedDB. Fallaba justo el camino con señal.
 *
 * ── Lo que vigila ───────────────────────────────────────────────────────────
 *
 * Que `clienteId` llegue al `where` como filtro de igualdad, y que NO se
 * mezcle con el `OR` de la búsqueda por texto: si acabara dentro del `OR`,
 * traería además los créditos de cualquiera cuyo nombre contenga ese texto.
 */
import { LoansService } from './loans.service';
import { comoPrisma, type DobleDePrisma } from '../common/testing/dobles';

type Where = {
  clienteId?: string;
  OR?: unknown[];
};

describe('getAllLoans filtra por cliente', () => {
  /*
   * El servicio con lo justo para que `getAllLoans` llegue a su `findMany`.
   * Montarlo con el modulo de Nest obligaria a declarar siete dependencias
   * que este camino no toca; es el mismo patron que `detalle-y-listado`.
   */
  const construir = () => {
    const prisma: DobleDePrisma = {
      prestamo: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: {}, _count: 0 }),
      },
      cuota: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: {}, _count: 0 }),
      },
      pago: { findMany: jest.fn().mockResolvedValue([]) },
      ruta: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const service = Object.create(LoansService.prototype) as LoansService;
    Object.assign(service, {
      prisma: comoPrisma(prisma),
      logger: { error: jest.fn(), log: jest.fn(), warn: jest.fn() },
    });

    return { service, prisma };
  };

  /** El `where` con el que se llamó a `findMany`. */
  const whereUsado = (prisma: DobleDePrisma): Where => {
    const findMany = prisma.prestamo?.findMany as jest.Mock;
    expect(findMany).toHaveBeenCalled();
    const args = findMany.mock.calls[0][0] as { where: Where };
    return args.where;
  };

  it('manda el id del cliente al `where`, no a la búsqueda por texto', async () => {
    const { service, prisma } = construir();

    await service.getAllLoans({ clienteId: 'cliente-1', limit: 20 }, null);

    const where = whereUsado(prisma);

    expect(where.clienteId).toBe('cliente-1');
    /*
     * Y no se cuela en el `OR`: ahí dentro sería «o este cliente, o
     * cualquiera que contenga este texto», que trae créditos ajenos.
     */
    expect(JSON.stringify(where.OR ?? [])).not.toContain('cliente-1');
  });

  it('sin `clienteId` no inventa el filtro', async () => {
    const { service, prisma } = construir();

    await service.getAllLoans({ limit: 20 }, null);

    expect(whereUsado(prisma).clienteId).toBeUndefined();
  });

  it('un `clienteId` en blanco se ignora en vez de buscar la cadena vacía', async () => {
    const { service, prisma } = construir();

    await service.getAllLoans({ clienteId: '   ', limit: 20 }, null);

    expect(whereUsado(prisma).clienteId).toBeUndefined();
  });

  /*
   * ── La sincronizacion incremental ──────────────────────────────────────
   *
   * La copia sin conexion bajaba la cartera ENTERA en cada arranque. Con
   * `desde` pide solo lo que se movio, y -esto es lo que se olvida siempre-
   * incluye los BORRADOS: si el filtro `eliminadoEn: null` se quedara
   * puesto, un credito borrado en el servidor seguiria vivo en el telefono
   * del cobrador para siempre, porque nunca volveria a aparecer en ninguna
   * respuesta.
   */
  it('con `desde` solo pide lo que cambio despues', async () => {
    const { service, prisma } = construir();

    await service.getAllLoans({ desde: '2026-11-25T00:00:00.000Z' }, null);

    const where = whereUsado(prisma) as Where & {
      actualizadoEn?: { gt: Date };
      eliminadoEn?: unknown;
    };
    expect(where.actualizadoEn?.gt).toEqual(
      new Date('2026-11-25T00:00:00.000Z'),
    );
  });

  it('con `desde` SI trae los borrados, para que el telefono los quite', async () => {
    const { service, prisma } = construir();

    await service.getAllLoans({ desde: '2026-11-25T00:00:00.000Z' }, null);

    const where = whereUsado(prisma) as Where & { eliminadoEn?: unknown };
    expect('eliminadoEn' in where).toBe(false);
  });

  it('sin `desde` sigue escondiendo los borrados', async () => {
    const { service, prisma } = construir();

    await service.getAllLoans({ limit: 20 }, null);

    const where = whereUsado(prisma) as Where & { eliminadoEn?: unknown };
    expect(where.eliminadoEn).toBeNull();
  });

  it('una fecha que no se entiende se ignora, no vacia el listado', async () => {
    const { service, prisma } = construir();

    await service.getAllLoans({ desde: 'ayer por la tarde' }, null);

    const where = whereUsado(prisma) as Where & {
      actualizadoEn?: unknown;
      eliminadoEn?: unknown;
    };
    expect(where.actualizadoEn).toBeUndefined();
    // Y el filtro de borrados se queda, que es el comportamiento normal.
    expect(where.eliminadoEn).toBeNull();
  });

  it('los dos filtros conviven: el cliente acota y el texto busca dentro', async () => {
    const { service, prisma } = construir();

    await service.getAllLoans(
      { clienteId: 'cliente-1', search: 'IMP-1032', limit: 20 },
      null,
    );

    const where = whereUsado(prisma);
    expect(where.clienteId).toBe('cliente-1');
    expect(JSON.stringify(where.OR ?? [])).toContain('IMP-1032');
  });
});
