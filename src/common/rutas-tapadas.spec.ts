import * as fs from 'fs';
import * as path from 'path';

/**
 * Que ninguna ruta quede inalcanzable por el orden en que se declara.
 *
 * Nest empareja las rutas en el orden en que aparecen en la clase. Si
 * `@Get(':id')` está declarado antes que `@Get('algo-literal')` y las dos
 * tienen el mismo número de segmentos, `:id` se queda con la petición y la
 * literal no se ejecuta nunca.
 *
 * No es hipotético: `@Get('reprogramaciones-pendientes')` estaba mil líneas
 * por debajo de `@Get(':id')` en el controlador de créditos, así que pedir la
 * lista de reprogramaciones pendientes respondía «Préstamo no encontrado»
 * —entraba por findOne con id = "reprogramaciones-pendientes"—. Compilaba,
 * arrancaba, aparecía en el log de rutas mapeadas y en Swagger, y no servía.
 *
 * Se encontró simulando una jornada de trabajo completa, no leyendo el código.
 * Esta prueba es para que no vuelva.
 */

const RAIZ = path.join(__dirname, '..');

const DECORADOR =
  /@(Get|Post|Patch|Put|Delete)\(\s*(?:'([^']*)'|"([^"]*)")?\s*\)/g;

/** Los comentarios se borran: un decorador nombrado en una explicación no declara nada. */
function sinComentarios(fuente: string): string {
  return fuente
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function controladores(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entrada.name === 'node_modules' || entrada.name === 'dist') continue;
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...controladores(completo));
    else if (entrada.name.endsWith('.controller.ts')) salida.push(completo);
  }
  return salida;
}

const segmentos = (camino: string) => camino.split('/').filter(Boolean);

describe('ninguna ruta queda tapada por otra con parámetro', () => {
  it('toda ruta literal se declara antes que la de parámetro que la cubriría', () => {
    const tapadas: string[] = [];

    for (const archivo of controladores(RAIZ)) {
      const rel = path.relative(RAIZ, archivo).split(path.sep).join('/');
      const fuente = sinComentarios(fs.readFileSync(archivo, 'utf8'));

      const declaradas: Array<{
        linea: number;
        metodo: string;
        camino: string;
      }> = [];
      for (const m of fuente.matchAll(DECORADOR)) {
        declaradas.push({
          linea: fuente.slice(0, m.index).split('\n').length,
          metodo: m[1],
          camino: m[2] ?? m[3] ?? '',
        });
      }

      declaradas.forEach((ruta, i) => {
        const segs = segmentos(ruta.camino);

        for (const antes of declaradas.slice(0, i)) {
          if (antes.metodo !== ruta.metodo) continue;
          const segsAntes = segmentos(antes.camino);
          if (segsAntes.length !== segs.length) continue;

          // La anterior cubre a esta si en cada posición, o es un parámetro
          // (traga cualquier cosa) o es exactamente el mismo texto.
          const cubre = segsAntes.every(
            (a, k) => a.startsWith(':') || a === segs[k],
          );
          // Y al menos en un sitio hay un parámetro donde esta tiene literal:
          // si las dos son literales distintas no se estorban.
          const pisaUnLiteral = segsAntes.some(
            (a, k) => a.startsWith(':') && !segs[k].startsWith(':'),
          );

          if (cubre && pisaUnLiteral) {
            tapadas.push(
              `${rel}:${ruta.linea} @${ruta.metodo}('${ruta.camino}') nunca se alcanza: ` +
                `la tapa @${antes.metodo}('${antes.camino}') de la línea ${antes.linea}. ` +
                `Muévela por encima.`,
            );
            break;
          }
        }
      });
    }

    expect(tapadas.join('\n')).toBe('');
  });
});
