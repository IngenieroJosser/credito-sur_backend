import { ClientesCreditosParser } from '../../importaciones/parsers/clientes-creditos.parser';
import { InventarioParser } from '../../importaciones/parsers/inventario.parser';
import {
  generarExcelClientesCreditosImportable,
  generarExcelInventarioImportable,
} from './importables.template';

const prismaVacio = () =>
  ({
    cliente: { findMany: jest.fn().mockResolvedValue([]) },
    producto: { findMany: jest.fn().mockResolvedValue([]) },
    ruta: { findMany: jest.fn().mockResolvedValue([]) },
    prestamo: { findMany: jest.fn().mockResolvedValue([]) },
  }) as any;

const articuloBase = {
  codigo: 'CEL-A15',
  nombre: 'Samsung Galaxy A15',
  descripcion: 'Equipo de prueba',
  categoria: 'Celulares',
  marca: 'Samsung',
  modelo: 'A15',
  costo: 480000,
  stock: 10,
  stockMinimo: 2,
  activo: true,
};

const creditoBase = {
  codigo: 'CRE-001',
  numeroPrestamo: 'IMP-001',
  ccCliente: '900001',
  tipoPrestamo: 'EFECTIVO',
  monto: 100000,
  tasaInteres: 10,
  tasaInteresMora: 0,
  frecuenciaPago: 'DIARIO',
  cantidadCuotas: 10,
  plazoMeses: 1,
  tipoAmortizacion: 'Interés simple',
  fechaCredito: '2026-07-12',
  fechaPrimerCobro: '2026-07-13',
  tipoCarga: 'HISTORICA',
  descontarCaja: 'NO',
};

const clienteBase = {
  codigo: 'CLI-001',
  dni: '900001',
  nombres: 'Cliente',
  apellidos: 'Prueba',
  telefono: '3000000000',
  correo: 'cliente@example.com',
  nivelRiesgo: 'VERDE',
};

describe('Plantillas importables de exportacion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('genera inventario exportado que el parser de importacion acepta', async () => {
    const archivo = await generarExcelInventarioImportable(
      [articuloBase],
      [
        { codigoProducto: 'CEL-A15', meses: 0, precio: 540000, activo: true },
        { codigoProducto: 'CEL-A15', meses: 1, precio: 580000, activo: true },
      ],
      '2026-07-12',
    );

    const resultado = await new InventarioParser(
      prismaVacio(),
    ).parseAndValidate(archivo.data, archivo.filename);

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.resumen.totalFilas).toBe(1);
    expect(resultado.resumen.filasValidas).toBe(1);
    expect(Object.keys(resultado.resumen.porHoja)).toEqual(['Artículos']);
    expect(resultado.precios).toEqual([
      expect.objectContaining({
        codigoProducto: 'CEL-A15',
        meses: 0,
        precio: 540000,
      }),
      expect.objectContaining({
        codigoProducto: 'CEL-A15',
        meses: 1,
        precio: 580000,
      }),
    ]);
  });

  it('conserva el precio de contado y varias opciones de plazo en el viaje de ida y vuelta', async () => {
    const archivo = await generarExcelInventarioImportable(
      [articuloBase],
      [
        { codigoProducto: 'CEL-A15', meses: 0, precio: 540000, activo: true },
        { codigoProducto: 'CEL-A15', meses: 1, precio: 580000, activo: true },
        { codigoProducto: 'CEL-A15', meses: 2, precio: 640000, activo: true },
        { codigoProducto: 'CEL-A15', meses: 3, precio: 690000, activo: true },
      ],
      '2026-07-12',
    );

    const resultado = await new InventarioParser(
      prismaVacio(),
    ).parseAndValidate(archivo.data, archivo.filename);

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.articulos?.[0]).toEqual(
      expect.objectContaining({ codigo: 'CEL-A15', precioContado: 540000 }),
    );
    expect(resultado.precios?.map((p: any) => p.meses).sort()).toEqual([
      0, 1, 2, 3,
    ]);
    // La utilidad se calcula sobre el costo para poder revisarla antes de importar.
    expect(resultado.precios?.find((p: any) => p.meses === 0)?.utilidad).toBe(
      60000,
    );
  });

  it('genera clientes y creditos exportados que el parser de importacion acepta', async () => {
    const archivo = await generarExcelClientesCreditosImportable(
      [clienteBase],
      [creditoBase],
      '2026-07-12',
    );

    const resultado = await new ClientesCreditosParser(
      prismaVacio(),
    ).parseAndValidate(archivo.data, archivo.filename);

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.resumen.totalFilas).toBe(2);
    expect(resultado.resumen.filasValidas).toBe(2);
    expect(Object.keys(resultado.resumen.porHoja)).toEqual([
      'Clientes',
      'Créditos de dinero',
      'Créditos de artículo',
    ]);
  });

  it('conserva el avance de cobro de un credito al exportarlo y volverlo a leer', async () => {
    const archivo = await generarExcelClientesCreditosImportable(
      [clienteBase],
      [
        {
          ...creditoBase,
          cuotasPagadas: 4,
          abonoAdicional: 2500,
          fechaUltimoPago: '2026-07-20',
        },
      ],
      '2026-07-12',
    );

    const resultado = await new ClientesCreditosParser(
      prismaVacio(),
    ).parseAndValidate(archivo.data, archivo.filename);

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.creditos?.[0]).toEqual(
      expect.objectContaining({ cuotasPagadas: 4, abonoAdicional: 2500 }),
    );
    expect(resultado.creditos?.[0].fechaUltimoPago).toBeInstanceOf(Date);
  });
});
