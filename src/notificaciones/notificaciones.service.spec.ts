import { Test, TestingModule } from '@nestjs/testing';
import { NotificacionesService } from './notificaciones.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesGateway } from './notificaciones.gateway';
import { PushService } from '../push/push.service';
import { RolUsuario } from '@prisma/client';
import { Logger } from '@nestjs/common';
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

/**
 * Un metodo imitado que resuelve una promesa.
 *
 * Este archivo importa `jest` de `@jest/globals`, cuyas tipificaciones son mas estrictas
 * que las globales: un `jest.fn()` sin firma infiere un retorno que NO admite
 * `mockResolvedValue`, y de ahi salia un `as any` en cada linea del doble. Declarando la
 * firma una vez, los dobles se escriben sin casts y las llamadas se siguen comprobando.
 */
const imitarAsync = () => jest.fn<(...args: unknown[]) => Promise<unknown>>();

describe('NotificacionesService', () => {
  let service: NotificacionesService;
  let prismaService: PrismaService;
  let loggerErrorSpy: jest.SpiedFunction<typeof Logger.prototype.error>;

  const mockPrismaService = {
    notificacion: {
      create: imitarAsync(),
    },
    usuario: {
      findMany: imitarAsync(),
    },
  };

  const mockNotificacionesGateway = {
    enviarNotificacionAUsuario: imitarAsync(),
    notificarActualizacion: imitarAsync(),
    enviarNotificacionATodos: imitarAsync(),
  };

  const mockPushService = {
    sendPushNotification: imitarAsync().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    mockPrismaService.notificacion.create.mockResolvedValue({
      id: 'notif-123',
      usuarioId: 'user-123',
      titulo: 'Test Notificacion',
      mensaje: 'Test Mensaje',
      tipo: 'SISTEMA',
      metadata: { nivel: undefined },
    });
    mockPushService.sendPushNotification.mockResolvedValue(undefined);
    loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificacionesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NotificacionesGateway,
          useValue: mockNotificacionesGateway,
        },
        {
          provide: PushService,
          useValue: mockPushService,
        },
      ],
    }).compile();

    service = module.get<NotificacionesService>(NotificacionesService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a notification', async () => {
      const data = {
        usuarioId: 'user-123',
        titulo: 'Test Notificacion',
        mensaje: 'Test Mensaje',
      };

      await service.create(data);

      expect(prismaService.notificacion.create).toHaveBeenCalledWith({
        data: {
          usuarioId: data.usuarioId,
          titulo: data.titulo,
          mensaje: data.mensaje,
          tipo: 'SISTEMA',
          entidad: undefined,
          entidadId: undefined,
          metadata: { nivel: undefined },
        },
      });
    });

    it('includes regularized payment metadata in the push payload', async () => {
      const data = {
        usuarioId: 'user-123',
        titulo: 'Pago regularizado registrado',
        mensaje: 'Pago asociado a jornada pendiente',
        tipo: 'INFO',
        entidad: 'Pago',
        entidadId: 'pago-1',
        metadata: {
          tipoEvento: 'PAGO_REGULARIZADO',
          pagoId: 'pago-1',
          rutaId: 'ruta-1',
          fechaOperativaRuta: '2026-06-03',
        },
      };

      await service.create(data);

      expect(prismaService.notificacion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tipo: 'SISTEMA',
          entidad: 'Pago',
          entidadId: 'pago-1',
          metadata: expect.objectContaining({
            nivel: 'INFORMATIVO',
            tipoEvento: 'PAGO_REGULARIZADO',
            pagoId: 'pago-1',
            rutaId: 'ruta-1',
            fechaOperativaRuta: '2026-06-03',
          }),
        }),
      });
      expect(mockPushService.sendPushNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          data: expect.objectContaining({
            tipo: 'SISTEMA',
            entidad: 'Pago',
            entidadId: 'pago-1',
            tipoEvento: 'PAGO_REGULARIZADO',
            pagoId: 'pago-1',
            rutaId: 'ruta-1',
            fechaOperativaRuta: '2026-06-03',
          }),
        }),
      );
    });

    it('should handle errors gracefully (log only)', async () => {
      // Configuramos el mock para lanzar error
      mockPrismaService.notificacion.create.mockRejectedValue(
        new Error('DB Error'),
      );

      const data = {
        usuarioId: 'user-123',
        titulo: 'Test Error',
        mensaje: 'Test Mensaje',
      };

      // No debería lanzar excepción
      await expect(service.create(data)).resolves.not.toThrow();
    });
  });

  describe('notifyCoordinator', () => {
    it('should notify all active coordinators', async () => {
      // Mock de usuarios encontrados
      const mockCoordinators = [
        { id: 'coord-1', rol: RolUsuario.COORDINADOR },
        { id: 'coord-2', rol: RolUsuario.COORDINADOR },
      ];
      mockPrismaService.usuario.findMany.mockResolvedValue(mockCoordinators);

      const data = {
        titulo: 'Alerta Coordinador',
        mensaje: 'Mensaje Importante',
      };

      await service.notifyCoordinator(data);

      // Verificar búsqueda de coordinadores
      expect(prismaService.usuario.findMany).toHaveBeenCalledWith({
        where: {
          rol: RolUsuario.COORDINADOR,
          estado: 'ACTIVO',
        },
      });

      // Verificar creación de notificaciones (debe llamarse 2 veces, una por cada coordinador)
      expect(prismaService.notificacion.create).toHaveBeenCalledTimes(2);
    });

    it('should do nothing if no coordinators found', async () => {
      mockPrismaService.usuario.findMany.mockResolvedValue([]);

      await service.notifyCoordinator({
        titulo: 'Test',
        mensaje: 'Test',
      });

      expect(prismaService.notificacion.create).not.toHaveBeenCalled();
    });
  });
});

describe('Las alertas por rol salen también por push', () => {
  // `notifyRolesDeduped` no llama a `create` directamente sino a
  // `createDeduped`, y ahí es fácil perder el push sin darse cuenta. La alerta
  // de integridad contable depende de esto para llegarle a alguien.
  it('la primera alerta del día dispara push a cada destinatario', async () => {
    // El doble en una variable: `module.get(PushService)` devuelve el servicio con su tipo
    // real, que no tiene `.mock`. Antes se leia con `(push.sendPushNotification as any)`.
    const pushDeLaPrueba = {
      sendPushNotification: imitarAsync().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificacionesService,
        {
          provide: PrismaService,
          useValue: {
            notificacion: {
              create: imitarAsync().mockImplementation((args: unknown) =>
                Promise.resolve({
                  id: 'n-1',
                  ...(args as { data?: Record<string, unknown> }).data,
                }),
              ),
              // Nadie tiene todavía una alerta con esa clave.
              findFirst: imitarAsync().mockResolvedValue(null),
            },
            usuario: {
              findMany: imitarAsync().mockResolvedValue([
                { id: 'contador-1' },
                { id: 'admin-1' },
              ]),
            },
          },
        },
        {
          provide: NotificacionesGateway,
          useValue: {
            enviarNotificacionAUsuario: imitarAsync(),
            notificarActualizacion: imitarAsync(),
          },
        },
        {
          provide: PushService,
          useValue: pushDeLaPrueba,
        },
      ],
    }).compile();

    const servicio = module.get<NotificacionesService>(NotificacionesService);

    await servicio.notifyRolesDeduped({
      roles: [RolUsuario.CONTADOR, RolUsuario.ADMIN],
      titulo: 'Alerta de Integridad Contable',
      mensaje: 'Balance global descuadrado.',
      dedupeKey: 'integridad-contable:2026-08-26',
    });

    expect(pushDeLaPrueba.sendPushNotification).toHaveBeenCalledTimes(2);
    const destinatarios = pushDeLaPrueba.sendPushNotification.mock.calls.map(
      (args) => (args[0] as { userId?: string }).userId,
    );
    expect(destinatarios.sort()).toEqual(['admin-1', 'contador-1']);
  });
});
