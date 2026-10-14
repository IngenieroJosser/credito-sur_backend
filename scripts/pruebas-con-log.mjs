/**
 * Corre las pruebas guardando la salida COMPLETA en un archivo.
 *
 *     pnpm test:log                 # toda la suite
 *     pnpm test:log src/clients     # igual que `jest`, acepta sus argumentos
 *
 * Por qué existe: hay un fallo intermitente de carga de suite —"Test Suites: 1
 * failed, 63 passed" con TODAS las pruebas ejecutadas pasando— que aparecio dos
 * veces y no se ha podido reproducir en veinte corridas completas, ni forzando
 * 15 workers ni con la cache de ts-jest borrada.
 *
 * Lo unico que falta para cerrarlo es el MENSAJE DE ERROR, y se perdio las dos
 * veces por mirar la salida con `grep` y quedarse solo con el resumen. Cuando
 * una suite no carga, Jest imprime el motivo en un bloque "Test suite failed to
 * run" que no sale en el resumen: si no se guarda la salida entera, el dato se
 * va con la terminal.
 *
 * Asi que esto no arregla nada; solo deja la evidencia preparada para la proxima
 * vez que pase. Si la corrida sale limpia, borra su log para no acumular
 * basura; si falla, lo conserva y escribe la ruta en pantalla.
 *
 * Lo que se sabe medido del fallo, para quien lea el log:
 *  - Las dos veces fue justo despues de editar archivos.
 *  - La primera perdio 6 pruebas, el numero exacto de `precios-cartera.spec.ts`,
 *    y la pila apuntaba a la linea donde ese archivo importa `exceljs`.
 *  - Cada worker ocupa ~600 MB de heap, aunque la prueba sea trivial.
 */
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const CARPETA = join(raiz, 'pruebas-logs');
/** Cuantos logs de fallos se conservan antes de ir borrando los mas viejos. */
const MAX_LOGS = 10;

mkdirSync(CARPETA, { recursive: true });

const sello = new Date()
  .toISOString()
  .replace(/[:.]/g, '-')
  .replace('T', '_')
  .slice(0, 19);
const rutaLog = join(CARPETA, `pruebas_${sello}.log`);
const log = createWriteStream(rutaLog, { flags: 'a' });

const argumentos = process.argv.slice(2);
log.write(`# jest ${argumentos.join(' ')}\n# ${new Date().toISOString()}\n\n`);

// `shell: true` porque en Windows `jest` es un .cmd y spawn no lo resuelve solo.
const jest = spawn('npx', ['jest', ...argumentos], {
  cwd: raiz,
  shell: true,
});

let salida = '';

/** A la pantalla y al archivo a la vez: la terminal sigue sirviendo igual. */
const reenviar = (origen, destino) => {
  origen.on('data', (trozo) => {
    const texto = trozo.toString();
    salida += texto;
    destino.write(texto);
    log.write(texto);
  });
};

reenviar(jest.stdout, process.stdout);
reenviar(jest.stderr, process.stderr);

jest.on('close', (codigo) => {
  log.end();

  const resumen = salida.match(/^Test Suites:.*$/m)?.[0] ?? '';
  const huboFallo = /failed/.test(resumen) || codigo !== 0;

  if (!huboFallo) {
    // Una corrida limpia no aporta nada y el log pesa varios MB.
    rmSync(rutaLog, { force: true });
    process.exit(codigo ?? 0);
  }

  // El bloque que Jest imprime cuando una suite no llega a cargar. Es justo lo
  // que se perdio las dos veces, asi que se repite al final para que no haya que
  // buscarlo entre miles de lineas.
  const bloques = salida.match(
    /●\s+Test suite failed to run[\s\S]{0,2000}?(?=\n\s*(?:●|PASS|FAIL|Test Suites:))/g,
  );

  console.error('\n' + '─'.repeat(72));
  console.error('SALIDA COMPLETA GUARDADA EN:');
  console.error('  ' + rutaLog);
  if (bloques?.length) {
    console.error(
      `\nUna suite no llego a cargar. El motivo (${bloques.length} bloque(s)):\n`,
    );
    for (const bloque of bloques) console.error(bloque.trim() + '\n');
  } else {
    console.error(
      '\nNo hay bloque "Test suite failed to run": el fallo fue de una prueba,',
    );
    console.error('no de la carga de una suite. El log tiene el detalle.');
  }
  console.error('─'.repeat(72) + '\n');

  // Se conservan solo los ultimos, por fecha de modificacion.
  const viejos = readdirSync(CARPETA)
    .filter((n) => n.endsWith('.log'))
    .map((n) => ({ n, t: statSync(join(CARPETA, n)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
    .slice(MAX_LOGS);
  for (const { n } of viejos) rmSync(join(CARPETA, n), { force: true });

  process.exit(codigo ?? 1);
});
