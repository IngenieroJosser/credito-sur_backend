/**
 * Leer una columna `Json` de Prisma sin dar por hecho su forma.
 *
 * Prisma tipa esas columnas como `JsonValue`, que puede ser un número, un texto,
 * un booleano, un objeto o una lista. Hasta ahora el código escribía
 * `lote.resumen?.creado` directamente: compilaba solo porque el cliente de
 * Prisma estaba tipado como `any`. Si la columna llegara con un texto o una
 * lista, esa lectura da `undefined` en silencio, y si llegara con `null`, el
 * `?.` lo salva pero la siguiente lectura ya no.
 *
 * Esto no adivina la forma: solo garantiza que hay un objeto donde leer. Cada
 * sitio sigue diciendo qué espera encontrar dentro, que es lo que ya hacía.
 */
export function objetoDeJson(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}

/**
 * Leer una LISTA DE IDs de una columna `Json`.
 *
 * Mismo problema que arriba pero con listas: el codigo hacia
 * `for (const id of rollbackData.transaccionIds || [])`, que compilaba solo porque el valor
 * era `any`. Si la columna llegara con un objeto o un numero, ese `for` revienta en
 * ejecucion ("is not iterable"), no falla en silencio.
 *
 * Devuelve solo los elementos que son texto: un id que no lo sea no serviria para buscar
 * nada, y colarlo haria fallar la consulta mas adelante en vez de aqui.
 */
export function textosDeJson(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((item): item is string => typeof item === 'string');
}

/**
 * Leer un TEXTO de una columna `Json`.
 *
 * El atajo obvio, `String(valor)`, es una trampa: si la columna trae un objeto donde se
 * esperaba un id, `String` no falla, devuelve `"[object Object]"` y ESO acaba escrito en la
 * base o buscado como id. La regla `no-base-to-string` avisa justo de eso.
 *
 * Aqui, si no es un texto, no hay texto: se devuelve `undefined` y quien llama decide. Los
 * numeros si se convierten, porque un id numerico en Json es normal.
 */
export function textoDeJson(valor: unknown): string | undefined {
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' && Number.isFinite(valor)) return String(valor);
  return undefined;
}
