/**
 * ============================================================
 * TESTS UNITARIOS — PaymentsService
 * ============================================================
 *
 * Cubre el flujo más crítico del sistema: registrar un pago.
 * Cada test es independiente (jest.clearAllMocks en afterEach).
 *
 * Para ejecutar: npx jest payments.service --no-coverage
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { AuditService } from '../audit/audit.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import { CloudinaryService } from '../upload/cloudinary.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EstadoCuota, EstadoPrestamo, MetodoPago } from '@prisma/client';

// ─────────────────────────────────────────────
// Mocks de los servicios de soporte (no críticos para estos tests)
// ─────────────────────────────────────────────
const mockNotificacionesService = {
  notifyCoordinator: jest.fn().mockResolvedValue(undefined),
};

const mockAuditService = {
  create: jest.fn().mockResolvedValue(undefined),
};

const mockNotificacionesGateway = {
  broadcastPagosActualizados: jest.fn(),
  broadcastPrestamosActualizados: jest.fn(),
  broadcastRutasActualizadas: jest.fn(),
  broadcastDashboardsActualizados: jest.fn(),
};

// ─────────────────────────────────────────────
// Datos de prueba reutilizables
// ─────────────────────────────────────────────
const PRESTAMO_ACTIVO = {
  id: 'prestamo-1',
  numeroPrestamo: 'PRE-000001',
  clienteId: 'cliente-1',
  estado: EstadoPrestamo.ACTIVO,
  monto: 1000000,
  tasaInteres: 10, // 10% → capital = pago * 100/110, interes = pago * 10/110
  interesTotal: 100000,
  saldoPendiente: 600000,
  totalPagado: 500000,
  capitalPagado: 454545.45,
  interesPagado: 45454.55,
  cliente: { id: 'cliente-1', nombres: 'Juan', apellidos: 'Pérez' },
  cuotas: [
    {
      id: 'cuota-1',
      numeroCuota: 1,
      monto: 110000,
      montoPagado: 0,
      estado: EstadoCuota.VENCIDA,
      montoInteresMora: 0,
    },
    {
      id: 'cuota-2',
      numeroCuota: 2,
      monto: 110000,
      montoPagado: 0,
      estado: EstadoCuota.PENDIENTE,
      montoInteresMora: 0,
    },
  ],
};

const PAGO_CREADO = {
  id: 'pago-1',
  numeroPago: 'PAG-000001',
  clienteId: 'cliente-1',
  prestamoId: 'prestamo-1',
  cobradorId: 'cobrador-1',
  montoTotal: 110000,
  metodoPago: MetodoPago.EFECTIVO,
  fechaPago: new Date(),
  detalles: [],
  cliente: { id: 'cliente-1', nombres: 'Juan', apellidos: 'Pérez' },
};

const CAJA_ACTIVA = { id: 'caja-1', nombre: 'Caja Ruta 1', saldoActual: 0 };
const ASIGNACION_RUTA = { rutaId: 'ruta-1' };

// ─────────────────────────────────────────────
// Mock de PrismaService — simula transacciones
// ─────────────────────────────────────────────
function buildMockPrisma(overrides: Record<string, unknown> = {}) {
  const txMock = {
    pago: { create: jest.fn().mockResolvedValue(PAGO_CREADO) },
    cuota: { update: jest.fn().mockResolvedValue({}) },
    prestamo: { update: jest.fn().mockResolvedValue({}) },
    asignacionRuta: { findFirst: jest.fn().mockResolvedValue(ASIGNACION_RUTA) },
    caja: {
      findFirst: jest.fn().mockResolvedValue(CAJA_ACTIVA),
      update: jest.fn().mockResolvedValue({}),
    },
    transaccion: { create: jest.fn().mockResolvedValue({}) },
  };

  return {
    prestamo: {
      findFirst: jest.fn().mockResolvedValue(PRESTAMO_ACTIVO),
    },
    pago: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(PAGO_CREADO),
    },
    // $transaction ejecuta el callback con el txMock directamente
    $transaction: jest.fn().mockImplementation((cb: (tx: typeof txMock) => unknown) => cb(txMock)),
    _txMock: txMock, // expuesto para assertions
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// Suite de tests
// ─────────────────────────────────────────────
describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof buildMockPrisma>;

  async function createModule(prismaOverrides = {}) {
    prisma = buildMockPrisma(prismaOverrides);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificacionesService, useValue: mockNotificacionesService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: NotificacionesGateway, useValue: mockNotificacionesGateway },
        { provide: CloudinaryService, useValue: { subirArchivo: jest.fn() } },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  }

  beforeEach(async () => {
    await createModule();
    jest.clearAllMocks();
  });

  // ── Instanciación ──────────────────────────
  it('debería instanciarse correctamente', () => {
    expect(service).toBeDefined();
  });

  // ── Fórmula capital/interés ────────────────
  describe('descomponerPago (fórmula del Excel)', () => {
    it('con tasa 10%: capital = pago × 100/110, interés = pago × 10/110', async () => {
      const dto = {
        prestamoId: 'prestamo-1',
        cobradorId: 'cobrador-1',
        montoTotal: 110000,
        metodoPago: MetodoPago.EFECTIVO,
      };

      const resultado = await service.create(dto);

      // capital = 110000 * 100 / 110 = 100000
      // interes = 110000 * 10  / 110 = 10000
      expect(resultado.descomposicion.capitalRecuperado).toBeCloseTo(100000, 0);
      expect(resultado.descomposicion.interesRecuperado).toBeCloseTo(10000, 0);
    });

    it('con tasa 0%: todo el monto es capital, interés = 0', async () => {
      (prisma.prestamo.findFirst as jest.Mock).mockResolvedValue({
        ...PRESTAMO_ACTIVO,
        tasaInteres: 0,
      });

      const dto = {
        prestamoId: 'prestamo-1',
        cobradorId: 'cobrador-1',
        montoTotal: 110000,
        metodoPago: MetodoPago.EFECTIVO,
      };

      const resultado = await service.create(dto);
      expect(resultado.descomposicion.capitalRecuperado).toBe(110000);
      expect(resultado.descomposicion.interesRecuperado).toBe(0);
    });
  });

  // ── Flujo happy path ───────────────────────
  describe('create — flujo exitoso', () => {
    it('crea el pago y retorna descomposicion + saldos', async () => {
      const dto = {
        prestamoId: 'prestamo-1',
        cobradorId: 'cobrador-1',
        montoTotal: 110000,
        metodoPago: MetodoPago.EFECTIVO,
      };

      const resultado = await service.create(dto);

      expect(resultado).toHaveProperty('pago');
      expect(resultado).toHaveProperty('descomposicion');
      expect(resultado.descomposicion.montoTotal).toBe(110000);
      expect(resultado.descomposicion.saldoAnterior).toBe(600000);
    });

    it('distribuye el pago a la primera cuota vencida (orden cronológico)', async () => {
      const dto = {
        prestamoId: 'prestamo-1',
        cobradorId: 'cobrador-1',
        montoTotal: 110000,
      };

      await service.create(dto);

      // La cuota-1 (VENCIDA) debe actualizarse primero
      expect(prisma._txMock.cuota.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cuota-1' },
          data: expect.objectContaining({
            montoPagado: 110000,
            estado: EstadoCuota.PAGADA,
          }),
        }),
      );
    });

    it('marca el préstamo como PAGADO cuando el saldo llega a ≤ 0', async () => {
      // Monto igual al saldo pendiente → préstamo queda saldado
      (prisma.prestamo.findFirst as jest.Mock).mockResolvedValue({
        ...PRESTAMO_ACTIVO,
        saldoPendiente: 110000,
        cuotas: [
          { id: 'cuota-1', monto: 110000, montoPagado: 0, estado: EstadoCuota.VENCIDA, montoInteresMora: 0 },
        ],
      });

      const dto = {
        prestamoId: 'prestamo-1',
        cobradorId: 'cobrador-1',
        montoTotal: 110000,
      };

      const resultado = await service.create(dto);

      expect(resultado.descomposicion.prestamoQuedaPagado).toBe(true);
      expect(prisma._txMock.prestamo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ estado: EstadoPrestamo.PAGADO }),
        }),
      );
    });

    it('llama al servicio de auditoría al registrar el pago', async () => {
      const dto = { prestamoId: 'prestamo-1', cobradorId: 'cobrador-1', montoTotal: 110000 };
      await service.create(dto);
      expect(mockAuditService.create).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'REGISTRAR_PAGO' }),
      );
    });
  });

  // ── Casos de error ─────────────────────────
  describe('create — validaciones y errores', () => {
    it('lanza BadRequestException si no se proporciona prestamoId', async () => {
      await expect(
        service.create({ prestamoId: '', cobradorId: 'cobrador-1', montoTotal: 100000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si no se proporciona cobradorId', async () => {
      await expect(
        service.create({ prestamoId: 'prestamo-1', cobradorId: '', montoTotal: 100000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si el préstamo no existe', async () => {
      (prisma.prestamo.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.create({ prestamoId: 'no-existe', cobradorId: 'cobrador-1', montoTotal: 100000 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si el préstamo está en estado PAGADO', async () => {
      (prisma.prestamo.findFirst as jest.Mock).mockResolvedValue({
        ...PRESTAMO_ACTIVO,
        estado: EstadoPrestamo.PAGADO,
      });
      await expect(
        service.create({ prestamoId: 'prestamo-1', cobradorId: 'cobrador-1', montoTotal: 110000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si clienteId no corresponde al préstamo', async () => {
      await expect(
        service.create({
          prestamoId: 'prestamo-1',
          cobradorId: 'cobrador-1',
          clienteId: 'cliente-DIFERENTE',
          montoTotal: 110000,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
