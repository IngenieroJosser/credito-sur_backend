import { DashboardService } from './dashboard.service';
import { ClientsService } from '../clients/clients.service';
import { comoPrisma, type DobleDePrisma } from '../common/testing/dobles';

/**
 * Si no se puede calcular, se falla. No se devuelven ceros.
 *
 * ── Lo que hacían estos tres endpoints ────────────────────────────────────
 *
 * Un barrido de los 145 bloques `catch` del backend encontró cuatro que
 * convertían un fallo en un dato falso:
 *
 *   - `getDashboardData` → «retornar datos de fallback en caso de error»:
 *     `delinquentAccounts: 0`, `capitalPrestado: 0`, `recaudo: 0` y la gráfica
 *     vacía. El dueño veía un negocio **sin cartera, sin cobranza y sin mora**,
 *     indistinguible de un día tranquilo.
 *   - `getTrendData` → `[]` con el comentario «devolver datos de muestra». Una
 *     gráfica plana se lee «no hubo cobranza»: es exactamente el incidente §P21,
 *     doce meses de ingresos en cero habiendo 7.883.331 cobrados.
 *   - `getAllClients` → `clientes: []` y `total: 0`: la financiera **sin
 *     clientes**.
 *   - `getAllLoans` → `prestamos: []` y la cartera en cero, sin mora.
 *
 * Es la regla del proyecto, la misma que vigila `__tests__/cero-no-miente.test.ts`
 * en el frontend: **un cero en dinero no es un hueco**. Un `$ 0` se lee «no debe
 * nada» y un contador en cero se lee «no hay nada pendiente».
 *
 * ── Y la otra mitad ───────────────────────────────────────────────────────
 *
 * Hacer fallar el servidor sin tocar la pantalla habría cambiado una mentira
 * por una pantalla en blanco: los dos paneles hacían
 * `if (!state.dashboardData) return null`, y el del coordinador ni siquiera
 * apagaba el `isLoading` salvo en un 401 —un fallo de red lo dejaba cargando
 * para siempre—. Las dos mitades se arreglaron en el mismo cambio, con
 * `components/ui/PanelDeError.tsx`.
 *
 * ── Por qué esta prueba ejercita el código ────────────────────────────────
 *
 * Porque lo que importa no es que el texto del `catch` haya cambiado, sino que
 * el error **salga**. Se hace fallar una consulta del doble y se exige que el
 * método lance en vez de devolver una respuesta con ceros.
 */
const falla = () =>
  jest.fn().mockRejectedValue(new Error('la base no responde'));

function dobleDelTablero(overrides: DobleDePrisma = {}) {
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
    $queryRaw: jest.fn().mockResolvedValue([{ total: 0 }]),
    ...overrides,
  };
}

describe('el tablero falla en vez de pintar el negocio en cero', () => {
  it('si el conteo de mora falla, lanza', async () => {
    const prisma = dobleDelTablero({ $queryRaw: falla() });

    await expect(
      new DashboardService(comoPrisma(prisma)).getDashboardData('today'),
    ).rejects.toThrow(/la base no responde/);
  });

  it('si falla una consulta de aprobaciones, lanza', async () => {
    const prisma = dobleDelTablero({
      aprobacion: {
        count: falla(),
        aggregate: jest.fn().mockResolvedValue({ _sum: { montoSolicitud: 0 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });

    await expect(
      new DashboardService(comoPrisma(prisma)).getDashboardData('today'),
    ).rejects.toThrow();
  });

  it('y no devuelve un objeto con las cifras en cero', async () => {
    /*
     * La aserción que de verdad distingue el antes del después: antes esto
     * resolvía con `metrics.recaudo === 0` y la pantalla lo pintaba.
     */
    const prisma = dobleDelTablero({ $queryRaw: falla() });
    const resultado = await new DashboardService(comoPrisma(prisma))
      .getDashboardData('today')
      .then(
        (r) => ({ lanzo: false, r }),
        () => ({ lanzo: true, r: null }),
      );

    expect(resultado.lanzo).toBe(true);
    expect(resultado.r).toBeNull();
  });
});

describe('el listado de clientes falla en vez de decir que no hay clientes', () => {
  it('lanza cuando la consulta falla', async () => {
    const prisma: DobleDePrisma = {
      cliente: {
        findMany: falla(),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _avg: { puntaje: 0 } }),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    /*
      Las otras cuatro dependencias van como dobles vacios: este metodo no las
      usa, y pedirlas de verdad traeria media aplicacion a una prueba que
      comprueba una sola cosa. Si algun dia las usara, la prueba fallaria con
      un «not a function», que es la señal correcta.
    */
    const vacio = {} as never;
    const servicio = new ClientsService(
      comoPrisma(prisma),
      vacio,
      vacio,
      vacio,
      vacio,
    );

    await expect(
      servicio.getAllClients({ nivelRiesgo: '', ruta: '', search: '' }),
    ).rejects.toThrow(/la base no responde/);
  });
});
