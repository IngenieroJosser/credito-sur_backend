/**
 * Pone en español los mensajes de validación que llegan a la pantalla.
 *
 * `class-validator` escribe sus mensajes en inglés y usando el nombre interno
 * del campo, así que lo que recibía la persona era «correo must be an email»,
 * «montoTotal must be a number» o «cantidadCuotas must not be less than 1».
 *
 * La medición que lo justifica: en los DTO del backend hay 1.096 decoradores de
 * validación y solo 12 llevan un `message` propio. Es decir, el 99% de los
 * errores de formulario salían en inglés. Y las pantallas, encima, suelen
 * reemplazarlos por un genérico suyo —«Error crear cliente. Verifique datos.»—
 * precisamente porque el mensaje de origen no era presentable, con lo que la
 * persona se queda sin saber qué campo corregir.
 *
 * Se traduce aquí, en un solo sitio, y no decorador por decorador, por dos
 * razones: los 1.084 que faltan no se van a escribir a mano, y un `message` en
 * cada decorador se olvida en el siguiente DTO que alguien añada. Un decorador
 * que SÍ trae su propio `message` se respeta tal cual: se reconoce porque su
 * texto no encaja con ninguna de las plantillas inglesas de abajo.
 */

/**
 * Cómo se llama cada campo cuando se le habla a una persona.
 *
 * Sin esto el mensaje diría «cantidadCuotas», que es el nombre de la columna.
 * Solo están los que de verdad aparecen en formularios; para el resto se
 * aplica la regla de abajo, que separa el camello y no inventa.
 */
const NOMBRES: Record<string, string> = {
  dni: 'la cédula',
  correo: 'el correo',
  telefono: 'el teléfono',
  nombres: 'los nombres',
  apellidos: 'los apellidos',
  direccion: 'la dirección',
  nombreUsuario: 'el usuario',
  password: 'la contraseña',
  contrasena: 'la contraseña',
  identificador: 'el usuario o correo',
  rol: 'el rol',
  estado: 'el estado',
  monto: 'el monto',
  montoTotal: 'el monto',
  montoInteres: 'el interés de mora',
  valor: 'el valor',
  tasaInteres: 'la tasa de interés',
  cantidadCuotas: 'la cantidad de cuotas',
  plazoMeses: 'el plazo en meses',
  frecuenciaPago: 'la frecuencia de pago',
  fechaInicio: 'la fecha de inicio',
  fechaVencimiento: 'la fecha de vencimiento',
  clienteId: 'el cliente',
  prestamoId: 'el crédito',
  rutaId: 'la ruta',
  cajaId: 'la caja',
  cobradorId: 'el cobrador',
  cuotaId: 'la cuota',
  metodoPago: 'el método de pago',
  descripcion: 'la descripción',
  codigo: 'el código',
  diasGracia: 'los días de gracia',
  cantidad: 'la cantidad',
  precio: 'el precio',
  costo: 'el costo',
};

/**
 * El nombre legible de un campo del que no hay traducción escrita.
 *
 * `montoDesembolsado` -> «monto desembolsado». No se inventa el artículo: sin
 * saber el género, «el/la» se equivocaría la mitad de las veces, y un mensaje
 * mal concordado se lee peor que uno sin artículo.
 */
function nombreLegible(campo: string): string {
  if (NOMBRES[campo]) return NOMBRES[campo];
  const separado = campo
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .trim();
  return separado || campo;
}

/**
 * Las plantillas de `class-validator`, de la más específica a la más general.
 *
 * El orden importa: «must be a number conforming to the specified constraints»
 * contiene «must be a number», así que la larga tiene que mirarse primero o la
 * corta se la come.
 */
const PLANTILLAS: [RegExp, (campo: string, m: RegExpMatchArray) => string][] = [
  [
    /^(.+) must be a number conforming to the specified constraints$/,
    (c) => `${c} tiene que ser un número.`,
  ],
  [
    /^(.+) must not be less than (-?[\d.]+)$/,
    (c, m) => `${c} no puede ser menor que ${m[2]}.`,
  ],
  [
    /^(.+) must not be greater than (-?[\d.]+)$/,
    (c, m) => `${c} no puede ser mayor que ${m[2]}.`,
  ],
  [
    /^(.+) must be longer than or equal to (\d+) characters?$/,
    (c, m) =>
      `${c} tiene que tener al menos ${m[2]} ${Number(m[2]) === 1 ? 'carácter' : 'caracteres'}.`,
  ],
  [
    /^(.+) must be shorter than or equal to (\d+) characters?$/,
    (c, m) =>
      `${c} no puede pasar de ${m[2]} ${Number(m[2]) === 1 ? 'carácter' : 'caracteres'}.`,
  ],
  [
    /^(.+) must be one of the following values: (.+)$/,
    (c, m) => `${c} tiene que ser uno de estos valores: ${m[2]}.`,
  ],
  [
    /^(.+) must be a valid ISO 8601 date string$/,
    (c) => `${c} tiene que ser una fecha válida.`,
  ],
  [/^(.+) must be an email$/, (c) => `${c} no es un correo válido.`],
  [/^(.+) must be a UUID$/, (c) => `${c} no tiene un identificador válido.`],
  [/^(.+) must be a string$/, (c) => `${c} tiene que ser texto.`],
  [/^(.+) must be a number$/, (c) => `${c} tiene que ser un número.`],
  [/^(.+) must be an integer number$/, (c) => `${c} tiene que ser un número entero.`],
  [/^(.+) must be a boolean value$/, (c) => `${c} tiene que ser sí o no.`],
  [/^(.+) must be an array$/, (c) => `${c} tiene que ser una lista.`],
  [/^(.+) must be a Date instance$/, (c) => `${c} tiene que ser una fecha.`],
  // «Falta indicar» y no «Falta», porque «Falta» tiene que concordar con el
  // número del campo y «Falta los nombres» está mal escrito. Con el infinitivo
  // en medio, la frase vale igual para «la cédula» y para «los nombres» sin
  // tener que saber el número de cada campo.
  [/^(.+) should not be empty$/, (c) => `Falta indicar ${c}.`],
  [/^(.+) must be empty$/, (c) => `${c} tiene que ir vacío.`],
  [
    /^(.+) must match (.+) regular expression$/,
    (c) => `${c} no tiene el formato que el sistema espera.`,
  ],
  [
    /^(.+) must be a positive number$/,
    (c) => `${c} tiene que ser mayor que cero.`,
  ],
  [
    /^property (.+) should not exist$/,
    (c) => `Se envió ${c}, que este formulario no admite.`,
  ],
];

/**
 * Traduce un mensaje de `class-validator`, o lo devuelve tal cual.
 *
 * Devolverlo tal cual es lo correcto cuando no encaja con ninguna plantilla:
 * significa que alguien escribió un `message` propio —ya en español— y
 * reescribirlo sería estropearlo.
 */
export function enEspanol(mensaje: string): string {
  for (const [patron, armar] of PLANTILLAS) {
    const encaja = mensaje.match(patron);
    if (!encaja) continue;
    // En «property x should not exist» el nombre no lleva artículo.
    const esPropiedad = patron.source.startsWith('^property');
    const campo = esPropiedad
      ? `«${encaja[1]}»`
      : nombreLegible(encaja[1].trim());
    return armar(campo, encaja);
  }
  return mensaje;
}

/** Un error de validación de Nest, con los anidados que puede traer. */
export interface ErrorDeValidacion {
  property?: string;
  constraints?: Record<string, string>;
  children?: ErrorDeValidacion[];
}

/**
 * Todos los mensajes de un árbol de errores de validación, ya en español.
 *
 * Los errores vienen en árbol: un objeto anidado o una lista ponen sus fallos
 * en `children`, y el padre llega sin `constraints`. Sin recorrerlos, un
 * cuerpo con un objeto dentro respondía con la lista vacía, que es el mensaje
 * vacío de siempre: la persona ve que algo falló y nada más.
 */
export function mensajesEnEspanol(
  errores: ErrorDeValidacion[],
): string[] {
  const salida: string[] = [];

  const recorrer = (lista: ErrorDeValidacion[]) => {
    for (const error of lista) {
      const reglas = error.constraints ?? {};

      // Un campo vacío incumple de golpe TODAS sus reglas, y las cuatro hablan
      // de lo mismo. Enviar la cédula en blanco devolvía: «La Cédula debe tener
      // entre 6 y 10 dígitos», «La Cédula debe contener solo números», «Falta
      // indicar la cédula» y «la cédula tiene que ser texto». Con un formulario
      // de seis campos eso son veinte frases para decir que está vacío, y nadie
      // las lee. Cuando el campo está vacío, lo único que hay que decir es que
      // falta; las reglas de formato se verán cuando haya algo que mirar.
      const estaVacio = 'isNotEmpty' in reglas;
      const aplicables = estaVacio
        ? { isNotEmpty: reglas.isNotEmpty }
        : reglas;

      for (const texto of Object.values(aplicables)) {
        if (texto) salida.push(enEspanol(texto));
      }
      if (error.children?.length) recorrer(error.children);
    }
  };

  recorrer(errores);
  // Sin repetidos y conservando el orden: el mismo campo puede fallar en dos
  // reglas que se traducen a la misma frase («Falta el monto.»).
  return [...new Set(salida)];
}
