/**
 * Texto de un valor que llega sin tipar.
 *
 * `String(valor)` sobre un `unknown` es una trampa: si llega un objeto —y el cuerpo
 * de una petición lo manda el cliente, aunque el DTO tipe `string`— se convierte en
 * el literal `"[object Object]"`, y eso es lo que se acaba guardando, comparando o
 * exportando. No abre ninguna puerta (ese literal nunca coincide con un dato real),
 * pero tampoco es lo que el código dice que hace, y eslint lo marca con
 * `no-base-to-string`.
 *
 * Aquí solo se aceptan los tipos que de verdad son texto. Cualquier otra cosa
 * (objetos, arreglos, funciones, símbolos) devuelve cadena vacía, que es lo que las
 * validaciones de arriba ya tratan como "falta el dato".
 *
 * Esta guarda estaba copiada en siete sitios; ahora vive aquí.
 */
export function textoDeValor(valor: unknown): string {
  if (typeof valor === 'string') return valor;

  // Números, enteros grandes y booleanos sí tienen una representación de texto
  // útil: un código numérico de una hoja de cálculo llega como number.
  if (
    typeof valor === 'number' ||
    typeof valor === 'bigint' ||
    typeof valor === 'boolean'
  ) {
    return String(valor);
  }

  return '';
}

/** `textoDeValor` sin espacios a los lados. */
export function textoRecortado(valor: unknown): string {
  return textoDeValor(valor).trim();
}

/**
 * Texto en mayúsculas y sin tildes, para comparar y para armar códigos.
 *
 * 'BOGOTÁ' y 'BOGOTA' tienen que dar lo mismo.
 */
export function textoComparable(valor: unknown): string {
  return textoRecortado(valor)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Normaliza un valor a uno de los permitidos, o `undefined`.
 *
 * Existe porque tres campos del cuerpo de un pago se normalizaban con
 * `valor?.toString().toUpperCase()`: el `toUpperCase()` devuelve `string`, que no
 * es asignable al enum ni a la union de literales, y el cast tapaba eso.
 *
 * Ojo: el DTO YA hace la misma normalizacion con `@Transform` y luego valida, asi que en
 * produccion el valor llega limpio. Esto se conserva de todos modos porque el
 * controlador tambien se llama directo en las pruebas, sin pipe, y porque asi la
 * garantia no depende de que el pipe este bien configurado. La diferencia es que ahora
 * el resultado esta TIPADO: si el valor no es uno de los permitidos, sale `undefined` en
 * vez de colarse como texto cualquiera.
 */
export function unoDeLosPermitidos<T extends string>(
  valor: unknown,
  permitidos: readonly T[],
): T | undefined {
  const texto = textoComparable(valor);
  return permitidos.find((permitido) => permitido === texto);
}
