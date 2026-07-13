import { ClientesCreditosParser } from '../../importaciones/parsers/clientes-creditos.parser';
import { InventarioParser } from '../../importaciones/parsers/inventario.parser';
import {
  generarExcelClientesCreditosImportable,
  generarExcelInventarioImportable,
} from './importables.template';

const prismaMock = {
  cliente: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  producto: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  ruta: {
    findMany: jest.fn().mockResolvedValue([]),
  },
} as any;

describe('Plantillas importables de exportacion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('genera inventario exportado que el parser de importacion acepta', async () => {
    const archivo = await generarExcelInventarioImportable(
      [
        {
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
        },
      ],
      [
        {
          codigoProducto: 'CEL-A15',
          meses: 1,
          precio: 580000,
          activo: true,
        },
      ],
      '2026-07-12',
    );

    const resultado = await new InventarioParser(prismaMock).parseAndValidate(
      archivo.data,
      archivo.filename,
    );

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.resumen.totalFilas).toBe(2);
    expect(resultado.resumen.filasValidas).toBe(2);
    expect(Object.keys(resultado.resumen.porHoja)).toEqual([
      'Artículos',
      'Precios',
    ]);
  });

  it('genera clientes y creditos exportados que el parser de importacion acepta', async () => {
    const archivo = await generarExcelClientesCreditosImportable(
      [
        {
          codigo: 'CLI-001',
          dni: '900001',
          nombres: 'Cliente',
          apellidos: 'Prueba',
          telefono: '3000000000',
          correo: 'cliente@example.com',
          nivelRiesgo: 'VERDE',
        },
      ],
      [
        {
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
        },
      ],
      '2026-07-12',
    );

    const resultado = await new ClientesCreditosParser(
      prismaMock,
    ).parseAndValidate(archivo.data, archivo.filename);

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.resumen.totalFilas).toBe(2);
    expect(resultado.resumen.filasValidas).toBe(2);
    expect(Object.keys(resultado.resumen.porHoja)).toEqual([
      'Clientes',
      'Créditos',
    ]);
  });
});
