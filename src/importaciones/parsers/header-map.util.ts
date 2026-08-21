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

/** `true` si todas las columnas indicadas están vacías en la fila. */
export function filaVaciaEnColumnas(row: ExcelJS.Row, columnas: number[]): boolean {
  return columnas.every((col) => !col || leerTexto(row.getCell(col).value) === '');
}
