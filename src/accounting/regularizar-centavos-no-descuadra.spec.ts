import * as fs from 'fs';
import * as path from 'path';

/**
 * Redondear centavos no puede dejar nada descuadrado.
 *
 * `regularizarCentavos` —`POST /accounting/regularizar-centavos`, con
 * `dryRun` por defecto— arregla dos cosas distintas:
 *
 *   1. las CUOTAS de un credito con centavos, redondeandolas y poniendo el
 *      resto en la ULTIMA cuota pendiente para que la suma siga siendo el
 *      total del credito;
 *   2. las LINEAS de un asiento contable con centavos, redondeandolas solo
 *      cuando el asiento sigue cuadrando despues (si no, lo salta: el propio
 *      codigo dice «es peor un asiento torcido que unos centavos»).
 *
 * Los dos bucles escribian fila por fila, sueltos. Un fallo a mitad producia
 * justo lo que cada uno viene a evitar: un credito cuyas cuotas ya no suman la
 * deuda —descuadrado por ese resto que todavia no se habia escrito— o un
 * asiento con unas lineas redondeadas y otras no, o sea sin cuadrar.
 *
 * Y en el caso de las cuotas no se arregla en la siguiente pasada: `objetivo`
 * se recalcula desde `totalAntes`, que ya seria el estado a medio escribir, asi
 * que la segunda corrida cuadraria el credito contra un total distinto del
 * original.
 *
 * ── Por que una centinela de codigo ────────────────────────────────────────
 *
 * Reproducir el fallo pide una base que falle entre dos escrituras del mismo
 * bucle. Lo que no puede volver es la FORMA.
 */
const FUENTE = fs.readFileSync(
  path.join(__dirname, 'accounting.service.ts'),
  'utf8',
);

/** El cuerpo de `regularizarCentavos`, para no acusar a otros metodos. */
const CUERPO = (() => {
  const inicio = FUENTE.indexOf('async regularizarCentavos(');
  expect(inicio).toBeGreaterThan(0);
  const resto = FUENTE.slice(inicio + 10);
  const siguiente = resto.search(/\n {2}(?:private |protected )?async \w+\(/);
  const cuerpo = siguiente > 0 ? resto.slice(0, siguiente) : resto;
  // Piso medido: el metodo pasa de 5.000 caracteres. Si el recorte sale corto,
  // la centinela estaria mirando casi nada y pasaria en verde sin ver.
  expect(cuerpo.length).toBeGreaterThan(4000);
  return cuerpo;
})();

describe('regularizar centavos escribe cada grupo entero o ninguno', () => {
  it('hay una transaccion por cada uno de los dos bucles', () => {
    const transacciones = CUERPO.match(/await this\.prisma\.\$transaction\(/g);
    expect(transacciones?.length).toBe(2);
  });

  it('las cuotas de un credito se reescriben dentro de la transaccion', () => {
    expect(CUERPO).toMatch(/tx\.cuota\.update\(/);
    expect(CUERPO).not.toMatch(/this\.prisma\.cuota\.update\(/);
  });

  it('las lineas de un asiento tambien', () => {
    expect(CUERPO).toMatch(/tx\.journalLine\.update\(/);
    expect(CUERPO).not.toMatch(/this\.prisma\.journalLine\.update\(/);
  });

  it('las dos transacciones tienen plazo propio', () => {
    // Un credito puede llevar 45 cuotas y un asiento varias lineas: los 5 s por
    // defecto de Prisma no dan.
    const conPlazo = CUERPO.match(/maxWait: 15_000,\s*timeout: 60_000/g);
    expect(conPlazo?.length).toBe(2);
  });

  it('sigue sin tocar las cuotas ya cobradas', () => {
    // Redondear una cuota PAGADA o PARCIAL reescribiria dinero ya recibido.
    expect(CUERPO).toMatch(/\['PAGADA', 'PARCIAL'\]\.includes/);
  });

  it('y sigue saltandose el asiento que quedaria descuadrado', () => {
    expect(CUERPO).toMatch(/if \(neto !== 0\)/);
    expect(CUERPO).toMatch(/asientosOmitidos\.push\(/);
  });

  it('sin aplicar no escribe nada: `dryRun` sigue mandando', () => {
    // Las dos transacciones viven dentro de su `if (!dryRun)`.
    const guardas = CUERPO.match(/if \(!dryRun\) \{/g);
    expect(guardas?.length).toBe(2);
  });
});
