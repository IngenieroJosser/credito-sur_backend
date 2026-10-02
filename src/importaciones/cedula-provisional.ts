/**
 * Cédulas provisionales para la carga de cartera vieja.
 *
 * El caso real: de los clientes que solo tuvieron crédito de DINERO, la empresa no tiene la
 * cédula, y `Cliente.dni` es `String @unique` NOT NULL (schema.prisma:178), así que sin un
 * valor no se puede insertar la fila. La decisión tomada es ponerles un número provisional
 * y corregirlo después.
 *
 * Cómo se usa en la plantilla: en la columna de cédula se escribe un número CORTO —1, 2, 3…—
 * que solo sirve para amarrar las filas del archivo entre sí (qué crédito o artículo es de
 * qué cliente). Al importar, el sistema cambia ese número por uno provisional de verdad.
 *
 * Dos cosas importantes de este diseño, y el motivo de cada una:
 *
 *  1. El número provisional EMPIEZA POR 99 y tiene diez dígitos. Hace falta poder
 *     encontrarlos después para reemplazarlos por la cédula real: sin una marca quedarían
 *     indistinguibles de una cédula buena y nadie sabría a quién le falta el dato.
 *     Diez dígitos y solo números para que pase las mismas validaciones que una cédula
 *     normal (el formulario del cliente pide entre 6 y 10 dígitos).
 *
 *  2. El número del archivo NO se guarda como cédula: se traduce. Quien importa mantiene la
 *     correspondencia `número del archivo → cédula provisional` durante toda la operación,
 *     porque los créditos del archivo apuntan al cliente por ese número. Guardar el "1" tal
 *     cual chocaría con el "1" de la siguiente importación, y las dos filas acabarían siendo
 *     la misma persona.
 */

/** Las cédulas provisionales empiezan así. Es la marca que permite encontrarlas. */
export const PREFIJO_CEDULA_PROVISIONAL = '99';

/** Los dígitos que tiene una cédula provisional, contando el prefijo. */
export const LARGO_CEDULA_PROVISIONAL = 10;

/**
 * Si el valor que viene en la columna de cédula es un marcador de la plantilla y no una
 * cédula.
 *
 * El criterio es el largo: una cédula colombiana tiene de 6 a 10 dígitos, así que cualquier
 * cosa de 1 a 5 dígitos es el número de amarre que se escribió para unir las filas.
 */
export function esMarcadorDeCedula(valor: string): boolean {
  const limpio = String(valor ?? '').trim();
  return /^\d{1,5}$/.test(limpio);
}

/** Si una cédula ya guardada es provisional: la generó el sistema, no es de nadie. */
export function esCedulaProvisional(dni: string): boolean {
  const limpio = String(dni ?? '').trim();
  return (
    limpio.length === LARGO_CEDULA_PROVISIONAL &&
    limpio.startsWith(PREFIJO_CEDULA_PROVISIONAL) &&
    /^\d+$/.test(limpio)
  );
}

/**
 * Genera una cédula provisional.
 *
 * `yaUsadas` son las que ya están tomadas en esta misma operación: la unicidad real la
 * garantiza la base (`dni` es `@unique`), pero reintentar contra el índice es más caro y
 * deja ruido en los registros, así que primero se evita aquí.
 */
export function generarCedulaProvisional(
  yaUsadas: Set<string> = new Set(),
): string {
  const digitos = LARGO_CEDULA_PROVISIONAL - PREFIJO_CEDULA_PROVISIONAL.length;
  const tope = 10 ** digitos;

  for (let intento = 0; intento < 50; intento += 1) {
    const sufijo = String(Math.floor(Math.random() * tope)).padStart(
      digitos,
      '0',
    );
    const candidata = `${PREFIJO_CEDULA_PROVISIONAL}${sufijo}`;
    if (!yaUsadas.has(candidata)) return candidata;
  }

  // Cincuenta choques seguidos sobre 100 millones de combinaciones no es azar: es que algo
  // está mal. Se avisa en vez de devolver una cédula repetida, que rompería la identidad de
  // un cliente en silencio.
  throw new Error(
    'No se pudo generar una cédula provisional distinta después de 50 intentos.',
  );
}
