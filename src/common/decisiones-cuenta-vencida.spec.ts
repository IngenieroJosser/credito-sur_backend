import * as fs from 'fs';
import * as path from 'path';
import {
  DECISIONES_CUENTA_VENCIDA,
  accionDecision,
  etiquetaDecision,
} from './decisiones-cuenta-vencida';

/**
 * Que una decisión se llame igual en todas partes.
 *
 * La misma gestión sobre una cuenta vencida tenía seis nombres repartidos entre
 * el backend y el frontend. Lo que leía una persona que pedía la gestión y
 * luego entraba a aprobarla:
 *
 *   PRORROGAR     Prórroga / una prórroga / Prorrogar Plan /
 *                 Prórroga de Plazo / Prorroga
 *   DEJAR_QUIETO  Dejar quieto / dejar quieto / Dejar Quieto /
 *                 Sin Mora por Ahora / Sin mora por ahora
 *   CASTIGAR      Baja por pérdida / Reportar Pérdida / Baja por perdida
 *
 * No hay forma de saber que se habla de lo mismo. Y en el aviso que llega al
 * teléfono es peor, porque suele ser el único texto que se lee antes de
 * decidir si se entra a aprobar.
 */
describe('las decisiones sobre una cuenta vencida tienen un solo nombre', () => {
  it('cada decisión conocida tiene su nombre y su acción', () => {
    for (const [clave, d] of Object.entries(DECISIONES_CUENTA_VENCIDA)) {
      expect(d.label.length).toBeGreaterThan(3);
      expect(d.accion.length).toBeGreaterThan(3);
      // El nombre no puede ser el enum disfrazado.
      expect(d.label.toUpperCase().replace(/ /g, '_')).not.toBe(clave);
    }
  });

  it('ninguna conserva el «dejar quieto» del habla de oficina', () => {
    // El cambio que pidió quien usa el sistema: menos coloquial, entendible a
    // la primera. Se vigila el texto, no solo que exista una etiqueta.
    const todos = Object.values(DECISIONES_CUENTA_VENCIDA)
      .flatMap((d) => [d.label, d.accion])
      .join(' | ')
      .toLowerCase();

    expect(todos).not.toContain('quieto');
  });

  it('el nombre dice lo que pasa, no solo que algo pasa', () => {
    expect(etiquetaDecision('DEJAR_QUIETO')).toBe('Dejar en seguimiento');
    expect(etiquetaDecision('PRORROGAR')).toBe('Prorrogar el plan');
    expect(etiquetaDecision('CASTIGAR')).toBe('Dar de baja por pérdida');
    expect(etiquetaDecision('JURIDICO')).toBe('Pasar a cobro jurídico');
  });

  it('JURIDICO está, aunque antes faltara', () => {
    // El mapa viejo del controlador no lo tenía, y `JURIDICO` sí existe en el
    // DTO de reportes: el título del aviso salía como
    // «undefined — Juan Pérez (PRES-000012)».
    expect(DECISIONES_CUENTA_VENCIDA).toHaveProperty('JURIDICO');
  });

  describe('una decisión desconocida no deja el texto en blanco', () => {
    it('devuelve el enum legible en vez de undefined', () => {
      expect(etiquetaDecision('ALGO_NUEVO')).toBe('Algo nuevo');
      expect(accionDecision('ALGO_NUEVO')).toBe('algo nuevo');
    });

    it('sin decisión dice algo, no una cadena vacía', () => {
      expect(etiquetaDecision(undefined)).toBe('Sin decisión');
      expect(etiquetaDecision('')).toBe('Sin decisión');
      expect(etiquetaDecision(null)).toBe('Sin decisión');
    });
  });

  /**
   * El backend y el frontend son dos repositorios y no comparten código, así
   * que cada uno tiene su copia. Lo que esta prueba impide es que se separen:
   * compara los textos de aquí con los del archivo del frontend.
   *
   * Si el frontend no está al lado —en CI, o en un clon solo del backend— la
   * comprobación se salta diciéndolo, en vez de fallar por algo que no es.
   */
  it('los nombres coinciden con los del frontend', () => {
    const archivoFront = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'credito-sur_frontend',
      'lib',
      'display-labels.ts',
    );

    if (!fs.existsSync(archivoFront)) {
      // eslint-disable-next-line no-console
      console.log(
        '[decisiones] no se encontró el frontend al lado; la comparación se salta',
      );
      return;
    }

    const fuente = fs.readFileSync(archivoFront, 'utf8');
    const distintos: string[] = [];

    for (const [clave, d] of Object.entries(DECISIONES_CUENTA_VENCIDA)) {
      // Se busca el nombre literal. Si el frontend lo cambia por su cuenta,
      // deja de aparecer y esto falla nombrando la decisión.
      if (!fuente.includes(`'${d.label}'`)) {
        distintos.push(`${clave}: el frontend no usa «${d.label}»`);
      }
    }

    const informe = distintos.length
      ? [
          'El nombre de estas decisiones no coincide con el del frontend.',
          'La persona que pide la gestión y la que la aprueba leerían textos',
          'distintos para lo mismo:',
          '',
          ...distintos.map((d) => `  - ${d}`),
          '',
          'Los dos sitios son: este archivo y',
          'credito-sur_frontend/lib/display-labels.ts',
        ].join('\n')
      : 'coinciden';

    expect(informe).toBe('coinciden');
  });
});
