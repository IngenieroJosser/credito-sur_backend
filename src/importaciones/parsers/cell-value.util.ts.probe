/**
 * Utilidades de lectura de celdas para las importaciones de Excel.
 *
 * ExcelJS no siempre entrega valores primitivos: una celda puede contener
 * `{ formula, result }`, `{ richText }`, `{ text, hyperlink }` o `{ error }`.
 * Si se leen con `String(cell.value)` se obtiene `[object Object]`, lo que
 * rompe silenciosamente la validación cuando el usuario deja fórmulas en la
 * plantilla (algo que ahora hacemos a propósito para autocompletar datos).
 *
 * Todas las lecturas de celdas de los parsers deben pasar por aquí.
 */

export function leerValorCelda(valor: any): any {
  if (valor === null || valor === undefined) return null;

  if (typeof valor === 'object') {
    // Celda con fórmula: usamos el resultado calculado por Excel.
    if ('result' in valor) return leerValorCelda(valor.result);
    if ('formula' in valor || 'sharedFormula' in valor) return null;

    // Celda con error de fórmula (#N/A, #DIV/0!, ...): se trata como vacía.
    if ('error' in valor) return null;

    // Texto enriquecido.
    if (Array.isArray(valor.richText)) {
      return valor.richText
        .map((parte: any) => String(parte?.text ?? ''))
        .join('');
    }

    // Hipervínculo.
    if ('text' in valor) return leerValorCelda(valor.text);

    if (valor instanceof Date) return valor;
  }

  return valor;
}

export function leerTexto(valor: any): string {
  const limpio = leerValorCelda(valor);
  if (limpio === null || limpio === undefined) return '';
  if (limpio instanceof Date) return limpio.toISOString().slice(0, 10);
  return String(limpio).trim();
}

export function leerTextoMayus(valor: any): string {
  return leerTexto(valor).toUpperCase();
}

/** Texto en mayúsculas y sin tildes, para comparar contra listas de valores. */
export function leerTextoNormalizado(valor: any): string {
  return leerTextoMayus(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Convierte una celda a número. Devuelve `null` si está vacía y `NaN` si tiene
 * contenido que no es numérico, para poder distinguir "no informado" de "inválido".
 */
export function leerNumero(valor: any): number | null {
  const limpio = leerValorCelda(valor);
  if (limpio === null || limpio === undefined) return null;
  if (typeof limpio === 'number') return Number.isFinite(limpio) ? limpio : NaN;

  const texto = String(limpio).trim();
  if (texto === '') return null;

  // Tolera formatos escritos a mano: "$ 1.200.000", "1,200,000", "1.200.000,50"
  const sinMoneda = texto.replace(/[$\s]/g, '');
  const normalizado =
    sinMoneda.includes(',') &&
    sinMoneda.lastIndexOf(',') > sinMoneda.lastIndexOf('.')
      ? sinMoneda.replace(/\./g, '').replace(',', '.')
      : sinMoneda.replace(/,/g, '');

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : NaN;
}

/**
 * Fecha de una celda. Acepta SOLO formatos inequívocos:
 *  - Date nativo (celda con formato de fecha en Excel) y serial de Excel.
 *  - Texto ISO `YYYY-MM-DD` (el formato que declara la plantilla).
 *  - Texto `DD/MM/YYYY` o `DD-MM-YYYY`, interpretado con el DÍA primero
 *    (convención colombiana).
 * Cualquier otra cosa devuelve null para que la validación reporte la fila.
 *
 * Antes se usaba `new Date(texto)`, y eso traía tres problemas graves:
 *  - `02/09/2026` (2 de septiembre) se leía como 9 de FEBRERO, porque JS asume
 *    formato de EE.UU. Un error silencioso de meses que corre todo el
 *    calendario de cuotas.
 *  - Texto mal escrito como `02/09 2026` se ACEPTABA en vez de rechazarse.
 *  - Fechas válidas aquí como `31/12/2026` se rechazaban.
 */
export function leerFecha(valor: any): Date | null {
  const limpio = leerValorCelda(valor);
  if (limpio === null || limpio === undefined || limpio === '') return null;
  if (limpio instanceof Date)
    return Number.isNaN(limpio.getTime()) ? null : limpio;

  if (typeof limpio === 'number') {
    // Serial de Excel (días desde 1899-12-30).
    const fecha = new Date(Math.round((limpio - 25569) * 86400 * 1000));
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  const texto = String(limpio).trim();

  // Solo construye la fecha si día/mes/año existen de verdad: rechaza 31/02,
  // mes 13, etc. (comprobando que la fecha no se "desborde" a otro día).
  const construir = (anio: number, mes: number, dia: number): Date | null => {
    if (anio < 1900 || anio > 2999) return null;
    if (mes < 1 || mes > 12) return null;
    if (dia < 1 || dia > 31) return null;
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));
    if (Number.isNaN(fecha.getTime())) return null;
    if (
      fecha.getUTCFullYear() !== anio ||
      fecha.getUTCMonth() !== mes - 1 ||
      fecha.getUTCDate() !== dia
    ) {
      return null;
    }
    return fecha;
  };

  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return construir(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const diaPrimero = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (diaPrimero) {
    return construir(
      Number(diaPrimero[3]),
      Number(diaPrimero[2]),
      Number(diaPrimero[1]),
    );
  }

  // Formato desconocido o mal escrito: se rechaza a propósito.
  return null;
}
