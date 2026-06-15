import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TipoTransaccion } from '@prisma/client';
import { SalesService } from './sales.service';

const makeService = (prisma: any, ledger: any = {}) =>
  new SalesService(prisma, {
    registrarVentaArticulo: jest.fn().mockResolvedValue({ id: 'journal-venta-1' }),
    ...ledger,
  } as any);

describe('SalesService venta contado', () => {
  it('registra venta de contado sin crear préstamo, cuotas ni pago operativo', async () => {
    const tx = {
      producto: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      caja: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'caja-oficina-1',
          codigo: 'CAJA-OFICINA',
          tipo: 'PRINCIPAL',
          saldoActual: 50_000,
        }),
      },
      transaccion: {
        create: jest.fn().mockResolvedValue({
          id: 'trx-venta-1',
          numeroTransaccion: 'VC-001',
        }),
      },
      prestamo: {
        create: jest.fn(),
      },
      cuota: {
        create: jest.fn(),
        createMany: jest.fn(),
      },
      pago: {
        create: jest.fn(),
      },
    };
    const prisma = {
      producto: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'producto-1',
          nombre: 'Nevera',
          costo: 650_000,
          stock: 3,
        }),
      },
      prestamo: {
        create: jest.fn(),
      },
      cuota: {
        create: jest.fn(),
        createMany: jest.fn(),
      },
      pago: {
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((callback: any) => callback(tx)),
    };
    const ledger = {
      registrarVentaArticulo: jest.fn().mockResolvedValue({
        id: 'journal-venta-1',
      }),
    };

    const resultado = await makeService(prisma, ledger).registrarVentaContado({
      clienteId: 'cliente-1',
      productoId: 'producto-1',
      precioVenta: 1_000_000,
      cajaId: 'caja-pv-1',
      creadoPorId: 'vendedor-1',
      metodoPago: 'EFECTIVO',
      notas: 'Venta mostrador',
    });

    expect(tx.producto.updateMany).toHaveBeenCalledWith({
      where: { id: 'producto-1', stock: { gt: 0 } },
      data: { stock: { decrement: 1 } },
    });
    expect(tx.caja.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          codigo: 'CAJA-OFICINA',
          activa: true,
        },
      }),
    );
    expect(tx.transaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cajaId: 'caja-oficina-1',
          tipo: TipoTransaccion.INGRESO,
          monto: 1_000_000,
          tipoReferencia: 'VENTA_CONTADO',
          referenciaId: expect.stringMatching(/^VENTA:/),
        }),
      }),
    );
    expect(ledger.registrarVentaArticulo).toHaveBeenCalledWith(
      expect.objectContaining({
        prestamoId: expect.stringMatching(/^VENTA:/),
        precioVenta: 1_000_000,
        costoArticulo: 650_000,
        montoFinanciado: 0,
        cuotaInicial: 1_000_000,
        cajaId: 'caja-oficina-1',
        accountCodeCaja: '1.1.1',
        createdBy: 'vendedor-1',
      }),
      tx,
    );
    expect(prisma.prestamo.create).not.toHaveBeenCalled();
    expect(tx.prestamo.create).not.toHaveBeenCalled();
    expect(tx.cuota.create).not.toHaveBeenCalled();
    expect(tx.cuota.createMany).not.toHaveBeenCalled();
    expect(tx.pago.create).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({
      success: true,
      productoId: 'producto-1',
      precioVenta: 1_000_000,
      transaccionId: 'trx-venta-1',
      journalEntryId: 'journal-venta-1',
    });
  });

  it('rechaza venta de contado sin stock disponible', async () => {
    const prisma = {
      producto: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'producto-1',
          nombre: 'Nevera',
          costo: 650_000,
          stock: 0,
        }),
      },
    };

    await expect(
      makeService(prisma).registrarVentaContado({
        clienteId: 'cliente-1',
        productoId: 'producto-1',
        precioVenta: 1_000_000,
        cajaId: 'caja-pv-1',
        creadoPorId: 'vendedor-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza venta de contado para producto inexistente', async () => {
    const prisma = {
      producto: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    await expect(
      makeService(prisma).registrarVentaContado({
        clienteId: 'cliente-1',
        productoId: 'producto-inexistente',
        precioVenta: 1_000_000,
        cajaId: 'caja-pv-1',
        creadoPorId: 'vendedor-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('registra venta de contado por transferencia en Caja Banco', async () => {
    const tx = {
      producto: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      caja: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'caja-banco-1',
          codigo: 'CAJA-BANCO',
          tipo: 'PRINCIPAL',
          saldoActual: 0,
        }),
      },
      transaccion: {
        create: jest.fn().mockResolvedValue({
          id: 'trx-venta-transferencia-1',
          numeroTransaccion: 'VC-TRANSFER-001',
        }),
      },
      prestamo: {
        create: jest.fn(),
      },
      cuota: {
        create: jest.fn(),
        createMany: jest.fn(),
      },
      pago: {
        create: jest.fn(),
      },
    };

    const prisma = {
      producto: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'producto-1',
          nombre: 'Nevera',
          costo: 650_000,
          stock: 3,
        }),
      },
      prestamo: {
        create: jest.fn(),
      },
      cuota: {
        create: jest.fn(),
        createMany: jest.fn(),
      },
      pago: {
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((callback: any) => callback(tx)),
    };

    const ledger = {
      registrarVentaArticulo: jest.fn().mockResolvedValue({
        id: 'journal-venta-transferencia-1',
      }),
    };

    const resultado = await makeService(prisma, ledger).registrarVentaContado({
      clienteId: 'cliente-1',
      productoId: 'producto-1',
      precioVenta: 1_000_000,
      cajaId: 'caja-pv-1',
      creadoPorId: 'vendedor-1',
      metodoPago: 'TRANSFERENCIA',
      notas: 'Transferencia Bancolombia',
    } as any);

    expect(tx.caja.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          codigo: 'CAJA-BANCO',
          activa: true,
        },
      }),
    );

    expect(tx.transaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cajaId: 'caja-banco-1',
          tipo: TipoTransaccion.INGRESO,
          monto: 1_000_000,
          tipoReferencia: 'VENTA_CONTADO',
          referenciaId: expect.stringMatching(/^VENTA:/),
        }),
      }),
    );

    expect(ledger.registrarVentaArticulo).toHaveBeenCalledWith(
      expect.objectContaining({
        prestamoId: expect.stringMatching(/^VENTA:/),
        precioVenta: 1_000_000,
        costoArticulo: 650_000,
        montoFinanciado: 0,
        cuotaInicial: 1_000_000,
        cajaId: 'caja-banco-1',
        accountCodeCaja: '1.1.2',
        createdBy: 'vendedor-1',
      }),
      tx,
    );

    expect(tx.prestamo.create).not.toHaveBeenCalled();
    expect(tx.cuota.create).not.toHaveBeenCalled();
    expect(tx.cuota.createMany).not.toHaveBeenCalled();
    expect(tx.pago.create).not.toHaveBeenCalled();

    expect(resultado).toMatchObject({
      success: true,
      productoId: 'producto-1',
      precioVenta: 1_000_000,
      metodoPago: 'TRANSFERENCIA',
      transaccionId: 'trx-venta-transferencia-1',
      journalEntryId: 'journal-venta-transferencia-1',
    });
  });

  it('rechaza venta de contado por transferencia si no existe Caja Banco activa', async () => {
    const tx = {
      producto: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      caja: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const prisma = {
      producto: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'producto-1',
          nombre: 'Nevera',
          costo: 650_000,
          stock: 3,
        }),
      },
      $transaction: jest.fn().mockImplementation((callback: any) => callback(tx)),
    };

    await expect(
      makeService(prisma).registrarVentaContado({
        clienteId: 'cliente-1',
        productoId: 'producto-1',
        precioVenta: 1_000_000,
        cajaId: 'caja-pv-1',
        creadoPorId: 'vendedor-1',
        metodoPago: 'TRANSFERENCIA',
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza venta de contado en efectivo si no existe Caja Oficina activa', async () => {
    const tx = {
      producto: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      caja: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const prisma = {
      producto: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'producto-1',
          nombre: 'Nevera',
          costo: 650_000,
          stock: 3,
        }),
      },
      $transaction: jest.fn().mockImplementation((callback: any) => callback(tx)),
    };

    await expect(
      makeService(prisma).registrarVentaContado({
        clienteId: 'cliente-1',
        productoId: 'producto-1',
        precioVenta: 1_000_000,
        cajaId: '',
        creadoPorId: 'vendedor-1',
        metodoPago: 'EFECTIVO',
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
