import * as fs from 'fs';
import * as path from 'path';

/**
 * Que toda cuenta contable que el código exige exista en las migraciones.
 *
 * Lo que pasó: `POST /accounting/gastos` comprueba que existan las cuentas
 * `1.6.1` y `1.2.1` antes de asentar un gasto de ruta, y responde
 *
 *     [GASTO_PROVISIONAL] Faltan cuentas contables requeridas para registrar
 *     gasto provisional: 1.6.1
 *
 * La cuenta `1.6.1` está definida en `seed-accounting.ts`, pero ese archivo no
 * lo ejecuta nada —ni package.json, ni el arranque, ni otra semilla— y la
 * migración que siembra el plan de cuentas no la incluía. El despliegue corre
 * migraciones, así que faltaba también en producción: un cobrador que echaba
 * gasolina a la moto no podía anotarlo, y con eso quedaba bloqueado el ciclo
 * entero del gasto, porque la aprobación usa la misma cuenta para
 * reclasificarlo.
 *
 * Se encontró simulando una jornada de cobro completa, no leyendo el código.
 *
 * Esta prueba cierra la grieta: cualquier código de cuenta que aparezca en el
 * código de los servicios tiene que estar sembrado por una migración. Mirar la
 * semilla no serviría —justamente la semilla sí la tenía—; lo que corre en el
 * despliegue son las migraciones.
 */

const RAIZ = path.join(__dirname, '..');
const MIGRACIONES = path.join(__dirname, 'migrations');

/**
 * Los códigos de cuenta que el código nombra, sacados de donde de verdad se
 * usan: `accountCode: '…'` y las listas de cuentas requeridas.
 *
 * No se busca cualquier cosa que parezca un número con puntos: eso recogería
 * versiones, porcentajes y fechas. Solo los sitios que declaran una cuenta.
 */
const DECLARACIONES = [
  /accountCode:\s*'([0-9][0-9.A-Z]*)'/g,
  /cuentasRequeridas\s*=\s*\[([^\]]*)\]/g,
  /accountCodeContrapartida:\s*'([0-9][0-9.A-Z]*)'/g,
];

function sinComentarios(fuente: string): string {
  const hueco = (m: string) => m.replace(/[^\n]/g, ' ');
  return fuente
    .replace(/\/\/[^\n]*/g, hueco)
    .replace(/\/\*[\s\S]*?\*\//g, hueco);
}

function archivosDeServicio(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entrada.name === 'node_modules' || entrada.name === 'dist') continue;
    if (entrada.name === 'migrations') continue;
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      salida.push(...archivosDeServicio(completo));
      continue;
    }
    if (!entrada.name.endsWith('.ts')) continue;
    if (entrada.name.includes('.spec.') || entrada.name.includes('.test.')) {
      continue;
    }
    // La semilla se excluye a propósito: tenía la cuenta y no sirvió de nada,
    // porque nadie la ejecuta. Lo que vale es lo que corre en el despliegue.
    if (entrada.name.startsWith('seed')) continue;
    salida.push(completo);
  }
  return salida;
}

/** Todo el SQL de las migraciones, junto. */
function sqlDeMigraciones(): string {
  const partes: string[] = [];
  const recorrer = (dir: string) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const completo = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        recorrer(completo);
        continue;
      }
      if (entrada.name.endsWith('.sql')) {
        partes.push(fs.readFileSync(completo, 'utf8'));
      }
    }
  };
  recorrer(MIGRACIONES);
  return partes.join('\n');
}

describe('las cuentas contables que el código exige están sembradas', () => {
  it('toda cuenta nombrada en los servicios la crea una migración', () => {
    const exigidas = new Set<string>();
    const dondeSeUsa = new Map<string, string>();

    for (const archivo of archivosDeServicio(RAIZ)) {
      const fuente = sinComentarios(fs.readFileSync(archivo, 'utf8'));
      const relativo = path.relative(RAIZ, archivo).replace(/\\/g, '/');

      for (const patron of DECLARACIONES) {
        for (const hallado of fuente.matchAll(patron)) {
          // En `cuentasRequeridas = ['1.6.1', '1.2.1']` el grupo trae la lista
          // entera; se parten las comillas.
          for (const codigo of hallado[1].match(/[0-9][0-9.A-Z]*/g) ?? []) {
            exigidas.add(codigo);
            if (!dondeSeUsa.has(codigo)) dondeSeUsa.set(codigo, relativo);
          }
        }
      }
    }

    // Si no se encontró ninguna, el patrón dejó de encajar con el código y
    // esta prueba estaría pasando sin comprobar nada.
    expect(exigidas.size).toBeGreaterThan(3);

    const sql = sqlDeMigraciones();
    const faltantes = [...exigidas]
      .filter((codigo) => !sql.includes(`'${codigo}'`))
      .sort();

    const informe = faltantes.length
      ? [
          'El código exige estas cuentas contables y ninguna migración las crea.',
          'La operación que las use va a fallar en producción, aunque estén en',
          'la semilla: el despliegue corre migraciones, no semillas.',
          '',
          ...faltantes.map((c) => `  - ${c}  (usada en ${dondeSeUsa.get(c)})`),
        ].join('\n')
      : 'ninguna';

    expect(informe).toBe('ninguna');
  });
});
