import { ConflictException } from '@nestjs/common';
import { RolUsuario, TipoTransaccion } from '@prisma/client';
import { LoansService } from './loans.service';

const mockNotifications = {
  create: jest.fn().mockResolvedValue(undefined),
  notifyApprovers: jest.fn().mockResolvedValue(undefined),
};
const mockAudit = { create: jest.fn().mockResolvedValue(undefined) };
const mockPush = { sendPushNotification: jest.fn().mockResolvedValue(undefined) };
const mockGateway = {
  broadcastPrestamosActualizados: jest.fn(),
  broadcastDashboardsActualizados: jest.fn(),
  broadcastRutasActualizadas: jest.fn(),
};
const mockConfig = { shouldAutoApproveCredits: jest.fn().mockResolvedValue(true) };
const mockLedger = {
  registrarDesembolso: jest.fn().mockResolvedValue({ id: 'journal-desembolso' }),
  registrarVentaArticulo: jest.fn().mockResolvedValue({ id: 'journal-venta-articulo' }),
  registrarAsiento: jest.fn().mockResolvedValue({ id: 'journal-reverso-articulo' }),
};

function makeService(prisma: any) {
  return new LoansService(
    prisma,
    mockNotifications as any,
    mockAudit as any,
    mockPush as any,
    mockGateway as any,
    mockConfig as any,
    mockLedger as any,
  );
}

describe('LoansService accounting impact for approved loans', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registra desembolso contable desde caja de oficina para préstamo en efectivo autoaprobado', async () => {
    const prisma = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({ rol: RolUsuario.ADMIN }),
      },
      asignacionRuta: {
        findFirst: jest.fn().mockResolvedValue({ rutaId: 'ruta-1' }),
      },
      ruta: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      caja: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({
            id: 'caja-oficina',
            tipo: 'PRINCIPAL',
            codigo: 'CAJA-OFICINA',
            saldoActual: 200000,
          })
          .mockResolvedValueOnce({
            id: 'caja-ruta-1',
            tipo: 'RUTA',
            codigo: 'CAJA-RUTA',
            saldoActual: 50000,
          }),
      },
      transaccion: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'trx-desembolso-1' }),
      },
    };

    await (makeService(prisma) as any).registrarImpactoContablePrestamoAprobado({
      id: 'prestamo-cash-1',
      numeroPrestamo: 'PRES-1',
      clienteId: 'cliente-1',
      tipoPrestamo: 'EFECTIVO',
      monto: 120000,
      creadoPorId: 'admin-1',
    });

    expect(prisma.transaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: TipoTransaccion.EGRESO,
          monto: 120000,
          tipoReferencia: 'PRESTAMO',
          referenciaId: 'prestamo-cash-1',
          cajaId: 'caja-oficina',
        }),
      }),
    );
    expect(mockLedger.registrarDesembolso).toHaveBeenCalledWith(
      expect.objectContaining({
        prestamoId: 'prestamo-cash-1',
        monto: 120000,
        cajaOrigenId: 'caja-oficina',
        accountCodeOrigen: '1.1.1',
        createdBy: 'admin-1',
      }),
    );
  });

  it('registra desembolso contable desde caja de ruta cuando el préstamo en efectivo lo hace un cobrador', async () => {
    const prisma = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({ rol: RolUsuario.COBRADOR }),
      },
      ruta: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ruta-cobrador-1' }),
      },
      caja: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'caja-ruta-1',
          tipo: 'RUTA',
          codigo: 'RUTA-001',
          saldoActual: 200000,
        }),
      },
      transaccion: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'trx-desembolso-ruta-1' }),
      },
    };

    await (makeService(prisma) as any).registrarImpactoContablePrestamoAprobado({
      id: 'prestamo-cash-ruta-1',
      numeroPrestamo: 'PRES-RUTA-1',
      clienteId: 'cliente-1',
      tipoPrestamo: 'EFECTIVO',
      monto: 120000,
      creadoPorId: 'cobrador-1',
    });

    expect(prisma.ruta.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cobradorId: 'cobrador-1',
          activa: true,
          eliminadoEn: null,
        }),
      }),
    );
    expect(prisma.transaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cajaId: 'caja-ruta-1',
          tipo: TipoTransaccion.EGRESO,
          monto: 120000,
          tipoReferencia: 'PRESTAMO',
          referenciaId: 'prestamo-cash-ruta-1',
        }),
      }),
    );
    expect(mockLedger.registrarDesembolso).toHaveBeenCalledWith(
      expect.objectContaining({
        prestamoId: 'prestamo-cash-ruta-1',
        monto: 120000,
        cajaOrigenId: 'caja-ruta-1',
        accountCodeOrigen: '1.2.1',
        createdBy: 'cobrador-1',
      }),
    );
  });

  it('registra venta de artículo separando precio de venta, costo y cuota inicial', async () => {
    const prisma = {
      asignacionRuta: {
        findFirst: jest.fn().mockResolvedValue({ rutaId: 'ruta-1' }),
      },
      caja: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({ id: 'caja-oficina', codigo: 'CAJA-OFICINA', tipo: 'PRINCIPAL' }),
      },
      transaccion: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'trx-cuota-inicial-1' }),
      },
    };

    await (makeService(prisma) as any).registrarImpactoContablePrestamoAprobado({
      id: 'prestamo-art-1',
      numeroPrestamo: 'ART-1',
      clienteId: 'cliente-1',
      tipoPrestamo: 'ARTICULO',
      monto: 80000,
      cuotaInicial: 20000,
      precioVentaArticulo: 100000,
      costoArticulo: 65000,
      creadoPorId: 'admin-1',
    });

    expect(prisma.transaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: TipoTransaccion.INGRESO,
          monto: 20000,
          tipoReferencia: 'CUOTA_INICIAL',
          referenciaId: 'prestamo-art-1',
        }),
      }),
    );
    expect(mockLedger.registrarVentaArticulo).toHaveBeenCalledWith(
      expect.objectContaining({
        prestamoId: 'prestamo-art-1',
        precioVenta: 100000,
        costoArticulo: 65000,
        montoFinanciado: 80000,
        cuotaInicial: 20000,
        cajaId: 'caja-oficina',
        accountCodeCaja: '1.1.1',
        createdBy: 'admin-1',
      }),
    );
  });

  it('retorna el préstamo existente al reintentar creación con la misma idempotencyKey', async () => {
    const prisma = {
      prestamo: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'prestamo-existente-1',
          numeroPrestamo: 'PRES-EXISTENTE',
          idempotencyKey: 'offline-loan-1',
        }),
      },
      aprobacion: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'approval-loan-1',
          referenciaId: 'prestamo-existente-1',
        }),
      },
    };

    const result = await makeService(prisma).createLoan({
      clienteId: 'cliente-1',
      tipoPrestamo: 'EFECTIVO',
      monto: 100000,
      tasaInteres: 10,
      tasaInteresMora: 2,
      plazoMeses: 1,
      frecuenciaPago: 'MENSUAL' as any,
      fechaInicio: '2026-05-15',
      creadoPorId: 'admin-1',
      idempotencyKey: 'offline-loan-1',
    } as any);

    expect(result).toMatchObject({
      prestamoId: 'prestamo-existente-1',
      aprobacionId: 'approval-loan-1',
      idempotentReplay: true,
    });
  });

  it('rechaza edición de préstamo si la versión enviada está vieja', async () => {
    const prisma = {
      prestamo: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'prestamo-1',
          version: 4,
          monto: 100000,
          tasaInteres: 10,
          plazoMeses: 1,
          frecuenciaPago: 'MENSUAL',
          estado: 'ACTIVO',
        }),
        update: jest.fn(),
      },
    };

    await expect(
      makeService(prisma).updateLoan('prestamo-1', { monto: 120000, version: 3 } as any, 'admin-1'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.prestamo.update).not.toHaveBeenCalled();
  });

  it('descuenta stock con una actualización condicional para evitar inventario negativo', async () => {
    const prisma = {
      producto: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    await (makeService(prisma) as any).descontarStockSiDisponible('producto-1');

    expect(prisma.producto.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'producto-1',
        stock: { gt: 0 },
      },
      data: { stock: { decrement: 1 } },
    });
  });

  it('rechaza el descuento de stock cuando otro proceso agotó el inventario', async () => {
    const prisma = {
      producto: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    await expect(
      (makeService(prisma) as any).descontarStockSiDisponible('producto-1'),
    ).rejects.toThrow('Producto sin stock disponible');
  });

  it('genera número de préstamo sin depender de count + 1', () => {
    const prisma = {
      prestamo: {
        count: jest.fn(),
      },
    };
    const service = makeService(prisma) as any;

    expect(service.generarNumeroPrestamo('ARTICULO')).toMatch(/^ART-\d+-[0-9a-f-]{8}$/);
    expect(service.generarNumeroPrestamo('EFECTIVO')).toMatch(/^PRES-\d+-[0-9a-f-]{8}$/);
    expect(prisma.prestamo.count).not.toHaveBeenCalled();
  });
});

describe('LoansService role scoping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forces loan list queries from collectors to loans assigned to their routes', async () => {
    const prisma = {
      prestamo: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 0, saldoPendiente: 0 } }),
      },
    };
    const service = makeService(prisma);

    await service.getAllLoans(
      { estado: 'todos', ruta: 'todas', search: '', tipo: 'todos', page: 1, limit: 8 },
      { id: 'cobrador-propio', rol: RolUsuario.COBRADOR } as any,
    );

    expect(prisma.prestamo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eliminadoEn: null,
          cliente: expect.objectContaining({
            asignacionesRuta: expect.objectContaining({
              some: expect.objectContaining({
                activa: true,
              }),
            }),
          }),
        }),
      }),
    );
    expect(prisma.prestamo.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        eliminadoEn: null,
        cliente: expect.objectContaining({
          asignacionesRuta: expect.objectContaining({
            some: expect.objectContaining({
              activa: true,
            }),
          }),
        }),
      }),
    });
  });

  it('does not return loan detail to a collector when the loan is not assigned to them', async () => {
    const prisma = {
      prestamo: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = makeService(prisma);

    await expect(
      service.getLoanById(
        'prestamo-ajeno',
        { id: 'cobrador-propio', rol: RolUsuario.COBRADOR } as any,
      ),
    ).rejects.toThrow('Préstamo no encontrado');

    expect(prisma.prestamo.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'prestamo-ajeno',
          eliminadoEn: null,
          cliente: expect.objectContaining({
            asignacionesRuta: expect.objectContaining({
              some: expect.objectContaining({
                activa: true,
              }),
            }),
          }),
        }),
      }),
    );
  });

  it('does not return loan cuotas to a collector when the loan is not assigned to them', async () => {
    const prisma = {
      prestamo: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      cuota: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = makeService(prisma);

    await expect(
      service.getLoanCuotas(
        'prestamo-ajeno',
        { id: 'cobrador-propio', rol: RolUsuario.COBRADOR } as any,
      ),
    ).rejects.toThrow('Préstamo no encontrado');

    expect(prisma.cuota.findMany).not.toHaveBeenCalled();
  });
});

describe('LoansService archive accounting reversal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('revierte caja, cartera, ingreso, costo e inventario cuando se archiva un crédito de artículo', async () => {
    const tx = {
      prestamo: {
        update: jest.fn().mockResolvedValue({ id: 'prestamo-art-1' }),
      },
      aprobacion: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      journalEntry: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({
            id: 'journal-venta',
            lines: [
              { accountCode: '1.1.1', cajaId: 'caja-oficina', debitAmount: 500000, creditAmount: 0 },
              { accountCode: '1.3.1', cajaId: null, debitAmount: 1900000, creditAmount: 0 },
              { accountCode: '3.4', cajaId: null, debitAmount: 0, creditAmount: 2400000 },
              { accountCode: '5.1', cajaId: null, debitAmount: 2000000, creditAmount: 0 },
              { accountCode: '1.5', cajaId: null, debitAmount: 0, creditAmount: 2000000 },
            ],
          })
          .mockResolvedValueOnce(null),
      },
      transaccion: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'trx-cuota-inicial',
          cajaId: 'caja-oficina',
        }),
        count: jest.fn().mockResolvedValue(3),
        create: jest.fn().mockResolvedValue({ id: 'trx-reverso' }),
      },
      notificacion: {
        create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      },
    };

    const prisma = {
      prestamo: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'prestamo-art-1',
          numeroPrestamo: 'ART-1',
          tipoPrestamo: 'ARTICULO',
          estado: 'ACTIVO',
          clienteId: 'cliente-1',
          monto: 1900000,
          saldoPendiente: 1900000,
          cuotaInicial: 500000,
          precioVentaArticulo: 2400000,
          costoArticulo: 2000000,
          cliente: { nombres: 'Adrian', apellidos: 'Murillo' },
        }),
      },
      $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)),
      asignacionRuta: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    await makeService(prisma).archiveLoan('prestamo-art-1', {
      motivo: 'Prueba',
      archivarPorId: 'admin-1',
    });

    expect(tx.transaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cajaId: 'caja-oficina',
          tipo: TipoTransaccion.EGRESO,
          monto: 500000,
          tipoReferencia: 'REVERSO_CUOTA_INICIAL',
          referenciaId: 'prestamo-art-1',
        }),
      }),
    );
    expect(mockLedger.registrarAsiento).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceType: 'AJUSTE',
        referenceId: 'ARCHIVO:prestamo-art-1',
        lines: expect.arrayContaining([
          expect.objectContaining({ accountCode: '3.4', debitAmount: 2400000 }),
          expect.objectContaining({ accountCode: '1.1.1', creditAmount: 500000, cajaId: 'caja-oficina', cajaDelta: -500000 }),
          expect.objectContaining({ accountCode: '1.3.1', creditAmount: 1900000 }),
          expect.objectContaining({ accountCode: '1.5', debitAmount: 2000000 }),
          expect.objectContaining({ accountCode: '5.1', creditAmount: 2000000 }),
        ]),
      }),
      tx,
    );
  });

  it('permite reparar la reversa contable de un crédito de artículo que ya estaba archivado', async () => {
    const tx = {
      journalEntry: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({
            id: 'journal-venta',
            lines: [
              { accountCode: '1.1.1', cajaId: 'caja-oficina', debitAmount: 500000, creditAmount: 0 },
              { accountCode: '1.3.1', cajaId: null, debitAmount: 1900000, creditAmount: 0 },
              { accountCode: '3.4', cajaId: null, debitAmount: 0, creditAmount: 2400000 },
              { accountCode: '5.1', cajaId: null, debitAmount: 2000000, creditAmount: 0 },
              { accountCode: '1.5', cajaId: null, debitAmount: 0, creditAmount: 2000000 },
            ],
          })
          .mockResolvedValueOnce(null),
      },
      transaccion: {
        findFirst: jest.fn().mockResolvedValue({ id: 'trx-cuota-inicial', cajaId: 'caja-oficina' }),
        count: jest.fn().mockResolvedValue(4),
        create: jest.fn().mockResolvedValue({ id: 'trx-reverso' }),
      },
    };
    const prisma = {
      prestamo: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'prestamo-art-archivado',
          numeroPrestamo: 'ART-ARCH',
          tipoPrestamo: 'ARTICULO',
          estado: 'PERDIDA',
          clienteId: 'cliente-1',
          monto: 1900000,
          saldoPendiente: 1900000,
          cuotaInicial: 500000,
          cliente: { nombres: 'Adrian', apellidos: 'Murillo' },
        }),
      },
      $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)),
    };

    const result = await makeService(prisma).archiveLoan('prestamo-art-archivado', {
      motivo: 'Reparar reversa',
      archivarPorId: 'admin-1',
    });

    expect(result.message).toContain('reversa contable verificada');
    expect(mockLedger.registrarAsiento).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceType: 'AJUSTE',
        referenceId: 'ARCHIVO:prestamo-art-archivado',
      }),
      tx,
    );
  });

  it('restaura el impacto contable de un crédito de artículo restaurado', async () => {
    const tx = {
      prestamo: {
        update: jest.fn().mockResolvedValue({ id: 'prestamo-art-restaurar', estado: 'ACTIVO', eliminadoEn: null }),
      },
      journalEntry: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({
            id: 'journal-archivo',
            lines: [
              { accountCode: '3.4', cajaId: null, debitAmount: 2400000, creditAmount: 0 },
              { accountCode: '1.1.1', cajaId: 'caja-oficina', debitAmount: 0, creditAmount: 500000, cajaDelta: -500000 },
              { accountCode: '1.3.1', cajaId: null, debitAmount: 0, creditAmount: 1900000 },
              { accountCode: '1.5', cajaId: null, debitAmount: 2000000, creditAmount: 0 },
              { accountCode: '5.1', cajaId: null, debitAmount: 0, creditAmount: 2000000 },
            ],
          })
          .mockResolvedValueOnce(null),
      },
      transaccion: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(5),
        create: jest.fn().mockResolvedValue({ id: 'trx-restauracion-cuota' }),
      },
    };
    const prisma = {
      prestamo: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'prestamo-art-restaurar',
          numeroPrestamo: 'ART-REST',
          tipoPrestamo: 'ARTICULO',
          estado: 'PERDIDA',
          eliminadoEn: new Date('2026-05-09T12:00:00-05:00'),
        }),
      },
      $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)),
    };

    await makeService(prisma).restoreLoan('prestamo-art-restaurar', 'admin-1');

    expect(tx.transaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cajaId: 'caja-oficina',
          tipo: TipoTransaccion.INGRESO,
          monto: 500000,
          tipoReferencia: 'RESTAURACION_CUOTA_INICIAL',
          referenciaId: 'prestamo-art-restaurar',
        }),
      }),
    );
    expect(mockLedger.registrarAsiento).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceType: 'AJUSTE',
        referenceId: 'RESTAURACION_ARCHIVO:prestamo-art-restaurar',
        lines: expect.arrayContaining([
          expect.objectContaining({ accountCode: '3.4', creditAmount: 2400000 }),
          expect.objectContaining({ accountCode: '1.1.1', debitAmount: 500000, cajaId: 'caja-oficina', cajaDelta: 500000 }),
          expect.objectContaining({ accountCode: '1.3.1', debitAmount: 1900000 }),
          expect.objectContaining({ accountCode: '1.5', creditAmount: 2000000 }),
          expect.objectContaining({ accountCode: '5.1', debitAmount: 2000000 }),
        ]),
      }),
      tx,
    );
    expect(mockGateway.broadcastPrestamosActualizados).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'RESTAURAR', prestamoId: 'prestamo-art-restaurar' }),
    );
    expect(mockGateway.broadcastDashboardsActualizados).toHaveBeenCalled();
  });
});
