import * as ExcelJS from 'exceljs';
import {
  generarPlantillaClientesCreditos,
  type DatosReferenciaPlantilla,
} from './plantilla-clientes-creditos';
import { generarPlantillaInventario } from './plantilla-inventario';

/**
 * Pruebas de ESTRUCTURA de las plantillas, con varias combinaciones de datos.
 *
 * Por qué combinaciones: la generación arma encabezados, grupos fusionados,
 * fórmulas y validaciones usando índices de columna. Si un rango se desincroniza
 * (p. ej. un grupo que termina en una columna que se movió), ExcelJS lanza
 * "Cannot merge already merged cells" o quedan fórmulas apuntando a la columna
 * equivocada. Generar con distintos datos destapa esos casos.
 */

const base: DatosReferenciaPlantilla = {
  clientes: [{ dni: '123', nombre: 'Prueba' }],
  articulos: [
    { codigo: 'ART1', nombre: 'Nevera', meses: 12, precio: 1000, costo: 700, stock: 5 },
  ],
  codigosArticulo: ['ART1'],
  numerosPrestamo: [],
  rutas: ['R1'],
};

const COMBINACIONES: Array<{ nombre: string; datos: DatosReferenciaPlantilla }> = [
  {
    nombre: 'base (1 cliente, 1 artículo, 1 ruta)',
    datos: base,
  },
  {
    nombre: 'todo vacío (instalación nueva)',
    datos: { clientes: [], articulos: [], codigosArticulo: [], numerosPrestamo: [], rutas: [] },
  },
  {
    nombre: 'artículo con varios plazos',
    datos: {
      ...base,
      articulos: [
        { codigo: 'ART1', nombre: 'Nevera', meses: 3, precio: 400, costo: 300, stock: 2 },
        { codigo: 'ART1', nombre: 'Nevera', meses: 6, precio: 700, costo: 300, stock: 2 },
        { codigo: 'ART1', nombre: 'Nevera', meses: 12, precio: 1200, costo: 300, stock: 2 },
      ],
    },
  },
  {
    nombre: 'con créditos existentes y varias rutas',
    datos: {
      ...base,
      numerosPrestamo: ['IMP-123-1', 'IMP-123-2', 'PR-0001'],
      rutas: ['R1', 'R2', 'RUTA-CENTRO'],
    },
  },
  {
    nombre: 'texto con acentos, comillas y apóstrofes',
    datos: {
      ...base,
      clientes: [
        { dni: '999', nombre: "Ñandú O'Brien \"El Grande\"" },
        { dni: '998', nombre: 'María José Gutiérrez' },
      ],
      articulos: [
        { codigo: 'A-Ñ1', nombre: 'Televisor 50" Ultra', meses: 6, precio: 900, costo: 600, stock: 1 },
      ],
      codigosArticulo: ['A-Ñ1'],
    },
  },
  {
    nombre: 'volumen alto (300 clientes)',
    datos: {
      ...base,
      clientes: Array.from({ length: 300 }, (_, i) => ({
        dni: String(100000 + i),
        nombre: `Cliente ${i}`,
      })),
    },
  },
];

const cargar = async (data: Buffer) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as any);
  return wb;
};

const encabezados = (wb: ExcelJS.Workbook, hoja: string): string[] => {
  const ws = wb.getWorksheet(hoja);
  expect(ws).toBeDefined();
  const out: string[] = [];
  ws!.getRow(6).eachCell({ includeEmpty: true }, (celda, col) => {
    out[col] = String(celda.value ?? '').trim();
  });
  return out;
};

describe('Plantilla de clientes y créditos: estructura con varias combinaciones', () => {
  it.each(COMBINACIONES)('se genera sin errores: $nombre', async ({ datos }) => {
    const { data, filename } = await generarPlantillaClientesCreditos(datos);
    expect(data.length).toBeGreaterThan(0);
    expect(filename).toMatch(/\.xlsx$/);

    const wb = await cargar(data);
    for (const hoja of ['Clientes', 'Créditos de dinero', 'Créditos de artículo']) {
      expect(wb.getWorksheet(hoja)).toBeDefined();
    }
  }, 60000);

  it('el número de crédito queda al final en AMBAS hojas de crédito', async () => {
    const { data } = await generarPlantillaClientesCreditos(base);
    const wb = await cargar(data);

    const dinero = encabezados(wb, 'Créditos de dinero');
    expect(dinero[10]).toBe('Total abonado');
    expect(dinero[11]).toBe('Fecha último pago');
    expect(dinero[14]).toContain('Cliente encontrado');
    expect(dinero[23]).toContain('Debe de la cuota');
    expect(dinero[24]).toBe('Número de crédito');

    const articulo = encabezados(wb, 'Créditos de artículo');
    expect(articulo[9]).toBe('Total abonado');
    expect(articulo[10]).toBe('Fecha último pago');
    expect(articulo[14]).toContain('Cliente encontrado');
    expect(articulo[24]).toContain('Debe de la cuota');
    expect(articulo[25]).toBe('Número de crédito');
  }, 60000);

  it('no quedan huecos: ningún encabezado vacío dentro del rango usado', async () => {
    const { data } = await generarPlantillaClientesCreditos(base);
    const wb = await cargar(data);
    for (const hoja of ['Clientes', 'Créditos de dinero', 'Créditos de artículo']) {
      const h = encabezados(wb, hoja);
      const ultima = h.length - 1;
      for (let col = 1; col <= ultima; col++) {
        expect({ hoja, col, valor: h[col] }).toEqual({ hoja, col, valor: expect.any(String) });
        expect(h[col]).not.toBe('');
      }
    }
  }, 60000);

  it('la hoja de clientes conserva su automática al final', async () => {
    const { data } = await generarPlantillaClientesCreditos(base);
    const wb = await cargar(data);
    const h = encabezados(wb, 'Clientes');
    expect(h[2]).toBe('CC cliente*');
    expect(h[14]).toContain('Revisión de cédula');
  }, 60000);
});

describe('Plantilla de inventario', () => {
  it('se genera sin errores y trae su hoja', async () => {
    const { data, filename } = await generarPlantillaInventario();
    expect(data.length).toBeGreaterThan(0);
    expect(filename).toMatch(/\.xlsx$/);
    const wb = await cargar(data);
    expect(wb.worksheets.length).toBeGreaterThan(0);
  }, 60000);
});
