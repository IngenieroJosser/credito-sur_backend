import * as fs from 'fs';
import * as path from 'path';

/**
 * Editar un crédito no puede dejarlo sin cuotas.
 *
 * ── El defecto ─────────────────────────────────────────────────────────────
 *
 * `updateLoan` —`PATCH /loans/:id`, que llama `EditarPrestamoModal`— rehace el
 * calendario cuando cambia el monto, la tasa, el plazo, la frecuencia, el tipo
 * de amortizacion, la cantidad de cuotas o la fecha de inicio. Lo hacia asi:
 *
 *     await this.prisma.cuota.deleteMany({ where: { prestamoId: id } });
 *     ... calculo del plan nuevo ...
 *     await this.prisma.cuota.createMany({ data: cuotasData });
 *     ...
 *     await this.prisma.prestamo.update({ ... });
 *
 * Tres escrituras sueltas. Si fallaba cualquier cosa despues del `deleteMany`
 * —la base ocupada, una validacion del plan, un timeout—, el credito se quedaba
 * con CERO cuotas y el borrado ya estaba confirmado.
 *
 * Y un credito sin cuotas no es un credito a medias: no tiene meta, no entra en
 * la jornada de ninguna ruta y no hay nada que cobrarle. Desaparece de la
 * operacion sin que nadie se entere, y el saldo sigue ahi.
 *
 * ── Por que una centinela de codigo ────────────────────────────────────────
 *
 * Reproducir el fallo pide una base que falle a mitad de camino. Lo que no
 * puede volver es la FORMA: que esas tres escrituras vuelvan a estar sueltas.
 */
const FUENTE = fs.readFileSync(path.join(__dirname, 'loans.service.ts'), 'utf8');

/** El cuerpo de `updateLoan`, para no acusar a otros metodos del archivo. */
const cuerpoDeUpdateLoan = (() => {
  const inicio = FUENTE.indexOf('async updateLoan(');
  expect(inicio).toBeGreaterThan(0);

  const resto = FUENTE.slice(inicio + 10);
  const siguiente = resto.search(/\n {2}(?:private |protected )?async \w+\(/);
  const cuerpo = siguiente > 0 ? resto.slice(0, siguiente) : resto;

  // Piso: si el recorte sale corto, la prueba estaria mirando casi nada.
  expect(cuerpo.length).toBeGreaterThan(3000);
  return cuerpo;
})();

describe('editar un credito rehace el calendario de forma atomica', () => {
  it('las tres escrituras van dentro de una transaccion', () => {
    expect(cuerpoDeUpdateLoan).toMatch(/await this\.prisma\.\$transaction\(/);
    expect(cuerpoDeUpdateLoan).toMatch(/tx\.cuota\.deleteMany\(/);
    expect(cuerpoDeUpdateLoan).toMatch(/tx\.cuota\.createMany\(/);
    expect(cuerpoDeUpdateLoan).toMatch(/tx\.prestamo\.update\(/);
  });

  it('ninguna de las tres se hace ya fuera de la transaccion', () => {
    expect(cuerpoDeUpdateLoan).not.toMatch(/this\.prisma\.cuota\.deleteMany\(/);
    expect(cuerpoDeUpdateLoan).not.toMatch(/this\.prisma\.cuota\.createMany\(/);
    expect(cuerpoDeUpdateLoan).not.toMatch(/this\.prisma\.prestamo\.update\(/);
  });

  it('la transaccion tiene plazo propio: 45 cuotas no caben en los 5 s de Prisma', () => {
    expect(cuerpoDeUpdateLoan).toMatch(/maxWait:\s*15_000/);
    expect(cuerpoDeUpdateLoan).toMatch(/timeout:\s*60_000/);
  });

  it('solo borra el calendario cuando de verdad hay que rehacerlo', () => {
    // El `else` del metodo —editar una nota, por ejemplo— no debe tocar las
    // cuotas. Si el borrado dejara de estar tras esa condicion, cualquier
    // edicion arrasaria el calendario.
    expect(cuerpoDeUpdateLoan).toMatch(/if \(rehacerCalendario\)/);
    expect(cuerpoDeUpdateLoan).toMatch(/rehacerCalendario = true/);
  });
});
