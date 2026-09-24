import * as ExcelJS from 'exceljs';
import {
  columnasDeOpcion,
  COLUMNAS_ARTICULOS,
  generarPlantillaInventario,
} from './plantilla-inventario';

/**
 * Las fórmulas de la plantilla contra una fila real de la empresa.
 *
 * Los números no son inventados: son los de la plantilla que la empresa usa
 * hoy, y por eso valen como prueba. Antes de tenerlos, esta plantilla calculaba
 * el precio de contado con `costo / (1 - rentabilidad)` —margen sobre la venta—
 * y con el mismo 30% daba 106.701 pesos de más. Y los precios a plazo salían de
 * una tasa mensual, que se pasaba por cientos de miles.
 *
 * Aquí se evalúan las fórmulas a mano, en TypeScript, en vez de pedirle a Excel
 * que las calcule: lo que se está fijando es la cuenta que la celda declara.
 */

/** La fila real: costo, rentabilidad y los precios que la empresa cobra. */
const REAL = {
  costo: 829900,
  rentabilidad: 0.3,
  contado: 1078870,
  plazos: [
    { meses: 3, recargo: 0.3, precio: 1402531 },
    // PENDIENTE DE CONFIRMAR: el dato que llegó decía 1.585.393, y la tabla del
    // 47% da 1.585.939 — los mismos tres dígitos en otro orden, 546 pesos de
    // diferencia. Si el precio real es 1.585.393, el recargo de ese plazo es
    // 46,9494% y no 47%. No cambia el diseño: el recargo es una casilla que se
    // escribe, así que sale el precio que se le pida. Solo cambia este ejemplo.
    { meses: 5, recargo: 0.47, precio: 1585939 },
    { meses: 8, recargo: 0.6, precio: 1726192 },
  ],
};

describe('Las fórmulas de la plantilla dan los precios reales de la empresa', () => {
  describe('el precio de contado va SOBRE EL COSTO', () => {
    it('costo 829.900 con 30% da 1.078.870', () => {
      expect(Math.round(REAL.costo * (1 + REAL.rentabilidad))).toBe(
        REAL.contado,
      );
    });

    it('la convención vieja, sobre la venta, daba 106.701 de más', () => {
      // Se deja escrito el número para que nadie vuelva a cambiar la fórmula
      // creyendo que las dos convenciones son lo mismo dicho de otra forma.
      const sobreLaVenta = Math.round(REAL.costo / (1 - REAL.rentabilidad));
      expect(sobreLaVenta).toBe(1185571);
      expect(sobreLaVenta - REAL.contado).toBe(106701);
    });

    it('para dar el precio real con la fórmula vieja habría que escribir 23,0769%', () => {
      const equivalente = (REAL.contado - REAL.costo) / REAL.contado;
      expect(equivalente).toBeCloseTo(0.230769, 6);
    });
  });

  describe('los precios a plazo salen del recargo, no de una tasa', () => {
    it.each(REAL.plazos)(
      'a $meses meses con recargo del $recargo da $precio',
      ({ recargo, precio }) => {
        expect(Math.round(REAL.contado * (1 + recargo))).toBe(precio);
      },
    );

    it('no existe una tasa mensual que produzca los tres precios', () => {
      // Esta es la razón de que el recargo sea una columna y no un cálculo.
      const tasas = REAL.plazos.map(
        ({ meses, precio }) => (precio / REAL.contado - 1) / meses,
      );

      expect(tasas[0]).toBeCloseTo(0.1, 4);
      expect(tasas[1]).toBeCloseTo(0.094, 4);
      expect(tasas[2]).toBeCloseTo(0.075, 4);

      // Y lo que las descarta como interés: BAJAN al alargarse el plazo.
      expect(tasas[0]).toBeGreaterThan(tasas[1]);
      expect(tasas[1]).toBeGreaterThan(tasas[2]);
    });

    it('la fórmula vieja, con la rentabilidad como tasa, se pasaba por cientos de miles', () => {
      const desfases = REAL.plazos.map(
        ({ meses, precio }) =>
          Math.round(REAL.contado * (1 + REAL.rentabilidad * meses)) - precio,
      );
      expect(desfases).toEqual([647322, 1111236, 1941966]);
    });
  });

  describe('la hoja declara esas mismas cuentas', () => {
    let ws: ExcelJS.Worksheet;

    beforeAll(async () => {
      const { data } = await generarPlantillaInventario();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(data as any);
      ws = wb.getWorksheet('Artículos')!;
    }, 60000);

    const formulaDe = (columna: number) =>
      String((ws.getCell(7, columna).value as any)?.formula ?? '');

    it('el precio de contado multiplica, no divide', () => {
      const formula = formulaDe(COLUMNAS_ARTICULOS.precioContado);
      expect(formula).toContain('ROUND($E7*(1+$F7),0)');
      expect(formula).not.toContain('/(1-');
    });

    it('cada precio a plazo usa el recargo de SU opción', () => {
      // Que la opción 2 no tome por error el recargo de la 1.
      for (const numero of [1, 2, 3]) {
        const opcion = columnasDeOpcion(numero);
        const letra = (c: number) => ws.getColumn(c).letter;
        expect({ numero, formula: formulaDe(opcion.precio) }).toEqual({
          numero,
          formula: expect.stringContaining(
            `ROUND($G7*(1+$${letra(opcion.recargo)}7),0)`,
          ),
        });
      }
    });

    it('el recargo es una casilla que se escribe, no una columna gris', () => {
      for (const numero of [1, 2, 3]) {
        const celda = ws.getCell(7, columnasDeOpcion(numero).recargo);
        expect({ numero, bloqueada: celda.protection?.locked }).toEqual({
          numero,
          bloqueada: false,
        });
        expect(formulaDe(columnasDeOpcion(numero).recargo)).toBe('');
      }
    });

    it('la rentabilidad admite más del 99%, que era un tope de la fórmula vieja', () => {
      // Con `costo / (1 - r)` un 100% dividía por cero, de ahí el 0,99. Al
      // multiplicar ya no hay ninguna frontera ahí: remarcar al 120% es un
      // precio, no un error de dedo.
      const columna = ws.getColumn(COLUMNAS_ARTICULOS.rentabilidadObjetivo);
      const validacion = ws.getCell(7, Number(columna.number)).dataValidation;
      expect(validacion).toEqual(
        expect.objectContaining({ type: 'decimal', formulae: [0, 3] }),
      );
    });
  });
});
