import { RolUsuario } from '@prisma/client';
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
 * Un supervisor solo opera sobre las rutas que supervisa.
 *
 * ── El defecto ─────────────────────────────────────────────────────────────
 *
 * `findOne` ya acotaba: su consulta lleva `supervisorId: actor.id` cuando quien
 * pregunta es SUPERVISOR, y hay un `assertCollectorOwnRoute` para el cobrador
 * con un comentario que dice por qué («sin ella un cobrador podría consultar la
 * cartera de otro cambiando el id en la URL»).
 *
 * Pero `update`, `remove`, `toggleActive`, `assignClient` y `removeClient` ni
 * siquiera RECIBÍAN el actor: el controlador les pasaba el id de la URL y nada
 * más, con `@Roles(SUPERVISOR, COORDINADOR, ADMIN, SUPER_ADMINISTRADOR)`.
 *
 * O sea que un supervisor podía LEER solo sus rutas y ESCRIBIR sobre las de
 * cualquiera. Y editar no es cosmético: `UpdateRouteDto` admite `cobradorId`,
 * así que podía cambiar quién cobra una ruta ajena —y el dinero entra a la caja
 * de quien cobra—, archivarla o desactivarla.
 *
 * ── Cómo se mide ───────────────────────────────────────────────────────────
 *
 * El doble de `ruta.findFirst` respeta el `where` que recibe. Si la guarda no
 * consulta por `supervisorId`, la ruta ajena aparece y la escritura sigue.
 *
 * El COORDINADOR y la oficina mantienen el paso libre a propósito: atienden
 * cualquier ruta.
 */
const RUTA_AJENA = {
  id: 'r-ajena',
  supervisorId: 'otro-supervisor',
  cobradorId: 'otro-cobrador',
  eliminadoEn: null,
};

const armar = (rol: RolUsuario, extra: Partial<DobleDePrisma> = {}) => {
  const findFirst = jest.fn((args: { where: Record<string, unknown> }) => {
    const w = args.where || {};
    const coincide = Object.entries(w).every(([campo, valor]) =>
      campo === 'eliminadoEn'
        ? true
        : (RUTA_AJENA as Record<string, unknown>)[campo] === valor,
    );
    return Promise.resolve(coincide ? RUTA_AJENA : null);
  });

  const servicio = new RoutesService(
    comoPrisma({ ruta: { findFirst, findUnique: findFirst }, ...extra }),
    dependenciaSinUsar<AuditService>(),
    dependenciaSinUsar<NotificacionesGateway>(),
    dependenciaSinUsar<NotificacionesService>(),
  );

  return { servicio, findFirst, actor: { id: 'yo', rol } };
};

describe('un supervisor no escribe sobre la ruta de otro', () => {
  it('no puede editarla', async () => {
    const { servicio, actor } = armar(RolUsuario.SUPERVISOR);
    await expect(
      servicio.update('r-ajena', { nombre: 'Mía ahora' }, actor),
    ).rejects.toThrow(/permiso/i);
  });

  it('no puede archivarla', async () => {
    const { servicio, actor } = armar(RolUsuario.SUPERVISOR);
    await expect(servicio.remove('r-ajena', actor)).rejects.toThrow(/permiso/i);
  });

  it('no puede desactivarla', async () => {
    const { servicio, actor } = armar(RolUsuario.SUPERVISOR);
    await expect(servicio.toggleActive('r-ajena', actor)).rejects.toThrow(
      /permiso/i,
    );
  });

  it('no puede meterle ni sacarle clientes', async () => {
    const { servicio, actor } = armar(RolUsuario.SUPERVISOR);
    await expect(
      servicio.assignClient('r-ajena', 'c-1', 'cob-1', actor),
    ).rejects.toThrow(/permiso/i);
    await expect(
      servicio.removeClient('r-ajena', 'c-1', actor),
    ).rejects.toThrow(/permiso/i);
  });

  it('la comprobación pregunta por el supervisor, no por el nombre de la ruta', async () => {
    const { servicio, findFirst, actor } = armar(RolUsuario.SUPERVISOR);

    await servicio.remove('r-ajena', actor).catch(() => undefined);

    expect(findFirst.mock.calls[0][0].where).toMatchObject({
      id: 'r-ajena',
      supervisorId: 'yo',
    });
  });

  it('al coordinador no se le cierra la puerta', async () => {
    // Atiende cualquier ruta: es la regla del negocio. Aquí basta con que la
    // guarda NO consulte —si consultara con `supervisorId`, lo bloquearía—.
    const { servicio, findFirst, actor } = armar(RolUsuario.COORDINADOR);

    await servicio.remove('r-ajena', actor).catch(() => undefined);

    const consultasConSupervisor = findFirst.mock.calls.filter((c) =>
      Object.prototype.hasOwnProperty.call(c[0]?.where ?? {}, 'supervisorId'),
    );
    expect(consultasConSupervisor).toEqual([]);
  });
});
