/**
 * Genera `plantilla-inventario 11111.xlsx` con la plantilla REAL de produccion.
 *
 * No imita el layout: llama a `generarPlantillaInventario()`, que es la misma
 * funcion que sirve el modulo de importaciones, y sobre esa hoja escribe los
 * articulos con `escribirFilaArticulo()`, que es la misma que usa la
 * exportacion compatible con importacion. Asi las 28 columnas, sus formulas,
 * formatos, validaciones, agrupaciones y hojas auxiliares son las de
 * produccion por construccion, no por parecido.
 *
 * Entrada:  articulos.json  (lo escribe extraer.py desde el archivo actual)
 * Salida:   el .xlsx que se le indique como segundo argumento
 */
import * as ExcelJS from 'exceljs';
import { readFileSync, writeFileSync } from 'fs';
import {
  escribirFilaArticulo,
  generarPlantillaInventario,
} from '../src/importaciones/plantillas/plantilla-inventario';

const FILA_INICIO_DATOS = 7;
const FILAS_PREPARADAS = 1000;
const COL_COSTO = 5;
const COL_RENTABILIDAD = 6;

interface ArticuloEntrada {
  codigo: string;
  nombre: string;
  categoria: string;
  marca: string;
  modelo: string;
  descripcion: string;
  costo: number;
  stock: number;
  stockMinimo: number;
  activo: boolean;
}

interface PrecioEntrada {
  codigoProducto: string;
  meses: number;
  precio: number;
}

async function main() {
  const [rutaJson, rutaSalida] = process.argv.slice(2);
  if (!rutaJson || !rutaSalida) {
    throw new Error('Uso: ts-node generar-inventario-produccion.ts <json> <salida.xlsx>');
  }

  const entrada = JSON.parse(readFileSync(rutaJson, 'utf8')) as {
    articulos: ArticuloEntrada[];
    precios: PrecioEntrada[];
  };

  // Los precios de cada articulo, el de contado aparte de los plazos.
  const porCodigo = new Map<string, PrecioEntrada[]>();
  entrada.precios.forEach((p) => {
    const lista = porCodigo.get(p.codigoProducto) ?? [];
    lista.push(p);
    porCodigo.set(p.codigoProducto, lista);
  });

  const plantilla = await generarPlantillaInventario();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(plantilla.data);
  const ws = workbook.getWorksheet('Artículos');
  if (!ws) throw new Error('La plantilla de produccion no trae la hoja "Artículos"');

  let conContado = 0;
  entrada.articulos.forEach((articulo, indice) => {
    const lista = (porCodigo.get(articulo.codigo) ?? []).sort(
      (a, b) => a.meses - b.meses,
    );
    const contado = lista.find((p) => p.meses === 0);
    if (contado) conContado++;

    escribirFilaArticulo(ws, FILA_INICIO_DATOS + indice, {
      codigo: articulo.codigo,
      nombre: articulo.nombre,
      descripcion: articulo.descripcion,
      categoria: articulo.categoria,
      marca: articulo.marca,
      modelo: articulo.modelo,
      costo: articulo.costo,
      precioContado: contado ? contado.precio : null,
      stock: articulo.stock,
      stockMinimo: articulo.stockMinimo,
      activo: articulo.activo,
      opciones: lista
        .filter((p) => p.meses > 0)
        .map((p) => ({ meses: p.meses, precio: p.precio })),
    });
  });

  // La rentabilidad, en la convencion de la plantilla: sobre el COSTO.
  //
  // `escribirFilaArticulo` la escribe como (contado - costo) / contado, que es
  // margen sobre la VENTA, mientras que la formula de la propia plantilla calcula
  // el contado como ROUND(costo * (1 + rentabilidad), 0), que es sobre el COSTO.
  // Las dos convenciones dan el mismo precio con numeros distintos: para un costo
  // de 178.123 y un contado de 275.000 son 35,23% sobre la venta y 54,39% sobre el
  // costo. Dejarlas mezcladas hace que la columna signifique una cosa en las filas
  // que ya traen precio y otra en las que hay que llenar a mano.
  //
  // Se escribe la del costo, que es la que la formula sabe leer, y se comprueba
  // que reproduzca el precio al peso.
  let descuadre = 0;
  entrada.articulos.forEach((articulo, indice) => {
    const fila = FILA_INICIO_DATOS + indice;
    const contado = (porCodigo.get(articulo.codigo) ?? []).find(
      (p) => p.meses === 0,
    );
    if (!contado || articulo.costo <= 0) return;

    const rentabilidad = contado.precio / articulo.costo - 1;
    ws.getRow(fila).getCell(COL_RENTABILIDAD).value = rentabilidad;
    if (Math.round(articulo.costo * (1 + rentabilidad)) !== contado.precio) {
      descuadre++;
    }
  });

  // `escribirFilaArticulo` escribe el costo siempre, y para los articulos que
  // todavia no lo tienen el JSON trae 0. Un costo de 0 no es "falta el costo":
  // haria que la columna de Revision diera OK y que la utilidad saliera del 100%.
  // Se deja la celda vacia, que es lo que esa columna sabe avisar.
  let sinCosto = 0;
  entrada.articulos.forEach((articulo, indice) => {
    if (articulo.costo > 0) return;
    ws.getRow(FILA_INICIO_DATOS + indice).getCell(COL_COSTO).value = null;
    sinCosto++;
  });

  // Al cargar el archivo, ExcelJS expande cada validacion a una entrada por
  // celda (~2.900) y al guardarlo las reagrupa en dos rangos solapados, que no
  // es lo que produccion emite. Se vuelven a declarar los tres rangos tal cual.
  const validaciones = ws as unknown as {
    dataValidations: {
      model: Record<string, unknown>;
      add: (rango: string, regla: unknown) => void;
    };
  };
  validaciones.dataValidations.model = {};
  const lista = (origen: string) => ({
    type: 'list',
    allowBlank: true,
    formulae: [origen],
  });
  validaciones.dataValidations.add(`A${FILA_INICIO_DATOS}:A${FILAS_PREPARADAS + 6}`, lista('Valores!$A$2:$A$3'));
  validaciones.dataValidations.add(`S${FILA_INICIO_DATOS}:S${FILAS_PREPARADAS + 6}`, lista('Valores!$B$2:$B$3'));
  validaciones.dataValidations.add(`F${FILA_INICIO_DATOS}:F${FILAS_PREPARADAS}`, {
    type: 'decimal',
    operator: 'between',
    allowBlank: true,
    formulae: [0, 0.99],
    showErrorMessage: true,
    errorTitle: 'Rentabilidad no válida',
    error: 'Escriba un porcentaje entre 0% y 99%.',
  });

  writeFileSync(rutaSalida, Buffer.from(await workbook.xlsx.writeBuffer()));

  console.log('Generado con la plantilla de produccion: %s', rutaSalida);
  console.log('  articulos escritos:        %d', entrada.articulos.length);
  console.log('  con precio de contado:     %d', conContado);
  console.log('  sin costo (celda en blanco): %d', sinCosto);
  console.log('  rentabilidad que NO reproduce el precio: %d', descuadre);
  console.log('  ultima columna de la hoja: %d', ws.columnCount);
  console.log('  hojas:                     %s', workbook.worksheets.map((h) => h.name).join(', '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
