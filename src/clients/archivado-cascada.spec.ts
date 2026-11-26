import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import { ConfiguracionService } from '../configuracion/configuracion.service';

/**
 * La cascada cliente → créditos.
 *
 * Archivar un cliente archiva sus créditos, y restaurarlo los devuelve. Lo
 * delicado es el ESTADO del crédito: un crédito que estaba en mora no puede
 * volver como ACTIVO al restaurar al cliente, porque escondería la mora.
 */
describe('ClientsService — cascada de archivado de créditos', () => {
  let service: ClientsService;

  const mockPrismaService = {
    cliente: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    prestamo: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    aprobacion: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  mockPrismaService.$transaction.mockImplementation(
    (cb: (tx: typeof mockPrismaService) => unknown) => cb(mockPrismaService),
  );

  const mockNotificacionesGateway = {
    broadcastClientesActualizados: jest.fn(),
    broadcastPrestamosActualizados: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: { create: jest.fn() } },
        { provide: NotificacionesService, useValue: {} },
        { provide: NotificacionesGateway, useValue: mockNotificacionesGateway },
        { provide: ConfiguracionService, useValue: {} },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
  });

  it('archiva el cliente y sus créditos con la misma marca, sin pisar el estado', async () => {
    mockPrismaService.cliente.findUnique.mockResolvedValue({
      id: 'c-1',
      nombres: 'Ana',
      apellidos: 'Perez',
      dni: '123',
    });
    mockPrismaService.prestamo.findMany.mockResolvedValue([{ id: 'p-1' }]);
    mockPrismaService.cliente.update.mockResolvedValue({ id: 'c-1' });
    mockPrismaService.prestamo.updateMany.mockResolvedValue({ count: 1 });
    mockPrismaService.aprobacion.updateMany.mockResolvedValue({ count: 0 });

    await service.remove('c-1', 'u-1');

    const datosCreditos = mockPrismaService.prestamo.updateMany.mock.calls[0][0]
      .data as Record<string, unknown>;
    const datosCliente = mockPrismaService.cliente.update.mock.calls[0][0]
      .data as Record<string, unknown>;

    // El estado NO se toca: un crédito en mora sigue en mora.
    expect(datosCreditos).not.toHaveProperty('estado');
    // Los dos comparten la misma marca de tiempo de archivado.
    expect(datosCreditos.eliminadoEn).toBeInstanceOf(Date);
    expect(datosCreditos.eliminadoEn).toEqual(datosCliente.eliminadoEn);
  });

  it('solo revive los créditos archivados con el cliente y no fuerza ACTIVO', async () => {
    const marca = new Date('2026-01-01T00:00:00.000Z');
    mockPrismaService.cliente.findUnique.mockResolvedValue({
      id: 'c-1',
      eliminadoEn: marca,
    });
    mockPrismaService.prestamo.findMany.mockResolvedValue([{ id: 'p-1' }]);
    mockPrismaService.cliente.update.mockResolvedValue({ id: 'c-1' });
    mockPrismaService.prestamo.updateMany.mockResolvedValue({ count: 1 });

    await service.restore('c-1', 'u-1');

    // El filtro es la marca exacta, no `not null`: un crédito archivado por
    // separado antes del cliente no debe revivir aquí.
    expect(mockPrismaService.prestamo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clienteId: 'c-1', eliminadoEn: marca },
      }),
    );

    const datosCreditos = mockPrismaService.prestamo.updateMany.mock.calls[0][0]
      .data as Record<string, unknown>;
    expect(datosCreditos).not.toHaveProperty('estado');
    expect(datosCreditos.eliminadoEn).toBeNull();
  });

  it('no permite restaurar un cliente que no está archivado', async () => {
    mockPrismaService.cliente.findUnique.mockResolvedValue({
      id: 'c-1',
      eliminadoEn: null,
    });

    await expect(service.restore('c-1', 'u-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
  });
});
