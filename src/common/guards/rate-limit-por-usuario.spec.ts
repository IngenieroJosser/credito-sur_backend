import { RateLimitGuard } from './rate-limit.guard';

/**
 * Contra quién se cuenta el cupo de peticiones.
 *
 * Antes se contaba siempre por IP, y eso tiene una consecuencia medida: en la oficina todos
 * salen por la misma, así que los usuarios se agotaban el cupo ENTRE ELLOS. Con los siete
 * roles trabajando a la vez aparecían cientos de respuestas 429 haciendo cada uno un uso
 * normal. Estas pruebas fijan las dos mitades de la regla.
 */
describe('RateLimitGuard: contra quién se cuenta', () => {
  // `resolveClientKey` es privado: se alcanza por su nombre a través de un tipo que lo
  // declara, en vez de con un `as any` que apagaría la comprobación entera.
  const clavePara = (request: unknown) =>
    (
      RateLimitGuard.prototype as unknown as {
        resolveClientKey(r: unknown): string;
      }
    ).resolveClientKey(request);

  it('cuenta por USUARIO cuando hay sesión', () => {
    expect(clavePara({ user: { id: 'u-1' }, ip: '10.0.0.5' })).toBe('u:u-1');
  });

  it('dos usuarios de la MISMA ip no comparten cupo', () => {
    // Es el caso de la oficina: una sola salida a internet, varias personas.
    const a = clavePara({ user: { id: 'u-1' }, ip: '190.1.1.1' });
    const b = clavePara({ user: { id: 'u-2' }, ip: '190.1.1.1' });
    expect(a).not.toBe(b);
  });

  it('cuenta por IP cuando NO hay sesión', () => {
    // El login llega sin usuario, y ahí el límite es justo lo que frena la fuerza bruta.
    expect(clavePara({ ip: '190.1.1.1' })).toBe('190.1.1.1');
  });

  it('cae al socket y al encabezado reenviado si no hay ip', () => {
    expect(clavePara({ socket: { remoteAddress: '10.0.0.9' } })).toBe(
      '10.0.0.9',
    );
    expect(
      clavePara({
        socket: {},
        headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
      }),
    ).toBe('203.0.113.7');
  });

  it('no se queda sin clave si no hay nada', () => {
    expect(clavePara({})).toBe('unknown');
  });
});
