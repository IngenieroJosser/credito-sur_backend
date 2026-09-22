import { normalizarCodigoRuta } from './codigo-ruta';

describe('normalizarCodigoRuta', () => {
  it('le pone el prefijo a un nombre suelto', () => {
    expect(normalizarCodigoRuta('Centro')).toBe('RT-CENTRO');
    expect(normalizarCodigoRuta('centro')).toBe('RT-CENTRO');
  });

  it('no duplica el prefijo, venga como venga', () => {
    expect(normalizarCodigoRuta('RT-CENTRO')).toBe('RT-CENTRO');
    expect(normalizarCodigoRuta('RUTA CENTRO')).toBe('RT-CENTRO');
    expect(normalizarCodigoRuta('rt centro')).toBe('RT-CENTRO');
  });

  it('respeta los codigos que ya existen en el sistema', () => {
    expect(normalizarCodigoRuta('RT-CEN-01')).toBe('RT-CEN-01');
  });

  it('es idempotente: normalizar dos veces da lo mismo', () => {
    const una = normalizarCodigoRuta('Zona Norte 2');
    expect(una).toBe('RT-ZONA-NORTE-2');
    expect(normalizarCodigoRuta(una)).toBe(una);
  });

  it('quita tildes, espacios y signos', () => {
    expect(normalizarCodigoRuta('  Bogotá   Sur  ')).toBe('RT-BOGOTA-SUR');
    expect(normalizarCodigoRuta('Centro / Norte')).toBe('RT-CENTRO-NORTE');
  });

  it('respeta el limite de la columna (20) y no deja guion al final', () => {
    const largo = normalizarCodigoRuta('Zona Nororiental Municipal Extendida');
    expect(largo.length).toBeLessThanOrEqual(20);
    expect(largo.endsWith('-')).toBe(false);
    expect(largo.startsWith('RT-')).toBe(true);
  });

  it('devuelve vacio cuando no hay nada que normalizar', () => {
    expect(normalizarCodigoRuta('')).toBe('');
    expect(normalizarCodigoRuta('   ')).toBe('');
    expect(normalizarCodigoRuta(null)).toBe('');
    expect(normalizarCodigoRuta('---')).toBe('');
  });
});
