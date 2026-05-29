import { BadRequestException } from '@nestjs/common';
import {
  EstadoCuota,
  EstadoPrestamo,
  MetodoPago,
  RolUsuario,
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
    pago: { create: jest.fn().mockResolvedValue({ id: 'pago-transfer-1' }) },
    cuota: {
      update: jest.fn().mockResolvedValue({}),
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
    },
    pago: { count: jest.fn().mockResolvedValue(0) },
    asignacionRuta: { findFirst: jest.fn().mockResolvedValue(null) },
    cliente: { update: jest.fn().mockResolvedValue({}) },
    producto: { update: jest.fn().mockResolvedValue({}) },
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
