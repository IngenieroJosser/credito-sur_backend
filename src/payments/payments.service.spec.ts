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
import { LedgerService } from '../accounting/ledger.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoCuota,
  EstadoPrestamo,
  MetodoPago,
  Prisma,
  RolUsuario,
} from '@prisma/client';

// ─────────────────────────────────────────────
// Mocks de los servicios de soporte (no críticos para estos tests)
// ─────────────────────────────────────────────
const mockNotificacionesService = {
  notifyCoordinator: jest.fn().mockResolvedValue(undefined),
  notifyApprovers: jest.fn().mockResolvedValue(undefined),
  notifyRolesDeduped: jest.fn().mockResolvedValue(undefined),
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

const mockLedgerService = {
  registrarPago: jest.fn().mockResolvedValue(undefined),
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
      montoCapital: 100000,
      montoInteres: 10000,
      montoPagado: 0,
      estado: EstadoCuota.VENCIDA,
      montoInteresMora: 0,
    },
    {
      id: 'cuota-2',
      numeroCuota: 2,
      monto: 110000,
      montoCapital: 100000,
      montoInteres: 10000,
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

const PAGO_EXISTENTE = {
  ...PAGO_CREADO,
  id: 'pago-existente-1',
  numeroPago: 'PAG-EXISTENTE',
  detalles: [
    {
      id: 'detalle-1',
      monto: 110000,
      montoCapital: 100000,
      montoInteres: 10000,
      montoInteresMora: 0,
    },
  ],
  prestamo: { id: 'prestamo-1', saldoPendiente: 490000 },
};

const CAJA_ACTIVA = { id: 'caja-1', nombre: 'Caja Ruta 1', saldoActual: 0 };
const ASIGNACION_RUTA = {
  rutaId: 'ruta-1',
  cobradorId: 'cobrador-ruta',
  ruta: { cobradorId: 'cobrador-ruta' },
};
const ASIGNACION_RUTA_CON_COBRADOR = {
  rutaId: 'ruta-1',
  cobradorId: 'cobrador-ruta',
  ruta: { cobradorId: 'cobrador-ruta' },
};

// ─────────────────────────────────────────────
// Mock de PrismaService — simula transacciones
// ─────────────────────────────────────────────
function buildMockPrisma(overrides: Record<string, unknown> = {}) {
  const txMock = {
    pago: { create: jest.fn().mockResolvedValue(PAGO_CREADO) },
    cuota: { update: jest.fn().mockResolvedValue({}) },
    prestamo: {
      findFirst: jest.fn().mockResolvedValue(PRESTAMO_ACTIVO),
      update: jest.fn().mockResolvedValue({}),
    },
    asignacionRuta: { findFirst: jest.fn().mockResolvedValue(ASIGNACION_RUTA) },
    registroVisita: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    caja: {
      findFirst: jest.fn().mockResolvedValue(CAJA_ACTIVA),
      update: jest.fn().mockResolvedValue({}),
    },
    transaccion: { create: jest.fn().mockResolvedValue({}) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };

  return {
    prestamo: {
      findFirst: jest.fn().mockResolvedValue(PRESTAMO_ACTIVO),
    },
    asignacionRuta: {
      findFirst: jest.fn().mockResolvedValue(ASIGNACION_RUTA_CON_COBRADOR),
    },
    pago: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(PAGO_CREADO),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(PAGO_CREADO),
    },
    aprobacion: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'approval-1' }),
    },
    // $transaction ejecuta el callback con el txMock directamente
    $transaction: jest
      .fn()
      .mockImplementation((cb: (tx: typeof txMock) => unknown) => cb(txMock)),
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
        { provide: LedgerService, useValue: mockLedgerService },
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

  describe('isDomingoBogota', () => {
    it('detecta sábado antes de medianoche Bogotá aunque ya sea domingo UTC', () => {
      expect(
        (service as any).isDomingoBogota(
          new Date('2026-05-31T04:59:00.000Z'),
        ),
      ).toBe(false);
    });

    it('detecta domingo desde medianoche Bogotá', () => {
      expect(
        (service as any).isDomingoBogota(
          new Date('2026-05-31T05:00:00.000Z'),
        ),
      ).toBe(true);
    });
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
      const prestamoSinInteres = {
        ...PRESTAMO_ACTIVO,
        tasaInteres: 0,
        cuotas: PRESTAMO_ACTIVO.cuotas.map((cuota) => ({
          ...cuota,
          montoCapital: cuota.monto,
          montoInteres: 0,
        })),
      };
      prisma.prestamo.findFirst.mockResolvedValue(prestamoSinInteres);
      prisma._txMock.prestamo.findFirst.mockResolvedValue(prestamoSinInteres);

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

    it('genera el número de pago sin depender de count + 1', async () => {
      const dto = {
        prestamoId: 'prestamo-1',
        cobradorId: 'cobrador-1',
        montoTotal: 110000,
        metodoPago: MetodoPago.EFECTIVO,
      };

      await service.create(dto);

      expect(prisma.pago.count).not.toHaveBeenCalled();
      expect(prisma._txMock.pago.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            numeroPago: expect.stringMatching(/^PAG-\d+-[0-9a-f-]{8}$/),
          }),
        }),
      );
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

    it('aplica el pago sobre cuotaId cuando viene de cierre pendiente', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));

      const rawIdempotencyKey =
        'CIERRE_PENDIENTE:ruta-1:2026-05-27:cliente-1:prestamo-1:cuota-2:16:PAGO:110000';
      const dto = {
        prestamoId: 'prestamo-1',
        cobradorId: 'cobrador-1',
        montoTotal: 110000,
        cuotaId: 'cuota-2',
        cuotaNumeroEsperada: 2,
        montoCuotaEsperado: 110000,
        fechaOperativaRuta: '2026-05-27',
        origenGestion: 'CIERRE_PENDIENTE' as const,
        rutaId: 'ruta-1',
        idempotencyKey: rawIdempotencyKey,
      };

      prisma.pago.findFirst.mockResolvedValueOnce(null);
      try {
        await service.create(dto);
      } finally {
        jest.useRealTimers();
      }

      expect(prisma._txMock.cuota.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cuota-2' },
          data: expect.objectContaining({
            montoPagado: 110000,
            estado: EstadoCuota.PAGADA,
          }),
        }),
      );
      expect(prisma._txMock.cuota.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cuota-1' },
        }),
      );
      expect(prisma._txMock.pago.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            idempotencyKey: rawIdempotencyKey,
            fechaOperativaRuta: '2026-05-27',
            origenGestion: 'CIERRE_PENDIENTE',
            detalles: {
              create: expect.arrayContaining([
                expect.objectContaining({ cuotaId: 'cuota-2' }),
              ]),
            },
          }),
        }),
      );
      expect(prisma._txMock.asignacionRuta.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            rutaId: 'ruta-1',
          }),
        }),
      );
    });

    it('acorta idempotencyKey largas antes de guardar el pago', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));

      const longKey = [
        'CIERRE_PENDIENTE',
        'e42db922-fea4-474b-a4b5-6165f132f9c3',
        '2026-05-27',
        'bc5c5e97-7745-4429-8ed2-112ab1b36552',
        '1c2ded1a-56de-4977-9ae7-314cbfeb6142',
        '0fee5824-088f-413c-a8eb-0f3ea6d2f927',
        '16',
        'PAGO',
        '10000',
      ].join(':');

      prisma.pago.findFirst.mockResolvedValueOnce(null);

      try {
        await service.create({
          prestamoId: 'prestamo-1',
          cobradorId: 'cobrador-1',
          montoTotal: 110000,
          cuotaId: 'cuota-2',
          cuotaNumeroEsperada: 2,
          montoCuotaEsperado: 110000,
          fechaOperativaRuta: '2026-05-27',
          origenGestion: 'CIERRE_PENDIENTE',
          rutaId: 'ruta-1',
          idempotencyKey: longKey,
        } as any);
      } finally {
        jest.useRealTimers();
      }

      const savedKey =
        prisma._txMock.pago.create.mock.calls[0][0].data.idempotencyKey;

      expect(longKey.length).toBeGreaterThan(100);
      expect(savedKey).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(savedKey.length).toBeLessThanOrEqual(100);
      expect(prisma.pago.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { idempotencyKey: savedKey },
        }),
      );
    });

    it('rechaza pago de cierre pendiente sin contexto completo', async () => {
      await expect(
        service.create({
          prestamoId: 'prestamo-1',
          cobradorId: 'cobrador-1',
          montoTotal: 110000,
          cuotaId: 'cuota-2',
          origenGestion: 'CIERRE_PENDIENTE',
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.prestamo.findFirst).not.toHaveBeenCalled();
    });

    it('rechaza pagos de cierre pendiente en domingo en Bogotá', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-05-31T12:00:00.000Z'));

      try {
        await expect(
          service.create({
            prestamoId: 'prestamo-1',
            cobradorId: 'cobrador-1',
            montoTotal: 110000,
            cuotaId: 'cuota-2',
            fechaOperativaRuta: '2026-05-27',
            origenGestion: 'CIERRE_PENDIENTE',
            rutaId: 'ruta-1',
          } as any),
        ).rejects.toThrow(
          'No se pueden registrar pagos regularizados en domingo.',
        );

        expect(prisma.prestamo.findFirst).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    it('marca el préstamo como PAGADO cuando el saldo llega a ≤ 0', async () => {
      // Monto igual al saldo pendiente → préstamo queda saldado
      const prestamoSaldado = {
        ...PRESTAMO_ACTIVO,
        saldoPendiente: 110000,
        cuotas: [
          {
            id: 'cuota-1',
            monto: 110000,
            montoCapital: 100000,
            montoInteres: 10000,
            montoPagado: 0,
            estado: EstadoCuota.VENCIDA,
            montoInteresMora: 0,
          },
        ],
      };
      prisma.prestamo.findFirst.mockResolvedValue(prestamoSaldado);
      prisma._txMock.prestamo.findFirst.mockResolvedValue(prestamoSaldado);

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

    it('cierra el préstamo cuando el último pago queda dentro de la tolerancia COP', async () => {
      const prestamoConResiduoCOP = {
        ...PRESTAMO_ACTIVO,
        saldoPendiente: 63334,
        cuotas: [
          {
            id: 'cuota-final',
            numeroCuota: 10,
            monto: 63334,
            montoCapital: 63334,
            montoInteres: 0,
            montoPagado: 0,
            estado: EstadoCuota.PENDIENTE,
            montoInteresMora: 0,
          },
        ],
      };
      prisma.prestamo.findFirst.mockResolvedValue(prestamoConResiduoCOP);
      prisma._txMock.prestamo.findFirst.mockResolvedValue(prestamoConResiduoCOP);

      const resultado = await service.create({
        prestamoId: 'prestamo-1',
        cobradorId: 'cobrador-1',
        montoTotal: 63333,
        tipoRegistro: 'PAGO',
        cuotaNumeroEsperada: 10,
        montoCuotaEsperado: 63333,
      } as any);

      expect(resultado.descomposicion.prestamoQuedaPagado).toBe(true);
      expect(resultado.descomposicion.saldoNuevo).toBe(0);
      expect(prisma._txMock.prestamo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            saldoPendiente: 0,
            estado: EstadoPrestamo.PAGADO,
          }),
        }),
      );
    });

    it('llama al servicio de auditoría al registrar el pago', async () => {
      const dto = {
        prestamoId: 'prestamo-1',
        cobradorId: 'cobrador-1',
        montoTotal: 110000,
      };
      await service.create(dto);
      expect(mockAuditService.create).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'REGISTRAR_PAGO' }),
      );
    });
  });

  describe('findAll — alcance por rol', () => {
    it('limita la consulta de pagos del cobrador a su propio id', async () => {
      await service.findAll({ prestamoId: 'prestamo-1', limit: 50 }, {
        id: 'cobrador-propio',
        rol: RolUsuario.COBRADOR,
      } as any);

      expect(prisma.pago.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            prestamoId: 'prestamo-1',
            cobradorId: 'cobrador-propio',
          },
        }),
      );
      expect(prisma.pago.count).toHaveBeenCalledWith({
        where: {
          prestamoId: 'prestamo-1',
          cobradorId: 'cobrador-propio',
        },
      });
    });
  });

  describe('findOne — alcance por rol', () => {
    it('limita el detalle de pago del cobrador a su propio id', async () => {
      await service.findOne('pago-1', {
        id: 'cobrador-propio',
        rol: RolUsuario.COBRADOR,
      } as any);

      expect(prisma.pago.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'pago-1',
            cobradorId: 'cobrador-propio',
          },
        }),
      );
    });
  });

  describe('create — alcance por rol', () => {
    it('ignora un cobradorId ajeno cuando el actor es cobrador', async () => {
      await service.create(
        {
          prestamoId: 'prestamo-1',
          cobradorId: 'cobrador-ajeno',
          montoTotal: 110000,
        },
        undefined,
        { id: 'cobrador-propio', rol: RolUsuario.COBRADOR } as any,
      );

      expect(prisma._txMock.pago.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cobradorId: 'cobrador-propio',
          }),
        }),
      );
    });
  });

  describe('create — concurrencia', () => {
    it('usa el estado fresco del préstamo dentro de la transacción para calcular saldos', async () => {
      const stalePrestamo = {
        ...PRESTAMO_ACTIVO,
        saldoPendiente: 600000,
        totalPagado: 500000,
      };
      const freshPrestamo = {
        ...PRESTAMO_ACTIVO,
        saldoPendiente: 490000,
        totalPagado: 610000,
      };

      prisma.prestamo.findFirst.mockResolvedValue(stalePrestamo);
      prisma._txMock.prestamo.findFirst.mockResolvedValue(freshPrestamo);

      const resultado = await service.create({
        prestamoId: 'prestamo-1',
        cobradorId: 'cobrador-1',
        montoTotal: 110000,
      });

      expect(prisma._txMock.$queryRaw).toHaveBeenCalled();
      expect(resultado.descomposicion.saldoAnterior).toBe(490000);
      expect(prisma._txMock.prestamo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalPagado: 720000,
            saldoPendiente: 380000,
          }),
        }),
      );
    });

    it('atribuye al cobrador de la ruta activa cuando un admin registra el pago sin cobradorId', async () => {
      await service.create(
        { prestamoId: 'prestamo-1', montoTotal: 110000 },
        undefined,
        { id: 'admin-1', rol: RolUsuario.ADMIN } as any,
      );

      expect(prisma._txMock.pago.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cobradorId: 'cobrador-ruta',
          }),
        }),
      );
      expect(prisma._txMock.transaccion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            creadoPorId: 'cobrador-ruta',
          }),
        }),
      );
      expect(mockLedgerService.registrarPago).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: 'cobrador-ruta',
        }),
        expect.anything(),
      );
      expect(mockAuditService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioId: 'cobrador-ruta',
        }),
      );
    });

    it('reemplaza el id del admin por el cobrador de la ruta activa si llega como cobradorId', async () => {
      await service.create(
        { prestamoId: 'prestamo-1', cobradorId: 'admin-1', montoTotal: 110000 },
        undefined,
        { id: 'admin-1', rol: RolUsuario.ADMIN } as any,
      );

      expect(prisma._txMock.pago.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cobradorId: 'cobrador-ruta',
          }),
        }),
      );
    });

    it('reemplaza cualquier cobradorId enviado por roles de oficina con el cobrador real de la ruta activa', async () => {
      await service.create(
        {
          prestamoId: 'prestamo-1',
          cobradorId: 'usuario-oficina-equivocado',
          montoTotal: 110000,
        },
        undefined,
        { id: 'supervisor-1', rol: RolUsuario.SUPERVISOR } as any,
      );

      expect(prisma._txMock.pago.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cobradorId: 'cobrador-ruta',
          }),
        }),
      );
      expect(prisma._txMock.transaccion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            creadoPorId: 'cobrador-ruta',
          }),
        }),
      );
    });

    it('busca la caja de la asignación activa que coincide con el cobrador del pago', async () => {
      await service.create(
        {
          prestamoId: 'prestamo-1',
          cobradorId: 'cobrador-1',
          montoTotal: 110000,
        },
        undefined,
        { id: 'cobrador-1', rol: RolUsuario.COBRADOR } as any,
      );

      expect(prisma._txMock.asignacionRuta.findFirst).toHaveBeenCalledWith({
        where: {
          clienteId: 'cliente-1',
          activa: true,
          OR: [
            { cobradorId: 'cobrador-1' },
            { ruta: { cobradorId: 'cobrador-1' } },
          ],
        },
        select: {
          rutaId: true,
          cobradorId: true,
          ruta: { select: { cobradorId: true } },
        },
      });
    });
  });

  describe('create — idempotencia', () => {
    it('retorna el pago existente y no crea movimientos cuando se repite la misma idempotencyKey', async () => {
      prisma.pago.findFirst.mockResolvedValue(PAGO_EXISTENTE);

      const resultado = await service.create({
        prestamoId: 'prestamo-1',
        cobradorId: 'cobrador-1',
        montoTotal: 110000,
        idempotencyKey: 'offline-op-1',
      } as any);

      expect(resultado.pago.id).toBe('pago-existente-1');
      expect(resultado.idempotentReplay).toBe(true);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma._txMock.pago.create).not.toHaveBeenCalled();
      expect(mockAuditService.create).not.toHaveBeenCalled();
    });

    it('retorna la aprobación existente si se reintenta una transferencia pendiente con la misma idempotencyKey', async () => {
      prisma.pago.findFirst.mockResolvedValue(null);
      prisma.aprobacion.findFirst.mockResolvedValue({
        id: 'approval-existente-1',
        estado: 'PENDIENTE',
      });

      const resultado = await service.create(
        {
          prestamoId: 'prestamo-1',
          cobradorId: 'cobrador-1',
          montoTotal: 110000,
          metodoPago: MetodoPago.TRANSFERENCIA,
          idempotencyKey: 'offline-transfer-1',
        } as any,
        { originalname: 'comprobante.jpg', mimetype: 'image/jpeg' } as any,
      );

      expect(resultado).toEqual(
        expect.objectContaining({
          pendingVerification: true,
          aprobacionId: 'approval-existente-1',
          idempotentReplay: true,
        }),
      );
      expect(prisma.aprobacion.create).not.toHaveBeenCalled();
      expect(mockNotificacionesService.notifyApprovers).not.toHaveBeenCalled();
    });
  });

  // ── Casos de error ─────────────────────────
  describe('create — validaciones y errores', () => {
    it('lanza BadRequestException si no se proporciona prestamoId', async () => {
      await expect(
        service.create({
          prestamoId: '',
          cobradorId: 'cobrador-1',
          montoTotal: 100000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si no se proporciona cobradorId ni existe ruta activa para deducirlo', async () => {
      prisma.asignacionRuta.findFirst.mockResolvedValue(null);

      await expect(
        service.create({
          prestamoId: 'prestamo-1',
          cobradorId: '',
          montoTotal: 100000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si el monto no es finito para evitar errores 500 de Prisma', async () => {
      await expect(
        service.create({
          prestamoId: 'prestamo-1',
          cobradorId: 'cobrador-1',
          montoTotal: Number.NaN,
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('convierte errores de relación inválida de Prisma en BadRequest legible', async () => {
      prisma._txMock.pago.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Foreign key failed', {
          code: 'P2003',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.create({
          prestamoId: 'prestamo-1',
          cobradorId: 'cobrador-1',
          montoTotal: 110000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si el préstamo no existe', async () => {
      prisma.prestamo.findFirst.mockResolvedValue(null);
      await expect(
        service.create({
          prestamoId: 'no-existe',
          cobradorId: 'cobrador-1',
          montoTotal: 100000,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si el préstamo está en estado PAGADO', async () => {
      prisma.prestamo.findFirst.mockResolvedValue({
        ...PRESTAMO_ACTIVO,
        estado: EstadoPrestamo.PAGADO,
      });
      await expect(
        service.create({
          prestamoId: 'prestamo-1',
          cobradorId: 'cobrador-1',
          montoTotal: 110000,
        }),
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

    it('lanza ConflictException si otro usuario ya pagó la cuota esperada antes de confirmar', async () => {
      prisma._txMock.prestamo.findFirst.mockResolvedValue({
        ...PRESTAMO_ACTIVO,
        cuotas: [
          {
            ...PRESTAMO_ACTIVO.cuotas[1],
            id: 'cuota-2',
            numeroCuota: 2,
            monto: 270000,
            montoPagado: 0,
          },
        ],
      });

      await expect(
        service.create({
          prestamoId: 'prestamo-1',
          cobradorId: 'cobrador-1',
          montoTotal: 270000,
          tipoRegistro: 'PAGO',
          cuotaNumeroEsperada: 1,
          montoCuotaEsperado: 270000,
        } as any),
      ).rejects.toThrow(ConflictException);

      expect(prisma._txMock.pago.create).not.toHaveBeenCalled();
      expect(prisma._txMock.cuota.update).not.toHaveBeenCalled();
    });

    it('permite completar una cuota con abono parcial si el numero de cuota no cambio', async () => {
      prisma._txMock.prestamo.findFirst.mockResolvedValue({
        ...PRESTAMO_ACTIVO,
        cuotas: [
          {
            ...PRESTAMO_ACTIVO.cuotas[0],
            id: 'cuota-1',
            numeroCuota: 1,
            monto: 92000,
            montoPagado: 90000,
          },
          {
            ...PRESTAMO_ACTIVO.cuotas[1],
            id: 'cuota-2',
            numeroCuota: 2,
            monto: 92000,
            montoPagado: 0,
          },
        ],
      });

      await expect(
        service.create({
          prestamoId: 'prestamo-1',
          cobradorId: 'cobrador-1',
          montoTotal: 92000,
          tipoRegistro: 'PAGO',
          cuotaNumeroEsperada: 1,
          montoCuotaEsperado: 92000,
        } as any),
      ).resolves.toBeDefined();

      expect(prisma._txMock.pago.create).toHaveBeenCalled();
      expect(prisma._txMock.cuota.update).toHaveBeenCalled();
    });
  });
});
