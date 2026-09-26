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
