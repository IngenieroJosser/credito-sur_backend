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
const FUENTE = fs.readFileSync(
  path.join(__dirname, 'loans.service.ts'),
  'utf8',
);

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

/**
 * Aprobar un credito tampoco puede dejar medio calendario movido.
 *
 * `approveLoan` —`POST /loans/:id/approve`— reagenda las cuotas pendientes
 * cuando el credito se aprueba despues de su fecha de inicio. Era un bucle de
 * `cuota.update` sueltos, uno por cuota, seguido del update del prestamo: si
 * fallaba en la 15 de 30, quedaba medio calendario en las fechas nuevas y medio
 * en las viejas, con el prestamo sin su `fechaInicio` movida. Y como el estado
 * seguia en PENDIENTE_APROBACION, el siguiente intento volvia a mover las que ya
 * se habian movido.
 *
 * La interfaz hoy no llama a esta ruta —usa `/approvals/:id/approve`, que si es
 * transaccional— pero el endpoint esta expuesto con sus roles.
 */
describe('aprobar un credito reagenda de forma atomica', () => {
  const cuerpo = (() => {
    const inicio = FUENTE.indexOf('async approveLoan(');
    expect(inicio).toBeGreaterThan(0);
    const resto = FUENTE.slice(inicio + 10);
    const siguiente = resto.search(/\n {2}(?:private |protected )?async \w+\(/);
    const c = siguiente > 0 ? resto.slice(0, siguiente) : resto;
    expect(c.length).toBeGreaterThan(1500);
    return c;
  })();

  it('el bucle de cuotas y el update del prestamo van en una transaccion', () => {
    expect(cuerpo).toMatch(/await this\.prisma\.\$transaction\(/);
    expect(cuerpo).toMatch(/tx\.cuota\.update\(/);
    expect(cuerpo).toMatch(/tx\.prestamo\.update\(/);
  });

  it('ya no quedan `cuota.update` sueltos reagendando', () => {
    expect(cuerpo).not.toMatch(/this\.prisma\.cuota\.update\(/);
  });

  it('el ultimo update —el que pone ACTIVO— sigue fuera, y es uno solo', () => {
    // Ese no necesita compañia: es una sola escritura, atomica por si misma.
    const sueltos = cuerpo.match(/this\.prisma\.prestamo\.update\(/g) || [];
    expect(sueltos.length).toBe(1);
  });
});

/** El cuerpo de un metodo del servicio, sin invadir el siguiente. */
const cuerpoDe = (nombre: string, minimo: number) => {
  const inicio = FUENTE.indexOf(`async ${nombre}(`);
  expect(inicio).toBeGreaterThan(0);
  const resto = FUENTE.slice(inicio + 10);
  const siguiente = resto.search(/\n {2}(?:private |protected )?async \w+\(/);
  const cuerpo = siguiente > 0 ? resto.slice(0, siguiente) : resto;
  // Piso medido: si el recorte sale corto, la centinela mira casi nada.
  expect(cuerpo.length).toBeGreaterThan(minimo);
  return cuerpo;
};

/**
 * Archivar o rechazar un credito cierra tambien su solicitud.
 *
 * `deleteLoan` y `rejectLoan` hacen dos escrituras: el prestamo y la
 * `aprobacion` PENDIENTE que lo espera en revisiones. Estaban sueltas, y si
 * fallaba la segunda el credito quedaba archivado o rechazado con su solicitud
 * todavia PENDIENTE.
 *
 * Eso no es cosmetico: `confirmarPrestamoProvisional`
 * (`approvals.service.ts`) actualiza el prestamo por id, sin comprobar
 * `eliminadoEn` ni `estadoAprobacion`. Aprobar esa solicitud huerfana devuelve
 * el credito a ACTIVO y desembolsa.
 *
 * Medido contra la base de desarrollo el 2026-11-19: 39 aprobaciones
 * PENDIENTE, 4 de ellas de NUEVO_PRESTAMO, y CERO sobre un prestamo borrado o
 * rechazado, con 65 prestamos archivados y 65 rechazados en la tabla. O sea: el
 * camino feliz cierra bien y lo que queda abierto es la ventana de fallo
 * parcial. El limite de la medicion: solo mira el estado de HOY, no si alguna
 * vez ocurrio y se corrigio a mano.
 *
 * `archiveLoan` —el otro camino de archivado— ya hacia estas dos escrituras
 * dentro de una transaccion. Era el mismo par, decidido de dos maneras.
 */
describe('archivar y rechazar cierran la solicitud en el mismo acto', () => {
  it('deleteLoan hace las dos escrituras en una transaccion', () => {
    const cuerpo = cuerpoDe('deleteLoan', 1200);
    expect(cuerpo).toMatch(/await this\.prisma\.\$transaction\(/);
    expect(cuerpo).toMatch(/tx\.prestamo\.update\(/);
    expect(cuerpo).toMatch(/tx\.aprobacion\.updateMany\(/);
    expect(cuerpo).not.toMatch(/this\.prisma\.prestamo\.update\(/);
    expect(cuerpo).not.toMatch(/this\.prisma\.aprobacion\.updateMany\(/);
  });

  it('rejectLoan hace las dos escrituras en una transaccion', () => {
    const cuerpo = cuerpoDe('rejectLoan', 1200);
    expect(cuerpo).toMatch(/await this\.prisma\.\$transaction\(/);
    expect(cuerpo).toMatch(/tx\.prestamo\.update\(/);
    expect(cuerpo).toMatch(/tx\.aprobacion\.updateMany\(/);
    expect(cuerpo).not.toMatch(/this\.prisma\.prestamo\.update\(/);
    expect(cuerpo).not.toMatch(/this\.prisma\.aprobacion\.updateMany\(/);
  });

  it('y las dos siguen anulando solo las aprobaciones PENDIENTE', () => {
    // Si el filtro desapareciera, archivar un credito reescribiria tambien las
    // aprobaciones ya resueltas y se perderia el rastro de quien las aprobo.
    for (const nombre of ['deleteLoan', 'rejectLoan']) {
      expect(cuerpoDe(nombre, 1200)).toMatch(
        /estado: EstadoAprobacion\.PENDIENTE/,
      );
    }
  });
});

/**
 * La correccion masiva de intereses ajusta el credito y sus cuotas a la vez.
 *
 * `fixInterestCalculations` —`POST /loans/fix-interest-calculations`, solo
 * SUPER_ADMINISTRADOR, y tambien al arranque si `AUTOFIX_INTERESES=1`, que no
 * esta puesto en ningun `.env` del repo— subia `interesTotal` y
 * `saldoPendiente` del prestamo y luego repartia la diferencia cuota por cuota,
 * todo suelto.
 *
 * Un fallo a mitad del reparto dejaba la suma de las cuotas por debajo de la
 * deuda. Y no se arreglaba solo: la condicion de entrada compara el interes
 * correcto con `interesTotal`, que ya estaria corregido, asi que ese credito no
 * vuelve a entrar nunca.
 */
describe('la correccion de intereses no deja un credito a medio ajustar', () => {
  it('el update del prestamo y el reparto por cuotas van juntos', () => {
    const cuerpo = cuerpoDe('fixInterestCalculations', 2000);
    expect(cuerpo).toMatch(/await this\.prisma\.\$transaction\(/);
    expect(cuerpo).toMatch(/tx\.prestamo\.update\(/);
    expect(cuerpo).toMatch(/tx\.cuota\.update\(/);
  });

  it('ya no queda ninguna de las dos suelta', () => {
    const cuerpo = cuerpoDe('fixInterestCalculations', 2000);
    expect(cuerpo).not.toMatch(/this\.prisma\.prestamo\.update\(/);
    expect(cuerpo).not.toMatch(/this\.prisma\.cuota\.update\(/);
  });

  it('el residuo sigue yendo a la ultima cuota', () => {
    // Repartir en pesos enteros deja un resto; si dejara de sumarse a la
    // ultima, el ajuste perderia pesos y la suma no cerraria.
    const cuerpo = cuerpoDe('fixInterestCalculations', 2000);
    expect(cuerpo).toMatch(/ajustePorCuota \+ residuo/);
  });
});

/**
 * La mora automatica NO lleva transaccion, a proposito.
 *
 * Es el septimo metodo de la misma lista, y aqui la medicion dice que no hace
 * falta: sus escrituras son filas sueltas e independientes —una cuota a
 * VENCIDA, un prestamo a EN_MORA, otro de vuelta a ACTIVO—, cada paso se
 * recalcula desde su propia consulta y repetir la corrida converge al mismo
 * estado. No hay ninguna invariante que una dos escrituras, asi que una
 * transaccion no cambiaria ningun resultado y solo mantendria un bloqueo largo
 * sobre miles de filas.
 *
 * Esta prueba existe para que la decision quede escrita y nadie la "arregle"
 * sin volver a medir. Si alguna vez dos escrituras de mora dependen una de
 * otra, hay que cambiarla.
 */
describe('la mora automatica se queda sin transaccion', () => {
  const MORA = fs.readFileSync(path.join(__dirname, 'mora.service.ts'), 'utf8');

  it('cada paso sigue siendo una escritura independiente', () => {
    expect(MORA).toMatch(/await this\.prisma\.cuota\.updateMany\(/);
    expect(MORA).toMatch(/await this\.prisma\.prestamo\.update\(/);
  });

  it('y cada fallo se anota sin tumbar la corrida', () => {
    // Es lo que hace segura la ausencia de transaccion: un prestamo que falla
    // se apunta en `errores` y los demas siguen.
    expect(MORA).toMatch(/resultado\.errores\.push\(/);
  });
});
