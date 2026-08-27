/**
 * Evaluador del puñado de fórmulas que la plantilla escribe en sus columnas
 * grises. Existe solo para las pruebas.
 *
 * Hasta ahora, comprobar que el Excel calculaba igual que el sistema se hacía
 * copiando la fórmula a mano dentro de la prueba. Esa copia se quedó vieja dos
 * veces: una vez con el orden de las operaciones del interés, que falla en 1 de
 * cada 450 casos, y otra al mover una columna de sitio. Una prueba que copia la
 * fórmula solo comprueba que la copia siga igual a sí misma.
 *
 * Leyendo la fórmula del archivo generado y evaluándola de verdad, cualquier
 * cambio en la plantilla se compara contra el sistema tal como quedó, sin que
 * nadie tenga que acordarse de actualizar la copia.
 *
 * Cubre lo justo: IF, AND, OR, NOT, ISNUMBER, ROUND, INT, MAX, aritmética y
 * comparaciones. Las columnas que usan VLOOKUP o COUNTIF buscan en las hojas
 * ocultas y no se evalúan aquí.
 */

export type ValorCelda = number | string | boolean;

interface Token {
  tipo: 'numero' | 'texto' | 'ref' | 'nombre' | 'simbolo';
  valor: string;
}

function tokenizar(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < formula.length) {
    const c = formula[i];

    if (c === ' ') {
      i++;
      continue;
    }

    if (c === '"') {
      let texto = '';
      i++;
      while (i < formula.length) {
        if (formula[i] === '"') {
          // Dos comillas seguidas son una comilla dentro del texto.
          if (formula[i + 1] === '"') {
            texto += '"';
            i += 2;
            continue;
          }
          break;
        }
        texto += formula[i++];
      }
      i++; // la comilla de cierre
      tokens.push({ tipo: 'texto', valor: texto });
      continue;
    }

    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(formula[i + 1] ?? ''))) {
      let numero = '';
      while (i < formula.length && /[0-9.]/.test(formula[i]))
        numero += formula[i++];
      tokens.push({ tipo: 'numero', valor: numero });
      continue;
    }

    // Referencia a celda: $C7, C7, $C$7
    const ref = /^\$?[A-Z]{1,3}\$?[0-9]+/.exec(formula.slice(i));
    if (ref && /[A-Z$]/.test(c)) {
      tokens.push({ tipo: 'ref', valor: ref[0].replace(/\$/g, '') });
      i += ref[0].length;
      continue;
    }

    if (/[A-Za-z]/.test(c)) {
      let nombre = '';
      while (i < formula.length && /[A-Za-z0-9._]/.test(formula[i]))
        nombre += formula[i++];
      tokens.push({ tipo: 'nombre', valor: nombre.toUpperCase() });
      continue;
    }

    const dobles = ['<>', '<=', '>='];
    const dos = formula.slice(i, i + 2);
    if (dobles.includes(dos)) {
      tokens.push({ tipo: 'simbolo', valor: dos });
      i += 2;
      continue;
    }

    tokens.push({ tipo: 'simbolo', valor: c });
    i++;
  }

  return tokens;
}

const esNumero = (v: ValorCelda): v is number => typeof v === 'number';

/** Excel redondea alejándose del cero, no como `Math.round` con negativos. */
const redondearExcel = (valor: number, decimales: number) => {
  const factor = Math.pow(10, decimales);
  const escalado = valor * factor;
  const redondeado =
    escalado >= 0 ? Math.round(escalado) : -Math.round(Math.abs(escalado));
  return redondeado / factor;
};

const aNumero = (v: ValorCelda): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

function comparar(a: ValorCelda, b: ValorCelda, operador: string): boolean {
  // Un número nunca es igual a un texto, ni siquiera al vacío. Es lo que hace
  // que `IF($C7="", ...)` distinga una celda en blanco de una en cero.
  const mismoTipo =
    (esNumero(a) && esNumero(b)) ||
    (typeof a === 'string' && typeof b === 'string');

  if (!mismoTipo) {
    if (operador === '=') return false;
    if (operador === '<>') return true;
    // En Excel cualquier texto es mayor que cualquier número.
    const aEsTexto = typeof a === 'string';
    return operador === '>' || operador === '>=' ? aEsTexto : !aEsTexto;
  }

  if (esNumero(a) && esNumero(b)) {
    switch (operador) {
      case '=':
        return a === b;
      case '<>':
        return a !== b;
      case '>':
        return a > b;
      case '<':
        return a < b;
      case '>=':
        return a >= b;
      case '<=':
        return a <= b;
    }
  }

  const x = String(a);
  const y = String(b);
  switch (operador) {
    case '=':
      return x === y;
    case '<>':
      return x !== y;
    case '>':
      return x > y;
    case '<':
      return x < y;
    case '>=':
      return x >= y;
    case '<=':
      return x <= y;
  }
  throw new Error(`Operador desconocido: ${operador}`);
}

class Interprete {
  private posicion = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly celdas: Record<string, ValorCelda>,
  ) {}

  evaluar(): ValorCelda {
    const valor = this.comparacion();
    if (this.posicion < this.tokens.length) {
      throw new Error(
        `Sobra "${this.tokens[this.posicion].valor}" al final de la fórmula`,
      );
    }
    return valor;
  }

  private mirar(): Token | undefined {
    return this.tokens[this.posicion];
  }

  private consumir(valor?: string): Token {
    const token = this.tokens[this.posicion++];
    if (!token) throw new Error('La fórmula termina antes de tiempo');
    if (valor && token.valor !== valor) {
      throw new Error(`Se esperaba "${valor}" y vino "${token.valor}"`);
    }
    return token;
  }

  private comparacion(): ValorCelda {
    let izquierda = this.concatenacion();
    const operadores = ['=', '<>', '<', '>', '<=', '>='];
    while (
      this.mirar()?.tipo === 'simbolo' &&
      operadores.includes(this.mirar()!.valor)
    ) {
      const operador = this.consumir().valor;
      const derecha = this.concatenacion();
      izquierda = comparar(izquierda, derecha, operador);
    }
    return izquierda;
  }

  private concatenacion(): ValorCelda {
    let izquierda = this.aditiva();
    while (this.mirar()?.valor === '&') {
      this.consumir();
      const derecha = this.aditiva();
      izquierda = `${izquierda}${derecha}`;
    }
    return izquierda;
  }

  private aditiva(): ValorCelda {
    let izquierda = this.multiplicativa();
    while (this.mirar()?.valor === '+' || this.mirar()?.valor === '-') {
      const operador = this.consumir().valor;
      const derecha = this.multiplicativa();
      izquierda =
        operador === '+'
          ? aNumero(izquierda) + aNumero(derecha)
          : aNumero(izquierda) - aNumero(derecha);
    }
    return izquierda;
  }

  private multiplicativa(): ValorCelda {
    let izquierda = this.unaria();
    while (this.mirar()?.valor === '*' || this.mirar()?.valor === '/') {
      const operador = this.consumir().valor;
      const derecha = this.unaria();
      izquierda =
        operador === '*'
          ? aNumero(izquierda) * aNumero(derecha)
          : aNumero(izquierda) / aNumero(derecha);
    }
    return izquierda;
  }

  private unaria(): ValorCelda {
    if (this.mirar()?.valor === '-') {
      this.consumir();
      return -aNumero(this.unaria());
    }
    return this.primaria();
  }

  private argumentos(): ValorCelda[] {
    this.consumir('(');
    const valores: ValorCelda[] = [];
    if (this.mirar()?.valor === ')') {
      this.consumir(')');
      return valores;
    }
    for (;;) {
      valores.push(this.comparacion());
      if (this.mirar()?.valor === ',') {
        this.consumir();
        continue;
      }
      this.consumir(')');
      return valores;
    }
  }

  private primaria(): ValorCelda {
    const token = this.consumir();

    if (token.tipo === 'numero') return Number(token.valor);
    if (token.tipo === 'texto') return token.valor;

    if (token.tipo === 'ref') {
      const valor = this.celdas[token.valor];
      if (valor === undefined) {
        throw new Error(`La fórmula usa la celda ${token.valor}, sin valor`);
      }
      return valor;
    }

    if (token.valor === '(') {
      const valor = this.comparacion();
      this.consumir(')');
      return valor;
    }

    if (token.tipo === 'nombre') {
      const args = this.argumentos();
      return this.funcion(token.valor, args);
    }

    throw new Error(`No se entiende "${token.valor}"`);
  }

  private funcion(nombre: string, args: ValorCelda[]): ValorCelda {
    switch (nombre) {
      case 'IF':
        return args[0] ? args[1] : (args[2] ?? false);
      case 'AND':
        return args.every(Boolean);
      case 'OR':
        return args.some(Boolean);
      case 'NOT':
        return !args[0];
      case 'ISNUMBER':
        return esNumero(args[0]);
      case 'ROUND':
        return redondearExcel(aNumero(args[0]), aNumero(args[1] ?? 0));
      case 'INT':
        return Math.floor(aNumero(args[0]));
      case 'MAX':
        return Math.max(...args.map(aNumero));
      case 'MIN':
        return Math.min(...args.map(aNumero));
      default:
        throw new Error(`Función no soportada por el evaluador: ${nombre}`);
    }
  }
}

/**
 * Evalúa una fórmula de Excel con los valores de celda que se le den.
 *
 * Las claves de `celdas` van sin el signo de dólar: `{ C7: 500000 }`. Una celda
 * vacía se escribe como cadena vacía, igual que en Excel.
 */
export function evaluarFormula(
  formula: string,
  celdas: Record<string, ValorCelda>,
): ValorCelda {
  const limpia = formula.startsWith('=') ? formula.slice(1) : formula;
  return new Interprete(tokenizar(limpia), celdas).evaluar();
}
