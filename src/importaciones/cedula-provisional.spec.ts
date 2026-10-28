import {
  esCedulaProvisional,
  esMarcadorDeCedula,
  generarCedulaProvisional,
  LARGO_CEDULA_PROVISIONAL,
  PREFIJO_CEDULA_PROVISIONAL,
} from './cedula-provisional';

/**
 * La cédula provisional es una medida temporal sobre el dato con el que el sistema
 * distingue a una persona, así que las reglas van fijadas una por una: equivocarse aquí
 * junta a dos clientes en uno o deja un crédito colgado del cliente equivocado.
 */
describe('Cédula provisional', () => {
  describe('esMarcadorDeCedula', () => {
    it('toma como marcador lo que la plantilla usa para amarrar filas (1 a 5 dígitos)', () => {
      for (const valor of ['1', '2', '42', '999', '12345']) {
        expect(esMarcadorDeCedula(valor)).toBe(true);
      }
    });

    it('NO toma como marcador una cédula de verdad', () => {
      // Seis dígitos es el mínimo de una cédula colombiana: desde ahí es un documento.
      for (const valor of ['123456', '1098765432', '99000000']) {
        expect(esMarcadorDeCedula(valor)).toBe(false);
      }
    });

    it('NO toma como marcador algo que no sea solo números', () => {
      for (const valor of ['', '  ', 'a', '1a', '1.2', '-1']) {
        expect(esMarcadorDeCedula(valor)).toBe(false);
      }
    });

    it('tolera espacios alrededor, que es lo que llega de una celda de Excel', () => {
      expect(esMarcadorDeCedula(' 3 ')).toBe(true);
    });
  });

  describe('generarCedulaProvisional', () => {
    it('genera diez dígitos que empiezan por el prefijo', () => {
      const cedula = generarCedulaProvisional();
      expect(cedula).toHaveLength(LARGO_CEDULA_PROVISIONAL);
      expect(cedula.startsWith(PREFIJO_CEDULA_PROVISIONAL)).toBe(true);
      expect(/^\d+$/.test(cedula)).toBe(true);
    });

    it('pasa la misma validación que una cédula normal (6 a 10 dígitos)', () => {
      // Si no la pasara, el formulario del cliente no podría guardar ese cliente después.
      expect(/^\d{6,10}$/.test(generarCedulaProvisional())).toBe(true);
    });

    it('no repite una que ya esté tomada en la misma importación', () => {
      const generadas = new Set<string>();
      for (let i = 0; i < 300; i += 1) {
        const cedula = generarCedulaProvisional(generadas);
        expect(generadas.has(cedula)).toBe(false);
        generadas.add(cedula);
      }
      expect(generadas.size).toBe(300);
    });

    it('avisa en vez de devolver una repetida cuando no puede generar otra', () => {
      // Se le pasan como usadas TODAS las combinaciones posibles de un espacio diminuto
      // simulado: el contrato es que falle con un mensaje, no que devuelva un duplicado,
      // porque un duplicado rompería la identidad de un cliente en silencio.
      const todas = new Set<string>();
      const digitos =
        LARGO_CEDULA_PROVISIONAL - PREFIJO_CEDULA_PROVISIONAL.length;
      const original = Math.random;
      // Fija el azar para que caiga siempre en la misma: así se agota en 50 intentos.
      Math.random = () => 0;
      try {
        todas.add(`${PREFIJO_CEDULA_PROVISIONAL}${'0'.repeat(digitos)}`);
        expect(() => generarCedulaProvisional(todas)).toThrow(
          /No se pudo generar una cédula provisional/,
        );
      } finally {
        Math.random = original;
      }
    });
  });

  describe('esCedulaProvisional', () => {
    it('reconoce la que generó el sistema', () => {
      expect(esCedulaProvisional(generarCedulaProvisional())).toBe(true);
    });

    it('no confunde una cédula real con una provisional', () => {
      // Diez dígitos pero sin el prefijo, y el prefijo pero con largo distinto.
      expect(esCedulaProvisional('1098765432')).toBe(false);
      expect(esCedulaProvisional('990000')).toBe(false);
      expect(esCedulaProvisional('')).toBe(false);
    });
  });
});
