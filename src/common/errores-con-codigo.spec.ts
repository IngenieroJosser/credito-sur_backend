import * as fs from 'fs';
import * as path from 'path';

/**
 * Que un mensaje para la persona no se lance como `Error` pelado.
 *
 * Nest no sabe qué código HTTP darle a un `Error` normal, así que lo sirve como
 * 500 con el texto genérico «Ocurrió un error inesperado y la operación no se
 * realizó», y el motivo verdadero se queda en el log del servidor. Para quien
 * está en la pantalla es indistinguible de que el sistema se cayó.
 *
 * Se encontró llamando a las 218 rutas con los siete roles. Tres de las cinco
 * que respondían 500 eran esto:
 *
 *  - `POST /loans/:id/approve` lanzaba `new Error('El préstamo no está en
 *    estado pendiente de aprobación')`. Es el caso de todos los días: dos
 *    personas aprueban el mismo crédito, y la segunda recibía un 500 en vez de
 *    «ya está aprobado», así que volvía a intentarlo.
 *  - `PATCH /loans/:id/restore` igual, con «El préstamo no está eliminado».
 *  - `GET` de reportes lanzaba `new Error('PrÃ©stamo no encontrado')`, con el
 *    texto además corrompido por una conversión de codificación.
 *
 * Lo que se exige: en controladores y servicios, un `throw` que lleve un texto
 * dirigido a una persona tiene que usar una excepción de Nest, que es la que
 * carga el código HTTP. Los `Error` que describen una condición imposible del
 * programa —no un error del usuario— se declaran abajo uno por uno.
 */

const RAIZ = path.join(__dirname, '..');

/**
 * Los `Error` pelados que SÍ deben seguir siendo `Error`.
 *
 * Cada uno describe algo que no puede pasar si el programa está bien: no hay
 * nada que la persona pueda corregir, y un 500 es la respuesta honesta. La
 * lista es explícita y corta a propósito: si crece, la regla se está erosionando.
 */
const INVARIANTES_DEL_PROGRAMA = [
  // Si la zona horaria de Bogotá no se puede calcular, no es un dato mal
  // escrito: es el entorno roto.
  'No se pudo calcular el dayKey de Bogotá',
  // El cierre de jornada sin usuario creador indica datos incoherentes en la
  // base, no una acción de la persona.
  'No se pudo determinar el usuario creador',
  // El error de una llamada HTTP a otro servicio, que se envuelve más arriba.
  'Error ${res.status}',
];

/** Un `throw new Error(...)` con el texto que lleva, si cabe en una o dos líneas. */
const ERROR_PELADO = /throw new Error\(\s*(?:`|')([^`'\n]{0,200})/g;

function sinComentarios(fuente: string): string {
  const hueco = (m: string) => m.replace(/[^\n]/g, ' ');
  return fuente.replace(/\/\/[^\n]*/g, hueco).replace(/\/\*[\s\S]*?\*\//g, hueco);
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
    // Solo lo que atiende peticiones. Un `Error` dentro de un script de
    // migración o de una prueba no llega a ninguna pantalla.
    if (
      !entrada.name.endsWith('.controller.ts') &&
      !entrada.name.endsWith('.service.ts')
    ) {
      continue;
    }
    if (entrada.name.includes('.spec.') || entrada.name.includes('.test.')) {
      continue;
    }
    salida.push(completo);
  }
  return salida;
}

describe('un mensaje para la persona lleva su código HTTP', () => {
  it('ningún controlador ni servicio lanza un Error pelado con texto de usuario', () => {
    const pelados: string[] = [];

    for (const archivo of fuentes(RAIZ)) {
      const fuente = sinComentarios(fs.readFileSync(archivo, 'utf8'));
      const relativo = path.relative(RAIZ, archivo).replace(/\\/g, '/');

      for (const hallado of fuente.matchAll(ERROR_PELADO)) {
        const texto = hallado[1];
        if (INVARIANTES_DEL_PROGRAMA.some((inv) => texto.includes(inv))) {
          continue;
        }
        const linea = fuente.slice(0, hallado.index).split('\n').length;
        pelados.push(`${relativo}:${linea} -> «${texto}»`);
      }
    }

    // El motivo va dentro de lo comparado: Jest ignora en silencio un segundo
    // argumento con el mensaje —eso es Vitest— y el informe saldría mudo.
    const informe = pelados.length
      ? [
          'Estos `throw new Error(...)` llevan un texto dirigido a una persona,',
          'y Nest los sirve como 500 «Ocurrió un error inesperado»: el motivo',
          'de verdad se queda en el log y la pantalla no puede explicarlo.',
          '',
          ...pelados.map((p) => `  - ${p}`),
          '',
          'Usa la excepción que corresponda —NotFoundException (404),',
          'BadRequestException (400), ConflictException (409),',
          'UnauthorizedException (401), ForbiddenException (403)—. Si de verdad',
          'describe una condición imposible del programa y no algo que la',
          'persona pueda corregir, añádelo a INVARIANTES_DEL_PROGRAMA con el',
          'motivo escrito.',
        ].join('\n')
      : 'ninguno';

    expect(informe).toBe('ninguno');
  });

  it('no hay texto corrompido por codificación en los mensajes', () => {
    // `PrÃ©stamo` es «Préstamo» leído como Latin-1 y vuelto a guardar como
    // UTF-8. Apareció en reports.service.ts y habría salido así en pantalla.
    const MOJIBAKE = /Ã[©³¡±º­¼½]|Â[¡¿]|ï¿½/;
    const dañados: string[] = [];

    for (const archivo of fuentes(RAIZ)) {
      const fuente = fs.readFileSync(archivo, 'utf8');
      fuente.split('\n').forEach((linea, i) => {
        if (MOJIBAKE.test(linea)) {
          dañados.push(
            `${path.relative(RAIZ, archivo).replace(/\\/g, '/')}:${i + 1}`,
          );
        }
      });
    }

    const informe = dañados.length
      ? `Texto corrompido por codificación en:\n${dañados.map((d) => `  - ${d}`).join('\n')}`
      : 'ninguno';

    expect(informe).toBe('ninguno');
  });
});
