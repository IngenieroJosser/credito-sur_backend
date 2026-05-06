import { Test, TestingModule } from '@nestjs/testing';
import { ClientsService } from './clients.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import { ConfiguracionService } from '../configuracion/configuracion.service';

describe('ClientsService', () => {
  let service: ClientsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    cliente: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    usuario: {
      findFirst: jest.fn(),
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
  });
});
