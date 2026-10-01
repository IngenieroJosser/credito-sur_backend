import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Dobles de prueba tipados.
 *
 * Existe porque las pruebas construían el servicio bajo prueba con `as any` en cada
 * dependencia: `new RolesService(prisma as any)`, `new PushService(prisma as any)`,
 * `new ReportsService(prisma, {} as any, {} as any)`. Eran 262 `any` repartidos en 37
 * archivos, y cada uno apagaba la comprobación de ese argumento entero.
 *
 * Lo que se gana: el nombre del modelo y el de la dependencia SÍ se comprueban. Un
 * `prisma.clientee.findFirst` o un `mockGateway` al que le falta el método que el
 * servicio llama dejan de compilar, en vez de fallar a mitad de la prueba con
 * "undefined is not a function" o —peor— de pasar porque nadie lo llamó.
 *
 * El `as` vive AQUÍ, en dos funciones de una línea, en vez de en cada archivo: un doble
 * nunca va a ser la clase real, y eso no se puede expresar sin un cast. La diferencia es
 * que ahora es un cast con nombre y en un solo sitio.
 */

/**
 * Las claves de modelo que expone el cliente de Prisma (`cliente`, `prestamo`, …).
 *
 * Se derivan de `Prisma.ModelName`, que Prisma genera, así que la lista no se escribe a
 * mano y no se queda vieja cuando se agrega un modelo al esquema.
 */
export type ClaveDeModelo = Uncapitalize<Prisma.ModelName>;

/** Un método de un modelo, imitado. Lo que la prueba le ponga dentro es cosa suya. */
export type MetodosDeModelo = Record<string, jest.Mock>;

/**
 * Un doble del cliente de Prisma: los modelos que la prueba necesita y nada más.
 *
 * `$transaction` y compañía van aparte porque no son modelos. `$transaction` se imita de
 * dos formas según la prueba —ejecutando el callback con el propio doble, o devolviendo un
 * valor fijo— y las dos caben en un `jest.Mock`.
 */
export type DobleDePrisma = Partial<Record<ClaveDeModelo, MetodosDeModelo>> & {
  $transaction?: jest.Mock;
  $queryRaw?: jest.Mock;
  $queryRawUnsafe?: jest.Mock;
  $executeRaw?: jest.Mock;
  $executeRawUnsafe?: jest.Mock;
  $connect?: jest.Mock;
  $disconnect?: jest.Mock;
  $on?: jest.Mock;
  enableShutdownHooks?: jest.Mock;
};

/**
 * Un doble de cualquier otra dependencia: solo los métodos que la prueba usa, con los
 * nombres comprobados contra la clase real.
 *
 * Las propiedades que no son función se dejan tal cual, para poder fijar una bandera de
 * configuración sin tener que imitarla como método.
 */
export type Doble<T> = {
  [K in keyof T]?: T[K] extends (...args: never[]) => unknown
    ? jest.Mock
    : T[K];
};

/** Entrega el doble de Prisma donde se espera el servicio real. */
export const comoPrisma = (doble: DobleDePrisma): PrismaService =>
  doble as unknown as PrismaService;

/** Entrega el doble de una dependencia donde se espera la clase real. */
export const comoDependencia = <T>(doble: Doble<T>): T => doble as unknown as T;

/**
 * Una dependencia que la prueba NO usa, pero que el constructor pide.
 *
 * Es el caso de `new ReportsService(prisma, {} as any, {} as any)`: dos servicios que esa
 * prueba no ejercita. Decirlo con un nombre deja claro que es deliberado, en vez de
 * parecer un `any` que alguien no acabó de tipar. Si el servicio llegara a llamarlo, la
 * prueba falla con "no es una función", que es la señal correcta: falta imitarlo.
 */
export const dependenciaSinUsar = <T>(): T => ({}) as T;
