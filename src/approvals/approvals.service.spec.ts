import { BadRequestException } from '@nestjs/common';
import {
  EstadoAprobacion,
  EstadoCuota,
  EstadoPrestamo,
  MetodoPago,
  RolUsuario,
  TipoAprobacion,
} from '@prisma/client';
import { ApprovalsService } from './approvals.service';

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

function buildPrismaMock() {
  const tx = {
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
    transaccion: { create: jest.fn().mockResolvedValue({ id: 'trx-bank-1' }) },
    gasto: {
      create: jest.fn().mockResolvedValue({
        id: 'gasto-1',
        ruta: { id: 'ruta-1', nombre: 'Ruta 1' },
        caja: { id: 'caja-ruta-1', nombre: 'Caja Ruta 1' },
        cobrador: { id: 'cobrador-1', nombres: 'Cobra', apellidos: 'Dor' },
      }),
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
    journalEntry: { findFirst: jest.fn().mockResolvedValue(null) },
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
    $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)),
    _tx: tx,
  };
}

function makeService(prisma: any) {
  return new ApprovalsService(
    prisma,
    mockNotifications as any,
    mockGateway as any,
    mockLedger as any,
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
                fechaVencimiento: new Date('2026-06-18T12:00:00.000Z'),
              },
              {
                id: 'cuota-2',
                numeroCuota: 5,
                monto: 45832,
                montoPagado: 0,
                estado: EstadoCuota.PENDIENTE,
                fechaVencimiento: new Date('2026-06-20T12:00:00.000Z'),
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
                fechaVencimiento: new Date('2026-06-01T12:00:00.000Z'),
              },
              {
                id: 'cuota-4',
                numeroCuota: 2,
                monto: 50000,
                montoPagado: 0,
                estado: EstadoCuota.VENCIDA,
                fechaVencimiento: new Date('2026-06-05T12:00:00.000Z'),
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

    expect(result.approval.datosSolicitud.prestamoId).toBe('prestamo-solicitud');
    expect(result.cliente.id).toBe('cliente-1');
    expect(result.creditoSolicitud.id).toBe('prestamo-solicitud');
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
      cuotasVencidas: 2,
      cuotasPagadas: 1,
      reprogramacionesPrevias: 3,
      pagosUltimos30Dias: 2,
      montoPagadoUltimos30Dias: 83333,
      candidatoReprogramacion: false,
    });
    expect(result.metricas.alertas).toEqual(
      expect.arrayContaining([
        'El cliente tiene 2 cuota(s) vencida(s).',
        'El cliente registra 3 reprogramación(es).',
      ]),
    );
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
              montoSolicitud: 5000000,
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

    await (service as any).approveTransferPayment(
      {
        id: 'approval-1',
        referenciaId: 'prestamo-1',
        solicitadoPorId: 'cobrador-1',
        montoSolicitud: 100000,
        datosSolicitud: {
          prestamoId: 'prestamo-1',
          cobradorId: 'cobrador-1',
          montoTotal: 100000,
          metodoPago: MetodoPago.TRANSFERENCIA,
        },
      },
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
      (makeService(buildPrismaMock()) as any).approveTransferPayment({
        id: 'approval-1',
        datosSolicitud: { montoTotal: 0 },
      }),
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

    await (makeService(prisma) as any).approveTransferPayment(
      {
        id: 'approval-1',
        referenciaId: 'prestamo-1',
        solicitadoPorId: 'cobrador-1',
        montoSolicitud: 50000,
        datosSolicitud: {
          prestamoId: 'prestamo-1',
          cobradorId: 'cobrador-1',
          montoTotal: 50000,
          metodoPago: MetodoPago.TRANSFERENCIA,
        },
      },
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

    await (makeService(prisma) as any).approveTransferPayment(
      {
        id: 'approval-1',
        referenciaId: 'prestamo-1',
        solicitadoPorId: 'cobrador-1',
        montoSolicitud: 100000,
        datosSolicitud: {
          prestamoId: 'prestamo-1',
          cobradorId: 'cobrador-1',
          montoTotal: 100000,
          metodoPago: MetodoPago.TRANSFERENCIA,
        },
      },
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

    await (makeService(prisma) as any).approveTransferPayment(
      {
        id: 'approval-1',
        idempotencyKey: 'offline-transfer-1',
        referenciaId: 'prestamo-1',
        solicitadoPorId: 'cobrador-1',
        montoSolicitud: 100000,
        datosSolicitud: {
          prestamoId: 'prestamo-1',
          cobradorId: 'cobrador-1',
          montoTotal: 100000,
          metodoPago: MetodoPago.TRANSFERENCIA,
        },
      },
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

    await (makeService(prisma) as any).approveTransferPayment(
      {
        id: 'approval-regularizada-1',
        referenciaId: 'prestamo-1',
        solicitadoPorId: 'cobrador-1',
        montoSolicitud: 100000,
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
      },
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

    await (makeService(prisma) as any).approveTransferPayment(
      {
        id: 'approval-1',
        referenciaId: 'prestamo-1',
        solicitadoPorId: 'admin-1',
        montoSolicitud: 100000,
        datosSolicitud: {
          prestamoId: 'prestamo-1',
          cobradorId: 'admin-1',
          montoTotal: 100000,
          metodoPago: MetodoPago.TRANSFERENCIA,
        },
      },
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

    await (makeService(prisma) as any).approveExpense(
      {
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
      },
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

  it('aprueba base de efectivo hacia la caja activa de la ruta aunque la solicitud traiga otra caja', async () => {
    const prisma = buildPrismaMock();
    prisma._tx.caja.findFirst
      .mockResolvedValueOnce({
        id: 'caja-principal',
        codigo: 'CAJA-PRINCIPAL',
        nombre: 'Caja Principal',
        tipo: 'PRINCIPAL',
        saldoActual: 500000,
      })
      .mockResolvedValueOnce({
        id: 'caja-ruta-1',
        nombre: 'Caja Ruta 1',
        tipo: 'RUTA',
        rutaId: 'ruta-1',
        responsableId: 'cobrador-1',
      });

    await (makeService(prisma) as any).approveCashBase(
      {
        id: 'approval-base-1',
        solicitadoPorId: 'cobrador-1',
        datosSolicitud: {
          rutaId: 'ruta-1',
          cobradorId: 'cobrador-viejo',
          cajaId: 'caja-vieja',
          monto: 50000,
          descripcion: 'Base inicial',
        },
      },
      'admin-1',
    );

    expect(prisma._tx.transaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cajaId: 'caja-ruta-1',
          tipo: 'INGRESO',
          tipoReferencia: 'SOLICITUD_BASE',
        }),
      }),
    );
    expect(mockLedger.registrarAsiento).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceType: 'BASE',
        lines: expect.arrayContaining([
          expect.objectContaining({
            accountCode: '1.2.1',
            cajaId: 'caja-ruta-1',
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
      makeService(prisma).approveItem('approval-1', 'GASTO' as any, 'admin-1'),
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

    const service = makeService(prisma) as any;
    const approveNewLoanSpy = jest
      .spyOn(service, 'approveNewLoan')
      .mockResolvedValue(undefined);

    await service.approveItem(
      'approval-loan-1',
      TipoAprobacion.NUEVO_PRESTAMO,
      'admin-1',
    );

    expect(approveNewLoanSpy).not.toHaveBeenCalled();
    expect(prisma._tx.efectoProvisional.update).toHaveBeenCalledWith({
      where: { id: 'efecto-loan-1' },
      data: expect.objectContaining({
        estado: 'CONFIRMADO',
        confirmadoEn: expect.any(Date),
      }),
    });
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
    (prisma._tx.efectoProvisional as any).create = jest
      .fn()
      .mockResolvedValue({ id: 'efecto-loan-2' });

    await makeService(prisma).confirmSuperadminAction(
      'approval-loan-1',
      'REVERTIR',
      'superadmin-1',
      'Revisar de nuevo',
    );

    expect(prisma._tx.aprobacion.update).toHaveBeenCalledWith({
      where: { id: 'approval-loan-1' },
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
    expect((prisma._tx.efectoProvisional as any).create).toHaveBeenCalledWith({
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
        'GASTO' as any,
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
    (prisma._tx.prestamo as any).findUnique = jest.fn().mockResolvedValue({
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
    (prisma._tx.transaccion as any).findFirst = jest
      .fn()
      .mockResolvedValue(null);

    await (makeService(prisma) as any).approveNewLoan(
      {
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
      },
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
    (prisma._tx.prestamo as any).findUnique = jest.fn().mockResolvedValue({
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

    await (makeService(prisma) as any).approveNewLoan(
      {
        id: 'approval-efectivo-1',
        referenciaId: 'prestamo-efectivo-1',
        solicitadoPorId: 'admin-1',
        datosSolicitud: {
          tipo: 'EFECTIVO',
          monto: 120000,
        },
      },
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
    (prisma._tx.prestamo as any).findUnique = jest.fn().mockResolvedValue({
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

    await (makeService(prisma) as any).approveNewLoan(
      {
        id: 'approval-efectivo-ruta-1',
        referenciaId: 'prestamo-efectivo-ruta-1',
        solicitadoPorId: 'cobrador-1',
        datosSolicitud: {
          tipo: 'EFECTIVO',
          monto: 120000,
        },
      },
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
    (prisma._tx.prestamo as any).findUnique = jest.fn().mockResolvedValue({
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
    (prisma._tx.transaccion as any).findFirst = jest
      .fn()
      .mockResolvedValue(null);
    mockLedger.registrarVentaArticulo.mockRejectedValueOnce(
      new Error('ledger failed'),
    );

    await expect(
      (makeService(prisma) as any).approveNewLoan(
        {
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
        },
        'admin-1',
      ),
    ).rejects.toThrow('ledger failed');
  });
});
