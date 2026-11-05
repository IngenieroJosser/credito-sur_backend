import {
  calcularDiasMoraCliente,
  type PrestamoParaDiasMora,
} from './dias-mora-cliente';

/**
 * Lo que se fija aquí, por encima de la aritmética, es la diferencia entre
 * "cero" y "no se sabe": de eso dependía que el listado de clientes pintara a
 * todo el mundo en verde.
 *
 * Las fechas llevan la hora de Bogotá explícita (`-05:00`). Escritas como
 * `'2026-10-04'` se interpretan en UTC, y al convertirlas a día de Bogotá caen
 * en el 3: las primeras versiones de estas pruebas fallaron por un día justo por
 * eso, y era la prueba la que estaba mal, no el cálculo.
 */
describe('calcularDiasMoraCliente', () => {
  // Miércoles 14 de octubre de 2026, media tarde en Bogotá.
  const HOY = new Date('2026-10-14T15:30:00-05:00');

  const conCuota = (
    fecha: string,
    frecuenciaPago?: string,
  ): PrestamoParaDiasMora => ({
    frecuenciaPago,
    cuotas: [{ fechaVencimiento: new Date(fecha) }],
  });

  it('cuenta los días desde la cuota impaga más antigua', () => {
    const prestamos = [conCuota('2026-10-04T00:00:00-05:00')];

    expect(calcularDiasMoraCliente(prestamos, HOY)).toBe(10);
  });

  it('con varios créditos devuelve el PEOR atraso, no el primero de la lista', () => {
    const prestamos = [
      conCuota('2026-10-10T00:00:00-05:00'),
      conCuota('2026-09-14T00:00:00-05:00'),
      conCuota('2026-10-13T00:00:00-05:00'),
    ];

    expect(calcularDiasMoraCliente(prestamos, HOY)).toBe(30);
  });

  it('una cuota que todavía no vence no es mora: da cero, no un negativo', () => {
    // Un negativo pasaría al revés cualquier comparación `> 0`: el cliente
    // contaría como moroso justo por no deber nada aún.
    const prestamos = [conCuota('2026-10-30T00:00:00-05:00')];

    expect(calcularDiasMoraCliente(prestamos, HOY)).toBe(0);
  });

  it('la cuota que vence hoy está al día', () => {
    const prestamos = [conCuota('2026-10-14T00:00:00-05:00')];

    expect(calcularDiasMoraCliente(prestamos, HOY)).toBe(0);
  });

  it('compara por día de Bogotá, no por el reloj del servidor', () => {
    // Esta cuota vence el 13 a las 22:00 de Bogotá, que en UTC ya es el 14. Si
    // se comparara en UTC el atraso saldría 0 en vez de 1. Es el fallo que
    // tenía el cálculo del export, que usaba `setHours(0,0,0,0)` —medianoche de
    // la zona del servidor— en vez de la clave de día de Bogotá.
    const prestamos = [conCuota('2026-10-13T22:00:00-05:00')];

    expect(calcularDiasMoraCliente(prestamos, HOY)).toBe(1);
  });

  it('a un crédito DIARIO no le cuenta los domingos', () => {
    // Del jueves 8 al miércoles 14 hay 6 días de calendario, pero el domingo 11
    // no hay jornada de cobro: nadie salió, así que el cliente no pudo
    // atrasarse ese día. El cálculo del export no miraba la frecuencia y a
    // estos créditos les inflaba el atraso.
    const prestamos = [conCuota('2026-10-08T00:00:00-05:00', 'DIARIO')];

    expect(calcularDiasMoraCliente(prestamos, HOY)).toBe(5);
  });

  it('al resto de frecuencias sí les cuenta el domingo', () => {
    const prestamos = [conCuota('2026-10-08T00:00:00-05:00', 'SEMANAL')];

    expect(calcularDiasMoraCliente(prestamos, HOY)).toBe(6);
  });

  it('con frecuencias distintas el máximo no sale de la fecha más vieja', () => {
    // El crédito más antiguo es DIARIO (se le descuentan domingos) y el más
    // reciente SEMANAL. Tomar la fecha más vieja y contar una sola vez daba 6;
    // el peor atraso real es el del semanal.
    const prestamos = [
      conCuota('2026-10-08T00:00:00-05:00', 'DIARIO'), // 5
      conCuota('2026-10-08T00:00:00-05:00', 'SEMANAL'), // 6
    ];

    expect(calcularDiasMoraCliente(prestamos, HOY)).toBe(6);
  });

  describe('el cero que SÍ es verdad', () => {
    it('un cliente sin créditos está al día', () => {
      expect(calcularDiasMoraCliente([], HOY)).toBe(0);
    });

    it('un cliente con todo pagado está al día', () => {
      // `cuotas: []` es "no le queda ninguna cuota sin pagar", que es un dato,
      // no un hueco.
      expect(calcularDiasMoraCliente([{ cuotas: [] }], HOY)).toBe(0);
    });

    it('un crédito pagado no tapa al que sí está atrasado', () => {
      const prestamos: PrestamoParaDiasMora[] = [
        { cuotas: [] },
        conCuota('2026-09-14T00:00:00-05:00'),
      ];

      expect(calcularDiasMoraCliente(prestamos, HOY)).toBe(30);
    });
  });

  describe('cuando no se puede saber devuelve null y NO cero', () => {
    // La distinción que importa: quien lo reciba pinta el cero en verde como
    // "al día". Un hueco disfrazado de cero es un cliente moroso en verde.

    it('cuando la relación de créditos no vino en la consulta', () => {
      expect(calcularDiasMoraCliente(null, HOY)).toBeNull();
      expect(calcularDiasMoraCliente(undefined, HOY)).toBeNull();
    });

    it('cuando a un crédito le falta la relación de cuotas', () => {
      expect(calcularDiasMoraCliente([{}], HOY)).toBeNull();
    });

    it('aunque los demás créditos sí la traigan', () => {
      // El que falta podría ser justo el del peor atraso, así que el total
      // completo tampoco se puede afirmar.
      const prestamos: PrestamoParaDiasMora[] = [
        conCuota('2026-10-13T00:00:00-05:00'),
        {},
      ];

      expect(calcularDiasMoraCliente(prestamos, HOY)).toBeNull();
    });
  });

  it('una cuota con fecha nula no cuenta, pero no anula al resto', () => {
    const prestamos: PrestamoParaDiasMora[] = [
      { cuotas: [{ fechaVencimiento: null }] },
      conCuota('2026-10-04T00:00:00-05:00'),
    ];

    expect(calcularDiasMoraCliente(prestamos, HOY)).toBe(10);
  });
});
