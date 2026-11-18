import { RoutesService } from './routes.service';
import type { AuditService } from '../audit/audit.service';
import type { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import type { NotificacionesService } from '../notificaciones/notificaciones.service';
import {
  comoPrisma,
  dependenciaSinUsar,
  type DobleDePrisma,
} from '../common/testing/dobles';

/**
 * Cuánta carga lleva cada cobrador.
 *
 * `GET /routes/cobradores` no mandaba estas dos cifras, y la pantalla de
 * ASIGNACION de rutas del coordinador —la que decide a quién se le carga
 * trabajo— las rellenaba a mano con `rutasAsignadas: 0`, `clientesTotales: 0` y
 * una `capacidadMaxima: 120` que no existe en el modelo. Resultado: todos los
 * cobradores aparecian libres, al 0% de capacidad, y el reparto se hacia sobre
 * una cifra inventada. Un cero se lee «no tiene nada», no «no se sabe».
 *
 * Comprobado contra la base de desarrollo el 2026-11-18: el cobrador con una
 * ruta y 17 clientes salia 0 y 0, y el 17 coincide con el `clientesAsignados`
 * que ya mostraba el listado de rutas para esa misma ruta. Las dos pantallas
 * tienen que decir lo mismo.
 */
const cobradorBase = {
  id: 'cob-1',
  nombres: 'Ana',
  apellidos: 'Gómez',
  correo: 'ana@credisur.com',
  telefono: null,
};

const armar = (doble: Partial<DobleDePrisma>) =>
  new RoutesService(
    comoPrisma({
      usuario: { findMany: jest.fn().mockResolvedValue([cobradorBase]) },
      ...doble,
    } as DobleDePrisma),
    // Este metodo solo lee de la base: los otros tres colaboradores no se
    // ejercitan, y un doble vacio lo deja dicho.
    dependenciaSinUsar<AuditService>(),
    dependenciaSinUsar<NotificacionesGateway>(),
    dependenciaSinUsar<NotificacionesService>(),
  );

describe('la carga real de cada cobrador', () => {
  it('cuenta sus rutas y sus clientes', async () => {
    const servicio = armar({
      ruta: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'r1', cobradorId: 'cob-1' },
            { id: 'r2', cobradorId: 'cob-1' },
          ]),
      },
      asignacionRuta: {
        findMany: jest.fn().mockResolvedValue([
          { rutaId: 'r1', clienteId: 'c1' },
          { rutaId: 'r1', clienteId: 'c2' },
          { rutaId: 'r2', clienteId: 'c3' },
        ]),
      },
    });

    const [cobrador] = await servicio.getCobradores();

    expect(cobrador.rutasAsignadas).toBe(2);
    expect(cobrador.clientesTotales).toBe(3);
  });

  it('no cuenta dos veces al cliente que está en dos rutas del mismo cobrador', async () => {
    /*
     * El indice unico parcial es `(rutaId, clienteId) WHERE activa`, asi que el
     * mismo cliente puede estar activo en DOS rutas distintas. Sumar las
     * asignaciones daria 3 clientes donde hay 2, y el coordinador repartiria
     * creyendo que ese cobrador va mas cargado de lo que va. Es la misma
     * correccion que ya lleva `clientesAsignados` en el listado de rutas.
     */
    const servicio = armar({
      ruta: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'r1', cobradorId: 'cob-1' },
            { id: 'r2', cobradorId: 'cob-1' },
          ]),
      },
      asignacionRuta: {
        findMany: jest.fn().mockResolvedValue([
          { rutaId: 'r1', clienteId: 'c1' },
          { rutaId: 'r2', clienteId: 'c1' },
          { rutaId: 'r2', clienteId: 'c2' },
        ]),
      },
    });

    const [cobrador] = await servicio.getCobradores();

    expect(cobrador.clientesTotales).toBe(2);
  });

  it('un cobrador sin rutas sale en cero, y no consulta asignaciones de nadie', async () => {
    const asignaciones = jest.fn().mockResolvedValue([]);
    const servicio = armar({
      ruta: { findMany: jest.fn().mockResolvedValue([]) },
      asignacionRuta: { findMany: asignaciones },
    });

    const [cobrador] = await servicio.getCobradores();

    expect(cobrador.rutasAsignadas).toBe(0);
    expect(cobrador.clientesTotales).toBe(0);
    // Sin rutas no hay nada que preguntar: un `in: []` traeria TODAS las
    // asignaciones activas del sistema.
    expect(asignaciones).not.toHaveBeenCalled();
  });

  it('solo mira las asignaciones de las rutas de estos cobradores', async () => {
    const asignaciones = jest.fn().mockResolvedValue([]);
    const servicio = armar({
      ruta: {
        findMany: jest.fn().mockResolvedValue([{ id: 'r1', cobradorId: 'cob-1' }]),
      },
      asignacionRuta: { findMany: asignaciones },
    });

    await servicio.getCobradores();

    expect(asignaciones).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          activa: true,
          rutaId: { in: ['r1'] },
        }),
      }),
    );
  });

  it('las rutas borradas no cuentan', async () => {
    const rutas = jest.fn().mockResolvedValue([]);
    const servicio = armar({
      ruta: { findMany: rutas },
      asignacionRuta: { findMany: jest.fn().mockResolvedValue([]) },
    });

    await servicio.getCobradores();

    expect(rutas).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ eliminadoEn: null }),
      }),
    );
  });
});
