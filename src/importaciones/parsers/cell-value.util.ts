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

/**
 * Lo que puede salir de una celda despues de desenvolverla.
 *
 * Los siete lectores de este archivo declaraban `valor: any` y `leerValorCelda`
 * devolvia `any`, o sea que ninguna de las formas que describe el comentario de arriba
 * —formula, richText, hipervinculo, error— se comprobaba en ningun sitio. Con `unknown`
 * a la entrada, cada `typeof`/`in` de aqui pasa a ser la comprobacion de verdad, y la
 * salida dice las cuatro cosas que de verdad devuelve.
 */
export type ValorDeCelda = string | number | boolean | Date | null;

/** Un trozo de texto enriquecido de ExcelJS: `text` es texto, no un objeto. */
type ParteDeTextoEnriquecido = { text?: string | number | null };

export function leerValorCelda(valor: unknown): ValorDeCelda {
  if (valor === null || valor === undefined) return null;

  if (typeof valor === 'object') {
    const celda = valor as Record<string, unknown>;

    // Celda con fórmula: usamos el resultado calculado por Excel.
    if ('result' in celda) return leerValorCelda(celda.result);
    if ('formula' in celda || 'sharedFormula' in celda) return null;

    // Celda con error de fórmula (#N/A, #DIV/0!, ...): se trata como vacía.
    if ('error' in celda) return null;

    // Texto enriquecido.
    if (Array.isArray(celda.richText)) {
      return (celda.richText as ParteDeTextoEnriquecido[])
        .map((parte) => String(parte?.text ?? ''))
        .join('');
    }

    // Hipervínculo.
    if ('text' in celda) return leerValorCelda(celda.text);

    if (valor instanceof Date) return valor;

    // Cualquier otro objeto no es un valor de celda: antes salia por el `return valor`
    // de abajo y terminaba en un `String(objeto)` = "[object Object]".
    return null;
  }

  if (
    typeof valor === 'string' ||
    typeof valor === 'number' ||
    typeof valor === 'boolean'
  ) {
    return valor;
  }

  return null;
}

export function leerTexto(valor: unknown): string {
  const limpio = leerValorCelda(valor);
  if (limpio === null || limpio === undefined) return '';
  if (limpio instanceof Date) return limpio.toISOString().slice(0, 10);
  return String(limpio).trim();
}

export function leerTextoMayus(valor: unknown): string {
  return leerTexto(valor).toUpperCase();
}

/** Texto en mayúsculas y sin tildes, para comparar contra listas de valores. */
export function leerTextoNormalizado(valor: unknown): string {
  return leerTextoMayus(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Convierte una celda a número. Devuelve `null` si está vacía y `NaN` si tiene
 * contenido que no es numérico, para poder distinguir "no informado" de "inválido".
 */
export function leerNumero(valor: unknown): number | null {
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
 * Número de una celda SIN aceptar el resultado guardado de una fórmula.
 *
 * Las casillas de precio son la captura de verdad: manda lo que la trabajadora
 * escribe a mano. Por eso no se puede tomar el `result` que Excel deja pegado a
 * una fórmula —con un `=200+999` pegado se colaría un precio que nadie decidió—
 * ni el de la fórmula de sugerencia que trae la plantilla. Una celda con fórmula
 * se trata como vacía y el precio se rehace con la regla respaldada, que es lo
 * que el importador ya sabe hacer.
 */
export function leerNumeroCapturado(valor: unknown): number | null {
  if (valor !== null && typeof valor === 'object') {
    const celda = valor as Record<string, unknown>;
    if ('formula' in celda || 'sharedFormula' in celda) return null;
  }
  return leerNumero(valor);
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
/**
 * Un dia del calendario, anclado a MEDIODIA DE BOGOTA (17:00 UTC).
 *
 * Es la convencion del resto del sistema —`new Date(`${clave}T12:00:00-05:00`)`
 * en `loans.service.ts` y `mora.service.ts`— y la importacion se habia quedado
 * fuera: construia las fechas a medianoche UTC.
 *
 * Por que importa, medido sobre la base de desarrollo: de 1.629 cuotas, 1.541
 * vencen a las 17:00 UTC (mediodia de Bogota, correcto) y 88 a las 00:00, que en
 * Bogota son las 19:00 del DIA ANTERIOR. Cuatro de los siete creditos con esas
 * 88 vinieron de la importacion.
 *
 * Y la consecuencia se comprobo fila por fila: las 88 se leen VENCIDAS el dia en
 * que toca pagarlas, porque la comparacion de mora es contra el inicio del dia
 * de Bogota (05:00 UTC) y medianoche UTC es anterior. Las de las 17:00 no. O sea
 * que cada cuota importada entraba en mora un dia antes: mueve la mora, la meta
 * del dia y el semaforo del cliente, y manda al cobrador a perseguir a alguien
 * que no esta atrasado.
 *
 * A mediodia el dia UTC y el de Bogota coinciden, asi que todo lo que ya leia
 * estas fechas con `getUTCDate()` o `toISOString().slice(0,10)` sigue viendo el
 * mismo dia. Es la direccion segura del arreglo.
 */
const HORA_MEDIODIA_BOGOTA_EN_UTC = 17;

const aMediodiaBogota = (anio: number, mes: number, dia: number): Date =>
  new Date(Date.UTC(anio, mes, dia, HORA_MEDIODIA_BOGOTA_EN_UTC, 0, 0, 0));

/** Reancla a mediodia de Bogota una fecha que ya trae su dia de calendario. */
const normalizarAMediodia = (fecha: Date): Date =>
  aMediodiaBogota(
    fecha.getUTCFullYear(),
    fecha.getUTCMonth(),
    fecha.getUTCDate(),
  );

export function leerFecha(valor: unknown): Date | null {
  const limpio = leerValorCelda(valor);
  if (limpio === null || limpio === undefined || limpio === '') return null;
  if (limpio instanceof Date)
    return Number.isNaN(limpio.getTime()) ? null : normalizarAMediodia(limpio);

  if (typeof limpio === 'number') {
    // Serial de Excel (días desde 1899-12-30).
    const fecha = new Date(Math.round((limpio - 25569) * 86400 * 1000));
    return Number.isNaN(fecha.getTime()) ? null : normalizarAMediodia(fecha);
  }

  const texto = String(limpio).trim();

  // Solo construye la fecha si día/mes/año existen de verdad: rechaza 31/02,
  // mes 13, etc. (comprobando que la fecha no se "desborde" a otro día).
  const construir = (anio: number, mes: number, dia: number): Date | null => {
    if (anio < 1900 || anio > 2999) return null;
    if (mes < 1 || mes > 12) return null;
    if (dia < 1 || dia > 31) return null;
    const fecha = aMediodiaBogota(anio, mes - 1, dia);
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
