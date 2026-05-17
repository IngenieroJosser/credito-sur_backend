import { Test, TestingModule } from '@nestjs/testing';
import { ClientsService } from './clients.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { ConflictException } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';

describe('ClientsService', () => {
  let service: ClientsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    cliente: {
      count: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    aprobacion: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    multimedia: {
      updateMany: jest.fn(),
      createMany: jest.fn(),
    },
    asignacionRuta: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    ruta: {
      findUnique: jest.fn(),
    },
    usuario: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockNotificacionesGateway = {
    broadcastClientesActualizados: jest.fn(),
    broadcastDashboardsActualizados: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditService,
          useValue: {},
        },
        {
          provide: NotificacionesService,
          useValue: {},
        },
        {
          provide: NotificacionesGateway,
          useValue: mockNotificacionesGateway,
        },
        {
          provide: ConfiguracionService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a client with auto-generated code', async () => {
      (prismaService.cliente.findFirst as jest.Mock).mockResolvedValue(null);

      // 1. Mock count para que retorne 10 (el siguiente será 11 -> C-0011)
      (prismaService.cliente.count as jest.Mock).mockResolvedValue(10);

      // 2. Mock usuario creador
      (prismaService.usuario.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-admin',
      });

      // 3. Mock create response
      const mockClientData = {
        nombres: 'Juan',
        apellidos: 'Perez',
        dni: '12345678',
        telefono: '3001234567',
        direccion: 'Calle Falsa 123',
        rutaId: 'ruta-1', // Se excluye en el service antes de guardar en tabla cliente
        observaciones: 'Ninguna', // Se excluye
      };

      (prismaService.cliente.create as jest.Mock).mockResolvedValue({
        id: 'new-client-id',
        codigo: 'C-0011',
        ...mockClientData,
      });

      const result = await service.create(mockClientData as any);

      // Verificaciones
      expect(prismaService.cliente.count).toHaveBeenCalled();

      // Verificar que se llamó a create con el código generado correcto
      expect(prismaService.cliente.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nombres: 'Juan',
            codigo: 'C-0011', // 10 + 1 format 4 digits
            creadoPorId: 'user-admin',
          }),
        }),
      );

      expect(result).toHaveProperty('id', 'new-client-id');
      expect(result).toHaveProperty('codigo', 'C-0011');
    });

    it('should throw error if no creator user found', async () => {
      (prismaService.cliente.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.cliente.count as jest.Mock).mockResolvedValue(0);
      (prismaService.usuario.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create({
          nombres: 'Test',
          apellidos: 'Test',
          dni: '123',
        } as any),
      ).rejects.toThrow('No existen usuarios en el sistema');
    });

    it('returns the existing approval when the same idempotencyKey is retried', async () => {
      (prismaService.cliente.findFirst as jest.Mock).mockResolvedValue({
        id: 'cliente-existente',
        idempotencyKey: 'offline-cliente-1',
        eliminadoEn: null,
      });
      (mockPrismaService.aprobacion.findFirst as jest.Mock).mockResolvedValue({
        id: 'approval-existente',
        referenciaId: 'cliente-existente',
      });

      const result = await service.createClient({
        nombres: 'Ana',
        apellidos: 'Perez',
        dni: '12345678',
        telefono: '3001234567',
        idempotencyKey: 'offline-cliente-1',
      } as any);

      expect(result).toMatchObject({
        aprobacionId: 'approval-existente',
        clienteId: 'cliente-existente',
        idempotentReplay: true,
      });
      expect(prismaService.cliente.create).not.toHaveBeenCalled();
    });
  });

  describe('updateClient concurrency', () => {
    it('rejects stale updates when version does not match', async () => {
      (prismaService.cliente.findUnique as jest.Mock).mockResolvedValue({
        id: 'cliente-1',
        version: 3,
        creadoPorId: 'admin-1',
        eliminadoEn: null,
      });

      await expect(
        service.updateClient('cliente-1', {
          nombres: 'Ana Maria',
          version: 2,
        } as any),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prismaService.cliente.update).not.toHaveBeenCalled();
    });
  });

  describe('role scoping', () => {
    it('forces client list queries from collectors to clients assigned to their routes', async () => {
      (prismaService.cliente.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.cliente.count as jest.Mock).mockResolvedValue(0);
      (prismaService.cliente.aggregate as jest.Mock).mockResolvedValue({ _avg: { puntaje: 0 } });

      await service.getAllClients(
        { nivelRiesgo: 'all', ruta: '', search: '' },
        { id: 'cobrador-propio', rol: RolUsuario.COBRADOR } as any,
      );

      expect(prismaService.cliente.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eliminadoEn: null,
            asignacionesRuta: expect.objectContaining({
              some: expect.objectContaining({
                activa: true,
              }),
            }),
          }),
        }),
      );
      expect(prismaService.cliente.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          eliminadoEn: null,
          asignacionesRuta: expect.objectContaining({
            some: expect.objectContaining({
              activa: true,
            }),
          }),
        }),
      });
    });

    it('does not return client detail to a collector when the client is not assigned to them', async () => {
      (prismaService.cliente.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getClientById(
          'cliente-ajeno',
          { id: 'cobrador-propio', rol: RolUsuario.COBRADOR } as any,
        ),
      ).rejects.toThrow('Cliente no encontrado');

      expect(prismaService.cliente.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'cliente-ajeno',
            eliminadoEn: null,
            asignacionesRuta: expect.objectContaining({
              some: expect.objectContaining({
                activa: true,
              }),
            }),
          }),
        }),
      );
    });
  });

  describe('assignToRoute', () => {
    it('usa el cobrador real de la ruta aunque el body traiga otro cobradorId', async () => {
      (prismaService.asignacionRuta.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.ruta.findUnique as jest.Mock).mockResolvedValue({
        id: 'ruta-1',
        cobradorId: 'cobrador-ruta',
      });
      (mockPrismaService.asignacionRuta.create as jest.Mock).mockResolvedValue({
        id: 'asignacion-1',
        cobradorId: 'cobrador-ruta',
      });

      await service.assignToRoute(
        'cliente-1',
        'ruta-1',
        'cobrador-equivocado',
      );

      expect(mockPrismaService.asignacionRuta.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          rutaId: 'ruta-1',
          clienteId: 'cliente-1',
          cobradorId: 'cobrador-ruta',
        }),
      });
    });
  });
});
