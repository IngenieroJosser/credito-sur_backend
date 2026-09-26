import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  codigoDeError,
  estadoDeError,
  mensajeDeError,
  metaDeError,
  pilaDeError,
} from './error.util';

/**
 * Estas funciones sustituyen a `err.message` y `err?.code` escritos a mano en 64
 * `catch`. Lo que hay que demostrar es que leen LO MISMO en los casos que de
 * verdad ocurren, y que además no revientan en los que antes reventaban.
 */
describe('mensajeDeError', () => {
  it('de un Error, su mensaje: es el caso del 99% de los catch', () => {
    expect(mensajeDeError(new Error('No hay caja abierta'))).toBe(
      'No hay caja abierta',
    );
  });

  it('de una excepción de Nest, el mensaje con el que se lanzó', () => {
    expect(mensajeDeError(new ConflictException('El código ya existe'))).toBe(
      'El código ya existe',
    );
  });

  it('de una lista de errores de validación, todos y no solo el primero', () => {
    // Nest lanza así los fallos del ValidationPipe. `err.message` a secas
    // devolvía "Bad Request Exception" y se perdía qué campo estaba mal.
    const excepcion = new BadRequestException([
      'monto debe ser positivo',
      'frecuenciaPago es obligatorio',
    ]);
    expect(mensajeDeError(excepcion)).toBe(
      'monto debe ser positivo. frecuenciaPago es obligatorio',
    );
  });

  it('de un texto lanzado a pelo, el texto', () => {
    // Aquí es donde el código de antes registraba "undefined".
    expect(mensajeDeError('timeout de la pasarela')).toBe(
      'timeout de la pasarela',
    );
  });

  it('de null o undefined, el respaldo, y sin reventar', () => {
    // `null.message` lanzaba TypeError DENTRO del catch, tumbando el manejo del
    // error original.
    expect(() => mensajeDeError(null)).not.toThrow();
    expect(mensajeDeError(null, 'Fallo la corrida')).toBe('Fallo la corrida');
    expect(mensajeDeError(undefined, 'Fallo la corrida')).toBe(
      'Fallo la corrida',
    );
  });

  it('de un Error con mensaje vacío, el respaldo y no una cadena vacía', () => {
    // Un error mudo se ve como si no hubiera pasado nada.
    expect(mensajeDeError(new Error('   '), 'Sin detalle')).toBe('Sin detalle');
  });
});

describe('codigoDeError', () => {
  it('lee el código de Prisma, que es de donde cuelga la idempotencia', () => {
    // 9 sitios deciden con esto: `P2002` significa que el registro ya existía,
    // y en vez de fallar se devuelve el que ya estaba.
    expect(codigoDeError({ code: 'P2002' })).toBe('P2002');
  });

  it('lee el código del sistema, como el ENOENT de pg_dump', () => {
    expect(codigoDeError({ code: 'ENOENT' })).toBe('ENOENT');
  });

  it('prefiere el del cuerpo de la excepción, igual que el código de antes', () => {
    // El gateway leía `error?.response?.code || error?.code`, en ese orden.
    expect(
      codigoDeError({ response: { code: 'DEL_CUERPO' }, code: 'PROPIO' }),
    ).toBe('DEL_CUERPO');
    expect(codigoDeError({ code: 'PROPIO' })).toBe('PROPIO');
  });

  it('sin código, undefined, que es lo que hacía `error?.code`', () => {
    expect(codigoDeError(new Error('cualquier cosa'))).toBeUndefined();
    expect(codigoDeError(null)).toBeUndefined();
    expect(codigoDeError('texto')).toBeUndefined();
  });

  it('un errno numérico se devuelve como texto y no se pierde', () => {
    expect(codigoDeError({ code: -2 })).toBe('-2');
  });
});

describe('metaDeError y pilaDeError', () => {
  it('meta trae el campo que chocó, que es para lo que se registra', () => {
    expect(metaDeError({ meta: { target: ['codigo'] } })).toEqual({
      target: ['codigo'],
    });
    expect(metaDeError(null)).toBeUndefined();
  });

  it('la pila solo de un Error de verdad', () => {
    expect(pilaDeError(new Error('x'))).toContain('Error: x');
    expect(pilaDeError('texto')).toBeUndefined();
    expect(pilaDeError(null)).toBeUndefined();
  });
});

describe('estadoDeError', () => {
  it('lee el statusCode de web-push, del que cuelga desactivar la suscripción', () => {
    expect(estadoDeError({ statusCode: 410 })).toBe(410);
    expect(estadoDeError({ statusCode: 404 })).toBe(404);
  });

  it('sin estado, undefined: la suscripción no se toca', () => {
    expect(estadoDeError(new Error('red caída'))).toBeUndefined();
    expect(estadoDeError(null)).toBeUndefined();
  });
});
