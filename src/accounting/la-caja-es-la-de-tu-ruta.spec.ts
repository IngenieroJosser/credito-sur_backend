import { AccountingService } from './accounting.service';
import {
  comoDependencia,
  comoPrisma,
  dependenciaSinUsar,
} from '../common/testing/dobles';
import type { LedgerService } from './ledger.service';
import type { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import type { NotificacionesService } from '../notificaciones/notificaciones.service';

/**
 * Un cobrador solo opera sobre la caja de SU ruta.
 *
 * ── El defecto ─────────────────────────────────────────────────────────────
 *
 * `resolveActiveRouteCashContext` es el ayudante que, dado el `rutaId` que
 * manda el cliente, devuelve la caja sobre la que se va a mover el dinero. Lo
 * usan las dos operaciones de caja que acepta un cobrador: pedir la base del
 * día (`solicitarBase`) y reportar un gasto (`registrarGasto`).
 *
 * Acotaba la consulta por SUPERVISOR y por nadie más. Con rol COBRADOR el
 * `where` que salía a la base era `{ id, eliminadoEn: null }` a secas: la ruta
 * de otro cobrador se encontraba igual, y la solicitud se creaba contra la caja
 * de ESA ruta.
 *
 * Lo que eso produce no se ve donde se hizo: el gasto deja corta la caja de
 * otro, y el descuadre aparece en el cierre de quien no hizo nada.
 *
 * ── Cómo se midió ──────────────────────────────────────────────────────────
 *
 * Ejecutando el código, no leyéndolo: el doble de `ruta.findFirst` de aquí
 * abajo FILTRA de verdad por el `where` que recibe. Si la consulta no acota, la
 * ruta ajena aparece y la solicitud sale. Antes del arreglo salía; ahora no.
 *
 * El COORDINADOR y los roles de oficina siguen sin filtro A PROPÓSITO: atienden
 * cualquier ruta, y es una regla del negocio —el cliente que paga en la sede, el
 * coordinador que pide la base del día—. Por eso esta prueba también comprueba
 * que al coordinador no se le cerró la puerta.
 */
const RUTA_PROPIA = {
  id: 'r-mia',
  cobradorId: 'yo',
  supervisorId: 'mi-supervisor',
};
const RUTA_AJENA = {
  id: 'r-ajena',
  cobradorId: 'otro-cobrador',
  supervisorId: 'otro-supervisor',
};
const RUTAS = [RUTA_PROPIA, RUTA_AJENA];

const armar = (rol: string) => {
  const create = jest.fn().mockResolvedValue({ id: 'apr-1' });

  /**
   * Respeta el `where`. Un doble que devuelve siempre la misma fila haría pasar
   * esta prueba con el defecto puesto: no estaría comprobando nada.
   */
  const rutaFindFirst = jest.fn((args: { where: Record<string, unknown> }) => {
    const w = args.where || {};
    const hallada = RUTAS.find((r) =>
      Object.entries(w).every(([campo, valor]) =>
        campo === 'eliminadoEn'
          ? true
          : (r as Record<string, unknown>)[campo] === valor,
      ),
    );
    return Promise.resolve(hallada ?? null);
  });

  const servicio = new AccountingService(
    comoPrisma({
      aprobacion: { findFirst: jest.fn().mockResolvedValue(null), create },
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'yo',
          nombres: 'Ana',
          apellidos: 'G.',
          rol,
        }),
      },
      ruta: { findFirst: rutaFindFirst },
      caja: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'caja-x', nombre: 'Caja de la ruta' }),
      },
    }),
    comoDependencia<NotificacionesService>({
      notifyApprovers: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue(undefined),
    }),
    comoDependencia<NotificacionesGateway>({
      broadcastDashboardsActualizados: jest.fn(),
    }),
    dependenciaSinUsar<LedgerService>(),
  );

  return { servicio, create, rutaFindFirst };
};

const pedirBase = (servicio: AccountingService, rutaId: string) =>
  servicio.solicitarBase({
    descripcion: 'Base del día',
    monto: 500000,
    rutaId,
    cobradorId: 'yo',
    solicitadoPorId: 'yo',
  });

describe('la caja sobre la que se opera es la de tu propia ruta', () => {
  it('el cobrador no puede pedir base sobre la ruta de otro', async () => {
    const { servicio, create } = armar('COBRADOR');

    await expect(pedirBase(servicio, 'r-ajena')).rejects.toThrow();
    // Lo que importa: no queda una solicitud que alguien pueda aprobar.
    expect(create).not.toHaveBeenCalled();
  });

  it('y el filtro va en la consulta, no en una comprobación posterior', async () => {
    // Acotar después de leer deja la fila ajena en memoria y basta con que
    // alguien mueva un `if` para volver a abrirlo.
    const { servicio, rutaFindFirst } = armar('COBRADOR');

    await pedirBase(servicio, 'r-ajena').catch(() => undefined);

    expect(rutaFindFirst.mock.calls[0][0].where).toMatchObject({
      cobradorId: 'yo',
    });
  });

  it('sobre SU ruta sigue funcionando', async () => {
    // El caso que un arreglo de alcance rompe si se pasa de ancho.
    const { servicio, create } = armar('COBRADOR');

    await expect(pedirBase(servicio, 'r-mia')).resolves.toMatchObject({
      success: true,
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('el supervisor conserva su propia regla, que es por supervisión', async () => {
    const { servicio, rutaFindFirst } = armar('SUPERVISOR');

    await pedirBase(servicio, 'r-ajena').catch(() => undefined);

    expect(rutaFindFirst.mock.calls[0][0].where).toMatchObject({
      supervisorId: 'yo',
    });
  });

  it('al coordinador NO se le cierra la puerta: atiende cualquier ruta', async () => {
    // Es la regla del negocio, no un descuido: muchos clientes pagan en la sede
    // y es el coordinador quien los recibe.
    const { servicio, create, rutaFindFirst } = armar('COORDINADOR');

    await expect(pedirBase(servicio, 'r-ajena')).resolves.toMatchObject({
      success: true,
    });
    expect(rutaFindFirst.mock.calls[0][0].where).not.toHaveProperty(
      'cobradorId',
    );
    expect(create).toHaveBeenCalledTimes(1);
  });
});
