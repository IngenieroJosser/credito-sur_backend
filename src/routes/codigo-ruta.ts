/**
 * Formato unico del codigo de ruta.
 *
 * El codigo lo escribe una persona y se usa para cruzar datos: es lo que va en
 * la columna "Ruta codigo" de las importaciones y lo que enlaza un cliente con
 * su ruta. Cuando cada quien lo escribia a su manera ("Centro", "ruta centro",
 * "RT CENTRO"), la importacion no encontraba la ruta y la fila se rechazaba.
 *
 * Aqui se lleva todo a la misma forma: PREFIJO + guion + el nombre en
 * mayusculas, sin tildes ni espacios.
 *
 *   'Centro'        -> 'RT-CENTRO'
 *   'ruta centro'   -> 'RT-CENTRO'
 *   'RT-CEN-01'     -> 'RT-CEN-01'   (ya estaba bien: no se toca)
 *   'Zona Norte 2'  -> 'RT-ZONA-NORTE-2'
 *
 * Es idempotente: normalizar dos veces da lo mismo, asi que se puede aplicar
 * sin miedo a un codigo que ya paso por aqui.
 */

export const PREFIJO_CODIGO_RUTA = 'RT';

/** `rutas.codigo` es VarChar(20) y unico. */
export const LARGO_MAXIMO_CODIGO_RUTA = 20;

export function normalizarCodigoRuta(valor: unknown): string {
  const crudo = String(valor ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    // Quitar tildes: 'BOGOTÁ' y 'BOGOTA' deben dar el mismo codigo.
    .replace(/[̀-ͯ]/g, '');

  if (!crudo) return '';

  const cuerpo = crudo
    // Si ya trae el prefijo (RT o RUTA) se quita para no duplicarlo.
    .replace(/^(RUTA|RT)[\s\-_.]+/, '')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!cuerpo) return '';

  return `${PREFIJO_CODIGO_RUTA}-${cuerpo}`
    .slice(0, LARGO_MAXIMO_CODIGO_RUTA)
    .replace(/-+$/, '');
}
