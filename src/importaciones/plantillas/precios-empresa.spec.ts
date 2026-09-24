import * as ExcelJS from 'exceljs';
import {
  columnasDeOpcion,
  COLUMNAS_ARTICULOS,
  generarPlantillaInventario,
} from './plantilla-inventario';

/**
 * Las fórmulas de la plantilla contra filas reales de la empresa.
 *
 * Los números no son inventados: salen de la plantilla que la empresa usa hoy, y
 * por eso valen como prueba. La fórmula quedó descifrada con el segundo
 * artículo, que cierra los tres plazos al peso:
 *
 *     base    = costo × (1 + rentabilidad)     (rentabilidad SOBRE EL COSTO)
 *     plazo i = base × (1 + recargo de ese plazo)
 *
 * y la tabla de recargos del negocio es +30% a 3 meses, +47% a 5 y +60% a 8.
 *
 * Aquí se evalúan las cuentas en TypeScript en vez de pedirle a Excel que
 * calcule: lo que se fija es la cuenta que la celda declara. El último bloque
 * comprueba que la hoja declare esas mismas cuentas.
 */

type Articulo = {
  nombre: string;
  costo: number;
  rentabilidad: number;
  /** Lo que la empresa anota como precio de contado, redondeado o no. */
  contadoAnotado: number;
  plazos: Array<{ meses: number; recargo: number; precio: number }>;
};

/**
 * El artículo que cerró la fórmula. Sus tres plazos salen exactos, y además es
 * el que destapó de qué base se calculan: su contado anotado es 805.900 pero la
 * base es 805.870.
 */
const CONFIRMADO: Articulo = {
  nombre: 'costo 619.900',
  costo: 619900,
  rentabilidad: 0.3,
  contadoAnotado: 805900,
  plazos: [
    { meses: 3, recargo: 0.3, precio: 1047631 },
    { meses: 5, recargo: 0.47, precio: 1184629 },
    { meses: 8, recargo: 0.6, precio: 1289392 },
  ],
};

/**
 * El primer artículo que llegó. Su precio de 3 meses cierra, y los otros dos
 * llegaron con dígitos cambiados: a 5 meses la tabla da 1.585.939 y el dato
 * decía 1.585.393; a 8 meses da 1.726.192 y el dato decía 1.726.191. Se deja
 * aquí con los valores que la fórmula produce, porque el artículo confirmado
 * demostró que la fórmula es esta.
 */
const PRIMERO: Articulo = {
  nombre: 'costo 829.900',
  costo: 829900,
  rentabilidad: 0.3,
  contadoAnotado: 1078870,
  plazos: [
    { meses: 3, recargo: 0.3, precio: 1402531 },
    { meses: 5, recargo: 0.47, precio: 1585939 },
    { meses: 8, recargo: 0.6, precio: 1726192 },
  ],
};

/** Las dos cuentas de la plantilla, tal como las declaran sus celdas. */
const baseDeContado = (costo: number, rentabilidad: number) =>
  Math.round(costo * (1 + rentabilidad));
const precioDelPlazo = (costo: number, rentabilidad: number, recargo: number) =>
  Math.round(baseDeContado(costo, rentabilidad) * (1 + recargo));

describe('Las fórmulas dan los precios reales de la empresa', () => {
  describe.each([CONFIRMADO, PRIMERO])('artículo $nombre', (art) => {
    it('el precio de contado es el costo más la rentabilidad SOBRE EL COSTO', () => {
      expect(baseDeContado(art.costo, art.rentabilidad)).toBe(
        Math.round(art.costo * 1.3),
      );
    });

    it.each(art.plazos)(
      'a $meses meses con recargo $recargo da $precio',
      ({ recargo, precio }) => {
        expect(precioDelPlazo(art.costo, art.rentabilidad, recargo)).toBe(
          precio,
        );
      },
    );
  });

  it('la base de los plazos es el costo, NO el precio de contado anotado', () => {
    // Este es el hallazgo del artículo confirmado y lo que más fácil se rompe.
    // Su contado anotado es 805.900 —la base 805.870 subida a la centena— y si
    // los plazos salieran de ahí darían entre 39 y 48 pesos de más cada uno.
    const art = CONFIRMADO;
    expect(baseDeContado(art.costo, art.rentabilidad)).toBe(805870);
    expect(art.contadoAnotado).toBe(805900);

    const desdeElAnotado = art.plazos.map(
      ({ recargo, precio }) =>
        Math.round(art.contadoAnotado * (1 + recargo)) - precio,
    );
    expect(desdeElAnotado).toEqual([39, 44, 48]);
  });

  it('el redondeo del contado es a mano, no una regla de la plantilla', () => {
    // Si la plantilla redondeara sola a la centena, el primer artículo quedaría
    // en 1.078.900 y su contado anotado es 1.078.870. Los dos artículos no
    // coinciden, así que ese redondeo lo hace la persona.
    expect(baseDeContado(PRIMERO.costo, PRIMERO.rentabilidad)).toBe(
      PRIMERO.contadoAnotado,
    );
    expect(Math.round(805870 / 100) * 100).toBe(CONFIRMADO.contadoAnotado);
  });

  describe('lo que se descartó, con los números que lo descartan', () => {
    it('la convención sobre la VENTA daba 106.701 de más', () => {
      const sobreLaVenta = Math.round(PRIMERO.costo / (1 - 0.3));
      expect(sobreLaVenta).toBe(1185571);
      expect(sobreLaVenta - PRIMERO.contadoAnotado).toBe(106701);
    });

    it('no existe una tasa mensual que produzca los tres precios', () => {
      // Esta es la razón de que el recargo sea una columna y no un cálculo.
      const base = baseDeContado(CONFIRMADO.costo, CONFIRMADO.rentabilidad);
      const tasas = CONFIRMADO.plazos.map(
        ({ meses, precio }) => (precio / base - 1) / meses,
      );

      expect(tasas[0]).toBeCloseTo(0.1, 4);
      expect(tasas[1]).toBeCloseTo(0.094, 4);
      expect(tasas[2]).toBeCloseTo(0.075, 4);

      // Y lo que las descarta como interés: BAJAN al alargarse el plazo.
      expect(tasas[0]).toBeGreaterThan(tasas[1]);
      expect(tasas[1]).toBeGreaterThan(tasas[2]);
    });

    it('usar la rentabilidad como tasa mensual se pasaba por cientos de miles', () => {
      const base = baseDeContado(CONFIRMADO.costo, CONFIRMADO.rentabilidad);
      const desfases = CONFIRMADO.plazos.map(
        ({ meses, precio }) => Math.round(base * (1 + 0.3 * meses)) - precio,
      );
      expect(desfases).toEqual([483522, 830046, 1450566]);
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

    it('cada precio a plazo parte del costo y busca el recargo de SUS meses', () => {
      // Que no cuelgue de $G (la celda de contado, que se puede redondear a
      // mano) y que cada opción consulte la tabla con sus propios meses.
      for (const numero of [1, 2, 3]) {
        const opcion = columnasDeOpcion(numero);
        const letraMeses = ws.getColumn(opcion.meses).letter;
        const formula = formulaDe(opcion.precio);

        expect({ numero, formula }).toEqual({
          numero,
          formula: expect.stringContaining(
            `ROUND(ROUND($E7*(1+$F7),0)*(1+VLOOKUP($${letraMeses}7,` +
              `Valores!$C$2:$D$4,2,FALSE)),0)`,
          ),
        });
        expect({
          numero,
          cuelgaDelContado: formula.includes('$G7*(1+'),
        }).toEqual({ numero, cuelgaDelContado: false });
      }
    });

    it('un plazo fuera de la tabla deja el precio vacío, no un #N/D', () => {
      // El desplegable solo ofrece los plazos de la tabla, pero un valor pegado
      // desde otra parte llegaría igual. Sin el IFERROR, la celda mostraría
      // #N/D y la fila entera se vería rota.
      for (const numero of [1, 2, 3]) {
        expect(formulaDe(columnasDeOpcion(numero).precio)).toContain(
          'IFERROR(',
        );
      }
    });

    it('ya no hay columna de recargo: el plazo se elige de una lista', () => {
      // El operador no tiene por qué escribir tres veces un porcentaje que es el
      // mismo en todos los artículos. La tabla vive en la hoja oculta "Valores".
      const encabezados: string[] = [];
      ws.getRow(6).eachCell({ includeEmpty: true }, (celda) => {
        encabezados.push(String(celda.value ?? ''));
      });
      expect(encabezados.filter((h) => h.startsWith('Recargo'))).toEqual([]);

      for (const numero of [1, 2, 3]) {
        const celda = ws.getCell(7, columnasDeOpcion(numero).meses);
        expect({ numero, lista: celda.dataValidation?.formulae }).toEqual({
          numero,
          lista: ['Valores!$C$2:$C$4'],
        });
      }
    });

    it('la rentabilidad admite más del 99%, que era un tope de la fórmula vieja', () => {
      // Con `costo / (1 - r)` un 100% dividía por cero, de ahí el 0,99. Al
      // multiplicar ya no hay ninguna frontera ahí: remarcar al 120% es un
      // precio, no un error de dedo.
      const validacion = ws.getCell(
        7,
        COLUMNAS_ARTICULOS.rentabilidadObjetivo,
      ).dataValidation;
      expect(validacion).toEqual(
        expect.objectContaining({ type: 'decimal', formulae: [0, 3] }),
      );
    });
  });
});
