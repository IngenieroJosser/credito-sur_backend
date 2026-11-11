import {
  enEspanol,
  mensajesEnEspanol,
  type ErrorDeValidacion,
} from './mensajes-de-validacion';

/**
 * Lo que se fija aquí no es la redacción, es que la persona pueda actuar.
 *
 * El punto de partida medido: 1.096 decoradores de validación en los DTO del
 * backend y 12 con mensaje propio, así que el 99% de los errores de formulario
 * llegaban en inglés y con el nombre de la columna. Lo que llegaba a la
 * pantalla era «correo must be an email».
 *
 * Por eso cada prueba comprueba dos cosas: que el texto está en español y que
 * NOMBRA el campo con la palabra que la persona ve en el formulario. Un mensaje
 * en español perfecto que diga «cantidadCuotas» no sirve de nada.
 */
describe('los errores de validación se leen en español', () => {
  describe('traduce las plantillas de class-validator', () => {
    const CASOS: [string, string][] = [
      ['correo must be an email', 'el correo no es un correo válido.'],
      ['montoTotal must be a number', 'el monto tiene que ser un número.'],
      [
        'montoTotal must be a number conforming to the specified constraints',
        'el monto tiene que ser un número.',
      ],
      [
        'cantidadCuotas must not be less than 1',
        'la cantidad de cuotas no puede ser menor que 1.',
      ],
      [
        'tasaInteres must not be greater than 100',
        'la tasa de interés no puede ser mayor que 100.',
      ],
      ['dni should not be empty', 'Falta indicar la cédula.'],
      [
        'password must be longer than or equal to 6 characters',
        'la contraseña tiene que tener al menos 6 caracteres.',
      ],
      [
        'direccion must be shorter than or equal to 200 characters',
        'la dirección no puede pasar de 200 caracteres.',
      ],
      [
        'fechaInicio must be a valid ISO 8601 date string',
        'la fecha de inicio tiene que ser una fecha válida.',
      ],
      ['clienteId must be a UUID', 'el cliente no tiene un identificador válido.'],
      ['nombres must be a string', 'los nombres tiene que ser texto.'],
      [
        'metodoPago must be one of the following values: EFECTIVO, TRANSFERENCIA',
        'el método de pago tiene que ser uno de estos valores: EFECTIVO, TRANSFERENCIA.',
      ],
    ];

    for (const [ingles, esperado] of CASOS) {
      it(`«${ingles}»`, () => {
        expect(enEspanol(ingles)).toBe(esperado);
      });
    }
  });

  it('la plantilla más larga gana a la más corta', () => {
    // «must be a number conforming to…» contiene «must be a number». Si se
    // mirara la corta primero, la larga nunca se traduciría entera y el
    // mensaje saldría con el resto de la frase inglesa pegado.
    expect(
      enEspanol('monto must be a number conforming to the specified constraints'),
    ).not.toContain('conforming');
  });

  it('un mensaje que ya venía en español se deja intacto', () => {
    // Los 12 decoradores que SÍ traían su mensaje escrito a mano. Reescribirlos
    // sería estropear el trabajo que ya estaba hecho, y además son los que
    // explican mejor su campo.
    const propios = [
      'La Cédula debe tener entre 6 y 10 dígitos.',
      'montoTotal debe ser mayor a 0',
      'El nombre de usuario solo puede contener letras, números, punto, guion y guion bajo.',
    ];
    for (const texto of propios) {
      expect(enEspanol(texto)).toBe(texto);
    }
  });

  it('un campo sin traducción escrita sale legible, no en camello', () => {
    expect(enEspanol('montoDesembolsado should not be empty')).toBe(
      'Falta indicar monto desembolsado.',
    );
    // Sin artículo a propósito: sin saber el género, «el/la» se equivocaría la
    // mitad de las veces y un mensaje mal concordado se lee peor.
    expect(enEspanol('montoDesembolsado should not be empty')).not.toContain(
      'el monto desembolsado',
    );
  });

  it('un mensaje desconocido se devuelve tal cual, no se pierde', () => {
    // Preferible un texto raro a un mensaje vacío: el vacío se ve como si la
    // operación se hubiera perdido y quien está en caja la repite.
    expect(enEspanol('algo totalmente inesperado')).toBe(
      'algo totalmente inesperado',
    );
  });

  describe('recorre el árbol de errores', () => {
    it('saca los mensajes de un error plano', () => {
      const errores: ErrorDeValidacion[] = [
        { property: 'dni', constraints: { isNotEmpty: 'dni should not be empty' } },
        {
          property: 'correo',
          constraints: { isEmail: 'correo must be an email' },
        },
      ];

      expect(mensajesEnEspanol(errores)).toEqual([
        'Falta indicar la cédula.',
        'el correo no es un correo válido.',
      ]);
    });

    it('baja a los hijos, donde un objeto anidado deja sus fallos', () => {
      // El padre llega SIN `constraints`: todo está en `children`. Sin bajar,
      // la respuesta salía con la lista vacía, que es el mensaje vacío de
      // siempre: la persona ve que falló y nada más.
      const errores: ErrorDeValidacion[] = [
        {
          property: 'subscription',
          children: [
            {
              property: 'endpoint',
              constraints: { isString: 'endpoint must be a string' },
            },
          ],
        },
      ];

      expect(mensajesEnEspanol(errores)).toEqual([
        'endpoint tiene que ser texto.',
      ]);
    });

    it('no repite la misma frase dos veces', () => {
      // Dos reglas distintas del mismo campo pueden traducirse igual.
      const errores: ErrorDeValidacion[] = [
        {
          property: 'monto',
          constraints: {
            isNumber: 'monto must be a number',
            isNumberString:
              'monto must be a number conforming to the specified constraints',
          },
        },
      ];

      expect(mensajesEnEspanol(errores)).toEqual([
        'el monto tiene que ser un número.',
      ]);
    });

    it('un campo vacío dice solo que falta, no sus cuatro reglas', () => {
      // Esto es lo que devuelve `class-validator` cuando la cédula llega en
      // blanco: incumple de golpe todas sus reglas, y las cuatro hablan de lo
      // mismo. Antes salían las cuatro, y con un formulario de seis campos eso
      // eran veinte frases para decir que estaba vacío. Nadie las lee.
      const errores: ErrorDeValidacion[] = [
        {
          property: 'dni',
          constraints: {
            length: 'La Cédula debe tener entre 6 y 10 dígitos.',
            matches: 'La Cédula debe contener solo números.',
            isNotEmpty: 'dni should not be empty',
            isString: 'dni must be a string',
          },
        },
      ];

      expect(mensajesEnEspanol(errores)).toEqual(['Falta indicar la cédula.']);
    });

    it('si el campo NO está vacío, sí se explican sus reglas de formato', () => {
      // El caso contrario: hay algo escrito, así que el motivo útil es en qué
      // no cuadra. Aquí no sobra nada y no se debe recortar.
      const errores: ErrorDeValidacion[] = [
        {
          property: 'dni',
          constraints: {
            length: 'La Cédula debe tener entre 6 y 10 dígitos.',
            matches: 'La Cédula debe contener solo números.',
          },
        },
      ];

      expect(mensajesEnEspanol(errores)).toEqual([
        'La Cédula debe tener entre 6 y 10 dígitos.',
        'La Cédula debe contener solo números.',
      ]);
    });

    it('un árbol vacío no revienta', () => {
      expect(mensajesEnEspanol([])).toEqual([]);
      expect(mensajesEnEspanol([{ property: 'x' }])).toEqual([]);
    });
  });
});
