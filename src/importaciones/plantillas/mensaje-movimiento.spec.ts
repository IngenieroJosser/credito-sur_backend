import * as ExcelJS from 'exceljs';
import { generarPlantillaClientesCreditos } from './plantilla-clientes-creditos';
import { evaluarFormula, ValorCelda } from '../evaluador-formulas';

/**
 * La columna "Al confirmar" escribe una frase con el monto dentro.
 *
 * Se escapó un fallo real: la frase usaba TEXT con la máscara "$#,##0" escrita
 * dentro de la fórmula, y Excel interpreta esa máscara con los separadores del
 * idioma de quien abre el archivo. En configuración española la coma es el
 * separador DECIMAL, así que en vez de «$500.000» se leía «$500000,0».
 *
 * Pasó desapercibido porque el evaluador de las pruebas no conocía TEXT, de
 * modo que esta columna nunca se evaluaba. Ahora sí.
 */
describe('Mensaje de "Al confirmar"', () => {
  let hojaDinero: ExcelJS.Worksheet;
  let hojaArticulo: ExcelJS.Worksheet;

  beforeAll(async () => {
    const { data } = await generarPlantillaClientesCreditos({
      clientes: [],
      articulos: [],
      codigosArticulo: [],
      numerosPrestamo: [],
      rutas: [],
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(data as any);
    hojaDinero = workbook.getWorksheet('Créditos de dinero')!;
    hojaArticulo = workbook.getWorksheet('Créditos de artículo')!;
  });

  const columnasDe = (hoja: ExcelJS.Worksheet) => {
    const mapa: Record<string, string> = {};
    hoja.getRow(6).eachCell({ includeEmpty: false }, (celda, numero) => {
      const encabezado = typeof celda.value === 'string' ? celda.value : '';
      if (encabezado) mapa[encabezado] = hoja.getColumn(numero).letter;
    });
    return mapa;
  };

  const letraDe = (hoja: ExcelJS.Worksheet, empiezaPor: string) => {
    const columnas = columnasDe(hoja);
    const encabezado = Object.keys(columnas).find((h) =>
      h.startsWith(empiezaPor),
    );
    if (!encabezado) throw new Error(`No existe la columna "${empiezaPor}"`);
    return columnas[encabezado];
  };

  const formulaDe = (hoja: ExcelJS.Worksheet, empiezaPor: string) => {
    const letra = letraDe(hoja, empiezaPor);
    const columna = hoja.getColumn(letra).number;
    const formula = (hoja.getCell(7, columna).value as any)?.formula;
    if (!formula) throw new Error(`"${empiezaPor}" no tiene fórmula`);
    return String(formula);
  };

  it('escribe el monto con formato colombiano, no crudo ni con decimales', () => {
    const celdas: Record<string, ValorCelda> = {
      [`${letraDe(hojaDinero, 'Tipo carga')}7`]: 'OPERATIVA',
      [`${letraDe(hojaDinero, 'Monto')}7`]: 500000,
    };

    const mensaje = evaluarFormula(
      formulaDe(hojaDinero, 'Al confirmar'),
      celdas,
    );

    expect(mensaje).toBe(
      'Saldrán $500.000 de la Caja de Oficina, porque el crédito se entrega hoy',
    );
    // El fallo concreto que se corrigió, por si alguien vuelve a TEXT.
    expect(String(mensaje)).not.toContain('500000');
  });

  it('un crédito histórico no anuncia movimiento de caja', () => {
    const celdas: Record<string, ValorCelda> = {
      [`${letraDe(hojaDinero, 'Tipo carga')}7`]: 'HISTORICA',
      [`${letraDe(hojaDinero, 'Monto')}7`]: 500000,
    };

    expect(evaluarFormula(formulaDe(hojaDinero, 'Al confirmar'), celdas)).toBe(
      'No mueve caja: el crédito ya venía cobrándose',
    );
  });

  it('la cuota inicial del crédito de artículo también va formateada', () => {
    const celdas: Record<string, ValorCelda> = {
      [`${letraDe(hojaArticulo, 'Tipo carga')}7`]: 'OPERATIVA',
      [`${letraDe(hojaArticulo, 'Cuota inicial')}7`]: 1250000,
    };

    const mensaje = String(
      evaluarFormula(formulaDe(hojaArticulo, 'Al confirmar'), celdas),
    );

    expect(mensaje).toContain('Entran $1.250.000 de cuota inicial');
    expect(mensaje).not.toContain('1250000');
  });

  it('ninguna fórmula de la plantilla lleva una máscara numérica de TEXT', () => {
    // Una máscara escrita dentro de la fórmula ("$#,##0") la interpreta Excel
    // con los separadores del idioma del usuario: es la causa del fallo.
    // FIXED no lleva máscara y usa los del propio Excel.
    for (const hoja of [hojaDinero, hojaArticulo]) {
      const conMascara: string[] = [];
      hoja.getRow(7).eachCell({ includeEmpty: false }, (celda) => {
        const formula = (celda.value as any)?.formula;
        if (formula && /TEXT\s*\([^)]*"[^"]*[#0][^"]*"/.test(String(formula))) {
          conMascara.push(String(formula));
        }
      });
      expect({ hoja: hoja.name, conMascara }).toEqual({
        hoja: hoja.name,
        conMascara: [],
      });
    }
  });
});
