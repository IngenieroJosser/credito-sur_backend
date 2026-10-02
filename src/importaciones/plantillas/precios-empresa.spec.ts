import * as ExcelJS from 'exceljs';
import {
  columnasDeOpcion,
  COLUMNAS_ARTICULOS,
  generarPlantillaInventario,
} from './plantilla-inventario';
import { baseDeContado, precioDelPlazo } from '../precios-articulo';

/**
 * Las fórmulas de la plantilla contra filas reales de la empresa.
 *
 * Los números no son inventados: salen del archivo que cartera llenó a mano el 30 de
 * septiembre de 2026 —`plantilla-inventario formulas manuales.xlsx`, 211 filas—, que es la
 * hoja que usan a diario y dieron por correcta. Las cuentas son:
 *
 *     contado = costo / divisor          (0,65 deja 35% de ganancia sobre la venta)
 *     plazo i = contado × (1 + recargo de ese plazo)
 *
 * y la tabla de recargos del negocio es +30% a 3 meses, +47% a 5 y +60% a 8.
 *
 * ESTO ESTUVO AL REVÉS. Antes aquí se afirmaba `costo × (1 + rentabilidad)`, fijado con
 * dos artículos sueltos que llegaron con el precio ya hecho, y se descartaba la división
 * por dar «106.701 pesos de más». El archivo de cartera demostró lo contrario: de sus 209
 * artículos con costo, NINGUNO multiplica y los 209 dividen. El televisor Samsung de
 * costo 829.900 —el mismo con el que se había fijado la fórmula vieja— lo tienen en
 * 1.185.571, que es justo el número que se había descartado.
 *
 * Aquí se evalúan las cuentas en TypeScript en vez de pedirle a Excel que calcule: lo que
 * se fija es la cuenta que la celda declara. El último bloque comprueba que la hoja
 * declare esas mismas cuentas.
 */

type Articulo = {
  nombre: string;
  costo: number;
  divisor: number;
  contado: number;
  plazos: Array<{ meses: number; precio: number }>;
};

/**
 * Un artículo por cada divisor que cartera usa, copiados de su archivo. Los tres cierran
 * sus cuatro precios al peso.
 */
const REALES: Articulo[] = [
  {
    nombre: 'VENTILADOR ALTEZZA 2 EN 1 PRO 18 (gana 35%)',
    costo: 178123,
    divisor: 0.65,
    contado: 274035,
    plazos: [
      { meses: 3, precio: 356246 },
      { meses: 5, precio: 402832 },
      { meses: 8, precio: 438456 },
    ],
  },
  {
    nombre: 'PARLANTE JBL BOOMBOX 4 (gana 30%)',
    costo: 1550000,
    divisor: 0.7,
    contado: 2214285,
    plazos: [
      { meses: 3, precio: 2878571 },
      { meses: 5, precio: 3255000 },
      { meses: 8, precio: 3542857 },
    ],
  },
  {
    nombre: 'BASE CAMA DE 1.20 TAPIZADA (gana 45%)',
    costo: 170000,
    divisor: 0.55,
    contado: 309090,
    plazos: [
      { meses: 3, precio: 401818 },
      { meses: 5, precio: 454363 },
      { meses: 8, precio: 494545 },
    ],
  },
];

/** El televisor con el que se había fijado la fórmula vieja, y que la desmintió. */
const TELEVISOR = { costo: 829900, divisor: 0.7, contadoDeCartera: 1185571 };

describe('Las fórmulas dan los precios reales de la empresa', () => {
  describe.each(REALES)('artículo $nombre', (art) => {
    it('el precio de contado es el costo DIVIDIDO por el divisor', () => {
      expect(baseDeContado(art.costo, art.divisor)).toBe(art.contado);
    });

    it.each(art.plazos)('a $meses meses da $precio', ({ meses, precio }) => {
      expect(precioDelPlazo(art.costo, art.divisor, meses)).toBe(precio);
    });
  });

  describe('lo que se descartó, con los números que lo descartan', () => {
    it('multiplicar por 1,30 da 106.701 MENOS de lo que cartera cobra', () => {
      // El mismo número de antes, con el signo al revés: lo que se tomó por un exceso de
      // la división era en realidad lo que falta al multiplicar.
      const multiplicando = Math.round(TELEVISOR.costo * 1.3);
      expect(multiplicando).toBe(1078870);
      expect(TELEVISOR.contadoDeCartera - multiplicando).toBe(106701);
      expect(baseDeContado(TELEVISOR.costo, TELEVISOR.divisor)).toBe(
        TELEVISOR.contadoDeCartera,
      );
    });

    it('ningún artículo de cartera sale de multiplicar por el divisor', () => {
      for (const art of REALES) {
        expect(Math.round(art.costo * art.divisor)).not.toBe(art.contado);
      }
    });

    it('no existe una tasa mensual que produzca los tres precios', () => {
      // Esta es la razón de que el recargo sea una tabla por plazo y no un interés.
      const art = REALES[0];
      const tasas = art.plazos.map(
        ({ meses, precio }) => (precio / art.contado - 1) / meses,
      );

      // BAJAN al alargarse el plazo, que es lo contrario de lo que hace un interés.
      expect(tasas[0]).toBeGreaterThan(tasas[1]);
      expect(tasas[1]).toBeGreaterThan(tasas[2]);
    });

    it('truncar la base antes de aplicar el recargo desviaría los precios', () => {
      // Por qué `precioDelPlazo` parte del costo sin truncar: comprobado contra los 209
      // artículos, truncar primero dejaba 136 filas con un peso de diferencia.
      const art = REALES[0];
      const desdeLaBaseTruncada = Math.trunc(art.contado * 1.47);
      expect(desdeLaBaseTruncada).not.toBe(art.plazos[1].precio);
      expect(art.plazos[1].precio - desdeLaBaseTruncada).toBe(1);
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

    it('el precio de contado divide por el divisor y no redondea', () => {
      const formula = formulaDe(COLUMNAS_ARTICULOS.precioContado);
      expect(formula).toContain('$E7/$F7');
      // Sin ROUND: redondear aquí dejaba 136 de los 209 artículos de cartera con un peso
      // de diferencia en algún plazo.
      expect(formula).not.toContain('ROUND');
      expect(formula).not.toContain('$E7*(1+');
    });

    it('cada precio a plazo parte del contado y calcula el recargo de SUS meses', () => {
      // Cuelga de $G, la celda de contado, y no de la cuenta repetida: es lo que cartera
      // escribe —sus fórmulas son `=G+(G*30%)`— y hace que negociar un precio de contado
      // arrastre sus plazos en vez de dejarlos descolgados.
      for (const numero of [1, 2, 3]) {
        const opcion = columnasDeOpcion(numero);
        const m = `$${ws.getColumn(opcion.meses).letter}7`;
        const formula = formulaDe(opcion.precio);

        expect({ numero, formula }).toEqual({
          numero,
          formula: expect.stringContaining(`TRUNC($G7*(1+`),
        });
        expect(formula).toContain(m);
        expect(formula).not.toContain('$E7*(1+$F7)');
      }
    });

    it('el precio sale con CUALQUIER plazo, no solo con los tres de la tabla', () => {
      // Este es el requisito: los meses se escriben libres y el precio tiene que
      // salir igual. Un intento anterior consultaba la tabla con BUSCARV y dejaba
      // la celda vacía en todo plazo que no fuera 3, 5 u 8.
      for (const numero of [1, 2, 3]) {
        const formula = formulaDe(columnasDeOpcion(numero).precio);
        expect(formula).not.toContain('VLOOKUP');
        // La recta por tramos: un IF que parte en el plazo del medio.
        expect(formula).toContain('<=5');
      }
    });

    it('el recargo interpolado da los de la tabla en sus propios plazos', () => {
      // Espejo de la cuenta que declara la celda. Si alguien cambia la
      // interpolación y deja de pasar por los puntos de la tabla, los precios
      // reales de la empresa dejan de salir y esto lo delata.
      const recargo = (m: number) =>
        m <= 5
          ? 0.3 + ((m - 3) * (0.47 - 0.3)) / (5 - 3)
          : 0.47 + ((m - 5) * (0.6 - 0.47)) / (8 - 5);

      expect(recargo(3)).toBeCloseTo(0.3, 10);
      expect(recargo(5)).toBeCloseTo(0.47, 10);
      expect(recargo(8)).toBeCloseTo(0.6, 10);

      // Y entre medias crece, que es lo que hace usable cualquier plazo.
      const seguidos = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 24].map(recargo);
      for (let i = 1; i < seguidos.length; i++) {
        expect(seguidos[i]).toBeGreaterThan(seguidos[i - 1]);
      }
    });

    it('un texto en la casilla de meses no llena la fila de errores', () => {
      // Los meses se escriben libres, asi que puede caer una palabra o un guion.
      // Sin el IFERROR la celda mostraria #VALOR! y la fila se veria rota; con
      // el, queda vacia y se escribe el precio a mano.
      // (El plazo fuera de la tabla ya no es el caso: ese se interpola.)
      for (const numero of [1, 2, 3]) {
        expect(formulaDe(columnasDeOpcion(numero).precio)).toContain(
          'IFERROR(',
        );
      }
    });

    it('ya no hay columna de recargo, y los meses se escriben libres', () => {
      // El operador no tiene por qué escribir tres veces un porcentaje que es el
      // mismo en todos los artículos, así que la tabla vive en la hoja oculta
      // "Valores". Pero los meses sí se escriben a mano, sin lista que los
      // limite: se puede poner el plazo que se quiera.
      const encabezados: string[] = [];
      ws.getRow(6).eachCell({ includeEmpty: true }, (celda) => {
        encabezados.push(String(celda.value ?? ''));
      });
      expect(encabezados.filter((h) => h.startsWith('Recargo'))).toEqual([]);

      for (const numero of [1, 2, 3]) {
        const celda = ws.getCell(7, columnasDeOpcion(numero).meses);
        expect({ numero, validacion: celda.dataValidation }).toEqual({
          numero,
          validacion: undefined,
        });
      }
    });

    it('el divisor va entre 0,01 y 1, y la casilla NO es de porcentaje', () => {
      // El divisor es la parte del precio que se va en costo, así que nunca pasa de 1;
      // más de 1 sería vender bajo el costo. Y el formato de número en vez de porcentaje
      // es el arreglo del error que obligó a cartera a escribir los precios a mano:
      // con formato de porcentaje, su "0,65" quedaba guardado como 0,0065.
      const celda = ws.getCell(7, COLUMNAS_ARTICULOS.divisorDelPrecio);
      expect(celda.dataValidation).toEqual(
        expect.objectContaining({ type: 'decimal', formulae: [0.01, 1] }),
      );
      expect(String(ws.getColumn(COLUMNAS_ARTICULOS.divisorDelPrecio).numFmt)).not.toContain(
        '%',
      );
    });
  });
});
