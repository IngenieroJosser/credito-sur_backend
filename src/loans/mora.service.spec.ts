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
        findMany: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
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
            nivelMoraNotificado: 1,
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

    // Leve (2 dias) no sube el riesgo: sigue en VERDE. Lo unico que se guarda
    // es el nivel de mora, para no volver a notificarlo tras un reinicio.
    expect(prisma.cliente.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nivelRiesgo: expect.anything() }),
      }),
    );
    expect(prisma.cliente.update).toHaveBeenCalledWith({
      where: { id: 'cliente-1' },
      data: { nivelMoraNotificado: 2 },
    });
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

    const result =
      await makeService(prisma).recalcularNivelRiesgoCliente('cliente-1');

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

  describe('nivel de mora guardado en la base', () => {
    const clienteEnMora = (nivelMoraNotificado: number | null) => ({
      id: 'cliente-2',
      nombres: 'Cliente',
      apellidos: 'Mora',
      dni: '456',
      telefono: '300',
      nivelRiesgo: 'ROJO',
      nivelMoraNotificado,
      asignacionesRuta: [],
      prestamos: [
        {
          numeroPrestamo: 'P-2',
          saldoPendiente: 100000,
          frecuenciaPago: 'SEMANAL',
          cuotas: [
            {
              // 9 dias de atraso al 2026-06-10: nivel Critico (5)
              fechaVencimiento: new Date('2026-06-01T05:00:00.000Z'),
              monto: 50000,
            },
          ],
        },
      ],
    });

    // La "base" es el mismo objeto cliente: lo que se guarda con update queda
    // disponible para la siguiente instancia, como pasa tras un reinicio.
    const prismaCon = (cliente: ReturnType<typeof clienteEnMora>) => ({
      cuota: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      prestamo: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      cliente: {
        findMany: jest.fn().mockImplementation(async () => [cliente]),
        update: jest
          .fn()
          .mockImplementation(async ({ data }: { data: any }) =>
            Object.assign(cliente, data),
          ),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    });

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-10T15:00:00.000Z'));
    });

    it('no vuelve a notificar el mismo nivel tras un reinicio', async () => {
      const cliente = clienteEnMora(1);

      await makeService(prismaCon(cliente)).procesarMoraAutomatica();
      expect(mockNotifications.notifyApprovers).toHaveBeenCalledTimes(1);
      expect(cliente.nivelMoraNotificado).toBe(5);

      // Reinicio: instancia nueva, mismo cliente leido de la base.
      await makeService(prismaCon(cliente)).procesarMoraAutomatica();
      expect(mockNotifications.notifyApprovers).toHaveBeenCalledTimes(1);
      expect(mockPush.sendPushNotification).toHaveBeenCalledTimes(1);
    });

    it('siembra sin notificar a los clientes sin nivel previo', async () => {
      const cliente = clienteEnMora(null);

      await makeService(prismaCon(cliente)).procesarMoraAutomatica();

      expect(mockNotifications.notifyApprovers).not.toHaveBeenCalled();
      expect(mockPush.sendPushNotification).not.toHaveBeenCalled();
      expect(cliente.nivelMoraNotificado).toBe(5);
    });

    it('notifica cuando el cliente sube respecto del nivel guardado', async () => {
      const cliente = clienteEnMora(3);

      await makeService(prismaCon(cliente)).procesarMoraAutomatica();

      expect(mockNotifications.notifyApprovers).toHaveBeenCalledTimes(1);
      expect(cliente.nivelMoraNotificado).toBe(5);
    });
  });
});
