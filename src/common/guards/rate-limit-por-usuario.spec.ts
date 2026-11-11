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

  /**
   * El caso que de verdad llega, y que estas pruebas no estaban mirando.
   *
   * Las de arriba le pasan `{ user: { id } }` a mano, y con eso pasaban. Pero
   * ese estado NO existe en producción en el momento en que corre este guarda:
   * está registrado como el único `APP_GUARD` global, Nest corre los globales
   * ANTES de los de controlador, y `JwtAuthGuard` —quien rellena
   * `request.user`— lo aplican los 26 controladores uno a uno con
   * `@UseGuards`. Así que `request.user` siempre valía `undefined` aquí y el
   * cupo caía SIEMPRE a la IP, con las pruebas en verde.
   *
   * Medido en vivo con la cabecera `X-RateLimit-Remaining`: el administrador
   * empezaba con 99.999, el cobrador hacía cinco peticiones y el administrador
   * pasaba a 99.993. Perdía cupo por peticiones que no había hecho él.
   *
   * De ahí la lección que estas pruebas dejan escrita: un doble que inventa un
   * estado que el sistema no produce comprueba el código y no el sistema.
   */
  describe('con el token en la cabecera y sin request.user (lo que pasa de verdad)', () => {
    const SECRETO = 'secreto-de-prueba-para-el-limitador';
    let secretoAnterior: string | undefined;

    beforeAll(() => {
      secretoAnterior = process.env.JWT_SECRET;
      process.env.JWT_SECRET = SECRETO;
    });

    afterAll(() => {
      if (secretoAnterior === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = secretoAnterior;
    });

    // El token se firma de verdad, con la misma librería que lo verifica: un
    // token inventado a mano no probaría nada, porque lo que se quiere fijar es
    // precisamente que se COMPRUEBE la firma.
    const firmar = (payload: object, secreto = SECRETO) =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('jsonwebtoken') as typeof import('jsonwebtoken')).sign(
        payload,
        secreto,
      );

    const conToken = (token: string, ip = '190.1.1.1') => ({
      ip,
      headers: { authorization: `Bearer ${token}` },
    });

    it('saca el usuario del token aunque request.user no exista', () => {
      expect(clavePara(conToken(firmar({ sub: 'u-7' })))).toBe('u:u-7');
    });

    it('dos personas de la misma IP no comparten cupo', () => {
      // Es el caso de la oficina, ahora comprobado por el camino real.
      const a = clavePara(conToken(firmar({ sub: 'u-1' })));
      const b = clavePara(conToken(firmar({ sub: 'u-2' })));
      expect(a).toBe('u:u-1');
      expect(b).toBe('u:u-2');
    });

    it('un token con OTRA firma no estrena cupo: cae a la IP', () => {
      // Lo importante de todo esto. Si se leyera el token sin verificarlo,
      // bastaría inventarse un `sub` cualquiera para tener cupo entero cada
      // vez, y el limitador no limitaría nada.
      expect(
        clavePara(conToken(firmar({ sub: 'intruso' }, 'otro-secreto'))),
      ).toBe('190.1.1.1');
    });

    it('un token caducado cae a la IP', () => {
      const caducado = firmar({ sub: 'u-9', exp: 1 });
      expect(clavePara(conToken(caducado))).toBe('190.1.1.1');
    });

    it('basura en la cabecera no revienta: cae a la IP', () => {
      for (const cabecera of [
        'Bearer no-es-un-token',
        'Bearer ',
        'Basic dXNlcjpwYXNz',
        '',
      ]) {
        expect(
          clavePara({ ip: '190.1.1.1', headers: { authorization: cabecera } }),
        ).toBe('190.1.1.1');
      }
    });

    it('un token sin `sub` cae a la IP', () => {
      expect(clavePara(conToken(firmar({ nombres: 'Sin Sub' })))).toBe(
        '190.1.1.1',
      );
    });

    it('request.user manda sobre el token si ya está puesto', () => {
      // Por si algún día `JwtAuthGuard` pasa a ser global: entonces el trabajo
      // ya está hecho y no hay que verificar el token dos veces.
      expect(
        clavePara({
          user: { id: 'u-del-guarda' },
          ...conToken(firmar({ sub: 'u-del-token' })),
        }),
      ).toBe('u:u-del-guarda');
    });
  });
});
