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
 * Pedir la base de efectivo dos veces entrega la base dos veces.
 *
 * ── Por que es dinero ──────────────────────────────────────────────────────
 *
 * `solicitarBase` crea una APROBACION de tipo SOLICITUD_BASE_EFECTIVO. Aprobarla
 * no es un tramite: `approvals.service.ts` saca el monto de CAJA-OFICINA con una
 * transaccion de EGRESO, lo ingresa a la caja de ruta con otra de INGRESO y
 * registra el asiento de partida doble. Dos solicitudes aprobadas = la base
 * entregada dos veces, y el descuadre aparece al cierre, lejos de su causa.
 *
 * ── Como se duplicaba ──────────────────────────────────────────────────────
 *
 * La cola offline reintenta lo que no recibio respuesta. Si la peticion SI llego
 * al servidor y lo que se perdio fue la respuesta, el reintento crea una segunda
 * solicitud. Por eso la clave se estampa al ENCOLAR —una sola vez, en
 * `lib/offline/syncService.ts`— y no en cada intento: es lo que hace que el
 * segundo sea el mismo que el primero.
 *
 * El tipo `base_solicitar` era el unico de los 49 que encola la cola que mueve
 * dinero y no estaba en `idempotentTypes`, y no lo estaba porque el backend no
 * miraba la clave. Ahora la mira, con el mismo patron que el registro de gasto.
 */
const CLAVE = 'offline-base_solicitar-1763500000000-ab12cd34';

const armar = (aprobacionExistente: { id: string } | null) => {
  const findFirst = jest.fn().mockResolvedValue(aprobacionExistente);
  const create = jest.fn().mockResolvedValue({ id: 'apr-nueva' });

  const prisma = {
    aprobacion: { findFirst, create },
    usuario: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'cob-1',
        nombres: 'Ana',
        apellidos: 'Gómez',
        rol: 'COBRADOR',
      }),
    },
    ruta: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'r-1',
        cobradorId: 'cob-1',
        supervisorId: null,
      }),
    },
    caja: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'caja-r1', nombre: 'Caja Ruta 1' }),
    },
  };

  const servicio = new AccountingService(
    comoPrisma(prisma),
    comoDependencia<NotificacionesService>({
      notifyApprovers: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue(undefined),
    }),
    comoDependencia<NotificacionesGateway>({
      broadcastDashboardsActualizados: jest.fn(),
    }),
    dependenciaSinUsar<LedgerService>(),
  );

  return { servicio, findFirst, create };
};

const peticion = (idempotencyKey?: string) => ({
  descripcion: 'Base del día',
  monto: 500000,
  rutaId: 'r-1',
  cobradorId: 'cob-1',
  solicitadoPorId: 'cob-1',
  idempotencyKey,
});

describe('la solicitud de base no se duplica al reintentar', () => {
  it('el reintento devuelve la solicitud que ya existe, sin crear otra', async () => {
    const { servicio, create } = armar({ id: 'apr-1' });

    const r = (await servicio.solicitarBase(peticion(CLAVE))) as {
      approvalId: string;
      idempotentReplay?: boolean;
    };

    expect(r.approvalId).toBe('apr-1');
    expect(r.idempotentReplay).toBe(true);
    // Lo que importa: NO hay una segunda aprobación que alguien pueda aprobar.
    expect(create).not.toHaveBeenCalled();
  });

  it('busca por la clave, no por el monto ni por la ruta', async () => {
    // Deduplicar por monto+ruta uniría dos solicitudes legítimas del mismo día.
    const { servicio, findFirst } = armar({ id: 'apr-1' });

    await servicio.solicitarBase(peticion(CLAVE));

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { idempotencyKey: CLAVE } }),
    );
  });

  it('la primera vez sí la crea, y la guarda con su clave', async () => {
    const { servicio, create } = armar(null);

    await servicio.solicitarBase(peticion(CLAVE));

    expect(create).toHaveBeenCalledTimes(1);
    // Si no se guardara, el reintento no encontraría nada y duplicaría igual.
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ idempotencyKey: CLAVE }),
      }),
    );
  });

  it('sin clave no pregunta nada: una solicitud a mano no se deduplica', async () => {
    // El coordinador que pide base dos veces en el día lo está haciendo a
    // propósito. La protección es contra el reintento de la cola, no contra él.
    const { servicio, findFirst, create } = armar(null);

    await servicio.solicitarBase(peticion(undefined));

    expect(findFirst).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('una clave en blanco cuenta como no haber mandado ninguna', async () => {
    const { servicio, findFirst } = armar(null);

    await servicio.solicitarBase(peticion('   '));

    expect(findFirst).not.toHaveBeenCalled();
  });
});
