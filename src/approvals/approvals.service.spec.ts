import { BadRequestException } from '@nestjs/common';
import {
  EstadoAprobacion,
  EstadoCuota,
  EstadoPrestamo,
  EstadoSincronizacion,
  MetodoPago,
  Prisma,
  RolUsuario,
  TipoAprobacion,
} from '@prisma/client';
import type { Aprobacion } from '@prisma/client';
import { ApprovalsService } from './approvals.service';
import type { NotificacionesService } from '../notificaciones/notificaciones.service';
import type { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import type { LedgerService } from '../accounting/ledger.service';
import {
  comoDependencia,
  comoPrisma,
  exigir,
  type DobleDePrisma,
  type MetodosDeModelo,
} from '../common/testing/dobles';

const mockNotifications = {
  create: jest.fn().mockResolvedValue(undefined),
  notifyCoordinator: jest.fn().mockResolvedValue(undefined),
  notifyApprovers: jest.fn().mockResolvedValue(undefined),
};

const mockGateway = {
  broadcastAprobacionesActualizadas: jest.fn(),
  broadcastPrestamosActualizados: jest.fn(),
  broadcastDashboardsActualizados: jest.fn(),
  broadcastClientesActualizados: jest.fn(),
};

const mockLedger = {
  registrarAsiento: jest.fn().mockResolvedValue({ id: 'journal-1' }),
  registrarVentaArticulo: jest
    .fn()
    .mockResolvedValue({ id: 'journal-venta-articulo' }),
  registrarAjusteCartera: jest
    .fn()
    .mockResolvedValue({ id: 'journal-ajuste-cartera' }),
};

/** Fecha desplazada respecto a hoy, para que las pruebas no dependan del día. */
function diasDesdeHoy(dias: number) {
  return new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
}

/**
 * La transaccion imitada. Cada modelo es `MetodosDeModelo` -no el literal inferido- para
 * que una prueba pueda agregarle el metodo que quiera vigilar (`cuota.deleteMany`) sin un
 * cast, y para que leerlo no salga como "posiblemente undefined".
 */
type TxDePruebas = {
  $queryRaw: jest.Mock;
  aprobacion: MetodosDeModelo;
  asignacionRuta: MetodosDeModelo;
  caja: MetodosDeModelo;
  cuota: MetodosDeModelo;
  efectoProvisional: MetodosDeModelo;
  gasto: MetodosDeModelo;
  journalEntry: MetodosDeModelo;
  multimedia: MetodosDeModelo;
  pago: MetodosDeModelo;
  prestamo: MetodosDeModelo;
  producto: MetodosDeModelo;
  registroVisita: MetodosDeModelo;
  ruta: MetodosDeModelo;
  transaccion: MetodosDeModelo;
  usuario: MetodosDeModelo;
};

type PrismaDeAprobaciones = {
  aprobacion: MetodosDeModelo;
  asignacionRuta: MetodosDeModelo;
  cliente: MetodosDeModelo;
  efectoProvisional: MetodosDeModelo;
  notificacion: MetodosDeModelo;
  pago: MetodosDeModelo;
  prestamo: MetodosDeModelo;
  producto: MetodosDeModelo;
  usuario: MetodosDeModelo;
  $transaction: jest.Mock;
  _tx: TxDePruebas;
};

function buildPrismaMock(): PrismaDeAprobaciones {
  const tx: TxDePruebas = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    aprobacion: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    pago: { create: jest.fn().mockResolvedValue({ id: 'pago-transfer-1' }) },
    cuota: {
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
    },
    prestamo: {
      // La reversión valida contra el préstamo antes de deshacer nada, y de
      // paso mira si era de artículo para devolver el stock.
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'prestamo-1', productoId: null }),
      findFirst: jest.fn().mockResolvedValue({
        id: 'prestamo-1',
        clienteId: 'cliente-1',
        estado: EstadoPrestamo.ACTIVO,
        saldoPendiente: 100000,
        totalPagado: 0,
        capitalPagado: 0,
        interesPagado: 0,
        cuotas: [
          {
            id: 'cuota-1',
            monto: 100000,
            montoPagado: 0,
            montoCapital: 80000,
            montoInteres: 15000,
            montoInteresMora: 5000,
            estado: EstadoCuota.VENCIDA,
          },
        ],
        cliente: { id: 'cliente-1' },
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    asignacionRuta: {
      findFirst: jest.fn().mockResolvedValue({
        cobradorId: 'cobrador-1',
        ruta: { cobradorId: 'cobrador-1' },
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    ruta: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'ruta-1',
        cobradorId: 'cobrador-1',
      }),
    },
    transaccion: {
      create: jest.fn().mockResolvedValue({ id: 'trx-bank-1' }),
      findMany: jest.fn().mockResolvedValue([]),
      // Antes de crear una reversa se comprueba que no exista ya.
      findFirst: jest.fn().mockResolvedValue(null),
    },
    gasto: {
      create: jest.fn().mockResolvedValue({
        id: 'gasto-1',
        ruta: { id: 'ruta-1', nombre: 'Ruta 1' },
        caja: { id: 'caja-ruta-1', nombre: 'Caja Ruta 1' },
        cobrador: { id: 'cobrador-1', nombres: 'Cobra', apellidos: 'Dor' },
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'gasto-1',
        cajaId: 'caja-ruta-1',
        monto: 25000,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    caja: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'caja-banco',
        nombre: 'Caja Banco',
        saldoActual: 0,
      }),
      findFirst: jest.fn().mockResolvedValue({
        id: 'caja-ruta-1',
        nombre: 'Caja Ruta 1',
        tipo: 'RUTA',
        rutaId: 'ruta-1',
        responsableId: 'cobrador-1',
        saldoActual: 500000,
      }),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    producto: { update: jest.fn().mockResolvedValue({}) },
    journalEntry: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    usuario: {
      findFirst: jest.fn(),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    multimedia: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    registroVisita: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    efectoProvisional: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };

  return {
    aprobacion: {
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    prestamo: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'prestamo-1',
        clienteId: 'cliente-1',
        estado: EstadoPrestamo.ACTIVO,
        saldoPendiente: 100000,
        totalPagado: 0,
        capitalPagado: 0,
        interesPagado: 0,
        cuotas: [
          {
            id: 'cuota-1',
            monto: 100000,
            montoPagado: 0,
            montoCapital: 80000,
            montoInteres: 15000,
            montoInteresMora: 5000,
            estado: EstadoCuota.VENCIDA,
          },
        ],
        cliente: { id: 'cliente-1' },
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    pago: { count: jest.fn().mockResolvedValue(0) },
    asignacionRuta: { findFirst: jest.fn().mockResolvedValue(null) },
    cliente: { update: jest.fn().mockResolvedValue({}) },
    producto: { update: jest.fn().mockResolvedValue({}) },
    efectoProvisional: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    usuario: { findUnique: jest.fn().mockResolvedValue(null) },
    notificacion: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockImplementation((cb) => cb(tx)),
    _tx: tx,
  };
}

/**
 * Una fila de `Aprobacion` completa, con lo que la prueba quiera cambiar encima.
 *
 * Hace falta porque los cuatro `approveX` reciben una `Aprobacion` de Prisma -quince
 * columnas, dos de ellas `Decimal`- y las pruebas le pasaban objetos de tres o cuatro
 * campos. Compilaba por el `as any` del llamador; sin el, el compilador dice que el
 * fixture no se parece a la fila real. Los valores por defecto son los del esquema
 * (schema.prisma:558-574), asi que una prueba solo escribe lo que de verdad ejercita.
 */
const aprobacion = (over: Partial<Aprobacion> = {}): Aprobacion => ({
  id: 'aprobacion-1',
  tipoAprobacion: TipoAprobacion.NUEVO_PRESTAMO,
  idempotencyKey: null,
  referenciaId: 'referencia-1',
  tablaReferencia: 'prestamos',
  solicitadoPorId: 'usuario-1',
  datosSolicitud: {},
  aprobadoPorId: null,
  estado: EstadoAprobacion.PENDIENTE,
  comentarios: null,
  datosAprobados: null,
  creadoEn: new Date('2026-01-01T12:00:00.000Z'),
  actualizadoEn: new Date('2026-01-01T12:00:00.000Z'),
  revisadoEn: null,
  estadoSincronizacion: EstadoSincronizacion.PENDIENTE,
  montoSolicitud: null,
  ...over,
});

/**
 * El asidero de prueba.
 *
 * Los cuatro `approveX` son `protected` en el servicio y estas pruebas los ejercitan uno
 * por uno. `.bind(this)` hereda la firma REAL -no se escribe a mano-, asi que si al metodo
 * le cambian un parametro, la prueba deja de compilar. Antes se llamaban por
 * `(service as any).approveX(...)`, donde no se comprobaba nada.
 */
class AprobacionesConDelegacionVigilada extends ApprovalsService {
  /**
   * Registra la delegacion de `approveItem` sin ejecutar el metodo de verdad.
   *
   * Antes se hacia `jest.spyOn(service, 'approveNewLoan')`, que con el metodo `protected`
   * ya no compila -y con `private` no compilaba tampoco: iba por un `as any`-. El
   * `override` SI lo comprueba el compilador contra la firma de la clase base, asi que si
   * al metodo le cambian los parametros, esto deja de compilar.
   */
  public readonly prestamoNuevoAprobado = jest.fn();

  protected override async approveNewLoan(
    approval: Aprobacion,
    aprobadoPorId?: string,
    editedData?: Record<string, unknown>,
  ) {
    this.prestamoNuevoAprobado(approval, aprobadoPorId, editedData);
  }
}

class AprobacionesParaPrueba extends ApprovalsService {
  public readonly aprobarPagoDeTransferencia =
    this.approveTransferPayment.bind(this);
  public readonly aprobarPrestamoNuevo = this.approveNewLoan.bind(this);
  public readonly aprobarGasto = this.approveExpense.bind(this);
  public readonly aprobarBaseDeCaja = this.approveCashBase.bind(this);
}

function makeService(prisma: DobleDePrisma) {
  return new AprobacionesParaPrueba(
    comoPrisma(prisma),
    comoDependencia<NotificacionesService>(mockNotifications),
    comoDependencia<NotificacionesGateway>(mockGateway),
    comoDependencia<LedgerService>(mockLedger),
  );
}

describe('ApprovalsService pending loan reconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('arma contexto de evaluación para una reprogramación con créditos, pagos y alertas', async () => {
    const approval = {
      id: 'aprobacion-reprogramacion-1',
      tipoAprobacion: TipoAprobacion.REPROGRAMACION_CUOTA,
      referenciaId: 'cuota-1',
      tablaReferencia: 'cuotas',
      solicitadoPorId: 'supervisor-1',
      aprobadoPorId: null,
      estado: EstadoAprobacion.PENDIENTE,
      comentarios: null,
      datosAprobados: null,
      montoSolicitud: null,
      creadoEn: new Date('2026-06-19T13:32:00.000Z'),
      actualizadoEn: new Date('2026-06-19T13:32:00.000Z'),
      revisadoEn: null,
      datosSolicitud: {
        prestamoId: 'prestamo-solicitud',
        cuotaId: 'cuota-1',
        clienteId: 'cliente-1',
        numeroPrestamo: 'PRES-000018',
        numeroCuota: 4,
        nuevaFecha: '2026-06-20',
        motivo: 'Cliente solicita pagar mañana',
        montoCuota: 45832,
      },
      solicitadoPor: {
        id: 'supervisor-1',
        nombres: 'Supervisor',
        apellidos: 'Operativo',
        rol: RolUsuario.SUPERVISOR,
      },
      aprobadoPor: null,
    };

    const prisma = {
      aprobacion: {
        findUnique: jest.fn().mockResolvedValue(approval),
        count: jest.fn().mockResolvedValue(3),
      },
      cliente: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cliente-1',
          codigo: 'C001',
          dni: '123',
          nombres: 'Josser',
          apellidos: 'Cordoba Rivas',
          telefono: '300',
          direccion: 'Calle 1',
          nivelRiesgo: 'AMARILLO',
          enListaNegra: false,
          referencia1Nombre: 'Maria',
          referencia1Telefono: '301',
          referencia2Nombre: 'Carlos',
          referencia2Telefono: '302',
          asignacionesRuta: [
            {
              ruta: {
                id: 'ruta-1',
                nombre: 'Ruta Centro',
                codigo: 'R-1',
                cobrador: {
                  id: 'cobrador-1',
                  nombres: 'Cobra',
                  apellidos: 'Dor',
                },
              },
            },
          ],
        }),
      },
      prestamo: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'prestamo-solicitud',
            numeroPrestamo: 'PRES-000018',
            estado: EstadoPrestamo.ACTIVO,
            saldoPendiente: 200000,
            monto: 500000,
            tipoPrestamo: 'EFECTIVO',
            frecuenciaPago: 'DIARIO',
            cantidadCuotas: 12,
            cuotas: [
              {
                id: 'cuota-1',
                numeroCuota: 4,
                monto: 45832,
                montoPagado: 0,
                estado: EstadoCuota.VENCIDA,
                fechaVencimiento: diasDesdeHoy(-20),
              },
              {
                // Sigue marcada PENDIENTE pero su fecha ya pasó: cuenta
                // como vencida igual, porque el estado se queda atrás hasta
                // que algo lo actualice.
                id: 'cuota-2',
                numeroCuota: 5,
                monto: 45832,
                montoPagado: 0,
                estado: EstadoCuota.PENDIENTE,
                fechaVencimiento: diasDesdeHoy(-5),
              },
              {
                // Esta todavía no vence, así que no debe contarse.
                id: 'cuota-5',
                numeroCuota: 6,
                monto: 45832,
                montoPagado: 0,
                estado: EstadoCuota.PENDIENTE,
                fechaVencimiento: diasDesdeHoy(10),
              },
            ],
            producto: null,
          },
          {
            id: 'prestamo-historico',
            numeroPrestamo: 'PRES-000010',
            estado: EstadoPrestamo.EN_MORA,
            saldoPendiente: 100000,
            monto: 300000,
            tipoPrestamo: 'EFECTIVO',
            frecuenciaPago: 'DIARIO',
            cantidadCuotas: 6,
            cuotas: [
              {
                id: 'cuota-3',
                numeroCuota: 1,
                monto: 50000,
                montoPagado: 50000,
                estado: EstadoCuota.PAGADA,
                fechaVencimiento: diasDesdeHoy(-40),
              },
              {
                id: 'cuota-4',
                numeroCuota: 2,
                monto: 50000,
                montoPagado: 0,
                estado: EstadoCuota.VENCIDA,
                fechaVencimiento: diasDesdeHoy(-35),
              },
            ],
            producto: null,
          },
        ]),
      },
      multimedia: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'foto-1',
            clienteId: 'cliente-1',
            tipoContenido: 'IMAGEN',
            url: 'https://example.com/foto.jpg',
            descripcion: 'Evidencia visita',
          },
        ]),
      },
      pago: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'pago-1',
            prestamoId: 'prestamo-solicitud',
            montoTotal: 50000,
            metodoPago: MetodoPago.EFECTIVO,
            fechaPago: new Date('2026-06-10T15:00:00.000Z'),
          },
          {
            id: 'pago-2',
            prestamoId: 'prestamo-historico',
            montoTotal: 33333,
            metodoPago: MetodoPago.EFECTIVO,
            fechaPago: new Date('2026-06-12T15:00:00.000Z'),
          },
        ]),
      },
    };

    const result = await makeService(prisma).getApprovalContext(approval.id);

    expect(result.approval.datosSolicitud.prestamoId).toBe(
      'prestamo-solicitud',
    );
    expect(exigir(result.cliente, 'el cliente').id).toBe('cliente-1');
    expect(
      exigir(result.creditoSolicitud, 'el crédito de la solicitud').id,
    ).toBe('prestamo-solicitud');
    expect(result.creditosCliente).toHaveLength(2);
    expect(result.referencias).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tipo: 'REFERENCIA_1', nombre: 'Maria' }),
        expect.objectContaining({ tipo: 'REFERENCIA_2', nombre: 'Carlos' }),
      ]),
    );
    expect(result.multimedia).toHaveLength(1);
    expect(result.pagosUltimos30Dias).toHaveLength(2);
    expect(result.metricas).toMatchObject({
      saldoTotalPendiente: 300000,
      creditosActivos: 2,
      cuotasVencidas: 3,
      cuotasPagadas: 1,
      reprogramacionesPrevias: 3,
      pagosUltimos30Dias: 2,
      montoPagadoUltimos30Dias: 83333,
      candidatoReprogramacion: false,
    });
    expect(result.metricas.alertas).toEqual(
      expect.arrayContaining([
        'El cliente tiene 3 cuota(s) vencida(s).',
        'El cliente registra 3 reprogramación(es).',
      ]),
    );
  });

  it('resuelve contexto de reprogramación desde la cuota referenciada y excluye la aprobación actual', async () => {
    const approval = {
      id: 'aprobacion-actual',
      tipoAprobacion: TipoAprobacion.REPROGRAMACION_CUOTA,
      referenciaId: 'cuota-referenciada',
      tablaReferencia: 'cuotas',
      solicitadoPorId: 'supervisor-1',
      aprobadoPorId: null,
      estado: EstadoAprobacion.PENDIENTE,
      comentarios: null,
      datosAprobados: null,
      montoSolicitud: null,
      creadoEn: new Date('2026-06-19T13:32:00.000Z'),
      actualizadoEn: new Date('2026-06-19T13:32:00.000Z'),
      revisadoEn: null,
      datosSolicitud: {
        nuevaFecha: '2026-06-20',
        motivo: 'Cliente solicita pagar mañana',
      },
      solicitadoPor: {
        id: 'supervisor-1',
        nombres: 'Supervisor',
        apellidos: 'Operativo',
        rol: RolUsuario.SUPERVISOR,
      },
      aprobadoPor: null,
    };

    const prisma = {
      aprobacion: {
        findUnique: jest.fn().mockResolvedValue(approval),
        count: jest.fn().mockResolvedValue(1),
      },
      cuota: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cuota-referenciada',
          prestamoId: 'prestamo-desde-cuota',
          prestamo: { clienteId: 'cliente-desde-cuota' },
        }),
      },
      cliente: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cliente-desde-cuota',
          nombres: 'Cliente',
          apellidos: 'Sin Datos Solicitud',
          referencia1Nombre: null,
          referencia1Telefono: null,
          referencia2Nombre: null,
          referencia2Telefono: null,
          asignacionesRuta: [],
        }),
      },
      prestamo: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'prestamo-desde-cuota',
            numeroPrestamo: 'PRES-000020',
            estado: EstadoPrestamo.ACTIVO,
            saldoPendiente: 100000,
            cuotas: [],
            producto: null,
          },
        ]),
      },
      multimedia: { findMany: jest.fn().mockResolvedValue([]) },
      pago: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const result = await makeService(prisma).getApprovalContext(approval.id);

    expect(prisma.cuota.findUnique).toHaveBeenCalledWith({
      where: { id: 'cuota-referenciada' },
      select: {
        id: true,
        prestamoId: true,
        prestamo: { select: { clienteId: true } },
      },
    });
    expect(prisma.aprobacion.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: 'aprobacion-actual' },
        }),
      }),
    );
    expect(exigir(result.cliente, 'el cliente').id).toBe('cliente-desde-cuota');
    expect(
      exigir(result.creditoSolicitud, 'el crédito de la solicitud').id,
    ).toBe('prestamo-desde-cuota');
    expect(result.approval.solicitante).toBe('Supervisor Operativo');
    expect(result.approval.rolSolicitante).toBe(RolUsuario.SUPERVISOR);
  });

  it('crea una aprobación faltante para préstamos pendientes y la expone en revisiones', async () => {
    const orphanLoan = {
      id: 'prestamo-huerfano-1',
      idempotencyKey: 'loan-idempotency-1',
      numeroPrestamo: 'PRES-000003',
      creadoPorId: 'coordinador-1',
      tipoPrestamo: 'EFECTIVO',
      monto: 5000000,
      interesTotal: 500000,
      precioVentaArticulo: null,
      cuotaInicial: 0,
      cantidadCuotas: 12,
      plazoMeses: 1,
      tasaInteres: 10,
      frecuenciaPago: 'DIARIO',
      notas: null,
      garantia: null,
      fechaInicio: new Date('2026-06-12T05:00:00.000Z'),
      fechaPrimerCobro: new Date('2026-06-13T05:00:00.000Z'),
      cliente: {
        nombres: 'Mario Baraka',
        apellidos: 'Mosquera',
        dni: '111111111',
        telefono: '3000000000',
      },
      producto: null,
    };

    const prisma = {
      prestamo: {
        findMany: jest.fn().mockResolvedValue([orphanLoan]),
      },
      aprobacion: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              id: 'aprobacion-recuperada-1',
              tipoAprobacion: TipoAprobacion.NUEVO_PRESTAMO,
              referenciaId: orphanLoan.id,
              tablaReferencia: 'Prestamo',
              solicitadoPorId: orphanLoan.creadoPorId,
              estado: EstadoAprobacion.PENDIENTE,
              datosSolicitud: {
                cliente: 'Mario Baraka Mosquera',
                monto: 5000000,
              },
              montoSolicitud: new Prisma.Decimal(5000000),
              creadoEn: new Date(),
              actualizadoEn: new Date(),
              aprobadoPorId: null,
              comentarios: null,
              datosAprobados: null,
              revisadoEn: null,
              solicitadoPor: {
                id: 'coordinador-1',
                nombres: 'Coordinador',
                apellidos: 'Prueba',
                rol: RolUsuario.COORDINADOR,
              },
              aprobadoPor: null,
            },
          ]),
        create: jest.fn().mockResolvedValue({ id: 'aprobacion-recuperada-1' }),
      },
    };

    const result = await makeService(prisma).getPendingApprovals();

    expect(prisma.aprobacion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipoAprobacion: TipoAprobacion.NUEVO_PRESTAMO,
          referenciaId: orphanLoan.id,
          tablaReferencia: 'Prestamo',
          solicitadoPorId: orphanLoan.creadoPorId,
          estado: EstadoAprobacion.PENDIENTE,
          datosSolicitud: expect.objectContaining({
            numeroPrestamo: 'PRES-000003',
            cliente: 'Mario Baraka Mosquera',
            monto: 5000000,
            montoTotal: 5500000,
            recuperadaAutomaticamente: true,
          }),
        }),
      }),
    );
    expect(result.total).toBe(1);
    expect(result.conteo.NUEVO_PRESTAMO).toBe(1);
  });
});

describe('ApprovalsService financial ledger controls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('aplica pago por transferencia sin incrementar Caja Banco manualmente', async () => {
    const prisma = buildPrismaMock();
    const service = makeService(prisma);

    await service.aprobarPagoDeTransferencia(
      aprobacion({
        id: 'approval-1',
        referenciaId: 'prestamo-1',
        solicitadoPorId: 'cobrador-1',
        montoSolicitud: new Prisma.Decimal(100000),
        datosSolicitud: {
          prestamoId: 'prestamo-1',
          cobradorId: 'cobrador-1',
          montoTotal: 100000,
          metodoPago: MetodoPago.TRANSFERENCIA,
        },
      }),
      'admin-1',
    );

    expect(prisma._tx.caja.update).not.toHaveBeenCalled();
    expect(mockLedger.registrarAsiento).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: expect.arrayContaining([
          expect.objectContaining({
            accountCode: '1.1.2',
            debitAmount: 100000,
            cajaId: 'caja-banco',
            cajaDelta: 100000,
          }),
        ]),
      }),
      prisma._tx,
    );
  });

  it('rechaza aprobación de transferencia con datos insuficientes', async () => {
    await expect(
      makeService(buildPrismaMock()).aprobarPagoDeTransferencia(
        aprobacion({
          id: 'approval-1',
          datosSolicitud: { montoTotal: 0 },
        }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('aplica pago por transferencia usando el préstamo fresco dentro de la transacción', async () => {
    const prisma = buildPrismaMock();
    prisma.prestamo.findFirst.mockResolvedValue({
      id: 'prestamo-1',
      clienteId: 'cliente-1',
      estado: EstadoPrestamo.ACTIVO,
      saldoPendiente: 100000,
      totalPagado: 0,
      capitalPagado: 0,
      interesPagado: 0,
      cuotas: [
        {
          id: 'cuota-1',
          monto: 100000,
          montoPagado: 0,
          montoCapital: 80000,
          montoInteres: 15000,
          montoInteresMora: 5000,
          estado: EstadoCuota.VENCIDA,
        },
      ],
      cliente: { id: 'cliente-1' },
    });
    prisma._tx.prestamo.findFirst.mockResolvedValue({
      id: 'prestamo-1',
      clienteId: 'cliente-1',
      estado: EstadoPrestamo.ACTIVO,
      saldoPendiente: 60000,
      totalPagado: 40000,
      capitalPagado: 30000,
      interesPagado: 10000,
      cuotas: [
        {
          id: 'cuota-1',
          monto: 100000,
          montoPagado: 40000,
          montoCapital: 80000,
          montoInteres: 15000,
          montoInteresMora: 5000,
          estado: EstadoCuota.PARCIAL,
        },
      ],
      cliente: { id: 'cliente-1' },
    });

    await makeService(prisma).aprobarPagoDeTransferencia(
      aprobacion({
        id: 'approval-1',
        referenciaId: 'prestamo-1',
        solicitadoPorId: 'cobrador-1',
        montoSolicitud: new Prisma.Decimal(50000),
        datosSolicitud: {
          prestamoId: 'prestamo-1',
          cobradorId: 'cobrador-1',
          montoTotal: 50000,
          metodoPago: MetodoPago.TRANSFERENCIA,
        },
      }),
      'admin-1',
    );

    expect(prisma._tx.$queryRaw).toHaveBeenCalled();
    expect(prisma._tx.prestamo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalPagado: 90000,
          saldoPendiente: 10000,
        }),
      }),
    );
  });

  it('genera número de pago de transferencia sin depender de count + 1', async () => {
    const prisma = buildPrismaMock();

    await makeService(prisma).aprobarPagoDeTransferencia(
      aprobacion({
        id: 'approval-1',
        referenciaId: 'prestamo-1',
        solicitadoPorId: 'cobrador-1',
        montoSolicitud: new Prisma.Decimal(100000),
        datosSolicitud: {
          prestamoId: 'prestamo-1',
          cobradorId: 'cobrador-1',
          montoTotal: 100000,
          metodoPago: MetodoPago.TRANSFERENCIA,
        },
      }),
      'admin-1',
    );

    expect(prisma.pago.count).not.toHaveBeenCalled();
    expect(prisma._tx.pago.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          numeroPago: expect.stringMatching(/^PAG-\d+-[0-9a-f-]{8}$/),
        }),
      }),
    );
  });

  it('conserva idempotencyKey al convertir una transferencia aprobada en pago', async () => {
    const prisma = buildPrismaMock();

    await makeService(prisma).aprobarPagoDeTransferencia(
      aprobacion({
        id: 'approval-1',
        idempotencyKey: 'offline-transfer-1',
        referenciaId: 'prestamo-1',
        solicitadoPorId: 'cobrador-1',
        montoSolicitud: new Prisma.Decimal(100000),
        datosSolicitud: {
          prestamoId: 'prestamo-1',
          cobradorId: 'cobrador-1',
          montoTotal: 100000,
          metodoPago: MetodoPago.TRANSFERENCIA,
        },
      }),
      'admin-1',
    );

    expect(prisma._tx.pago.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idempotencyKey: 'offline-transfer-1',
        }),
      }),
    );
  });

  it('conserva contexto de cierre pendiente al aprobar transferencia regularizada', async () => {
    const prisma = buildPrismaMock();
    prisma._tx.prestamo.findFirst.mockResolvedValue({
      id: 'prestamo-1',
      clienteId: 'cliente-1',
      estado: EstadoPrestamo.ACTIVO,
      saldoPendiente: 200000,
      totalPagado: 0,
      capitalPagado: 0,
      interesPagado: 0,
      cuotas: [
        {
          id: 'cuota-1',
          monto: 100000,
          montoPagado: 0,
          montoCapital: 80000,
          montoInteres: 15000,
          montoInteresMora: 5000,
          estado: EstadoCuota.VENCIDA,
        },
        {
          id: 'cuota-2',
          monto: 100000,
          montoPagado: 0,
          montoCapital: 80000,
          montoInteres: 15000,
          montoInteresMora: 5000,
          estado: EstadoCuota.VENCIDA,
        },
      ],
      cliente: { id: 'cliente-1' },
    });

    await makeService(prisma).aprobarPagoDeTransferencia(
      aprobacion({
        id: 'approval-regularizada-1',
        referenciaId: 'prestamo-1',
        solicitadoPorId: 'cobrador-1',
        montoSolicitud: new Prisma.Decimal(100000),
        datosSolicitud: {
          prestamoId: 'prestamo-1',
          clienteId: 'cliente-1',
          cobradorId: 'cobrador-1',
          rutaId: 'ruta-1',
          montoTotal: 100000,
          metodoPago: MetodoPago.TRANSFERENCIA,
          cuotaId: 'cuota-2',
          fechaOperativaRuta: '2026-06-05',
          origenGestion: 'CIERRE_PENDIENTE',
          notas: 'Pago regularizado por banco',
        },
      }),
      'admin-1',
    );

    expect(prisma._tx.pago.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rutaId: 'ruta-1',
          fechaOperativaRuta: '2026-06-05',
          origenGestion: 'CIERRE_PENDIENTE',
          detalles: {
            create: expect.arrayContaining([
              expect.objectContaining({ cuotaId: 'cuota-2' }),
            ]),
          },
        }),
      }),
    );
    expect(prisma._tx.cuota.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cuota-1' },
      }),
    );
    expect(prisma._tx.cuota.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cuota-2' },
      }),
    );
    expect(prisma._tx.registroVisita.updateMany).toHaveBeenCalledWith({
      where: {
        clienteId: 'cliente-1',
        fechaVisita: '2026-06-05',
        rutaId: 'ruta-1',
        estadoVisita: 'ausente',
      },
      data: {
        estadoVisita: 'pagado',
        notas: 'Ausencia anulada automáticamente por registro de pago.',
      },
    });
  });

  it('aprueba transferencia usando el cobrador activo de la ruta aunque la solicitud traiga otro usuario', async () => {
    const prisma = buildPrismaMock();
    prisma._tx.asignacionRuta.findFirst.mockResolvedValue({
      cobradorId: 'cobrador-real',
      ruta: { cobradorId: 'cobrador-real' },
    });

    await makeService(prisma).aprobarPagoDeTransferencia(
      aprobacion({
        id: 'approval-1',
        referenciaId: 'prestamo-1',
        solicitadoPorId: 'admin-1',
        montoSolicitud: new Prisma.Decimal(100000),
        datosSolicitud: {
          prestamoId: 'prestamo-1',
          cobradorId: 'admin-1',
          montoTotal: 100000,
          metodoPago: MetodoPago.TRANSFERENCIA,
        },
      }),
      'admin-1',
    );

    expect(prisma._tx.pago.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cobradorId: 'cobrador-real',
        }),
      }),
    );
    expect(prisma._tx.transaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipoReferencia: 'PAGO',
          creadoPorId: 'cobrador-real',
        }),
      }),
    );
  });

  it('aprueba gasto usando la caja y cobrador activos de la ruta aunque la solicitud esté vieja', async () => {
    const prisma = buildPrismaMock();

    await makeService(prisma).aprobarGasto(
      aprobacion({
        id: 'approval-gasto-1',
        solicitadoPorId: 'cobrador-viejo',
        datosSolicitud: {
          rutaId: 'ruta-1',
          cobradorId: 'cobrador-viejo',
          cajaId: 'caja-vieja',
          tipoGasto: 'OPERATIVO',
          monto: 25000,
          descripcion: 'Gasolina',
        },
      }),
      'admin-1',
    );

    expect(prisma._tx.gasto.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rutaId: 'ruta-1',
          cobradorId: 'cobrador-1',
          cajaId: 'caja-ruta-1',
        }),
      }),
    );
    expect(mockLedger.registrarAsiento).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceType: 'GASTO',
        lines: expect.arrayContaining([
          expect.objectContaining({
            accountCode: '1.2.1',
            cajaId: 'caja-ruta-1',
            cajaDelta: -25000,
          }),
        ]),
      }),
      prisma._tx,
    );
  });

  it('entrega la base a la caja de la solicitud y no a la que resulte de la ruta', async () => {
    // Antes la caja destino se volvía a resolver por rutaId. Eso rompía el
    // caso del supervisor que cubre una ruta: la base le caía en la caja del
    // cobrador titular y no en la suya. Ahora manda la caja que viene en la
    // solicitud, y lo único que se exige es que exista y esté activa.
    const prisma = buildPrismaMock();
    prisma._tx.caja.findFirst
      .mockResolvedValueOnce({
        id: 'caja-oficina',
        codigo: 'CAJA-OFICINA',
        nombre: 'Caja de Oficina',
        tipo: 'PRINCIPAL',
        saldoActual: 500000,
      })
      .mockResolvedValueOnce({
        id: 'caja-supervisor',
        nombre: 'Caja Supervisor',
        tipo: 'RUTA',
        rutaId: 'ruta-1',
        responsableId: 'supervisor-1',
      });

    await makeService(prisma).aprobarBaseDeCaja(
      aprobacion({
        id: 'approval-base-1',
        solicitadoPorId: 'supervisor-1',
        // `referenciaId` ES el id de la caja destino: asi la crea
        // `accounting.service.ts:1099` (`referenciaId: cajaRuta.id`, `tablaReferencia:
        // 'Caja'`). El fixture lo omitia, y como la columna es NOT NULL eso no puede pasar
        // en la base: el servicio hace `approval.referenciaId || data.cajaId`, asi que la
        // prueba estaba ejercitando el respaldo y NO la rama que corre en produccion.
        referenciaId: 'caja-supervisor',
        tablaReferencia: 'Caja',
        tipoAprobacion: TipoAprobacion.SOLICITUD_BASE_EFECTIVO,
        datosSolicitud: {
          rutaId: 'ruta-1',
          cobradorId: 'cobrador-1',
          cajaId: 'caja-supervisor',
          monto: 50000,
          descripcion: 'Base inicial',
        },
      }),
      'admin-1',
    );

    // Sale de la Caja de Oficina...
    expect(prisma._tx.transaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cajaId: 'caja-oficina',
          tipo: 'EGRESO',
          tipoReferencia: 'SOLICITUD_BASE_EFECTIVO',
        }),
      }),
    );
    // ...y entra en la caja de quien la pidió, no en la del cobrador titular.
    expect(prisma._tx.transaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cajaId: 'caja-supervisor',
          tipo: 'INGRESO',
          tipoReferencia: 'SOLICITUD_BASE_EFECTIVO',
        }),
      }),
    );
    expect(mockLedger.registrarAsiento).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceType: 'BASE',
        lines: expect.arrayContaining([
          expect.objectContaining({
            accountCode: '1.2.1',
            cajaId: 'caja-supervisor',
            cajaDelta: 50000,
          }),
        ]),
      }),
      prisma._tx,
    );
  });

  it('no ejecuta una aprobación si otro usuario ya la tomó primero', async () => {
    const prisma = buildPrismaMock();
    prisma.aprobacion.findUnique.mockResolvedValue({
      id: 'approval-1',
      tipoAprobacion: 'GASTO',
      referenciaId: 'gasto-1',
      tablaReferencia: 'gastos',
      solicitadoPorId: 'cobrador-1',
      estado: 'PENDIENTE',
      datosSolicitud: {
        rutaId: 'ruta-1',
        cobradorId: 'cobrador-1',
        cajaId: 'caja-1',
        tipoGasto: 'OPERATIVO',
        monto: 10000,
        descripcion: 'Transporte',
      },
    });
    prisma.aprobacion.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      makeService(prisma).approveItem('approval-1', 'GASTO', 'admin-1'),
    ).rejects.toThrow(BadRequestException);

    expect(prisma._tx.transaccion.create).not.toHaveBeenCalled();
    expect(mockLedger.registrarAsiento).not.toHaveBeenCalled();
  });

  it('confirma un préstamo provisional sin volver a mover caja ni ledger', async () => {
    const prisma = buildPrismaMock();
    prisma.aprobacion.findUnique.mockResolvedValue({
      id: 'approval-loan-1',
      tipoAprobacion: TipoAprobacion.NUEVO_PRESTAMO,
      referenciaId: 'prestamo-1',
      tablaReferencia: 'Prestamo',
      solicitadoPorId: 'supervisor-1',
      estado: EstadoAprobacion.PENDIENTE,
      datosSolicitud: { monto: 5000000 },
    });
    prisma.efectoProvisional.findFirst.mockResolvedValue({
      id: 'efecto-loan-1',
      aprobacionId: 'approval-loan-1',
      tipoAccion: 'NUEVO_PRESTAMO',
      tipoEntidad: 'Prestamo',
      entidadId: 'prestamo-1',
      estado: 'PENDIENTE_REVISION',
    });

    const service = new AprobacionesConDelegacionVigilada(
      comoPrisma(prisma),
      comoDependencia<NotificacionesService>(mockNotifications),
      comoDependencia<NotificacionesGateway>(mockGateway),
      comoDependencia<LedgerService>(mockLedger),
    );

    await service.approveItem(
      'approval-loan-1',
      TipoAprobacion.NUEVO_PRESTAMO,
      'admin-1',
    );

    expect(service.prestamoNuevoAprobado).not.toHaveBeenCalled();
    expect(prisma._tx.efectoProvisional.update).toHaveBeenCalledWith({
      where: { id: 'efecto-loan-1' },
      data: expect.objectContaining({
        estado: 'CONFIRMADO',
        confirmadoEn: expect.any(Date),
      }),
    });
  });

  it('bloquea regenerar cuotas de un crédito activo editado si ya tiene pagos', async () => {
    const prisma = buildPrismaMock();
    prisma._tx.prestamo.findUnique = jest.fn().mockResolvedValue({
      estado: EstadoPrestamo.ACTIVO,
      monto: 500000,
    });
    prisma._tx.prestamo.update.mockResolvedValue({
      id: 'prestamo-1',
      numeroPrestamo: 'PRES-000021',
      estado: EstadoPrestamo.ACTIVO,
      monto: 500000,
      tasaInteres: 10,
      frecuenciaPago: 'DIARIO',
      cantidadCuotas: 12,
      plazoMeses: 1,
      tipoAmortizacion: 'INTERES_SIMPLE',
      fechaInicio: new Date('2026-06-19T12:00:00.000Z'),
      tipoPrestamo: 'EFECTIVO',
      cliente: { asignacionesRuta: [] },
    });
    prisma._tx.cuota.count.mockResolvedValue(1);
    prisma._tx.cuota.deleteMany = jest.fn();
    prisma._tx.cuota.createMany = jest.fn();

    await expect(
      makeService(prisma).aprobarPrestamoNuevo(
        aprobacion({
          id: 'approval-loan-editada',
          referenciaId: 'prestamo-1',
          solicitadoPorId: 'supervisor-1',
          datosSolicitud: { monto: 500000 },
        }),
        'admin-1',
        { monto: 600000, cantidadCuotas: 12 },
      ),
    ).rejects.toThrow(
      'No se pueden regenerar las cuotas de un crédito activo con pagos registrados.',
    );

    expect(prisma._tx.cuota.deleteMany).not.toHaveBeenCalled();
    expect(prisma._tx.cuota.createMany).not.toHaveBeenCalled();
  });

  it('revierte un préstamo provisional al rechazar la aprobación', async () => {
    const prisma = buildPrismaMock();
    prisma.aprobacion.findUnique.mockResolvedValue({
      id: 'approval-loan-1',
      tipoAprobacion: TipoAprobacion.NUEVO_PRESTAMO,
      referenciaId: 'prestamo-1',
      tablaReferencia: 'Prestamo',
      solicitadoPorId: 'supervisor-1',
      estado: EstadoAprobacion.PENDIENTE,
      datosSolicitud: { monto: 5000000 },
    });
    prisma.efectoProvisional.findFirst.mockResolvedValue({
      id: 'efecto-loan-1',
      aprobacionId: 'approval-loan-1',
      tipoAccion: 'NUEVO_PRESTAMO',
      tipoEntidad: 'Prestamo',
      entidadId: 'prestamo-1',
      estado: 'PENDIENTE_REVISION',
      rollbackData: {
        prestamoId: 'prestamo-1',
        productoId: null,
        stockDescontado: false,
        asignacionRutaId: 'asignacion-nueva',
      },
    });
    // Revertir exige encontrar los movimientos que el desembolso provisional
    // dejó: no se puede deshacer lo que no se sabe qué movió.
    prisma._tx.transaccion.findMany.mockResolvedValue([
      {
        id: 'trx-desembolso-1',
        cajaId: 'caja-ruta-1',
        tipo: 'EGRESO',
        monto: 5000000,
        descripcion: 'Desembolso de préstamo',
        creadoPorId: 'supervisor-1',
        tipoReferencia: 'PRESTAMO',
        referenciaId: 'prestamo-1',
      },
    ]);
    prisma._tx.journalEntry.findMany.mockResolvedValue([
      {
        id: 'journal-desembolso-1',
        referenceType: 'DESEMBOLSO',
        referenceId: 'prestamo-1',
        lines: [
          {
            accountCode: '1.3.1',
            debitAmount: 5000000,
            creditAmount: 0,
            cajaId: null,
          },
          {
            accountCode: '1.2.1',
            debitAmount: 0,
            creditAmount: 5000000,
            cajaId: 'caja-ruta-1',
          },
        ],
      },
    ]);

    await makeService(prisma).rejectItem(
      'approval-loan-1',
      TipoAprobacion.NUEVO_PRESTAMO,
      'admin-1',
      'No cumple política',
    );

    expect(prisma._tx.prestamo.update).toHaveBeenCalledWith({
      where: { id: 'prestamo-1' },
      data: expect.objectContaining({
        estadoAprobacion: EstadoAprobacion.RECHAZADO,
        aprobadoPorId: 'admin-1',
        eliminadoEn: expect.any(Date),
      }),
      include: { producto: true },
    });
    expect(prisma._tx.cuota.updateMany).toHaveBeenCalledWith({
      where: { prestamoId: 'prestamo-1' },
      data: {
        estado: EstadoCuota.PENDIENTE,
        montoPagado: 0,
        fechaPago: null,
      },
    });
    expect(prisma._tx.asignacionRuta.updateMany).toHaveBeenCalledWith({
      where: { id: 'asignacion-nueva' },
      data: { activa: false },
    });
    expect(prisma._tx.efectoProvisional.update).toHaveBeenCalledWith({
      where: { id: 'efecto-loan-1' },
      data: expect.objectContaining({
        estado: 'REVERTIDO',
        revertidoEn: expect.any(Date),
        motivoReversion: 'No cumple política',
      }),
    });
  });

  it('restaura una aprobación rechazada creando un nuevo efecto provisional', async () => {
    const prisma = buildPrismaMock();
    prisma.aprobacion.findUnique.mockResolvedValue({
      id: 'approval-loan-1',
      tipoAprobacion: TipoAprobacion.NUEVO_PRESTAMO,
      referenciaId: 'prestamo-1',
      solicitadoPorId: 'supervisor-1',
      estado: EstadoAprobacion.RECHAZADO,
    });
    prisma.efectoProvisional.findFirst.mockResolvedValue({
      id: 'efecto-loan-1',
      aprobacionId: 'approval-loan-1',
      estado: 'REVERTIDO',
      rollbackData: {
        prestamoId: 'prestamo-1',
        cuotaIds: ['cuota-1'],
        transaccionIds: [],
        journalEntryIds: [],
        stockDescontado: false,
      },
    });
    prisma._tx.efectoProvisional.findFirst = jest.fn().mockResolvedValue({
      id: 'efecto-loan-1',
      aprobacionId: 'approval-loan-1',
      estado: 'REVERTIDO',
      rollbackData: {
        prestamoId: 'prestamo-1',
        cuotaIds: ['cuota-1'],
        transaccionIds: [],
        journalEntryIds: [],
        stockDescontado: false,
      },
    });
    prisma._tx.efectoProvisional.create = jest
      .fn()
      .mockResolvedValue({ id: 'efecto-loan-2' });

    await makeService(prisma).confirmSuperadminAction(
      'approval-loan-1',
      'REVERTIR',
      'superadmin-1',
      'Revisar de nuevo',
    );

    // Se reclama con `updateMany` condicionado al estado RECHAZADO, y no con
    // un `update` a secas, para que dos superadministradores no puedan
    // restaurar la misma revisión a la vez: el segundo encuentra cero filas y
    // se le rechaza la operación.
    expect(prisma._tx.aprobacion.updateMany).toHaveBeenCalledWith({
      where: { id: 'approval-loan-1', estado: EstadoAprobacion.RECHAZADO },
      data: expect.objectContaining({
        estado: EstadoAprobacion.PENDIENTE,
        aprobadoPorId: null,
        revisadoEn: null,
      }),
    });
    expect(prisma._tx.prestamo.update).toHaveBeenCalledWith({
      where: { id: 'prestamo-1' },
      data: expect.objectContaining({
        estado: EstadoPrestamo.PENDIENTE_APROBACION,
        estadoAprobacion: EstadoAprobacion.PENDIENTE,
        eliminadoEn: null,
      }),
    });
    expect(prisma._tx.efectoProvisional.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        aprobacionId: 'approval-loan-1',
        estado: 'PENDIENTE_REVISION',
        rollbackData: expect.objectContaining({
          efectoAnteriorId: 'efecto-loan-1',
          reaperturaPorId: 'superadmin-1',
        }),
      }),
    });
  });

  it('no ejecuta un rechazo si otro usuario ya tomó la aprobación primero', async () => {
    const prisma = buildPrismaMock();
    prisma.aprobacion.findUnique.mockResolvedValue({
      id: 'approval-1',
      tipoAprobacion: 'GASTO',
      referenciaId: 'gasto-1',
      tablaReferencia: 'gastos',
      solicitadoPorId: 'cobrador-1',
      estado: 'PENDIENTE',
      datosSolicitud: { descripcion: 'Transporte' },
    });
    prisma.aprobacion.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      makeService(prisma).rejectItem(
        'approval-1',
        'GASTO',
        'admin-1',
        'Duplicado',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.aprobacion.update).not.toHaveBeenCalled();
    expect(mockNotifications.create).not.toHaveBeenCalled();
    expect(
      mockGateway.broadcastAprobacionesActualizadas,
    ).not.toHaveBeenCalled();
  });

  it('registra venta de artículo separando ingreso, costo, inventario y cuota inicial', async () => {
    const prisma = buildPrismaMock();
    prisma._tx.prestamo.findUnique = jest.fn().mockResolvedValue({
      estado: EstadoPrestamo.BORRADOR,
      monto: 90000,
    });
    prisma._tx.prestamo.update.mockResolvedValue({
      id: 'prestamo-articulo-1',
      numeroPrestamo: 'P-ART-1',
      monto: 90000,
      tipoPrestamo: 'ARTICULO',
      precioVentaArticulo: 100000,
      costoArticulo: 65000,
      cliente: {
        nombres: 'Ana',
        apellidos: 'Rojas',
        asignacionesRuta: [{ rutaId: 'ruta-1' }],
      },
    });
    prisma._tx.caja.findFirst
      .mockResolvedValueOnce({ id: 'caja-ruta-1', codigo: 'CAJA-RUTA' })
      .mockResolvedValueOnce({ id: 'caja-oficina', codigo: 'CAJA-OFICINA' })
      .mockResolvedValueOnce({
        id: 'caja-ruta-1',
        nombre: 'Caja Ruta',
        saldoActual: 100000,
      });
    prisma._tx.transaccion.findFirst = jest.fn().mockResolvedValue(null);

    await makeService(prisma).aprobarPrestamoNuevo(
      aprobacion({
        id: 'approval-articulo-1',
        referenciaId: 'prestamo-articulo-1',
        solicitadoPorId: 'admin-1',
        datosSolicitud: {
          tipo: 'ARTICULO',
          monto: 90000,
          cuotaInicial: 10000,
          valorArticulo: 100000,
          costoArticulo: 65000,
        },
      }),
      'admin-1',
    );

    expect(mockLedger.registrarVentaArticulo).toHaveBeenCalledWith(
      expect.objectContaining({
        prestamoId: 'prestamo-articulo-1',
        precioVenta: 100000,
        costoArticulo: 65000,
        montoFinanciado: 90000,
        cuotaInicial: 10000,
        cajaId: 'caja-oficina',
        accountCodeCaja: '1.1.1',
        createdBy: 'admin-1',
      }),
      prisma._tx,
    );
    expect(mockLedger.registrarAsiento).not.toHaveBeenCalledWith(
      expect.objectContaining({
        lines: expect.arrayContaining([
          expect.objectContaining({
            accountCode: '3.1',
            creditAmount: 10000,
          }),
        ]),
      }),
      expect.anything(),
    );
  });

  it('desembolsa préstamo en efectivo desde caja de oficina al aprobar revisión', async () => {
    const prisma = buildPrismaMock();
    prisma._tx.prestamo.findUnique = jest.fn().mockResolvedValue({
      estado: EstadoPrestamo.BORRADOR,
      monto: 120000,
    });
    prisma._tx.prestamo.update.mockResolvedValue({
      id: 'prestamo-efectivo-1',
      numeroPrestamo: 'P-EFE-1',
      monto: 120000,
      tipoPrestamo: 'EFECTIVO',
      cliente: {
        nombres: 'Luis',
        apellidos: 'Perez',
        asignacionesRuta: [{ rutaId: 'ruta-1' }],
      },
    });
    prisma._tx.caja.findFirst.mockResolvedValueOnce({
      id: 'caja-oficina',
      codigo: 'CAJA-OFICINA',
      nombre: 'Caja de Oficina',
      saldoActual: 200000,
    });

    await makeService(prisma).aprobarPrestamoNuevo(
      aprobacion({
        id: 'approval-efectivo-1',
        referenciaId: 'prestamo-efectivo-1',
        solicitadoPorId: 'admin-1',
        datosSolicitud: {
          tipo: 'EFECTIVO',
          monto: 120000,
        },
      }),
      'admin-1',
    );

    expect(prisma._tx.transaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cajaId: 'caja-oficina',
          tipo: 'EGRESO',
          monto: 120000,
          tipoReferencia: 'PRESTAMO',
          referenciaId: 'prestamo-efectivo-1',
        }),
      }),
    );
    expect(mockLedger.registrarAsiento).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceType: 'DESEMBOLSO',
        referenceId: 'prestamo-efectivo-1',
        lines: expect.arrayContaining([
          expect.objectContaining({
            accountCode: '1.1.1',
            creditAmount: 120000,
            cajaId: 'caja-oficina',
            cajaDelta: -120000,
          }),
        ]),
      }),
      prisma._tx,
    );
  });

  it('desembolsa préstamo en efectivo desde caja de ruta cuando la solicitud es de un cobrador', async () => {
    const prisma = buildPrismaMock();
    prisma._tx.prestamo.findUnique = jest.fn().mockResolvedValue({
      estado: EstadoPrestamo.BORRADOR,
      monto: 120000,
    });
    prisma._tx.prestamo.update.mockResolvedValue({
      id: 'prestamo-efectivo-ruta-1',
      numeroPrestamo: 'P-EFE-RUTA-1',
      monto: 120000,
      tipoPrestamo: 'EFECTIVO',
      cliente: {
        nombres: 'Luis',
        apellidos: 'Perez',
        asignacionesRuta: [{ rutaId: 'ruta-1' }],
      },
    });
    prisma._tx.usuario.findFirst.mockResolvedValue({
      rol: RolUsuario.COBRADOR,
    });
    prisma._tx.caja.findFirst.mockResolvedValueOnce({
      id: 'caja-ruta-1',
      codigo: 'RUTA-001',
      nombre: 'Caja Ruta 1',
      saldoActual: 200000,
    });

    await makeService(prisma).aprobarPrestamoNuevo(
      aprobacion({
        id: 'approval-efectivo-ruta-1',
        referenciaId: 'prestamo-efectivo-ruta-1',
        solicitadoPorId: 'cobrador-1',
        datosSolicitud: {
          tipo: 'EFECTIVO',
          monto: 120000,
        },
      }),
      'admin-1',
    );

    expect(prisma._tx.usuario.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cobrador-1' },
        select: { rol: true },
      }),
    );
    expect(prisma._tx.transaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cajaId: 'caja-ruta-1',
          tipo: 'EGRESO',
          monto: 120000,
          tipoReferencia: 'PRESTAMO',
          referenciaId: 'prestamo-efectivo-ruta-1',
        }),
      }),
    );
    expect(mockLedger.registrarAsiento).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceType: 'DESEMBOLSO',
        referenceId: 'prestamo-efectivo-ruta-1',
        lines: expect.arrayContaining([
          expect.objectContaining({
            accountCode: '1.2.1',
            creditAmount: 120000,
            cajaId: 'caja-ruta-1',
            cajaDelta: -120000,
          }),
        ]),
      }),
      prisma._tx,
    );
  });

  it('propaga errores de ledger al registrar venta de artículo', async () => {
    const prisma = buildPrismaMock();
    prisma._tx.prestamo.findUnique = jest.fn().mockResolvedValue({
      estado: EstadoPrestamo.BORRADOR,
      monto: 90000,
    });
    prisma._tx.prestamo.update.mockResolvedValue({
      id: 'prestamo-articulo-1',
      numeroPrestamo: 'P-ART-1',
      monto: 90000,
      tipoPrestamo: 'ARTICULO',
      precioVentaArticulo: 100000,
      costoArticulo: 65000,
      cliente: {
        nombres: 'Ana',
        apellidos: 'Rojas',
        asignacionesRuta: [{ rutaId: 'ruta-1' }],
      },
    });
    prisma._tx.caja.findFirst
      .mockResolvedValueOnce({ id: 'caja-ruta-1', codigo: 'CAJA-RUTA' })
      .mockResolvedValueOnce({ id: 'caja-oficina', codigo: 'CAJA-OFICINA' });
    prisma._tx.transaccion.findFirst = jest.fn().mockResolvedValue(null);
    mockLedger.registrarVentaArticulo.mockRejectedValueOnce(
      new Error('ledger failed'),
    );

    await expect(
      makeService(prisma).aprobarPrestamoNuevo(
        aprobacion({
          id: 'approval-articulo-1',
          referenciaId: 'prestamo-articulo-1',
          solicitadoPorId: 'admin-1',
          datosSolicitud: {
            tipo: 'ARTICULO',
            monto: 90000,
            cuotaInicial: 10000,
            valorArticulo: 100000,
            costoArticulo: 65000,
          },
        }),
        'admin-1',
      ),
    ).rejects.toThrow('ledger failed');
  });
});

/**
 * Los dos fallos que tenia aprobar un credito CON cambios.
 *
 * Los dos vivian en el mismo bloque y solo se disparaban cuando el revisor editaba
 * algo antes de aprobar: sin `editedData` ese bloque no corre.
 */
describe('Aprobar un credito con cambios', () => {
  const HOY = new Date('2026-03-12T10:00:00-05:00');

  /** Un tx que deja ver con que se llamo a cada escritura. */
  function txEspia(prestamo: Record<string, unknown>) {
    const cuotasCreadas: Array<Record<string, unknown>> = [];
    const prestamoActualizado: Array<Record<string, unknown>> = [];
    const cuotasActualizadas: Array<Record<string, unknown>> = [];

    const tx: Record<string, unknown> = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      prestamo: {
        findUnique: jest.fn().mockResolvedValue({
          estado: EstadoPrestamo.PENDIENTE_APROBACION,
          monto: prestamo.monto,
        }),
        update: jest.fn().mockImplementation(({ data }) => {
          prestamoActualizado.push(data);
          // Prisma IGNORA las claves con `undefined`: significan "no lo cambies".
          // El servicio manda muchas asi (`tipoAmortizacion: x || undefined`), y
          // un `{...prestamo, ...data}` a secas las pisaria con undefined. Con eso
          // el plazo salia 1 y las dos ramas de interes daban el mismo numero: la
          // prueba pasaba sin distinguir nada, que es peor que fallar.
          const soloDefinidos = Object.fromEntries(
            Object.entries(data).filter(([, valor]) => valor !== undefined),
          );
          return Promise.resolve({
            ...prestamo,
            ...soloDefinidos,
            cliente: { asignacionesRuta: [] },
          });
        }),
      },
      cuota: {
        count: jest.fn().mockResolvedValue(0),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockImplementation(({ data }) => {
          cuotasCreadas.push(...data);
          return Promise.resolve({ count: data.length });
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockImplementation((args) => {
          cuotasActualizadas.push(args);
          return Promise.resolve({});
        }),
      },
      caja: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'caja-1',
          codigo: 'CAJA-OFICINA',
          nombre: 'Caja oficina',
          saldoActual: 50_000_000,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      usuario: {
        findFirst: jest.fn().mockResolvedValue({ rol: RolUsuario.ADMIN }),
      },
      aprobacion: {
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      movimientoCaja: { create: jest.fn().mockResolvedValue({}) },
      notificacion: {
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    // El servicio toca muchas tablas por el camino (transaccion, movimiento de
    // caja, asiento contable...). Lo que esta prueba mira es el interes y las
    // fechas, asi que en vez de declarar cada modelo se responde a cualquiera con
    // un doble permisivo. Si manana el servicio toca una tabla nueva, la prueba
    // sigue midiendo lo suyo en vez de romperse por algo que no le importa.
    const modeloVacio = () =>
      new Proxy(
        {},
        {
          get: () => jest.fn().mockResolvedValue({}),
        },
      );
    const txPermisivo = new Proxy(tx, {
      get: (destino, clave: string) =>
        clave in destino ? destino[clave] : modeloVacio(),
    });

    const prisma = {
      $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) =>
        fn(txPermisivo),
      ),
    };

    return {
      prisma,
      tx,
      cuotasCreadas,
      prestamoActualizado,
      cuotasActualizadas,
    };
  }

  // `tipo` NO es columna de `Aprobacion`: la columna es `tipoAprobacion`
  // (schema.prisma:560). Con el fixture sin tipar nadie lo veia, y el campo que el
  // servicio lee llegaba vacio en estas tres pruebas.
  const aprobacionDe = (prestamoId: string, datos: Record<string, unknown>) =>
    aprobacion({
      referenciaId: prestamoId,
      solicitadoPorId: 'cobrador-1',
      tipoAprobacion: TipoAprobacion.NUEVO_PRESTAMO,
      datosSolicitud: datos as Prisma.JsonObject,
    });

  it('INTERES_PLANO aplica la tasa una vez, no una por mes de plazo', async () => {
    // El caso: 1.000.000 al 10% mensual a 3 meses. En plano el interes son
    // 100.000. La rama que habia aqui trataba como interes simple TODO lo que no
    // fuera FRANCESA, y el enum tiene tres valores: se comia INTERES_PLANO, que
    // es el tipo por defecto de `createLoan`. Salian 300.000, y ese interes entra
    // en el saldo, asi que era deuda real del cliente. En el modal el aprobador
    // veia 100.000, porque la pantalla si distingue los dos tipos.
    const prestamo = {
      id: 'prestamo-1',
      monto: 1_000_000,
      tasaInteres: 10,
      cantidadCuotas: 3,
      plazoMeses: 3,
      frecuenciaPago: 'MENSUAL',
      tipoAmortizacion: 'INTERES_PLANO',
      tipoPrestamo: 'EFECTIVO',
      fechaInicio: HOY,
      fechaPrimerCobro: null,
    };
    const { prisma, cuotasCreadas, prestamoActualizado } = txEspia(prestamo);

    await makeService(prisma).aprobarPrestamoNuevo(
      aprobacionDe('prestamo-1', { monto: 1_000_000, porcentaje: 10 }),
      'admin-1',
      // Editar cualquier cosa es lo que dispara la regeneracion.
      { monto: 1_000_000, porcentaje: 10, cantidadCuotas: 3 },
    );

    const conInteres = prestamoActualizado.find(
      (d) => d.interesTotal !== undefined,
    );
    expect(conInteres?.interesTotal).toBe(100_000);
    expect(conInteres?.interesTotal).not.toBe(300_000);

    // Y el reparto queda en pesos enteros: antes dividia sin truncar y guardaba
    // cuotas con centavos.
    expect(cuotasCreadas).toHaveLength(3);
    for (const cuota of cuotasCreadas) {
      for (const campo of ['monto', 'montoCapital', 'montoInteres'] as const) {
        expect(Number.isInteger(Number(cuota[campo]))).toBe(true);
      }
    }
    const sumado = cuotasCreadas.reduce((t, c) => t + Number(c.monto), 0);
    expect(sumado).toBe(1_100_000);
  });

  it('INTERES_SIMPLE sigue aplicando la tasa por cada mes', async () => {
    // El contraste: con el mismo credito, en simple si son 300.000. Si esta
    // expectativa y la de arriba dieran lo mismo, el arreglo no distingue nada.
    const prestamo = {
      id: 'prestamo-2',
      monto: 1_000_000,
      tasaInteres: 10,
      cantidadCuotas: 3,
      plazoMeses: 3,
      frecuenciaPago: 'MENSUAL',
      tipoAmortizacion: 'INTERES_SIMPLE',
      tipoPrestamo: 'EFECTIVO',
      fechaInicio: HOY,
      fechaPrimerCobro: null,
    };
    const { prisma, prestamoActualizado } = txEspia(prestamo);

    await makeService(prisma).aprobarPrestamoNuevo(
      aprobacionDe('prestamo-2', { monto: 1_000_000, porcentaje: 10 }),
      'admin-1',
      { monto: 1_000_000, porcentaje: 10, cantidadCuotas: 3 },
    );

    const conInteres = prestamoActualizado.find(
      (d) => d.interesTotal !== undefined,
    );
    expect(conInteres?.interesTotal).toBe(300_000);
  });
  it('reagenda las cuotas que se vencieron esperando la aprobacion', async () => {
    // El credito se creo el 9 de marzo y se aprueba el 12: tres dias esperando.
    // Sus cuotas diarias ya estan fechadas desde el 10, asi que sin reagendar, esa
    // misma noche el cron de las 00:10 las marca VENCIDA y voltea el prestamo a
    // EN_MORA, sin que el cliente haya dejado de pagar nada.
    jest.useFakeTimers().setSystemTime(HOY);
    try {
      const prestamo = {
        id: 'prestamo-3',
        monto: 300_000,
        tasaInteres: 10,
        cantidadCuotas: 3,
        plazoMeses: 1,
        frecuenciaPago: 'DIARIO',
        tipoAmortizacion: 'INTERES_PLANO',
        tipoPrestamo: 'EFECTIVO',
        fechaInicio: new Date('2026-03-09T10:00:00-05:00'),
        fechaPrimerCobro: null,
      };
      const { prisma, tx, cuotasActualizadas, prestamoActualizado } =
        txEspia(prestamo);
      (tx.cuota as { findMany: jest.Mock }).findMany.mockResolvedValue([
        { id: 'cuota-1' },
        { id: 'cuota-2' },
        { id: 'cuota-3' },
      ]);

      await makeService(prisma).aprobarPrestamoNuevo(
        aprobacionDe('prestamo-3', { monto: 300_000, porcentaje: 10 }),
        'admin-1',
      );

      // Las tres se mueven, y ninguna queda fechada antes del dia de aprobacion.
      expect(cuotasActualizadas).toHaveLength(3);
      const claveBogota = (d: Date) =>
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Bogota',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(d);

      for (const llamada of cuotasActualizadas) {
        const datos = (
          llamada as { data: { fechaVencimiento: Date; estado: string } }
        ).data;
        expect(claveBogota(datos.fechaVencimiento) > '2026-03-12').toBe(true);
        // Y vuelven a PENDIENTE: si alguna ya se habia marcado VENCIDA, deja de estarlo.
        expect(datos.estado).toBe(EstadoCuota.PENDIENTE);
      }

      // La primera reagendada vence al dia siguiente de aprobar, no el mismo dia:
      // aprobar hoy no convierte hoy en dia de cobro.
      const primera = (
        cuotasActualizadas[0] as { data: { fechaVencimiento: Date } }
      ).data;
      expect(claveBogota(primera.fechaVencimiento)).toBe('2026-03-13');

      // Y la fecha de inicio del prestamo se mueve con ellas.
      const conFecha = prestamoActualizado.find(
        (d) => d.fechaInicio !== undefined,
      );
      expect(conFecha).toBeDefined();
      expect(claveBogota(conFecha!.fechaInicio as Date)).toBe('2026-03-12');
    } finally {
      jest.useRealTimers();
    }
  });

  it('no toca las fechas si el credito se aprueba el mismo dia que se creo', async () => {
    // El caso normal: sin espera no hay nada que reagendar, y mover fechas aqui
    // seria cambiar el cronograma que el cliente acepto.
    jest.useFakeTimers().setSystemTime(HOY);
    try {
      const prestamo = {
        id: 'prestamo-4',
        monto: 300_000,
        tasaInteres: 10,
        cantidadCuotas: 3,
        plazoMeses: 1,
        frecuenciaPago: 'DIARIO',
        tipoAmortizacion: 'INTERES_PLANO',
        tipoPrestamo: 'EFECTIVO',
        fechaInicio: HOY,
        fechaPrimerCobro: null,
      };
      const { prisma, tx, cuotasActualizadas } = txEspia(prestamo);
      (tx.cuota as { findMany: jest.Mock }).findMany.mockResolvedValue([
        { id: 'cuota-1' },
      ]);

      await makeService(prisma).aprobarPrestamoNuevo(
        aprobacionDe('prestamo-4', { monto: 300_000, porcentaje: 10 }),
        'admin-1',
      );

      expect(cuotasActualizadas).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
