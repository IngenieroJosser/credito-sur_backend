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
    {
      codigo: 'ART1',
      nombre: 'Nevera',
      meses: 12,
      precio: 1000,
      costo: 700,
      stock: 5,
    },
  ],
  codigosArticulo: ['ART1'],
  numerosPrestamo: [],
  rutas: ['R1'],
};

const COMBINACIONES: Array<{
  nombre: string;
  datos: DatosReferenciaPlantilla;
}> = [
  {
    nombre: 'base (1 cliente, 1 artículo, 1 ruta)',
    datos: base,
  },
  {
    nombre: 'todo vacío (instalación nueva)',
    datos: {
      clientes: [],
      articulos: [],
      codigosArticulo: [],
      numerosPrestamo: [],
      rutas: [],
    },
  },
  {
    nombre: 'artículo con varios plazos',
    datos: {
      ...base,
      articulos: [
        {
          codigo: 'ART1',
          nombre: 'Nevera',
          meses: 3,
          precio: 400,
          costo: 300,
          stock: 2,
        },
        {
          codigo: 'ART1',
          nombre: 'Nevera',
          meses: 6,
          precio: 700,
          costo: 300,
          stock: 2,
        },
        {
          codigo: 'ART1',
          nombre: 'Nevera',
          meses: 12,
          precio: 1200,
          costo: 300,
          stock: 2,
        },
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
        { dni: '999', nombre: 'Ñandú O\'Brien "El Grande"' },
        { dni: '998', nombre: 'María José Gutiérrez' },
      ],
      articulos: [
        {
          codigo: 'A-Ñ1',
          nombre: 'Televisor 50" Ultra',
          meses: 6,
          precio: 900,
          costo: 600,
          stock: 1,
        },
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
    out[col] = typeof celda.value === 'string' ? celda.value.trim() : '';
  });
  return out;
};

describe('Plantilla de clientes y créditos: estructura con varias combinaciones', () => {
  it.each(COMBINACIONES)(
    'se genera sin errores: $nombre',
    async ({ datos }) => {
      const { data, filename } = await generarPlantillaClientesCreditos(datos);
      expect(data.length).toBeGreaterThan(0);
      expect(filename).toMatch(/\.xlsx$/);

      const wb = await cargar(data);
      for (const hoja of [
        'Clientes',
        'Créditos de dinero',
        'Créditos de artículo',
      ]) {
        expect(wb.getWorksheet(hoja)).toBeDefined();
      }
    },
    60000,
  );

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
    for (const hoja of [
      'Clientes',
      'Créditos de dinero',
      'Créditos de artículo',
    ]) {
      const h = encabezados(wb, hoja);
      const ultima = h.length - 1;
      for (let col = 1; col <= ultima; col++) {
        expect({ hoja, col, valor: h[col] }).toEqual({
          hoja,
          col,
          valor: expect.any(String),
        });
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

  it('ofrece tres plazos y no un cuarto', async () => {
    const h = encabezados(
      await cargar((await generarPlantillaInventario()).data),
      'Artículos',
    );

    expect(h).toContain('Meses opción 3');
    expect(h).toContain('Precio total opción 3');
    expect(h).not.toContain('Meses opción 4');
  }, 60000);

  it('el precio de contado LO TRAE la fórmula, no una columna gris aparte', async () => {
    // Antes había una columna gris "Precio sugerido" al final: quien llenaba la
    // hoja tenía que mirarla y copiar el número a mano en "Precio contado".
    // Ahora la fórmula vive dentro de la columna que de verdad se importa.
    const { data } = await generarPlantillaInventario();
    const wb = await cargar(data);
    const ws = wb.getWorksheet('Artículos')!;
    const h = encabezados(wb, 'Artículos');

    expect(h).not.toContain('Precio sugerido (automático)');
    expect(h[5]).toBe('Costo unitario*');
    expect(h[6]).toBe('Rentabilidad deseada');
    expect(h[7]).toBe('Precio contado*');

    expect(ws.getCell('F7').dataValidation).toEqual(
      expect.objectContaining({ type: 'decimal', formulae: [0, 0.99] }),
    );
    expect(
      (ws.getCell('G7').value as ExcelJS.CellFormulaValue).formula,
    ).toContain('$E7/(1-$F7)');
  }, 60000);

  it('los tres precios a crédito salen del de contado con interés simple', async () => {
    // Un crédito de artículo se crea con tasaInteres 0: el precio de la opción
    // es el único sitio donde vive el costo de financiar. Por eso la fórmula
    // multiplica la tasa por los meses -interés simple-, igual que
    // `capital * tasa * meses / 100` en el cálculo del sistema. Con interés
    // compuesto, el precio del artículo y el interés del sistema quedarían en
    // dos convenciones distintas.
    const { data } = await generarPlantillaInventario();
    const wb = await cargar(data);
    const ws = wb.getWorksheet('Artículos')!;
    const h = encabezados(wb, 'Artículos');

    expect(h[8]).toBe('Tasa mensual crédito');
    expect(h[9]).toBe('Meses opción 1');
    expect(h[10]).toBe('Precio total opción 1');

    // $G = precio de contado, $H = tasa mensual, $I = meses de la opción 1.
    const opcion1 = (ws.getCell('J7').value as ExcelJS.CellFormulaValue)
      .formula;
    expect(opcion1).toContain('ROUND($G7*(1+$H7*$I7),0)');

    // La opción 3 usa sus propios meses ($M) y la misma tasa y contado.
    const opcion3 = (ws.getCell('N7').value as ExcelJS.CellFormulaValue)
      .formula;
    expect(opcion3).toContain('ROUND($G7*(1+$H7*$M7),0)');
  }, 60000);

  it('los precios vienen resueltos pero SIN candado: son una sugerencia', async () => {
    // Si quedaran bloqueados como las columnas grises de utilidad, el precio
    // que de verdad cobra el negocio no se podría escribir, y la plantilla
    // pasaría de ayudar a estorbar.
    const { data } = await generarPlantillaInventario();
    const wb = await cargar(data);
    const ws = wb.getWorksheet('Artículos')!;

    for (const celda of ['G7', 'J7', 'L7', 'N7', 'G1006']) {
      expect({
        celda,
        bloqueada: ws.getCell(celda).protection?.locked,
      }).toEqual({ celda, bloqueada: false });
    }
    // Las de utilidad sí van bloqueadas: ahí no hay nada que decidir.
    expect(ws.getCell('V7').protection?.locked).not.toBe(false);
  }, 60000);

  it('la revisión distingue "falta la rentabilidad" de "falta la tasa"', async () => {
    // Las dos situaciones dejan celdas vacías que se ven idénticas. Sin este
    // aviso, quien escriba los meses y olvide la tasa lee "sin opciones de
    // crédito", que es justo lo contrario de lo que quiso hacer.
    const { data } = await generarPlantillaInventario();
    const wb = await cargar(data);
    const ws = wb.getWorksheet('Artículos')!;
    const h = encabezados(wb, 'Artículos');

    expect(h[21]).toContain('Revisión de la fila');
    const revision = (ws.getCell('U7').value as ExcelJS.CellFormulaValue)
      .formula;

    expect(revision).toContain('escriba la rentabilidad deseada');
    expect(revision).toContain('falta la tasa mensual');
    expect(revision).toContain('Hay plazos que dan pérdida');
  }, 60000);
});
