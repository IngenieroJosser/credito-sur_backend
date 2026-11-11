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
import { MoraService } from '../loans/mora.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoCuota,
  EstadoPrestamo,
  MetodoPago,
  Prisma,
  RolUsuario,
} from '@prisma/client';
import { dependenciaSinUsar } from '../common/testing/dobles';

/**
 * Exige que `create` haya devuelto un pago REGISTRADO antes de leerlo.
 *
 * `create` devuelve varias formas segun el camino: el pago registrado, el que ya
 * estaba registrado (reintento idempotente) y el que queda en revision sin pago
 * todavia. Estas pruebas comprueban el primero, y leian el desglose directamente:
 * compilaba porque el cliente de Prisma estaba tipado como `any` y con el todo el
 * retorno del metodo.
 *
 * Asi, si el servicio devolviera otra forma, la prueba dice cual llego en vez de
 * comparar contra `undefined` y fallar con un mensaje que no explica nada.
 */
const pagoRegistrado = <T>(resultado: T) => {
  if (
    !resultado ||
    typeof resultado !== 'object' ||
    !('descomposicion' in resultado)
  ) {
    throw new Error(
      `Se esperaba un pago registrado y llego: ${JSON.stringify(resultado)}`,
    );
  }
  // Se exige tambien `idempotentReplay`: hay dos formas con desglose y solo
  // una lo trae, y es la que estas pruebas comprueban.
  return resultado as Extract<
    T,
    { pago: unknown; descomposicion: unknown; idempotentReplay: unknown }
  >;
};

// ─────────────────────────────────────────────
// Mocks de los servicios de soporte (no críticos para estos tests)
// ─────────────────────────────────────────────
const mockNotificacionesService = {
  notifyCoordinator: jest.fn().mockResolvedValue(undefined),
  notifyApprovers: jest.fn().mockResolvedValue(undefined),
  notifyRolesDeduped: jest.fn().mockResolvedValue(undefined),
  createDeduped: jest.fn().mockResolvedValue(undefined),
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

const mockMoraService = {
  recalcularNivelRiesgoCliente: jest.fn().mockResolvedValue({
    clienteId: 'cliente-1',
    nivelRiesgo: 'VERDE',
    diasEnMora: 0,
    actualizado: true,
  }),
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
  prestamo: { id: 'prestamo-1', numeroPrestamo: 'PRE-000001' },
  ruta: { id: 'ruta-1', nombre: 'Ruta Centro', codigo: 'RT-CEN' },
  rutaId: 'ruta-1',
  cobrador: { id: 'cobrador-1', nombres: 'Cobrador', apellidos: 'Prueba' },
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
const ACTOR_ADMIN = {
  id: 'admin-1',
  rol: RolUsuario.ADMIN,
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
    // Un supervisor que registra un pago valida que la ruta sea suya.
    ruta: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'ruta-1', cobradorId: 'cobrador-ruta' }),
    },
    registroVisita: {
      upsert: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
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
    ruta: {
      findFirst: jest.fn().mockResolvedValue({ id: 'ruta-1' }),
    },
    pago: {
      count: jest.fn().mockResolvedValue(0),
      /**
       * `null` por defecto: «no hay ningún pago previo que se parezca».
       *
       * Antes devolvía `PAGO_CREADO` para CUALQUIER consulta, y eso ya era una
       * trampa —cuatro pruebas de aquí tenían que neutralizarlo a mano con
       * `mockResolvedValueOnce(null)` para poder registrar un pago—. Al añadir
       * la comprobación de pago repetido del servidor, esa misma consulta pasó
       * a usarse para otra pregunta, y el doble contestaba «sí, ya existe» a
       * las dos: doce pruebas de registro de pago empezaron a fallar diciendo
       * que el pago estaba duplicado.
       *
       * Las dos pruebas que SÍ necesitan encontrar un pago —las de
       * idempotencia— lo ponen ellas, que es donde se lee.
       */
      findFirst: jest.fn().mockResolvedValue(null),
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
        { provide: MoraService, useValue: mockMoraService },
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
    /**
     * `isDomingoBogota` es `protected`: la subclase lo expone con su firma real en vez de
     * llamarlo por `(service as any)`, donde no se comprobaba nada.
     */
    class PagosParaPrueba extends PaymentsService {
      public readonly esDomingoBogota = this.isDomingoBogota.bind(this);
    }
    const esDomingo = (fecha: Date) =>
      new PagosParaPrueba(
        dependenciaSinUsar(),
        dependenciaSinUsar(),
        dependenciaSinUsar(),
        dependenciaSinUsar(),
        dependenciaSinUsar(),
        dependenciaSinUsar(),
        dependenciaSinUsar(),
      ).esDomingoBogota(fecha);

    it('detecta sábado antes de medianoche Bogotá aunque ya sea domingo UTC', () => {
      expect(esDomingo(new Date('2026-05-31T04:59:00.000Z'))).toBe(false);
    });

    it('detecta domingo desde medianoche Bogotá', () => {
      expect(esDomingo(new Date('2026-05-31T05:00:00.000Z'))).toBe(true);
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
      expect(
        pagoRegistrado(resultado).descomposicion.capitalRecuperado,
      ).toBeCloseTo(100000, 0);
      expect(
        pagoRegistrado(resultado).descomposicion.interesRecuperado,
      ).toBeCloseTo(10000, 0);
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
      expect(pagoRegistrado(resultado).descomposicion.capitalRecuperado).toBe(
        110000,
      );
      expect(pagoRegistrado(resultado).descomposicion.interesRecuperado).toBe(
        0,
      );
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
      expect(pagoRegistrado(resultado).descomposicion.montoTotal).toBe(110000);
      expect(pagoRegistrado(resultado).descomposicion.saldoAnterior).toBe(
        600000,
      );
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
        await service.create(dto, undefined, ACTOR_ADMIN);
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
      expect(mockMoraService.recalcularNivelRiesgoCliente).toHaveBeenCalledWith(
        'cliente-1',
        prisma._txMock,
      );
    });

    it('aplica pago regularizado acumulado desde cuotaId hacia cuotas siguientes', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));

      const dto = {
        prestamoId: 'prestamo-1',
        cobradorId: 'cobrador-1',
        montoTotal: 220000,
        cuotaId: 'cuota-1',
        cuotaNumeroEsperada: 1,
        montoCuotaEsperado: 220000,
        fechaOperativaRuta: '2026-05-27',
        origenGestion: 'CIERRE_PENDIENTE' as const,
        rutaId: 'ruta-1',
        idempotencyKey:
          'CIERRE_PENDIENTE:ruta-1:2026-05-27:cliente-1:prestamo-1:cuota-1:1:PAGO:220000',
      };

      prisma.pago.findFirst.mockResolvedValueOnce(null);
      try {
        await service.create(dto, undefined, ACTOR_ADMIN);
      } finally {
        jest.useRealTimers();
      }

      expect(prisma._txMock.cuota.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cuota-1' },
          data: expect.objectContaining({
            montoPagado: 110000,
            estado: EstadoCuota.PAGADA,
          }),
        }),
      );
      expect(prisma._txMock.cuota.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cuota-2' },
          data: expect.objectContaining({
            montoPagado: 110000,
            estado: EstadoCuota.PAGADA,
          }),
        }),
      );
      expect(prisma._txMock.pago.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            montoTotal: 220000,
            fechaOperativaRuta: '2026-05-27',
            origenGestion: 'CIERRE_PENDIENTE',
            detalles: {
              create: expect.arrayContaining([
                expect.objectContaining({ cuotaId: 'cuota-1', monto: 110000 }),
                expect.objectContaining({ cuotaId: 'cuota-2', monto: 110000 }),
              ]),
            },
          }),
        }),
      );
    });

    it('notifica pago regularizado a oficina y al cobrador de la ruta con metadata auditable', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));

      prisma.pago.findFirst.mockResolvedValueOnce(null);

      try {
        await service.create(
          {
            prestamoId: 'prestamo-1',
            cobradorId: 'cobrador-1',
            montoTotal: 110000,
            cuotaId: 'cuota-2',
            cuotaNumeroEsperada: 2,
            montoCuotaEsperado: 110000,
            fechaOperativaRuta: '2026-05-27',
            origenGestion: 'CIERRE_PENDIENTE',
            rutaId: 'ruta-1',
            notas: 'Recibido con nota administrativa',
            idempotencyKey:
              'CIERRE_PENDIENTE:ruta-1:2026-05-27:cliente-1:prestamo-1:cuota-2:1:PAGO:110000',
          },
          undefined,
          ACTOR_ADMIN,
        );
      } finally {
        jest.useRealTimers();
      }

      expect(mockNotificacionesService.notifyRolesDeduped).toHaveBeenCalledWith(
        expect.objectContaining({
          titulo: 'Pago regularizado registrado',
          entidad: 'Pago',
          entidadId: 'pago-1',
          dedupeKey: 'PAGO_REGULARIZADO:pago-1:2026-05-27',
          metadata: expect.objectContaining({
            tipoEvento: 'PAGO_REGULARIZADO',
            pagoId: 'pago-1',
            rutaId: 'ruta-1',
            rutaNombre: 'Ruta Centro',
            clienteId: 'cliente-1',
            clienteNombre: 'Juan Pérez',
            prestamoId: 'prestamo-1',
            numeroPrestamo: 'PRE-000001',
            cobradorId: 'cobrador-1',
            cobradorNombre: 'Cobrador Prueba',
            fechaOperativaRuta: '2026-05-27',
            montoTotal: 110000,
            cuotasAfectadas: 1,
            notaAdministrativa: 'Recibido con nota administrativa',
            notas: 'Recibido con nota administrativa',
          }),
        }),
      );
      expect(mockNotificacionesService.createDeduped).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioId: 'cobrador-1',
          dedupeKey: 'PAGO_REGULARIZADO:pago-1:2026-05-27:cobrador-1',
          metadata: expect.objectContaining({
            tipoEvento: 'PAGO_REGULARIZADO',
            pagoId: 'pago-1',
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
        await service.create(
          {
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
          },
          undefined,
          ACTOR_ADMIN,
        );
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
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.prestamo.findFirst).not.toHaveBeenCalled();
    });

    it('rechaza pagos regularizados de roles sin permiso operativo en la ruta', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));

      try {
        await expect(
          service.create(
            {
              prestamoId: 'prestamo-1',
              cobradorId: 'cobrador-1',
              montoTotal: 110000,
              cuotaId: 'cuota-2',
              fechaOperativaRuta: '2026-05-27',
              origenGestion: 'CIERRE_PENDIENTE',
              rutaId: 'ruta-1',
            },
            undefined,
            { id: 'contador-1', rol: RolUsuario.CONTADOR },
          ),
        ).rejects.toThrow(ForbiddenException);

        expect(prisma.prestamo.findFirst).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
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
          }),
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

      expect(pagoRegistrado(resultado).descomposicion.prestamoQuedaPagado).toBe(
        true,
      );
      expect(prisma._txMock.prestamo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ estado: EstadoPrestamo.PAGADO }),
        }),
      );
    });

    it('no cierra el préstamo si queda residuo de 1 COP', async () => {
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
      prisma._txMock.prestamo.findFirst.mockResolvedValue(
        prestamoConResiduoCOP,
      );

      const resultado = await service.create({
        prestamoId: 'prestamo-1',
        cobradorId: 'cobrador-1',
        montoTotal: 63333,
        tipoRegistro: 'PAGO',
        cuotaNumeroEsperada: 10,
        montoCuotaEsperado: 63333,
      });

      expect(pagoRegistrado(resultado).descomposicion.prestamoQuedaPagado).toBe(
        false,
      );
      expect(pagoRegistrado(resultado).descomposicion.saldoNuevo).toBe(1);

      expect(prisma._txMock.prestamo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            saldoPendiente: 1,
          }),
        }),
      );

      expect(prisma._txMock.prestamo.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            estado: EstadoPrestamo.PAGADO,
          }),
        }),
      );
    });

    it('cierra el préstamo solo cuando el saldo truncado llega a 0', async () => {
      const prestamoSaldado = {
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

      prisma.prestamo.findFirst.mockResolvedValue(prestamoSaldado);
      prisma._txMock.prestamo.findFirst.mockResolvedValue(prestamoSaldado);

      const resultado = await service.create({
        prestamoId: 'prestamo-1',
        cobradorId: 'cobrador-1',
        montoTotal: 63334,
        tipoRegistro: 'PAGO',
        cuotaNumeroEsperada: 10,
        montoCuotaEsperado: 63334,
      });

      expect(pagoRegistrado(resultado).descomposicion.prestamoQuedaPagado).toBe(
        true,
      );
      expect(pagoRegistrado(resultado).descomposicion.saldoNuevo).toBe(0);

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
      await service.findAll(
        { prestamoId: 'prestamo-1', limit: 50 },
        {
          id: 'cobrador-propio',
          rol: RolUsuario.COBRADOR,
        },
      );

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
      // Esta prueba SÍ necesita que la consulta encuentre un pago: lo que
      // comprueba es con qué filtro se pidió, y sin pago `findOne` lanza
      // «Pago no encontrado» antes de llegar a la comprobación. Se dice aquí,
      // donde se usa, en vez de en el doble compartido: el valor por defecto
      // allí es `null` porque la mayoría de las pruebas registra pagos nuevos.
      prisma.pago.findFirst.mockResolvedValueOnce(PAGO_CREADO);

      await service.findOne('pago-1', {
        id: 'cobrador-propio',
        rol: RolUsuario.COBRADOR,
      });

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
        { id: 'cobrador-propio', rol: RolUsuario.COBRADOR },
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
      expect(pagoRegistrado(resultado).descomposicion.saldoAnterior).toBe(
        490000,
      );
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
        { id: 'admin-1', rol: RolUsuario.ADMIN },
      );

      expect(prisma._txMock.pago.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cobradorId: 'cobrador-ruta',
          }),
        }),
      );
      // El movimiento entra a la caja de la ruta del cobrador, que es de quien
      // es la plata. `creadoPorId` guarda quién ejecutó el registro —el admin—,
      // porque es un dato de auditoría: quien registra no siempre es quien cobra.
      expect(prisma._txMock.transaccion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            creadoPorId: 'admin-1',
            cajaId: 'caja-1',
          }),
        }),
      );
      // El asiento se registra sobre la caja de la ruta, pero `createdBy` y la
      // auditoría apuntan a quien ejecutó la acción, no a quien cobró.
      expect(mockLedgerService.registrarPago).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: 'admin-1',
          cajaRutaId: 'caja-1',
        }),
        expect.anything(),
      );
      expect(mockAuditService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioId: 'admin-1',
        }),
      );
    });

    it('reemplaza el id del admin por el cobrador de la ruta activa si llega como cobradorId', async () => {
      await service.create(
        { prestamoId: 'prestamo-1', cobradorId: 'admin-1', montoTotal: 110000 },
        undefined,
        { id: 'admin-1', rol: RolUsuario.ADMIN },
      );

      expect(prisma._txMock.pago.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cobradorId: 'cobrador-ruta',
          }),
        }),
      );
    });

    it('ignora el cobradorId del body y atribuye el pago al supervisor que salió a cobrar', async () => {
      await service.create(
        {
          prestamoId: 'prestamo-1',
          cobradorId: 'usuario-oficina-equivocado',
          montoTotal: 110000,
        },
        undefined,
        { id: 'supervisor-1', rol: RolUsuario.SUPERVISOR },
      );

      expect(prisma._txMock.pago.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cobradorId: 'supervisor-1',
          }),
        }),
      );
      // El movimiento de caja queda a nombre del supervisor, que es quien
      // recibió el dinero y quien responde por él al cierre. El dinero entra a
      // su propia caja operativa, no a la de la ruta.
      expect(prisma._txMock.transaccion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ creadoPorId: 'supervisor-1' }),
        }),
      );

      // Antes de aceptar el cobro se verifica que la ruta esté bajo su
      // supervisión: un supervisor no puede cobrar en rutas ajenas.
      expect(prisma._txMock.ruta.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ supervisorId: 'supervisor-1' }),
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
        { id: 'cobrador-1', rol: RolUsuario.COBRADOR },
      );

      // Lo que importa es el filtro: la asignación activa del cliente que
      // corresponde a ese cobrador, sea directo o por la ruta. El `select` no
      // se fija al detalle para que agregar un campo no rompa la prueba.
      expect(prisma._txMock.asignacionRuta.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            clienteId: 'cliente-1',
            activa: true,
            OR: [
              { cobradorId: 'cobrador-1' },
              { ruta: { cobradorId: 'cobrador-1' } },
            ],
          },
        }),
      );
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
      });

      expect(pagoRegistrado(resultado).pago.id).toBe('pago-existente-1');
      expect(pagoRegistrado(resultado).idempotentReplay).toBe(true);
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
        },
        // Solo los dos campos que el servicio lee del archivo subido; `Express.Multer.File`
        // declara diez mas que aqui no cambian nada.
        {
          originalname: 'comprobante.jpg',
          mimetype: 'image/jpeg',
        } as Express.Multer.File,
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
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    /**
     * `tipoRegistro` se recibia desde siempre y se USABA (el minimo del abono, el estado
     * que queda en la visita, la nota de gestion) pero NO se guardaba. Por eso el export
     * de pagos tenia una columna `esAbono` que salia SIEMPRE en false: no habia de donde
     * sacarla. Ahora es columna.
     */
    it('guarda tipoRegistro en el pago', async () => {
      await service.create({
        prestamoId: 'prestamo-1',
        cobradorId: 'cobrador-1',
        montoTotal: 10_000,
        tipoRegistro: 'ABONO',
      });

      expect(prisma._txMock.pago.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tipoRegistro: 'ABONO' }),
        }),
      );
    });

    it('si no lo mandan queda sin valor, no como PAGO', async () => {
      // Poner PAGO por omision etiquetaria como pago lo que en realidad no se sabe.
      await service.create({
        prestamoId: 'prestamo-1',
        cobradorId: 'cobrador-1',
        montoTotal: 10_000,
      });

      const [argumento] = prisma._txMock.pago.create.mock.calls.at(-1);
      expect(argumento.data.tipoRegistro).toBeUndefined();
    });

    it('rechaza abonos menores a 1000 pesos', async () => {
      await expect(
        service.create({
          prestamoId: 'prestamo-1',
          cobradorId: 'cobrador-1',
          montoTotal: 999,
          tipoRegistro: 'ABONO',
        }),
      ).rejects.toThrow('El abono mínimo permitido es $1.000.');

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
        }),
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
        }),
      ).resolves.toBeDefined();

      expect(prisma._txMock.pago.create).toHaveBeenCalled();
      expect(prisma._txMock.cuota.update).toHaveBeenCalled();
    });
  });

  /**
   * El servidor se defiende solo del cobro doble.
   *
   * Medido antes de esto: dos POST /payments simultaneos con el mismo cuerpo y
   * SIN idempotencyKey respondian 201 y 201, y la deuda bajaba 100.000 por dos
   * pagos de 50.000. Lo frenaba solo la pantalla —el modal bloquea el boton
   * mientras envia—, asi que la proteccion entera dependia de que ninguna
   * pantalla futura se olvidara. Y ya paso una vez en produccion: esta contado
   * en el comentario de VistaCobrador.tsx:499.
   */
  /**
   * El servidor se defiende solo del cobro doble.
   *
   * Medido antes de esto: dos POST /payments simultaneos con el mismo cuerpo y
   * SIN idempotencyKey respondian 201 y 201, y la deuda bajaba 100.000 por dos
   * pagos de 50.000. Lo frenaba solo la pantalla, asi que la proteccion entera
   * dependia de que ninguna pantalla futura se olvidara. Y ya paso una vez en
   * produccion: esta contado en el comentario de VistaCobrador.tsx:499.
   *
   * ── Por que una llave derivada y no una consulta ──────────────────────────
   *
   * El primer arreglo fue consultar antes de escribir: «hay ya un pago
   * identico en el ultimo minuto?». Medido, NO funciona: los dos envios llegan
   * a la vez, los dos consultan antes de que ninguno haya guardado, los dos
   * encuentran nada y los dos entran. Ninguna comprobacion de leer-y-despues-
   * escribir le gana a una carrera.
   *
   * Asi que al pago sin llave se le pone una DERIVADA de su contenido —credito,
   * importe, cobrador y un cubo de tiempo—, y el indice unico de
   * `Pago.idempotencyKey` hace el trabajo. Dos envios identicos producen la
   * misma llave: uno entra y el otro recibe el que entro. Eso es atomico,
   * porque no hay comprobacion que adelantar.
   */
  describe('create — el servidor para el pago repetido sin llave', () => {
    const DTO = {
      prestamoId: 'prestamo-1',
      cobradorId: 'cobrador-1',
      montoTotal: 110000,
      metodoPago: MetodoPago.EFECTIVO,
    };

    it('le pone al pago una llave derivada de su contenido', async () => {
      prisma.pago.findFirst.mockResolvedValue(null);

      await service.create(DTO);

      const guardado = prisma._txMock.pago.create.mock.calls[0][0];
      // `auto:` la distingue de una llave que haya traido quien llama, que es
      // lo que permite saber de donde salio al mirar la tabla.
      expect(guardado.data.idempotencyKey).toMatch(/^auto:/);
      expect(guardado.data.idempotencyKey).toContain('prestamo-1');
      expect(guardado.data.idempotencyKey).toContain('110000');
    });

    it('dos pagos iguales seguidos producen la MISMA llave', async () => {
      // Es la propiedad de la que depende todo: si la llave cambiara entre un
      // envio y el siguiente, el indice unico no veria nada que frenar.
      prisma.pago.findFirst.mockResolvedValue(null);

      await service.create(DTO);
      const primera = prisma._txMock.pago.create.mock.calls[0][0].data
        .idempotencyKey as string;

      jest.clearAllMocks();
      prisma.pago.findFirst.mockResolvedValue(null);
      prisma._txMock.pago.create.mockResolvedValue(PAGO_CREADO);

      await service.create(DTO);
      const segunda = prisma._txMock.pago.create.mock.calls[0][0].data
        .idempotencyKey as string;

      expect(segunda).toBe(primera);
    });

    it('dos pagos DISTINTOS producen llaves distintas', async () => {
      // Lo contrario tambien importa: si dos pagos legitimos compartieran
      // llave, el segundo se perderia en silencio. Se cambia el importe, que
      // es lo minimo que distingue un pago de otro.
      prisma.pago.findFirst.mockResolvedValue(null);

      await service.create(DTO);
      const unaLlave = prisma._txMock.pago.create.mock.calls[0][0].data
        .idempotencyKey as string;

      jest.clearAllMocks();
      prisma.pago.findFirst.mockResolvedValue(null);
      prisma._txMock.pago.create.mockResolvedValue(PAGO_CREADO);

      await service.create({ ...DTO, montoTotal: 120000 });
      const otraLlave = prisma._txMock.pago.create.mock.calls[0][0].data
        .idempotencyKey as string;

      expect(otraLlave).not.toBe(unaLlave);
    });

    it('si la llave derivada ya esta usada, devuelve el pago que entro', async () => {
      // El doble clic en SERIE: el segundo envio llega cuando el primero ya
      // guardo. No se crea un segundo pago y no se cobra dos veces.
      prisma.pago.findFirst.mockResolvedValue(PAGO_EXISTENTE);

      const resultado = await service.create(DTO);

      expect(pagoRegistrado(resultado).idempotentReplay).toBe(true);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma._txMock.pago.create).not.toHaveBeenCalled();
    });

    it('el choque del indice unico en paralelo sale como conflicto, no como 500', async () => {
      // El doble clic en PARALELO: los dos pasan la consulta y los dos llegan
      // a escribir. El indice unico deja entrar uno; el otro recibe un P2002,
      // que tiene que llegar explicado y no como «error inesperado».
      prisma.pago.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('llave repetida', {
          code: 'P2002',
          clientVersion: 'prueba',
          meta: { target: ['idempotencyKey'] },
        }),
      );

      await expect(service.create(DTO)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('con idempotencyKey propia NO se deriva ninguna: la llave ya decidio', async () => {
      // La cola offline reusa la MISMA llave que intento en linea, asi que un
      // reintento de red entra por aqui y queda cubierto. Derivar otra encima
      // romperia esa garantia.
      prisma.pago.findFirst.mockResolvedValue(null);

      await service.create({ ...DTO, idempotencyKey: 'llave-propia-1' });

      const guardado = prisma._txMock.pago.create.mock.calls[0][0];
      expect(guardado.data.idempotencyKey).toBe('llave-propia-1');
    });
  });

  describe('create — importes que no son pesos', () => {
    const conMonto = (montoTotal: number) => ({
      prestamoId: 'prestamo-1',
      cobradorId: 'cobrador-1',
      montoTotal,
      metodoPago: MetodoPago.EFECTIVO,
    });

    const IMPOSIBLES: [string, number][] = [
      ['con centavos', 1000.57],
      ['con una fraccion minima', 1000.004],
      ['negativo', -50000],
      ['cero', 0],
      ['mas grande de lo que cabe en la columna', 1e15],
    ];

    for (const [nombre, monto] of IMPOSIBLES) {
      it(`rechaza un pago ${nombre} sin tocar el dinero`, async () => {
        prisma.pago.findFirst.mockResolvedValue(null);

        await expect(service.create(conMonto(monto))).rejects.toBeInstanceOf(
          BadRequestException,
        );
        expect(prisma.$transaction).not.toHaveBeenCalled();
      });
    }

    it('el motivo explica que el peso no tiene centavos', async () => {
      prisma.pago.findFirst.mockResolvedValue(null);

      // «Importe invalido» dejaria a la persona mirando el monto sin entender
      // que sobra la coma.
      await expect(service.create(conMonto(1000.57))).rejects.toThrow(
        /centavos/i,
      );
    });

    it('un importe entero sigue entrando', async () => {
      prisma.pago.findFirst.mockResolvedValue(null);

      await expect(service.create(conMonto(110000))).resolves.toBeDefined();
    });
  });
});
