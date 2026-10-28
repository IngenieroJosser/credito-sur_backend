import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ExcelJS from 'exceljs';
import { InventarioParser } from './parsers/inventario.parser';
import { generarPlantillaInventario } from './plantillas/plantilla-inventario';
import { baseDeContado, precioDelPlazo } from './precios-articulo';
import { PrismaService } from '../prisma/prisma.service';

/**
 * La regla de precios contra el catálogo COMPLETO de cartera.
 *
 * Por qué existe este archivo: la fórmula del precio se cambió entera —de multiplicar por
 * la rentabilidad a dividir por el divisor— y lo único que la respaldaba eran tres
 * artículos escritos a mano en otro spec. Tres artículos no son una red: la fórmula
 * anterior también cuadraba con los dos que tenía, y resultó estar equivocada en los 209.
 *
 * El fixture son los 209 artículos de `plantilla-inventario formulas manuales.xlsx`, la
 * hoja que cartera llenó el 30 de septiembre de 2026 y dio por correcta. Solo van los
 * números —costo, divisor y los cuatro precios—: los nombres comerciales no tienen por qué
 * entrar al repositorio.
 *
 * Lo que NO prueba, y conviene decirlo: que esos precios sean los que el negocio quiere
 * cobrar. Eso lo decidió cartera. Aquí se fija que el sistema reproduzca los suyos.
 */

type ArticuloDeCartera = {
  costo: number;
  divisor: number;
  contado: number;
  plazos: Array<{ meses: number; precio: number }>;
};

// Se lee del disco en vez de importarlo: `resolveJsonModule` no está activado en el
// tsconfig del proyecto, y encenderlo por una prueba cambia cómo compila todo lo demás.
const ARTICULOS = JSON.parse(
  readFileSync(
    join(__dirname, '__fixtures__', 'precios-cartera.json'),
    'utf8',
  ),
) as ArticuloDeCartera[];

/**
 * Cuánto se admite de diferencia, y por qué no es cero.
 *
 * Doce de los 833 precios salen un peso por encima del que cartera tiene, y es ruido de
 * coma flotante, no de la fórmula: 220.000/0,55 da 399.999,999…, que Excel trunca a
 * 399.999 y la cuenta exacta deja en 400.000. La propia hoja de cartera lo calcula de
 * forma inconsistente entre filas. Un peso se tolera; dos ya serían otra fórmula.
 */
const TOLERANCIA_EN_PESOS = 1;

/** Mínimo de precios que deben salir CLAVADOS, para que una regresión real se note. */
const MINIMO_EXACTOS = 0.95;

describe('La regla de precios contra el catálogo de cartera', () => {
  it('el fixture trae los 209 artículos, con sus tres divisores', () => {
    // Si alguien regenera el fixture y se queda corto, el resto de pruebas pasaría
    // comprobando cuatro filas y nadie se enteraría.
    expect(ARTICULOS.length).toBe(209);
    const divisores = [...new Set(ARTICULOS.map((a) => a.divisor))].sort();
    expect(divisores).toEqual([0.55, 0.65, 0.7]);
  });

  it('ningún precio del catálogo se desvía más de un peso', () => {
    const desviados: string[] = [];

    for (const art of ARTICULOS) {
      const contado = baseDeContado(art.costo, art.divisor);
      if (Math.abs(contado - art.contado) > TOLERANCIA_EN_PESOS) {
        desviados.push(
          `costo ${art.costo} /${art.divisor} contado: cartera ${art.contado}, sistema ${contado}`,
        );
      }

      for (const plazo of art.plazos) {
        const precio = precioDelPlazo(art.costo, art.divisor, plazo.meses);
        if (Math.abs(precio - plazo.precio) > TOLERANCIA_EN_PESOS) {
          desviados.push(
            `costo ${art.costo} /${art.divisor} a ${plazo.meses}m: cartera ${plazo.precio}, sistema ${precio}`,
          );
        }
      }
    }

    expect(desviados).toEqual([]);
  });

  it('al menos el 95% de los precios salen clavados, sin tolerancia', () => {
    let exactos = 0;
    let total = 0;

    for (const art of ARTICULOS) {
      total += 1;
      if (baseDeContado(art.costo, art.divisor) === art.contado) exactos += 1;
      for (const plazo of art.plazos) {
        total += 1;
        if (precioDelPlazo(art.costo, art.divisor, plazo.meses) === plazo.precio) {
          exactos += 1;
        }
      }
    }

    // Medido al escribirlo: 821 de 833, el 98,6%. El umbral va en 95% para que no falle
    // por un artículo nuevo con centavos, pero sí si alguien cambia la fórmula.
    expect({ exactos, total, proporcion: exactos / total }).toEqual(
      expect.objectContaining({ total: 833 }),
    );
    expect(exactos / total).toBeGreaterThanOrEqual(MINIMO_EXACTOS);
  });

  it('la cuenta vieja —multiplicar— fallaba en TODO el catálogo', () => {
    // La prueba que no existía cuando se eligió multiplicar. Con ella, el error se habría
    // visto el primer día en vez de a los seis días y en un archivo suelto.
    const aciertos = ARTICULOS.filter(
      (art) =>
        Math.abs(Math.round(art.costo * (1 + (1 - art.divisor))) - art.contado) <= 1,
    ).length;

    expect(aciertos).toBe(0);
  });
});

/**
 * La cadena completa: plantilla → archivo → importador.
 *
 * Las pruebas de arriba comprueban la regla en TypeScript. Estas comprueban que lo que
 * llega al sistema desde un archivo de Excel es ese mismo número, que es donde se pierden
 * las cosas: un encabezado que no coincide, un formato de celda, un truncado de más.
 */
describe('De la plantilla al importador, con precios de cartera', () => {
  // Lo único que el parser consulta es el catálogo existente, para avisar de códigos
  // repetidos. Vacío: aquí lo que se mide son los precios, no los duplicados.
  const prismaFalso = () =>
    ({
      producto: { findMany: jest.fn().mockResolvedValue([]) },
    }) as unknown as PrismaService;

  /** Rellena la plantilla real con artículos y la pasa por el importador. */
  const importar = async (
    filas: Array<Record<string, string | number>>,
    editarEncabezados?: (hoja: ExcelJS.Worksheet) => void,
  ) => {
    const { data } = await generarPlantillaInventario();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(data as never);
    const hoja = wb.getWorksheet('Artículos')!;

    if (editarEncabezados) editarEncabezados(hoja);

    const columnas = new Map<string, number>();
    hoja.getRow(6).eachCell({ includeEmpty: false }, (celda, numero) => {
      columnas.set(
        String(celda.value ?? '')
          .replace(/\*/g, '')
          .trim()
          .toUpperCase(),
        numero,
      );
    });

    filas.forEach((fila, indice) => {
      for (const [encabezado, valor] of Object.entries(fila)) {
        const columna = columnas.get(encabezado.toUpperCase());
        if (!columna) throw new Error(`La hoja no tiene la columna "${encabezado}"`);
        hoja.getCell(7 + indice, columna).value = valor;
      }
    });

    const buffer = await wb.xlsx.writeBuffer();
    return new InventarioParser(prismaFalso()).parseAndValidate(
      Buffer.from(buffer),
      'inventario.xlsx',
    );
  };

  /**
   * Los precios van vacíos a propósito: ExcelJS no evalúa fórmulas, así que una celda con
   * fórmula llega sin resultado. Ese es justo el camino que rehace el importador con la
   * regla del sistema, y lo que se comprueba es que rehaga el precio de cartera.
   */
  it('con el costo y el divisor, el importador rehace los precios de cartera', async () => {
    const muestra = ARTICULOS.filter((a) => a.plazos.length === 3).slice(0, 25);

    const resultado = await importar(
      muestra.map((art, i) => ({
        Acción: 'CREAR',
        Código: `ART-${i}`,
        'Nombre del artículo': `Artículo ${i}`,
        Categoría: 'General',
        'Costo unitario': art.costo,
        'Divisor del precio': art.divisor,
        'Meses opción 1': art.plazos[0].meses,
        'Meses opción 2': art.plazos[1].meses,
        'Meses opción 3': art.plazos[2].meses,
      })),
    );

    expect(resultado.errores).toEqual([]);
    expect(resultado.articulos).toHaveLength(muestra.length);

    // Los precios NO viajan dentro del artículo: el parser los devuelve en una lista
    // aparte, enlazados por `codigoProducto`, con el contado como el plazo de 0 meses.
    const precioDe = (codigo: string, meses: number): number | undefined =>
      resultado.precios?.find(
        (p: any) => p.codigoProducto === codigo && p.meses === meses,
      )?.precio;

    const desviados: string[] = [];
    muestra.forEach((art, i) => {
      const codigo = `ART-${i}`;
      const esperados = [{ meses: 0, precio: art.contado }, ...art.plazos];
      for (const { meses, precio } of esperados) {
        const real = precioDe(codigo, meses);
        if (real === undefined || Math.abs(real - precio) > TOLERANCIA_EN_PESOS) {
          desviados.push(
            `${codigo} a ${meses}m: cartera ${precio}, importado ${String(real)}`,
          );
        }
      }
    });

    expect(desviados).toEqual([]);
  }, 120000);

  /**
   * Las plantillas ya descargadas siguen sirviendo.
   *
   * La columna se llamaba "Rentabilidad deseada" y pasó a "Divisor del precio". Quien
   * tenga el archivo viejo a medio llenar no debería tener que empezar de nuevo, y el
   * importador acepta los dos encabezados. Esta prueba es la que avisa si alguien quita
   * ese alias.
   */
  it('acepta el encabezado anterior, "Rentabilidad deseada"', async () => {
    const art = ARTICULOS[0];

    const resultado = await importar(
      [
        {
          Acción: 'CREAR',
          Código: 'VIEJO-1',
          'Nombre del artículo': 'Artículo de plantilla vieja',
          Categoría: 'General',
          'Costo unitario': art.costo,
          'Rentabilidad deseada': art.divisor,
        },
      ],
      (hoja) => {
        const fila = hoja.getRow(6);
        fila.eachCell({ includeEmpty: false }, (celda) => {
          if (String(celda.value ?? '').startsWith('Divisor del precio')) {
            celda.value = 'Rentabilidad deseada';
          }
        });
      },
    );

    expect(resultado.errores).toEqual([]);
    const contado = resultado.precios?.find(
      (p: any) => p.codigoProducto === 'VIEJO-1' && p.meses === 0,
    )?.precio;
    expect(contado).toBeDefined();
    expect(Math.abs((contado as number) - art.contado)).toBeLessThanOrEqual(
      TOLERANCIA_EN_PESOS,
    );
  }, 120000);
});
