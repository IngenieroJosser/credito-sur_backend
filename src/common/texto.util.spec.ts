import { textoDeValor, textoRecortado, textoComparable } from './texto.util';

/**
 * La guarda que evita que un objeto se convierta en "[object Object]".
 *
 * Estaba copiada en siete sitios del backend: el identificador de login, el nombre
 * de usuario, el normalizador de importaciones, el código de ruta, `normalizeUpper`
 * de las reglas de ruta, el `text()` de la plantilla de importables y la validación
 * de alertas. En todos era `String(valor ?? '')` sobre un `unknown`, que es lo que
 * eslint marca con `no-base-to-string`.
 */
describe('textoDeValor', () => {
  it('devuelve el texto tal cual', () => {
    expect(textoDeValor('Ruta Centro')).toBe('Ruta Centro');
  });

  it('acepta numeros: un codigo de una hoja de calculo llega como number', () => {
    expect(textoDeValor(1024)).toBe('1024');
    expect(textoDeValor(0)).toBe('0');
    expect(textoDeValor(-1.5)).toBe('-1.5');
  });

  it('acepta enteros grandes y booleanos', () => {
    expect(textoDeValor(BigInt(90071992547409911n))).toBe('90071992547409911');
    expect(textoDeValor(true)).toBe('true');
    expect(textoDeValor(false)).toBe('false');
  });

  it('null y undefined dan cadena vacia, no "null" ni "undefined"', () => {
    expect(textoDeValor(null)).toBe('');
    expect(textoDeValor(undefined)).toBe('');
  });

  describe('lo que arregla', () => {
    it('un objeto NO se convierte en "[object Object]"', () => {
      // Asi se veia el error: esto es lo que hacia el codigo de antes. El
      // `no-base-to-string` de aqui es justamente lo que se esta demostrando.
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      expect(String({ correo: 'admin' })).toBe('[object Object]');
      expect(textoDeValor({ correo: 'admin' })).toBe('');
    });

    it('un arreglo tampoco se convierte en su lista separada por comas', () => {
      expect(String(['a', 'b'])).toBe('a,b');
      expect(textoDeValor(['a', 'b'])).toBe('');
    });

    it('una funcion tampoco devuelve su codigo fuente', () => {
      expect(textoDeValor(() => 'hola')).toBe('');
    });

    it('un symbol no revienta: `String(symbol)` lanza en algunos contextos', () => {
      expect(textoDeValor(Symbol('x'))).toBe('');
    });
  });
});

describe('textoRecortado', () => {
  it('quita los espacios de los lados', () => {
    expect(textoRecortado('  Ruta Centro  ')).toBe('Ruta Centro');
  });

  it('un valor de solo espacios queda vacio', () => {
    expect(textoRecortado('   ')).toBe('');
  });

  it('un objeto queda vacio, no "[object Object]"', () => {
    expect(textoRecortado({})).toBe('');
  });
});

describe('textoComparable', () => {
  it('pone en mayusculas', () => {
    expect(textoComparable('ruta centro')).toBe('RUTA CENTRO');
  });

  it('quita las tildes: BOGOTA y BOGOTÁ tienen que dar lo mismo', () => {
    expect(textoComparable('Bogotá')).toBe('BOGOTA');
    expect(textoComparable('Bogota')).toBe('BOGOTA');
    expect(textoComparable('Bogotá')).toBe(textoComparable('BOGOTA'));
  });

  it('quita la enie sin romper la letra', () => {
    // La enie se descompone en n + tilde, y al quitar el acento queda la n.
    expect(textoComparable('Muñoz')).toBe('MUNOZ');
  });

  it('recorta y normaliza a la vez', () => {
    expect(textoComparable('  interés simple  ')).toBe('INTERES SIMPLE');
  });

  it('un objeto queda vacio', () => {
    expect(textoComparable({ a: 1 })).toBe('');
  });
});
