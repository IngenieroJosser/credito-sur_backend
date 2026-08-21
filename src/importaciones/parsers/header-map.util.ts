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

export function normalizarEncabezado(valor: any): string {
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

/** Lee una celda por índice de columna; devuelve `undefined` si la columna no existe. */
export function celda(row: ExcelJS.Row, indice: number): any {
  if (!indice) return undefined;
  return row.getCell(indice).value;
}

/**
 * Última fila que la plantilla preparó con fórmulas y validaciones.
 * Debe coincidir con `FILAS_PREPARADAS` de las plantillas.
 */
export const ULTIMA_FILA_PREPARADA = FILA_INICIO_DATOS + 1000 - 1;

/**
 * Avisa de filas escritas más allá del rango que la plantilla preparó.
 *
 * Esas filas se importan igual, pero llegaron sin las fórmulas de verificación
 * ni las listas desplegables, así que nadie las revisó antes de subirlas.
 */
export function avisarFilasFueraDeRango(
  filasLeidas: number[],
  hoja: string,
): { fila: number; campo: string; mensaje: string; valor: any } | null {
  const fueraDeRango = filasLeidas.filter((f) => f > ULTIMA_FILA_PREPARADA);
  if (fueraDeRango.length === 0) return null;

  return {
    fila: fueraDeRango[0],
    campo: 'GLOBAL',
    mensaje:
      `Hay ${fueraDeRango.length} fila(s) más allá de la fila ${ULTIMA_FILA_PREPARADA}, que es hasta donde llega la plantilla. ` +
      `Se importan igual, pero no tuvieron fórmulas de verificación ni listas desplegables: revíselas con cuidado. ` +
      `Si son muchas, conviene partir el archivo en varios.`,
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
