import { BadRequestException } from '@nestjs/common';
import { EstadoCuota, EstadoPrestamo, MetodoPago, RolUsuario } from '@prisma/client';
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
  registrarVentaArticulo: jest.fn().mockResolvedValue({ id: 'journal-venta-articulo' }),
  registrarAjusteCartera: jest.fn().mockResolvedValue({ id: 'journal-ajuste-cartera' }),
};

function buildPrismaMock() {
  const tx = {
    pago: { create: jest.fn().mockResolvedValue({ id: 'pago-transfer-1' }) },
    cuota: { update: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(0) },
    prestamo: { update: jest.fn().mockResolvedValue({}) },
    transaccion: { create: jest.fn().mockResolvedValue({ id: 'trx-bank-1' }) },
    caja: {
      findUnique: jest.fn().mockResolvedValue({ id: 'caja-banco', nombre: 'Caja Banco', saldoActual: 0 }),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    journalEntry: { findFirst: jest.fn().mockResolvedValue(null) },
    usuario: { findFirst: jest.fn() },
    multimedia: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
  };

  return {
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
    },
    pago: { count: jest.fn().mockResolvedValue(0) },
    asignacionRuta: { findFirst: jest.fn().mockResolvedValue(null) },
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

describe('ApprovalsService financial ledger controls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('aplica pago por transferencia sin incrementar Caja Banco manualmente', async () => {
    const prisma = buildPrismaMock();
    const service = makeService(prisma);

    await (service as any).approveTransferPayment({
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
    }, 'admin-1');

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
      .mockResolvedValueOnce({ id: 'caja-ruta-1', nombre: 'Caja Ruta', saldoActual: 100000 });
    (prisma._tx.transaccion as any).findFirst = jest.fn().mockResolvedValue(null);

    await (makeService(prisma) as any).approveNewLoan({
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
    }, 'admin-1');

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

    await (makeService(prisma) as any).approveNewLoan({
      id: 'approval-efectivo-1',
      referenciaId: 'prestamo-efectivo-1',
      solicitadoPorId: 'admin-1',
      datosSolicitud: {
        tipo: 'EFECTIVO',
        monto: 120000,
      },
    }, 'admin-1');

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
    prisma._tx.usuario.findFirst.mockResolvedValue({ rol: RolUsuario.COBRADOR });
    prisma._tx.caja.findFirst.mockResolvedValueOnce({
      id: 'caja-ruta-1',
      codigo: 'RUTA-001',
      nombre: 'Caja Ruta 1',
      saldoActual: 200000,
    });

    await (makeService(prisma) as any).approveNewLoan({
      id: 'approval-efectivo-ruta-1',
      referenciaId: 'prestamo-efectivo-ruta-1',
      solicitadoPorId: 'cobrador-1',
      datosSolicitud: {
        tipo: 'EFECTIVO',
        monto: 120000,
      },
    }, 'admin-1');

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
    (prisma._tx.transaccion as any).findFirst = jest.fn().mockResolvedValue(null);
    mockLedger.registrarVentaArticulo.mockRejectedValueOnce(new Error('ledger failed'));

    await expect(
      (makeService(prisma) as any).approveNewLoan({
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
      }, 'admin-1'),
    ).rejects.toThrow('ledger failed');
  });
});
