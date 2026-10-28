import {
  formatBogotaFecha,
  formatBogotaFechaHora,
  formatBogotaFechaHoraPad2,
  formatBogotaFechaLarga,
  formatBogotaFechaPad2,
  formatBogotaHora,
  getBogotaDayKey,
} from './date-utils';

/**
 * El servidor corre en UTC. Todo lo registrado desde las 7 p. m. de Bogota ya
 * es el dia siguiente en UTC, y ahi es donde las exportaciones mostraban la
 * fecha "corrida" un dia.
 */
describe('fechas en hora de Bogota', () => {
  // 5 de junio, 7:30 p. m. en Bogota = 6 de junio, 00:30 UTC.
  const nocheEnBogota = new Date('2026-06-06T00:30:00.000Z');
  // Medianoche de Bogota, que es como se guardan los vencimientos de cuota.
  const medianocheBogota = new Date('2026-06-05T05:00:00.000Z');

  it('mantiene el dia real aunque en UTC ya sea el siguiente', () => {
    expect(formatBogotaFecha(nocheEnBogota)).toBe('5/6/2026');
    expect(getBogotaDayKey(nocheEnBogota)).toBe('2026-06-05');
    // Asi salia antes: el formateo sin zona sigue el reloj del proceso.
    expect(nocheEnBogota.toISOString().slice(0, 10)).toBe('2026-06-06');
  });

  it('no corre la fecha de una medianoche de Bogota', () => {
    expect(formatBogotaFecha(medianocheBogota)).toBe('5/6/2026');
    expect(getBogotaDayKey(medianocheBogota)).toBe('2026-06-05');
  });

  it('formatea fecha y hora en Bogota, no en UTC', () => {
    const texto = formatBogotaFechaHora(nocheEnBogota);
    expect(texto).toContain('5/6/2026');
    expect(texto).toMatch(/7:30/);
  });

  it('acepta cadenas y numeros, y devuelve vacio si la fecha no sirve', () => {
    expect(formatBogotaFecha('2026-06-06T00:30:00.000Z')).toBe('5/6/2026');
    expect(formatBogotaFecha(nocheEnBogota.getTime())).toBe('5/6/2026');
    expect(formatBogotaFecha('no es una fecha')).toBe('');
    expect(formatBogotaFechaHora('no es una fecha')).toBe('');
  });

  /**
   * Las versiones de dos digitos, que son las que usa el respaldo en Excel.
   * Ese archivo tenia su propia copia escrita con `d.getDate()` y fechaba un dia
   * despues todo lo registrado de noche. Lo que se fecha mal ahi son movimientos
   * de dinero.
   *
   * Estas pruebas no dependen de la zona de la maquina: la cuenta va por `Intl`
   * con `America/Bogota` fijo. Corridas con TZ=UTC dan lo mismo, y es justo lo
   * que la version vieja no hacia.
   */
  describe('con dia y mes a dos digitos (exportaciones)', () => {
    it('mantiene el dia real de una noche de Bogota', () => {
      expect(formatBogotaFechaPad2(nocheEnBogota)).toBe('05/06/2026');
      // El reloj del proceso decia el 6: asi salia antes en el respaldo.
      expect(nocheEnBogota.toISOString().slice(0, 10)).toBe('2026-06-06');
    });

    it('rellena el dia y el mes de una cifra', () => {
      // Es la unica diferencia con `formatBogotaFecha`, que daria '5/6/2026'.
      expect(formatBogotaFechaPad2(medianocheBogota)).toBe('05/06/2026');
      expect(formatBogotaFecha(medianocheBogota)).toBe('5/6/2026');
    });

    it('lleva la hora completa, con segundos', () => {
      // Con segundos a proposito: dos pagos del mismo minuto hay que poder
      // distinguirlos en la exportacion.
      expect(formatBogotaFechaHoraPad2(nocheEnBogota)).toBe(
        '05/06/2026 19:30:00',
      );
    });

    it('usa el reloj de 24 horas, no am/pm', () => {
      // 8 p. m. de Bogota. En formato de 12 horas se leeria '08', que en una
      // columna de horas sin am/pm es indistinguible de las ocho de la manana.
      const nocheTarde = new Date('2026-06-06T01:00:00.000Z');
      expect(formatBogotaFechaHoraPad2(nocheTarde)).toBe('05/06/2026 20:00:00');
    });

    it('la medianoche de Bogota es 00, no 24', () => {
      expect(formatBogotaFechaHoraPad2(medianocheBogota)).toBe(
        '05/06/2026 00:00:00',
      );
    });

    it('acepta cadenas y numeros, y devuelve vacio si la fecha no sirve', () => {
      expect(formatBogotaFechaPad2('2026-06-06T00:30:00.000Z')).toBe(
        '05/06/2026',
      );
      expect(formatBogotaFechaPad2(nocheEnBogota.getTime())).toBe('05/06/2026');
      expect(formatBogotaFechaPad2('no es una fecha')).toBe('');
      expect(formatBogotaFechaHoraPad2('no es una fecha')).toBe('');
    });
  });

  /**
   * La hora sola, para las columnas de 'hora' de los tableros. Es donde una
   * aprobacion de las 8:30 de la noche se mostraba como 01:30.
   */
  describe('solo la hora', () => {
    it('da la hora de Bogota, no la del proceso', () => {
      expect(formatBogotaHora(nocheEnBogota)).toBe('19:30');
      // En UTC ese mismo instante son las 00:30: asi se mostraba antes.
      expect(nocheEnBogota.toISOString()).toContain('T00:30');
    });

    it('usa reloj de 24 horas', () => {
      const ochoNoche = new Date('2026-06-06T01:00:00.000Z');
      expect(formatBogotaHora(ochoNoche)).toBe('20:00');
    });

    it('la medianoche de Bogota es 00:00', () => {
      expect(formatBogotaHora(medianocheBogota)).toBe('00:00');
    });

    it('devuelve vacio si la fecha no sirve', () => {
      expect(formatBogotaHora('no es una fecha')).toBe('');
    });
  });

  /**
   * La fecha con el mes escrito: el formato de los documentos que se imprimen,
   * como el contrato de un credito de articulo.
   */
  describe('fecha con el mes escrito', () => {
    it('mantiene el dia real de una noche de Bogota', () => {
      expect(formatBogotaFechaLarga(nocheEnBogota)).toBe('5 de junio de 2026');
    });

    it('no rellena el dia: en un texto se lee 5, no 05', () => {
      expect(formatBogotaFechaLarga(medianocheBogota)).toBe(
        '5 de junio de 2026',
      );
    });

    it('acierta el mes en los dos bordes del ano', () => {
      // Un enero y un diciembre, que son los indices que se salen del array si
      // alguien confunde el mes 1-12 con el indice 0-11.
      const enero = new Date('2026-01-15T12:00:00-05:00');
      const diciembre = new Date('2026-12-15T12:00:00-05:00');
      expect(formatBogotaFechaLarga(enero)).toBe('15 de enero de 2026');
      expect(formatBogotaFechaLarga(diciembre)).toBe('15 de diciembre de 2026');
    });

    it('una noche de fin de ano no se pasa al ano siguiente', () => {
      // 31 de diciembre, 8 p. m. de Bogota: en UTC ya es el 1 de enero del ano
      // siguiente. En un contrato eso es un ano entero de diferencia.
      const finDeAno = new Date('2026-12-31T20:00:00-05:00');
      expect(finDeAno.toISOString()).toContain('2027-01-01');
      expect(formatBogotaFechaLarga(finDeAno)).toBe('31 de diciembre de 2026');
    });

    it('devuelve vacio si la fecha no sirve', () => {
      expect(formatBogotaFechaLarga('no es una fecha')).toBe('');
    });
  });
});
