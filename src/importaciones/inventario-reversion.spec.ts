import { BadRequestException } from '@nestjs/common';
import { ImportacionesService } from './importaciones.service';

const snapshot = (stock = 4) => ({
  nombre: 'Samsung Galaxy A15',
  descripcion: null,
  categoria: 'Celulares',
  categoriaId: null,
  marca: 'Samsung',
  modelo: 'A15',
  costo: 187000,
  stock,
  stockMinimo: 1,
  activo: true,
  eliminadoEn: null,
  ocultoArchivadosEn: null,
});

const registro = {
  productoId: 'producto-1',
  codigo: 'CEL-A15',
  nombre: 'Samsung Galaxy A15',
  accion: 'CREADO',
  despues: snapshot(),
  preciosCreados: [
    {
      id: 'precio-1',
      meses: 0,
      despues: { precio: 267143, activo: true },
    },
  ],
  preciosActualizados: [],
  asientoReferenceIds: ['IMP-INV-movimiento-1'],
};

function preparar(stockActual = 4) {
  const tx = {
    producto: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'producto-1',
          ...snapshot(stockActual),
          precios: [
            {
              id: 'precio-1',
              meses: 0,
              precio: 267143,
              activo: true,
              _count: { prestamos: 0 },
            },
          ],
          _count: { prestamos: 0, archivos: 0 },
        },
      ]),
      delete: jest.fn().mockResolvedValue({ id: 'producto-1' }),
      update: jest.fn(),
    },
    precioProducto: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
    },
    importacionLote: { update: jest.fn().mockResolvedValue({}) },
  };

  const lote = {
    id: 'lote-1',
    tipo: 'INVENTARIO',
    estado: 'CONFIRMADO',
    resumen: { creado: { articulos: 1, precios: 1, inventario: [registro] } },
  };
  const prisma = {
    importacionLote: { findUnique: jest.fn().mockResolvedValue(lote) },
    $transaction: jest.fn((callback) => callback(tx)),
  };
  const ledger = {
    reversarAsientos: jest.fn().mockResolvedValue(['reversa-1']),
  };
  const gateway = { broadcastInventarioActualizado: jest.fn() };
  const service = new ImportacionesService(
    prisma as any,
    ledger as any,
    gateway as any,
  );

  return { service, prisma, tx, ledger, gateway };
}

describe('Reversión de importaciones de inventario', () => {
  it('elimina lo creado y deja la reversa contable', async () => {
    const { service, tx, ledger, gateway } = preparar();

    const resultado = await service.revertirLote('lote-1', {
      usuarioId: 'superadmin-1',
    });

    expect(ledger.reversarAsientos).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        referenceIds: ['IMP-INV-movimiento-1'],
        referenceTypes: ['AJUSTE'],
      }),
    );
    expect(tx.precioProducto.deleteMany).toHaveBeenCalled();
    expect(tx.producto.delete).toHaveBeenCalledWith({
      where: { id: 'producto-1' },
    });
    expect(tx.importacionLote.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { estado: 'CANCELADO' } }),
    );
    expect(resultado.articulosEliminados).toBe(1);
    expect(gateway.broadcastInventarioActualizado).toHaveBeenCalled();
  });

  it('bloquea la reversa si el stock cambió después de importar', async () => {
    const { service, tx, ledger } = preparar(3);

    await expect(
      service.revertirLote('lote-1', { usuarioId: 'superadmin-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(ledger.reversarAsientos).not.toHaveBeenCalled();
    expect(tx.producto.delete).not.toHaveBeenCalled();
  });
});
