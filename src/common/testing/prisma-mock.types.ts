/**
 * Tipos para los dobles de Prisma en las pruebas.
 *
 * Existe porque el mismo `({ where, data }: any)` estaba repetido cuarenta y dos veces
 * entre `loans.service.spec.ts` y `routes.service.spec.ts`. Los dos archivos lo importan
 * de aqui; no es una centralizacion anunciada, es la unica copia.
 *
 * Lo que se gana sobre `any`: un `where` mal escrito en una prueba lo marca el compilador
 * en vez de resolver `undefined` en silencio y dejar pasar la asercion.
 */

/**
 * Lo que los dobles de Prisma leen de la llamada que reciben.
 *
 * No hace falta `Prisma.XUpdateArgs` entero: estos dobles miran `where` para decidir que
 * devolver y reenvian `data` en la respuesta.
 *
 * `id` se nombra aparte porque hay pruebas que filtran con el operador de Prisma
 * (`where: { id: { in: [...] } }`) y otras con un id suelto. La firma dice las dos formas,
 * asi que el sitio que lee `in` tiene que distinguirlas, que es justo lo que `any` tapaba.
 */
export type ArgsDePrismaEnMock = {
  where?: { id?: string | { in?: string[] } } & Record<string, unknown>;
  data?: Record<string, unknown>;
  distinct?: string[];
  include?: Record<string, unknown>;
};

/**
 * Un operador de filtro de Prisma (`{ not: x }`, `{ in: [...] }`), distinguido de un valor.
 *
 * Los dobles que imitan un `where` tienen que saber si el valor de un campo es el dato o
 * un operador. Con `any` la diferencia no se comprobaba en ningun sitio.
 */
export const esFiltroDePrisma = (
  valor: unknown,
): valor is { not?: unknown; in?: unknown[] } =>
  !!valor && typeof valor === 'object';
