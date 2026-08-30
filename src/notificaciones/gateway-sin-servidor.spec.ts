import { NotificacionesGateway } from './notificaciones.gateway';

/**
 * Avisar es un efecto secundario y nunca puede tumbar la operación que ya movió
 * dinero.
 *
 * `server` solo existe cuando Nest levantó el servidor de websockets. Rechazar
 * una aprobación devolvía la plata a caja, guardaba el asiento de reversa, y
 * después moría al emitir el evento: el usuario veía un error sobre algo que sí
 * se había hecho, y la pantalla quedaba mostrando una solicitud que ya no
 * existía. `createLoan` ya trataba el aviso como efecto secundario; las
 * aprobaciones no.
 */
describe('El gateway sin servidor de websockets', () => {
  const construir = () =>
    // El cuarto es JwtService: el gateway pasó a verificar el token del socket.
    new NotificacionesGateway({} as any, {} as any, {} as any, {} as any);

  it('no revienta al emitir a todos', () => {
    const gateway = construir();
    // Sin `afterInit`, `server` no existe: es el caso de un script o una
    // migración corriendo sin HTTP.
    expect((gateway as any).server).toBeUndefined();

    expect(() =>
      gateway.broadcastAprobacionesActualizadas({ accion: 'RECHAZAR' }),
    ).not.toThrow();
    expect(() =>
      gateway.broadcastPrestamosActualizados({ accion: 'RECHAZAR' }),
    ).not.toThrow();
    expect(() => gateway.broadcastDashboardsActualizados({})).not.toThrow();
    expect(() => gateway.broadcastInventarioActualizado({})).not.toThrow();
  });

  it('no revienta al emitir a un usuario', () => {
    const gateway = construir();

    expect(() =>
      gateway.enviarNotificacionAUsuario('user-1', { titulo: 'hola' }),
    ).not.toThrow();
    expect(() => gateway.notificarActualizacion('user-1')).not.toThrow();
  });

  it('cuando sí hay servidor, emite', () => {
    const gateway = construir();
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    (gateway as any).server = { emit, to };

    gateway.broadcastAprobacionesActualizadas({ accion: 'APROBAR' });
    expect(emit).toHaveBeenCalledWith(
      'aprobaciones_actualizadas',
      expect.objectContaining({ accion: 'APROBAR' }),
    );

    gateway.notificarActualizacion('user-1');
    expect(to).toHaveBeenCalledWith('user_user-1');
  });
});
