import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RolUsuario, TipoTransaccion } from '@prisma/client';
import { SalesService } from './sales.service';
import {
  comoDependencia,
  comoPrisma,
  type Doble,
  type DobleDePrisma,
} from '../common/testing/dobles';
import type { LedgerService } from '../accounting/ledger.service';

const makeService = (
  prisma: DobleDePrisma,
  ledger: Doble<LedgerService> = {},
) =>
  new SalesService(
    comoPrisma(prisma),
    comoDependencia<LedgerService>({
      registrarVentaArticulo: jest
        .fn()
        .mockResolvedValue({ id: 'journal-venta-1' }),
      ...ledger,
    }),
  );

describe('SalesService listado de contado', () => {
  it('pagina sobre las ventas del vendedor autenticado y conserva el cliente', async () => {
    const prisma = {
      transaccion: {
        count: jest.fn().mockResolvedValue(51),
        findMany: jest.fn().mockResolvedValue([{
          id: 'trx-1',
          monto: 750000,
          caja: { codigo: 'CAJA-BANCO', nombre: 'Caja Banco' },
          clienteId: 'cliente-1',
          cliente: { nombres: 'Ana', apellidos: 'Prueba', dni: '1000' },
          creadoPorId: 'pdv-propio',
        }]),
      },
    };
    const resultado = await makeService(prisma).listarVentasContado({
      actor: { id: 'pdv-propio', rol: RolUsuario.PUNTO_DE_VENTA },
      vendedorId: 'pdv-ajeno',
      pagina: 3,
      limite: 25,
    });
    const where = { creadoPorId: 'pdv-propio', tipoReferencia: 'VENTA_CONTADO', tipo: 'INGRESO' };
    expect(prisma.transaccion.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 50, take: 25 }));
    expect(prisma.transaccion.count).toHaveBeenCalledWith({ where });
    expect(resultado).toMatchObject({
      ventas: [{ cliente: 'Ana Prueba', vendedorId: 'pdv-propio', metodoPago: 'TRANSFERENCIA', monto: 750000 }],
      paginacion: { pagina: 3, limite: 25, total: 51, totalPaginas: 3 },
    });
  });

  it('permite que un administrador filtre el listado por vendedor de Punto de Venta', async () => {
    const prisma = { transaccion: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) } };
    await makeService(prisma).listarVentasContado({
      actor: { id: 'admin', rol: RolUsuario.ADMIN },
      soloPuntoVenta: true,
      vendedorId: 'pdv-1',
      pagina: 1,
    });
    expect(prisma.transaccion.count).toHaveBeenCalledWith({
      where: {
        tipoReferencia: 'VENTA_CONTADO',
        tipo: 'INGRESO',
        creadoPorId: 'pdv-1',
        creadoPor: { rol: RolUsuario.PUNTO_DE_VENTA },
      },
    });
  });
});

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
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
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
          clienteId: 'cliente-1',
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
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
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
    });

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
          clienteId: 'cliente-1',
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
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
    };

    await expect(
      makeService(prisma).registrarVentaContado({
        clienteId: 'cliente-1',
        productoId: 'producto-1',
        precioVenta: 1_000_000,
        cajaId: 'caja-pv-1',
        creadoPorId: 'vendedor-1',
        metodoPago: 'TRANSFERENCIA',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('es idempotente: un reintento con la misma idempotencyKey no duplica la venta', async () => {
    const prisma = {
      producto: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'producto-1',
          nombre: 'Nevera',
          costo: 650_000,
          stock: 3,
        }),
      },
      transaccion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'trx-existente-1',
          numeroTransaccion: 'VC-EXIST-1',
          referenciaId: 'VENTA:PREV',
          monto: 1_000_000,
        }),
      },
      $transaction: jest.fn(),
    };

    const resultado = await makeService(prisma).registrarVentaContado({
      clienteId: 'cliente-1',
      productoId: 'producto-1',
      precioVenta: 1_000_000,
      cajaId: 'caja-pv-1',
      creadoPorId: 'vendedor-1',
      metodoPago: 'EFECTIVO',
      idempotencyKey: 'venta-abc-123',
    });

    // No se ejecuta la transacción (no se descuenta stock ni se duplica dinero)
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.transaccion.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          idempotencyKey: 'venta-abc-123',
          creadoPorId: 'vendedor-1',
          tipo: TipoTransaccion.INGRESO,
          tipoReferencia: 'VENTA_CONTADO',
        },
      }),
    );
    expect(resultado).toMatchObject({
      success: true,
      transaccionId: 'trx-existente-1',
      ventaId: 'VENTA:PREV',
      duplicada: true,
    });
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
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
    };

    await expect(
      makeService(prisma).registrarVentaContado({
        clienteId: 'cliente-1',
        productoId: 'producto-1',
        precioVenta: 1_000_000,
        cajaId: '',
        creadoPorId: 'vendedor-1',
        metodoPago: 'EFECTIVO',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
