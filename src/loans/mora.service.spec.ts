import { MoraService } from './mora.service';

const mockNotifications = {
  notifyApprovers: jest.fn().mockResolvedValue(undefined),
  create: jest.fn().mockResolvedValue(undefined),
};

const mockGateway = {
  broadcastPrestamosActualizados: jest.fn(),
  broadcastDashboardsActualizados: jest.fn(),
};

const mockPush = {
  sendPushNotification: jest.fn().mockResolvedValue(undefined),
};

function makeService(prisma: any) {
  return new MoraService(
    prisma,
    mockNotifications as any,
    mockGateway as any,
    mockPush as any,
  );
}

describe('MoraService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calcula mora diaria excluyendo domingos antes de subir riesgo', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-08T15:00:00.000Z'));

    const prisma = {
      cuota: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      prestamo: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
        update: jest.fn(),
      },
      cliente: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'cliente-1',
            nombres: 'Cliente',
            apellidos: 'Diario',
            dni: '123',
            telefono: '300',
            nivelRiesgo: 'VERDE',
            asignacionesRuta: [],
            prestamos: [
              {
                numeroPrestamo: 'P-1',
                saldoPendiente: 100000,
                frecuenciaPago: 'DIARIO',
                cuotas: [
                  {
                    fechaVencimiento: new Date('2026-06-05T00:00:00.000Z'),
                    monto: 50000,
                  },
                ],
              },
            ],
          },
        ]),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    await makeService(prisma).procesarMoraAutomatica();

    expect(prisma.cliente.update).not.toHaveBeenCalled();
    expect(mockNotifications.notifyApprovers).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          diasEnMora: 2,
          etiquetaMora: 'Leve',
          nivelRiesgo: 'VERDE',
        }),
      }),
    );
    expect(mockPush.sendPushNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          diasEnMora: 2,
          etiqueta: 'Leve',
        }),
      }),
    );
  });

  it('recalcula un cliente a verde cuando ya no quedan cuotas vencidas', async () => {
    const prisma = {
      cliente: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cliente-1',
          nivelRiesgo: 'AMARILLO',
          enListaNegra: false,
          prestamos: [
            {
              frecuenciaPago: 'DIARIO',
              cuotas: [],
            },
          ],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const result = await makeService(prisma).recalcularNivelRiesgoCliente(
      'cliente-1',
    );

    expect(result).toEqual({
      clienteId: 'cliente-1',
      diasEnMora: 0,
      nivelRiesgo: 'VERDE',
      actualizado: true,
    });
    expect(prisma.cliente.update).toHaveBeenCalledWith({
      where: { id: 'cliente-1' },
      data: expect.objectContaining({
        nivelRiesgo: 'VERDE',
        ultimaActualizacionRiesgo: expect.any(Date),
      }),
    });
  });
});
