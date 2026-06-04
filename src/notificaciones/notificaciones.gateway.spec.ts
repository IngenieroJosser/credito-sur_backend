import { NotificacionesGateway } from './notificaciones.gateway';

describe('NotificacionesGateway', () => {
  const buildGateway = (overrides?: {
    prisma?: any;
    routesService?: any;
    notificacionesService?: any;
  }) => {
    const notificacionesService =
      overrides?.notificacionesService || {
        notifyApprovers: jest.fn(),
      };
    const prisma =
      overrides?.prisma || {
        caja: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'caja-ruta-1',
            rutaId: 'ruta-1',
            responsableId: 'cobrador-1',
            saldoActual: 6020669,
          }),
        },
        usuario: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'cobrador-1',
            rol: 'COBRADOR',
          }),
        },
        transaccion: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'trx-1' }),
        },
      };
    const routesService =
      overrides?.routesService || {
        assertPuedeCerrarJornadaActual: jest.fn().mockResolvedValue(undefined),
        getDailyVisits: jest.fn().mockResolvedValue({
          resumen: {
            meta: 1511998,
            recaudo: 552001,
            recaudoOperativo: 552001,
            efectividad: 36.5,
          },
          visitas: [
            { estadoGestion: 'PAGO_REGISTRADO', recaudadoDelDia: 425335 },
            { estadoGestion: 'PAGO_REGISTRADO', recaudadoDelDia: 126666 },
            { estadoGestion: 'PENDIENTE', recaudadoDelDia: 0 },
          ],
        }),
      };

    return {
      gateway: new NotificacionesGateway(
        notificacionesService as any,
        prisma as any,
        routesService as any,
      ),
      notificacionesService,
      prisma,
      routesService,
    };
  };

  it('recalcula el cierre de ruta en backend aunque el frontend envie KPIs en cero', async () => {
    const { gateway, notificacionesService, prisma, routesService } =
      buildGateway();

    const response = await gateway.handleRutaCompletadaEmit(
      {
        rutaNombre: 'Ruta Centro - Norte',
        cobradorNombre: 'Cobrador Prueba',
        recaudo: 0,
        meta: 0,
        efectividad: 0,
        clientesFaltantes: 0,
        rutaId: 'ruta-1',
        actorId: 'cobrador-1',
        actorRol: 'COBRADOR',
      },
      {} as any,
    );

    expect(response).toEqual({
      success: true,
      message: 'Ruta cerrada correctamente.',
    });
    expect(routesService.getDailyVisits).toHaveBeenCalledWith(
      'ruta-1',
      expect.any(String),
      { id: 'cobrador-1', rol: 'COBRADOR' },
    );
    expect(prisma.transaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          referenciaId: expect.stringContaining('RC:552001|MT:1511998|EF:36.5'),
          descripcion: expect.stringContaining('Recaudó: $552.001'),
        }),
      }),
    );
    expect(notificacionesService.notifyApprovers).toHaveBeenCalledWith(
      expect.objectContaining({
        mensaje: expect.stringContaining('Recaudo Final: $552.001 (36.5% META)'),
        metadata: expect.objectContaining({
          rutaId: 'ruta-1',
          recaudoFinal: 552001,
          meta: 1511998,
          efectividad: 36.5,
          clientesFaltantes: 1,
        }),
      }),
    );
  });
});
