/**
 * Resolución de columnas por nombre de encabezado.
 *
 * Antes los parsers leían columnas por índice fijo (`row.getCell(8)`). Bastaba
 * con que el usuario insertara una columna para que toda la importación se
 * leyera corrida sin avisar. Ahora las columnas se localizan por su encabezado,
 * lo que además permite convivir con plantillas antiguas y nuevas.
 */
import * as ExcelJS from 'exceljs';
import { leerTexto } from './cell-value.util';

export const FILA_ENCABEZADOS = 6;
export const FILA_INICIO_DATOS = 7;

export function normalizarEncabezado(valor: unknown): string {
  return leerTexto(valor)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\*/g, '')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface MapaColumnas {
  /** Índice de columna (1-based) o 0 si el encabezado no existe en la hoja. */
  indice(...alias: string[]): number;
  /** Índices de todas las columnas de entrada declaradas, para detectar filas vacías. */
  columnasDeclaradas: number[];
  encabezados: Map<string, number>;
}

export function construirMapaColumnas(
  hoja: ExcelJS.Worksheet,
  filaEncabezados = FILA_ENCABEZADOS,
): MapaColumnas {
  const encabezados = new Map<string, number>();
  const fila = hoja.getRow(filaEncabezados);

  fila.eachCell({ includeEmpty: false }, (celda, colNumber) => {
    const clave = normalizarEncabezado(celda.value);
    if (clave && !encabezados.has(clave)) {
      encabezados.set(clave, colNumber);
    }
  });

  const usadas: number[] = [];

  return {
    encabezados,
    columnasDeclaradas: usadas,
    indice(...alias: string[]): number {
      for (const nombre of alias) {
        const col = encabezados.get(normalizarEncabezado(nombre));
        if (col) {
          if (!usadas.includes(col)) usadas.push(col);
          return col;
        }
      }
      return 0;
    },
  };
}

/**
 * Lee una celda por índice de columna; devuelve `undefined` si la columna no existe.
 *
 * Devuelve `ExcelJS.CellValue`, que es la union de las diez formas que una celda puede
 * tener, y no `any`: quien lo llame tiene que pasarlo por los lectores de
 * `cell-value.util.ts`, que es justo la regla que ese archivo pide en su cabecera.
 */
export function celda(
  row: ExcelJS.Row,
  indice: number,
): ExcelJS.CellValue | undefined {
  if (!indice) return undefined;
  return row.getCell(indice).value;
}

/**
 * Última fila que la plantilla preparó con fórmulas y validaciones.
 * Debe coincidir con `FILAS_PREPARADAS` de las plantillas.
 */
export const FILAS_PREPARADAS = 1000;
export const ULTIMA_FILA_PREPARADA = FILA_INICIO_DATOS + FILAS_PREPARADAS - 1;
export const MARCA_CAPACIDAD = '_CrediSur';

export function declararCapacidad(workbook: ExcelJS.Workbook, cantidad = FILAS_PREPARADAS) {
  workbook.addWorksheet(MARCA_CAPACIDAD, { state: 'veryHidden' }).getCell('A1').value = cantidad;
}

/**
 * Avisa de filas escritas más allá del rango que la plantilla preparó.
 *
 * Esas filas se importan igual, pero llegaron sin las fórmulas de verificación
 * ni las listas desplegables, así que nadie las revisó antes de subirlas.
 */
export function limiteOficial(workbook: ExcelJS.Workbook): number | null {
  const control = workbook.getWorksheet(MARCA_CAPACIDAD);
  if (!control) return null;
  const cantidad = control.getCell('A1').value;
  return typeof cantidad === 'number' && Number.isSafeInteger(cantidad) && cantidad > 0
    ? FILA_INICIO_DATOS + cantidad - 1 : ULTIMA_FILA_PREPARADA;
}

export function avisarFilasFueraDeRango(
  filasLeidas: number[],
  hoja: string,
  workbook?: ExcelJS.Workbook,
): { fila: number; campo: string; mensaje: string; valor: string } | null {
  const oficial = workbook ? limiteOficial(workbook) : null;
  const limite = oficial ?? ULTIMA_FILA_PREPARADA;
  const fueraDeRango = filasLeidas.filter((f) => f > limite);
  if (fueraDeRango.length === 0) return null;

  return {
    fila: fueraDeRango[0],
    campo: 'GLOBAL',
    mensaje:
      `Hay ${fueraDeRango.length} fila(s) más allá de la fila ${limite}, que es hasta donde llega la plantilla. ` +
      (oficial ? `Divida el archivo en lotes antes de importarlo.` :
        `Esta plantilla anterior permite esas filas, pero no tuvieron fórmulas ni listas desplegables.`),
    valor: hoja,
  };
}

/** `true` si todas las columnas indicadas están vacías en la fila. */
export function filaVaciaEnColumnas(
  row: ExcelJS.Row,
  columnas: number[],
): boolean {
  return columnas.every(
    (col) => !col || leerTexto(row.getCell(col).value) === '',
  );
}
