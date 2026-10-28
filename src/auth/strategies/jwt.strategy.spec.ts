import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Lo que queda en `req.user` en cada peticion autenticada, y que
 * `GET /auth/perfil` devuelve tal cual.
 *
 * Antes salia en parte del token, y el token no lleva todo: `auth.service` firma
 * `sub`, `nombres`, `rol` y `permisos` (el payload de registrar un usuario omite
 * incluso `permisos`). Nunca lleva `email`. Y aqui se hacia
 * `correo: payload.email`, asi que el correo valia SIEMPRE undefined y el endpoint
 * de perfil respondia sin correo, sin apellidos y sin telefono.
 *
 * Ahora todo sale de la fila del usuario, que esta consulta ya traia: es la misma
 * consulta con mas columnas en el `select`, no una extra.
 */
const filaDeUsuario = {
  id: 'usuario-1',
  estado: 'ACTIVO',
  eliminadoEn: null,
  rol: 'COBRADOR',
  nombres: 'Juan',
  apellidos: 'Perez',
  correo: 'juan@ejemplo.com',
  telefono: '3110000000',
};

// El constructor de la estrategia exige el secreto (lo lee de JWT_SECRET con un
// getter, para que el .env ya este cargado). En la prueba se pone uno cualquiera:
// aqui no se verifica ninguna firma, solo `validate`.
const SECRETO_PREVIO = process.env.JWT_SECRET;
beforeAll(() => {
  process.env.JWT_SECRET = 'secreto-de-prueba';
});
afterAll(() => {
  if (SECRETO_PREVIO === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = SECRETO_PREVIO;
});

const hacerEstrategia = (fila: unknown) => {
  const prisma = {
    usuario: { findUnique: jest.fn().mockResolvedValue(fila) },
  } as unknown as PrismaService;
  return { estrategia: new JwtStrategy(prisma), prisma };
};

/** El payload real de iniciar sesion: sin `email`. */
const payloadDeLogin = {
  sub: 'usuario-1',
  nombres: 'Juan',
  rol: 'COBRADOR' as never,
  permisos: ['RUTAS_VIEW'],
};

describe('JwtStrategy.validate', () => {
  it('devuelve el correo de la base, que el token no lleva', async () => {
    const { estrategia } = hacerEstrategia(filaDeUsuario);

    const usuario = await estrategia.validate(payloadDeLogin);

    expect(usuario.correo).toBe('juan@ejemplo.com');
  });

  it('devuelve apellidos y telefono, que el token tampoco lleva', async () => {
    const { estrategia } = hacerEstrategia(filaDeUsuario);

    const usuario = await estrategia.validate(payloadDeLogin);

    expect(usuario.apellidos).toBe('Perez');
    expect(usuario.telefono).toBe('3110000000');
  });

  it('pide esos campos en la misma consulta, no en otra', async () => {
    const { estrategia, prisma } = hacerEstrategia(filaDeUsuario);

    await estrategia.validate(payloadDeLogin);

    const findUnique = (
      prisma as unknown as { usuario: { findUnique: jest.Mock } }
    ).usuario.findUnique;
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique.mock.calls[0][0].select).toMatchObject({
      nombres: true,
      apellidos: true,
      correo: true,
      telefono: true,
    });
  });

  it('el rol sale de la base, no del token: una degradacion surte efecto ya', async () => {
    // Si a un ADMIN se le baja a COBRADOR, no hay que esperar a que caduque el
    // token de 8 horas.
    const { estrategia } = hacerEstrategia({
      ...filaDeUsuario,
      rol: 'COBRADOR',
    });

    const usuario = await estrategia.validate({
      ...payloadDeLogin,
      rol: 'ADMIN',
    });

    expect(usuario.rol).toBe('COBRADOR');
  });

  it('un correo nulo en la base no se convierte en la cadena "null"', async () => {
    const { estrategia } = hacerEstrategia({
      ...filaDeUsuario,
      correo: null,
      apellidos: null,
      telefono: null,
    });

    const usuario = await estrategia.validate(payloadDeLogin);

    expect(usuario.correo).toBeUndefined();
    expect(usuario.apellidos).toBeUndefined();
    expect(usuario.telefono).toBeUndefined();
  });

  it('cae al nombre del token si la fila lo trae vacio', async () => {
    const { estrategia } = hacerEstrategia({ ...filaDeUsuario, nombres: '' });

    const usuario = await estrategia.validate(payloadDeLogin);

    expect(usuario.nombres).toBe('Juan');
  });

  it('acepta el token de registro, que no trae permisos', async () => {
    const { estrategia } = hacerEstrategia(filaDeUsuario);

    const usuario = await estrategia.validate({
      sub: 'usuario-1',
      nombres: 'Juan',
      rol: 'COBRADOR',
    });

    expect(usuario.permisos).toEqual([]);
  });

  describe('sesiones que deben rechazarse', () => {
    it('un usuario que no existe', async () => {
      const { estrategia } = hacerEstrategia(null);

      await expect(estrategia.validate(payloadDeLogin)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('un usuario que no esta ACTIVO', async () => {
      const { estrategia } = hacerEstrategia({
        ...filaDeUsuario,
        estado: 'SUSPENDIDO',
      });

      await expect(estrategia.validate(payloadDeLogin)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('un usuario archivado, aunque su estado siga en ACTIVO', async () => {
      const { estrategia } = hacerEstrategia({
        ...filaDeUsuario,
        eliminadoEn: new Date(),
      });

      await expect(estrategia.validate(payloadDeLogin)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
