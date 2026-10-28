/**
 * Limpieza de los datos que llegan por Excel.
 *
 * La cartera se ensucia para siempre con lo que entra en la migración: nombres
 * en MAYÚSCULAS copiados de un sistema viejo, espacios dobles, teléfonos con
 * guiones. Aquí se corrige antes de guardar, sin cambiar el significado.
 */

/** Quita espacios sobrantes y caracteres de control. */
export function limpiarTexto(valor: string): string {
  return (
    String(valor ?? '')
      // Los caracteres de control son el objetivo de esta limpieza, no un
      // descuido: el regex esta aqui para quitarlos del texto importado.
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f\x7f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** Palabras que se mantienen en minúscula dentro de un nombre compuesto. */
const CONECTORES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'do']);

/**
 * Normaliza nombres propios.
 *
 * Solo cambia las mayúsculas cuando el texto viene todo en mayúsculas o todo en
 * minúsculas; si la persona ya lo escribió con un formato propio, se respeta.
 * "MARIA DE LOS ANGELES" → "Maria de los Angeles".
 */
export function limpiarNombre(valor: string): string {
  const texto = limpiarTexto(valor);
  if (!texto) return '';

  const tieneMinusculas = /[a-záéíóúñü]/.test(texto);
  const tieneMayusculas = /[A-ZÁÉÍÓÚÑÜ]/.test(texto);
  const formatoUniforme = !tieneMinusculas || !tieneMayusculas;

  if (!formatoUniforme) return texto;

  return texto
    .toLocaleLowerCase('es-CO')
    .split(' ')
    .map((palabra, indice) => {
      if (indice > 0 && CONECTORES.has(palabra)) return palabra;
      return palabra.charAt(0).toLocaleUpperCase('es-CO') + palabra.slice(1);
    })
    .join(' ');
}

/** Deja solo los dígitos del teléfono, conservando el prefijo internacional. */
export function limpiarTelefono(valor: string): string {
  const texto = limpiarTexto(valor);
  if (!texto) return '';

  const internacional = texto.startsWith('+');
  const digitos = texto.replace(/\D/g, '');
  if (!digitos) return '';

  return internacional ? `+${digitos}` : digitos;
}

/** Correo en minúsculas y sin espacios. */
export function limpiarCorreo(valor: string): string {
  return limpiarTexto(valor).toLocaleLowerCase('es-CO').replace(/\s/g, '');
}

/** Clave para comparar nombres: sin tildes, sin mayúsculas y sin espacios extra. */
export function claveNombre(nombres: string, apellidos: string): string {
  return `${limpiarTexto(nombres)} ${limpiarTexto(apellidos)}`
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
