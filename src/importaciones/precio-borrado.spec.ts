import * as ExcelJS from 'exceljs';
import { InventarioParser } from './parsers/inventario.parser';
import { generarPlantillaInventario } from './plantillas/plantilla-inventario';
import {
  baseDeContado,
  precioDelPlazo,
  recargoDelPlazo,
  PLAZOS,
} from './precios-articulo';

/**
 * Borrar un precio de la plantilla ya no rompe la fila.
 *
 * El caso que lo motivó, tal como lo contó el usuario: borra el precio de
 * contado, vuelve a escribir el costo unitario y la rentabilidad, y en el precio
 * de contado no aparece nada. No es un fallo de la plantilla: en Excel una celda
 * guarda o una fórmula o un valor, así que al borrar el contenido se va la
 * fórmula de esa fila y no vuelve sola. No hay forma de evitarlo en la hoja.
 *
 * Lo que sí se puede es que deje de importar al importar: el archivo llega con la
 * casilla vacía y el importador la rellena con la misma regla que usa la
 * plantilla, avisando de que lo hizo. Antes la fila fallaba entera con un "el
 * precio es requerido" aunque el costo y la rentabilidad estuvieran al lado.
 */

const FILA_DATOS = 7;

const prismaMock = () =>
  ({
    producto: { findMany: jest.fn().mockResolvedValue([]) },
    precioProducto: { findMany: jest.fn().mockResolvedValue([]) },
  }) as any;

/** Escribe una fila localizando las columnas por el nombre del encabezado. */
const escribirFila = (
  hoja: ExcelJS.Worksheet,
  valores: Record<string, unknown>,
) => {
  const columnas = new Map<string, number>();
  hoja.getRow(6).eachCell({ includeEmpty: false }, (celda, numero) => {
    const clave = String(celda.value ?? '')
      .replace(/\*/g, '')
      .trim()
      .toUpperCase();
    if (clave && !columnas.has(clave)) columnas.set(clave, numero);
  });

  for (const [encabezado, valor] of Object.entries(valores)) {
    const columna = columnas.get(encabezado.toUpperCase());
    if (!columna)
      throw new Error(`La hoja no tiene la columna "${encabezado}"`);
    hoja.getCell(FILA_DATOS, columna).value = valor as any;
  }
};

/**
 * Deja la celda como la deja Excel al borrarla: sin valor y sin fórmula. Es el
 * punto del que parte todo esto, así que se hace de verdad y no se simula.
 */
const borrarCelda = (hoja: ExcelJS.Worksheet, encabezado: string) => {
  let columna = 0;
  hoja.getRow(6).eachCell({ includeEmpty: false }, (celda, numero) => {
    const clave = String(celda.value ?? '')
      .replace(/\*/g, '')
      .trim()
      .toUpperCase();
    if (clave === encabezado.toUpperCase() && !columna) columna = numero;
  });
  expect(columna).toBeGreaterThan(0);
  hoja.getCell(FILA_DATOS, columna).value = null;
};

const COSTO = 619900;
const RENTABILIDAD = 0.3;

/** Genera la plantilla, la edita y la pasa por el parser. */
const validar = async (
  editar: (hoja: ExcelJS.Worksheet) => void,
): Promise<any> => {
  const plantilla = await generarPlantillaInventario();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(plantilla.data as any);
  const hoja = wb.getWorksheet('Artículos')!;

  escribirFila(hoja, {
    Acción: 'CREAR',
    Código: 'NEV-1',
    'Nombre del artículo': 'Nevera',
    Categoría: 'Electrodomésticos',
    'Costo unitario': COSTO,
    'Rentabilidad deseada': RENTABILIDAD,
    'Meses opción 1': 3,
  });
  editar(hoja);

  const buffer = await wb.xlsx.writeBuffer();
  return new InventarioParser(prismaMock()).parseAndValidate(
    Buffer.from(buffer),
    'inventario.xlsx',
  );
};

describe('Un precio borrado se rehace al importar', () => {
  it('con el precio de contado borrado, la fila entra y el precio se calcula', async () => {
    const resultado = await validar((hoja) => {
      borrarCelda(hoja, 'Precio contado');
      borrarCelda(hoja, 'Precio total opción 1');
    });

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.articulos?.[0]).toEqual(
      expect.objectContaining({
        codigo: 'NEV-1',
        precioContado: baseDeContado(COSTO, RENTABILIDAD),
      }),
    );
  }, 60000);

  it('avisa de que lo calculó, en vez de rellenarlo en silencio', async () => {
    const resultado = await validar((hoja) => {
      borrarCelda(hoja, 'Precio contado');
      borrarCelda(hoja, 'Precio total opción 1');
    });

    const mensajes = (resultado.advertencias ?? []).map(
      (a: any) => `${a.campo}: ${a.mensaje}`,
    );
    expect(mensajes.join(' | ')).toContain('precio_contado');
    expect(mensajes.join(' | ')).toContain('se calculó desde el costo');
  }, 60000);

  it('el precio del plazo borrado se rehace con el recargo de sus meses', async () => {
    const resultado = await validar((hoja) => {
      borrarCelda(hoja, 'Precio total opción 1');
    });

    expect(resultado.errores).toHaveLength(0);
    const precios = (resultado.precios ?? []).filter(
      (p: any) => Number(p.meses) === 3,
    );
    expect(precios).toHaveLength(1);
    expect(Number(precios[0].precio)).toBe(
      precioDelPlazo(COSTO, RENTABILIDAD, 3),
    );
  }, 60000);

  it('sin rentabilidad no se puede rehacer, y el precio sigue siendo requerido', async () => {
    // El costo solo no alcanza: sin el porcentaje no hay de dónde sacar el
    // precio, así que la fila tiene que seguir avisando en vez de inventar uno.
    const resultado = await validar((hoja) => {
      borrarCelda(hoja, 'Rentabilidad deseada');
      borrarCelda(hoja, 'Precio contado');
      borrarCelda(hoja, 'Precio total opción 1');
    });

    const campos = resultado.errores.map((e: any) => e.campo);
    expect(campos).toContain('precio_contado');
  }, 60000);
});

describe('La regla de precios es la misma en la plantilla y en el importador', () => {
  it('el recargo pasa exacto por los plazos de la tabla', () => {
    for (const { meses, recargo } of PLAZOS) {
      expect(recargoDelPlazo(meses)).toBeCloseTo(recargo, 10);
    }
  });

  it('reproduce los precios reales de la empresa', () => {
    // Artículo medido: costo 619.900 al 30%, base 805.870.
    expect(baseDeContado(619900, 0.3)).toBe(805870);
    expect(precioDelPlazo(619900, 0.3, 3)).toBe(1047631);
    expect(precioDelPlazo(619900, 0.3, 5)).toBe(1184629);
    expect(precioDelPlazo(619900, 0.3, 8)).toBe(1289392);
  });

  it('da precio con cualquier plazo, y siempre creciente', () => {
    const precios = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 24].map((m) =>
      precioDelPlazo(619900, 0.3, m),
    );
    for (let i = 1; i < precios.length; i++) {
      expect(precios[i]).toBeGreaterThan(precios[i - 1]);
    }
  });
});
