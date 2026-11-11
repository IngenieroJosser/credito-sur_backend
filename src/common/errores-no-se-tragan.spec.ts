import * as fs from 'fs';
import * as path from 'path';

/**
 * Que un `catch` no convierta un mensaje claro en «Error interno del servidor».
 *
 * El patrón es siempre el mismo: el servicio valida algo y lanza una excepción
 * de Nest con su mensaje —`ConflictException('Ya existe un cliente activo con
 * ese número de documento: …')`—, y más abajo, en el mismo `try`, un `catch`
 * final la recoge junto con los fallos de verdad inesperados y la reemplaza por
 * `new InternalServerErrorException('Error interno del servidor')`. Compila,
 * pasa las pruebas unitarias del camino feliz, y la persona que registra un
 * cliente recibe un 500 sin saber que el cliente ya existía.
 *
 * Pasó en `clients.service.ts`: el mensaje correcto se lanzaba en la línea 1003
 * y se destruía en la 1434. Se encontró registrando dos veces el mismo
 * documento contra la base de pruebas —el error más común del día a día—, no
 * leyendo el código.
 *
 * Lo que se exige es el reflejo que lo evita: si en un `try` se lanza alguna
 * excepción HTTP y su `catch` puede acabar en un 500 genérico, ese `catch`
 * tiene que dejar pasar primero lo que ya viene explicado
 * (`if (error instanceof HttpException) throw error`).
 *
 * Se mide por bloque y no por archivo, porque medirlo por archivo daba falsos
 * positivos y un falso positivo en una prueba centinela es peor que no tenerla:
 * se acaba desactivando. `backup.service.ts` lanza un 500 genérico y lanza
 * excepciones explicadas, pero las explicadas están todas FUERA del `try`, así
 * que no se traga ninguna. Comprobado leyendo el bloque, no deduciéndolo.
 *
 * Para emparejar cada `catch` con su `try` se cuentan llaves, después de borrar
 * comentarios, cadenas y expresiones regulares: una llave dentro de un texto no
 * abre nada. El límite de la medición, dicho explícitamente: solo se miran los
 * `throw` escritos literalmente dentro del bloque. Una validación que viva en
 * un método aparte y se llame desde el `try` no se ve desde aquí.
 */

const RAIZ = path.join(__dirname, '..');

/** Lo que se busca: el 500 genérico como última salida de un `catch`. */
const LANZA_500 = /throw new InternalServerErrorException\(/;

/** La guarda que lo hace inofensivo. */
const DEJA_PASAR =
  /instanceof\s+HttpException|instanceof\s+(?:Bad|Not|Un|Con|Forbidden)[A-Za-z]*Exception\s*\)\s*\{?\s*throw/;

/** Alguna excepción de Nest con mensaje propio lanzada en este archivo. */
const LANZA_EXPLICADO =
  /throw new (?:BadRequest|NotFound|Conflict|Unauthorized|Forbidden|UnprocessableEntity|Gone|PreconditionFailed)Exception\(/;

/**
 * Comentarios y cadenas se borran antes de buscar, dejando huecos del mismo
 * largo para que las posiciones no se muevan.
 *
 * Los comentarios, porque este archivo mismo nombra los dos patrones en su
 * explicación de arriba y la prueba se encontraría a sí misma. Las cadenas,
 * porque abajo se cuentan llaves para emparejar `try` con `catch`, y una llave
 * dentro de un mensaje —`` `${x}` ``, `'{'`— descuadraría la cuenta.
 */
function soloCodigo(fuente: string): string {
  const hueco = (m: string) => m.replace(/[^\n]/g, ' ');
  return fuente
    .replace(/\/\/[^\n]*/g, hueco)
    .replace(/\/\*[\s\S]*?\*\//g, hueco)
    .replace(/`(?:\\[\s\S]|[^`\\])*`/g, hueco)
    .replace(/'(?:\\.|[^'\\\n])*'/g, hueco)
    .replace(/"(?:\\.|[^"\\\n])*"/g, hueco);
}

/**
 * Los bloques `try { … } catch (e) { … }` de un archivo, ya sin comentarios ni
 * cadenas, cada uno con el texto del `try` y el del `catch` por separado.
 *
 * Se recorre contando llaves desde cada `try`. Si la cuenta no cierra —código
 * que no compila, o una llave que se colara pese al borrado de cadenas— ese
 * bloque se descarta en silencio: una prueba centinela que se equivoca al
 * interpretar el archivo debe callarse, no acusar.
 */
function bloques(fuente: string): { intento: string; captura: string }[] {
  const salida: { intento: string; captura: string }[] = [];
  const cuerpo = (desde: number): { texto: string; fin: number } | null => {
    const abre = fuente.indexOf('{', desde);
    if (abre === -1) return null;
    let nivel = 0;
    for (let i = abre; i < fuente.length; i++) {
      if (fuente[i] === '{') nivel++;
      else if (fuente[i] === '}') {
        nivel--;
        if (nivel === 0) return { texto: fuente.slice(abre + 1, i), fin: i + 1 };
      }
    }
    return null;
  };

  const TRY = /\btry\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = TRY.exec(fuente)) !== null) {
    const intento = cuerpo(m.index);
    if (!intento) continue;
    const resto = fuente.slice(intento.fin);
    // `catch` tiene que venir inmediatamente después del `try`; si hay otra
    // cosa en medio es un `try`/`finally` y aquí no hay nada que tragarse.
    if (!/^\s*catch\s*\(/.test(resto)) continue;
    const captura = cuerpo(intento.fin);
    if (!captura) continue;
    salida.push({ intento: intento.texto, captura: captura.texto });
  }
  return salida;
}

function fuentes(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entrada.name === 'node_modules' || entrada.name === 'dist') continue;
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      salida.push(...fuentes(completo));
      continue;
    }
    if (!entrada.name.endsWith('.ts')) continue;
    // Las propias pruebas quedan fuera: un doble que simula un 500 no es un
    // `catch` que se trague nada.
    if (entrada.name.endsWith('.spec.ts') || entrada.name.endsWith('.test.ts')) {
      continue;
    }
    salida.push(completo);
  }
  return salida;
}

describe('un error explicado no se convierte en 500 genérico', () => {
  it('todo archivo que pueda lanzar un 500 genérico deja pasar antes lo explicado', () => {
    const sinGuarda: string[] = [];

    for (const archivo of fuentes(RAIZ)) {
      const fuente = soloCodigo(fs.readFileSync(archivo, 'utf8'));
      if (!LANZA_500.test(fuente)) continue;

      for (const { intento, captura } of bloques(fuente)) {
        // El `catch` no puede acabar en un 500 genérico: nada que tragarse.
        if (!LANZA_500.test(captura)) continue;
        // En el `try` no se lanza nada explicado: el 500 es la única
        // respuesta posible y está bien puesto.
        if (!LANZA_EXPLICADO.test(intento)) continue;
        // El `catch` deja pasar lo explicado antes de llegar al 500.
        if (DEJA_PASAR.test(captura)) continue;

        sinGuarda.push(path.relative(RAIZ, archivo).replace(/\\/g, '/'));
        break;
      }
    }

    // El motivo va DENTRO de lo que se compara. Jest no acepta un segundo
    // argumento con el mensaje —eso es Vitest—, y pasarlo no falla: lo ignora
    // en silencio y el informe sale sin la explicación.
    const informe = sinGuarda.length
      ? [
          'Estos archivos lanzan excepciones con mensaje propio Y pueden acabar',
          'en «Error interno del servidor», sin dejar pasar primero lo',
          'explicado. La persona que use la pantalla verá un 500 en vez del',
          'motivo:',
          '',
          ...sinGuarda.map((f) => `  - ${f}`),
          '',
          'El remedio es una línea al principio del catch:',
          '  if (error instanceof HttpException) throw error;',
        ].join('\n')
      : 'ninguno';

    expect(informe).toBe('ninguno');
  });
});
