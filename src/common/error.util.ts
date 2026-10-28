/**
 * Leer un error capturado sin dar por hecho qué es.
 *
 * En un `catch` de TypeScript la variable no está tipada: `catch (err)` deja
 * `err` como `any` mientras `useUnknownInCatchVariables` esté apagado, y con eso
 * se escribe `err.message` en 64 sitios sin que el compilador diga nada. Hoy
 * funciona —se comprobó que en este proyecto todo lo que se lanza es un `Error`,
 * incluidas las excepciones de Nest y de Prisma— pero basta un
 * `Promise.reject('texto')` de una dependencia para que el registro diga
 * «Error en Paso 1: undefined» y se pierda el motivo justo cuando se necesita.
 * Si además lo lanzado fuera `null`, leer `.message` revienta DENTRO del catch.
 *
 * Estas funciones leen lo mismo que leía el código de antes, en el mismo orden,
 * y devuelven algo utilizable cuando no hay nada de eso. No cambian ninguna
 * decisión: `codigoDeError(e) === 'P2002'` es exactamente lo que hacía
 * `e?.code === 'P2002'`.
 *
 * No se confunda con `ErroresClarosFilter.textoDe`, que hace otro trabajo:
 * traduce el CUERPO de una respuesta HTTP al texto que verá el usuario. Esto es
 * para el lado de acá del `catch`, casi siempre para registrar.
 */

/** Lo que se puede leer de un error sin saber qué es. */
interface ErrorConDatos {
  message?: unknown;
  code?: unknown;
  statusCode?: unknown;
  meta?: unknown;
  stack?: unknown;
  // Las excepciones de Nest guardan aquí el cuerpo con el que se lanzaron.
  response?: unknown;
}

const comoObjeto = (error: unknown): ErrorConDatos =>
  error && typeof error === 'object' ? error : {};

const cuerpo = (error: unknown): ErrorConDatos => {
  const dentro = comoObjeto(error).response;
  return dentro && typeof dentro === 'object' ? dentro : {};
};

const textoUtil = (valor: unknown): string | undefined => {
  if (typeof valor === 'string' && valor.trim()) return valor.trim();
  // Los errores de validación de Nest traen una lista de mensajes.
  if (Array.isArray(valor)) {
    const limpios = valor.map((v) => String(v ?? '').trim()).filter(Boolean);
    if (limpios.length) return limpios.join('. ');
  }
  return undefined;
};

/**
 * El motivo del error, en el orden en que lo buscaba el código de antes:
 * el cuerpo de la excepción, luego `message`, luego el error mismo si es texto.
 */
export function mensajeDeError(
  error: unknown,
  respaldo = 'Error desconocido',
): string {
  return (
    textoUtil(cuerpo(error).message) ??
    textoUtil(comoObjeto(error).message) ??
    textoUtil(error) ??
    respaldo
  );
}

/**
 * El código del error: `P2002` de Prisma, `ENOENT` del sistema de ficheros, o el
 * que venga en el cuerpo de una excepción de Nest. `undefined` si no hay.
 */
export function codigoDeError(error: unknown): string | undefined {
  const delCuerpo = cuerpo(error).code;
  if (typeof delCuerpo === 'string' && delCuerpo) return delCuerpo;

  const propio = comoObjeto(error).code;
  if (typeof propio === 'string' && propio) return propio;
  // Los errores de Node traen a veces el código como número (errno).
  if (typeof propio === 'number') return String(propio);

  return undefined;
}

/** El `meta` de un error de Prisma, que trae qué campo chocó. */
export function metaDeError(error: unknown): unknown {
  return comoObjeto(error).meta;
}

/** La pila, solo si es un `Error` de verdad; si no, el error como texto. */
export function pilaDeError(error: unknown): string | undefined {
  if (error instanceof Error) return error.stack;
  const propia = comoObjeto(error).stack;
  return typeof propia === 'string' ? propia : undefined;
}

/**
 * El estado HTTP que trae el error, si lo trae.
 *
 * `web-push` lo pone en `statusCode`: un 410 o un 404 significan que el
 * navegador ya no acepta esa suscripción y hay que desactivarla, así que de esto
 * cuelga una escritura en la base.
 */
export function estadoDeError(error: unknown): number | undefined {
  const estado = comoObjeto(error).statusCode;
  if (typeof estado === 'number') return estado;
  if (
    typeof estado === 'string' &&
    estado.trim() &&
    !Number.isNaN(Number(estado))
  ) {
    return Number(estado);
  }
  return undefined;
}
