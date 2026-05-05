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

describe('NotificacionesService', () => {
  let service: NotificacionesService;
  let prismaService: PrismaService;
  let loggerErrorSpy: jest.SpiedFunction<typeof Logger.prototype.error>;

  // Mock de PrismaService
  const mockPrismaService = {
    notificacion: {
      create: jest.fn() as any,
    },
    usuario: {
      findMany: jest.fn() as any,
    },
  };

  // Mock de NotificacionesGateway
  const mockNotificacionesGateway = {
    enviarNotificacionAUsuario: jest.fn() as any,
    notificarActualizacion: jest.fn() as any,
    enviarNotificacionATodos: jest.fn() as any,
  };

  // Mock de PushService
  const mockPushService = {
    sendPushNotification: (jest.fn() as any).mockResolvedValue(undefined),
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
