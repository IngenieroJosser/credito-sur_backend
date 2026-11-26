import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ArchivadosService } from './archivados.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * El borrado definitivo es la parte peligrosa de esta pantalla: es dinero.
 *
 * La regla que se blinda aqui es la que no se puede romper nunca: un registro
 * que ya tuvo movimiento de dinero (un pago, un abono en cuotas, un movimiento
 * de caja o un asiento) NO se puede borrar de la base. Si se pudiera, la
 * contabilidad quedaria descuadrada y el historial perderia su rastro.
 */
describe('ArchivadosService — borrado definitivo', () => {
  let service: ArchivadosService;

  const mockPrismaService = {
    cliente: {
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    prestamo: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
    },
    producto: {
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    precioProducto: {
      deleteMany: jest.fn(),
    },
    pago: { count: jest.fn() },
    transaccion: { count: jest.fn() },
    cuota: {
      count: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    journalEntry: { count: jest.fn() },
    aprobacion: { deleteMany: jest.fn() },
    asignacionRuta: { deleteMany: jest.fn() },
    alertaCliente: { deleteMany: jest.fn() },
    registroVisita: { deleteMany: jest.fn() },
    detallePago: { deleteMany: jest.fn() },
    extensionPago: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  };

  // Igual que en el resto de specs: la implementacion va aparte para que
  // `mockPrismaService` no se referencie a si mismo dentro del literal.
  mockPrismaService.$transaction.mockImplementation(
    (cb: (tx: typeof mockPrismaService) => unknown) => cb(mockPrismaService),
  );

  const mockAuditService = { create: jest.fn() };

  /** No hay ningun rastro de dinero en ninguna de las cuatro fuentes. */
  const sinDinero = () => {
    mockPrismaService.pago.count.mockResolvedValue(0);
    mockPrismaService.transaccion.count.mockResolvedValue(0);
    mockPrismaService.cuota.count.mockResolvedValue(0);
    mockPrismaService.journalEntry.count.mockResolvedValue(0);
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchivadosService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ArchivadosService>(ArchivadosService);
  });

  it('rechaza el borrado definitivo de un cliente que tiene pagos', async () => {
    mockPrismaService.cliente.findFirst.mockResolvedValue({
      id: 'c-1',
      nombres: 'Ana',
      apellidos: 'Perez',
      dni: '123',
    });
    mockPrismaService.prestamo.findMany.mockResolvedValue([{ id: 'p-1' }]);
    sinDinero();
    mockPrismaService.pago.count.mockResolvedValue(2);

    await expect(
      service.eliminarDefinitivo('cliente', 'c-1', 'u-1'),
    ).rejects.toBeInstanceOf(ConflictException);

    // No se toca nada: ni transaccion ni borrado ni auditoria.
    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    expect(mockPrismaService.cliente.delete).not.toHaveBeenCalled();
  });

  it('rechaza el borrado definitivo de un crédito con abono parcial en cuotas', async () => {
    mockPrismaService.prestamo.findFirst.mockResolvedValue({
      id: 'p-1',
      numeroPrestamo: 'CR-0001',
    });
    sinDinero();
    mockPrismaService.cuota.count.mockResolvedValue(1);

    await expect(
      service.eliminarDefinitivo('prestamo', 'p-1', 'u-1'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(mockPrismaService.prestamo.delete).not.toHaveBeenCalled();
  });

  it('rechaza el borrado definitivo de un producto ligado a créditos', async () => {
    mockPrismaService.producto.findFirst.mockResolvedValue({
      id: 'pr-1',
      nombre: 'Moto',
      codigo: 'M-1',
    });
    mockPrismaService.prestamo.count.mockResolvedValue(3);

    await expect(
      service.eliminarDefinitivo('producto', 'pr-1', 'u-1'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(mockPrismaService.producto.delete).not.toHaveBeenCalled();
  });

  it('no borra nada que no esté archivado', async () => {
    mockPrismaService.cliente.findFirst.mockResolvedValue(null);

    await expect(
      service.eliminarDefinitivo('cliente', 'c-1', 'u-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('elimina un cliente sin dinero y deja la auditoría', async () => {
    mockPrismaService.cliente.findFirst.mockResolvedValue({
      id: 'c-1',
      nombres: 'Ana',
      apellidos: 'Perez',
      dni: '123',
    });
    mockPrismaService.prestamo.findMany.mockResolvedValue([{ id: 'p-1' }]);
    sinDinero();
    mockPrismaService.cuota.findMany.mockResolvedValue([]);

    const resultado = await service.eliminarDefinitivo('cliente', 'c-1', 'u-1');

    expect(mockPrismaService.cliente.delete).toHaveBeenCalledWith({
      where: { id: 'c-1' },
    });
    expect(mockPrismaService.prestamo.deleteMany).toHaveBeenCalledWith({
      where: { clienteId: 'c-1' },
    });
    expect(mockAuditService.create).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'ELIMINAR_DEFINITIVO_CLIENTE' }),
    );
    expect(resultado).toEqual({
      eliminado: true,
      tipo: 'cliente',
      entidadId: 'c-1',
    });
  });

  it('rechaza un tipo desconocido', async () => {
    await expect(
      service.eliminarDefinitivo('ruta', 'r-1', 'u-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
