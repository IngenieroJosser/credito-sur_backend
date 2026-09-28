/**
 * ============================================================
 * TESTS UNITARIOS — AuthService
 * ============================================================
 *
 * Cubre el flujo de login y recuperación de contraseña.
 * argon2 se mockea para mantener los tests rápidos y deterministas.
 *
 * Para ejecutar: npx jest auth.service --no-coverage
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';

// Mockear argon2 para no hacer hash real en tests
jest.mock('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn().mockResolvedValue('$argon2id$hash-mock'),
}));

// ─────────────────────────────────────────────
// Datos de prueba
// ─────────────────────────────────────────────
const USUARIO_ACTIVO = {
  id: 'user-1',
  nombres: 'Admin',
  apellidos: 'Test',
  nombreUsuario: 'admin.test',
  correo: 'admin@test.com',
  rol: 'SUPER_ADMINISTRADOR',
  estado: 'ACTIVO',
  hashContrasena: '$argon2id$hash-correcto',
  ultimoIngreso: null,
  permisos: [],
};

// ─────────────────────────────────────────────
// Mocks de dependencias
// ─────────────────────────────────────────────
const mockUsersService = {};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('jwt-token-mock'),
};

function buildMockPrisma(
  usuarioOverride: Record<string, unknown> | null = USUARIO_ACTIVO,
) {
  return {
    usuario: {
      findFirst: jest.fn().mockResolvedValue(usuarioOverride),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest
        .fn()
        .mockResolvedValue({ ...USUARIO_ACTIVO, ultimoIngreso: new Date() }),
    },
    asignacionRolUsuario: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    asignacionPermisoUsuario: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    rolPermiso: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    resetCodigoContrasena: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({}),
    },
  };
}

// ─────────────────────────────────────────────
// Suite de tests
// ─────────────────────────────────────────────
describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof buildMockPrisma>;

  async function createModule(prismaOverride = buildMockPrisma()) {
    prisma = prismaOverride;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  }

  beforeEach(async () => {
    await createModule();
    jest.clearAllMocks();
  });

  // ── Instanciación ──────────────────────────
  it('debería instanciarse correctamente', () => {
    expect(service).toBeDefined();
  });

  // ── Login ──────────────────────────────────
  describe('login', () => {
    it('retorna accessToken y datos del usuario si las credenciales son correctas', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const resultado = await service.login({
        identificador: 'admin.test',
        contrasena: 'contraseña-correcta',
      });

      expect(resultado).toHaveProperty('access_token');
      expect(resultado.access_token).toBe('jwt-token-mock');
      expect(resultado.usuario).toHaveProperty('id', 'user-1');
      // No debe incluir el hash de la contraseña en la respuesta
      expect(resultado.usuario).not.toHaveProperty('hashContrasena');
    });

    it('lanza UnauthorizedException si el usuario no existe', async () => {
      prisma.usuario.findFirst.mockResolvedValue(null);
      prisma.usuario.findMany.mockResolvedValue([]);

      await expect(
        service.login({ identificador: 'no.existe', contrasena: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si la contraseña es incorrecta', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({
          identificador: 'admin.test',
          contrasena: 'contraseña-mal',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si el usuario está INACTIVO', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      prisma.usuario.findFirst.mockResolvedValue({
        ...USUARIO_ACTIVO,
        estado: 'INACTIVO',
      });

      await expect(
        service.login({ identificador: 'admin.test', contrasena: 'correcta' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('actualiza ultimoIngreso después de un login exitoso', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await service.login({
        identificador: 'admin.test',
        contrasena: 'correcta',
      });

      expect(prisma.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ ultimoIngreso: expect.any(Date) }),
        }),
      );
    });

    it('permite iniciar sesión con correo', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const resultado = await service.login({
        correo: ' ADMIN@Test.com ',
        contrasena: 'correcta',
      });

      expect(resultado.access_token).toBe('jwt-token-mock');
      expect(prisma.usuario.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { correo: { equals: 'admin@test.com', mode: 'insensitive' } },
            { nombreUsuario: 'admin@test.com' },
          ],
        },
      });
    });

    it('permite iniciar sesión con nombreUsuario', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const resultado = await service.login({
        identificador: ' Admin.Test ',
        contrasena: 'correcta',
      });

      expect(resultado.usuario).toHaveProperty('id', 'user-1');
      expect(prisma.usuario.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { correo: { equals: 'admin.test', mode: 'insensitive' } },
            { nombreUsuario: 'admin.test' },
          ],
        },
      });
    });

    it('lanza UnauthorizedException si el nombreUsuario no existe', async () => {
      prisma.usuario.findFirst.mockResolvedValue(null);
      prisma.usuario.findMany.mockResolvedValue([]);

      await expect(
        service.login({
          identificador: 'usuario.inexistente',
          contrasena: 'correcta',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── validarUsuario ─────────────────────────
  describe('validarUsuario', () => {
    it('retorna null si el usuario no existe en BD', async () => {
      prisma.usuario.findFirst.mockResolvedValue(null);
      prisma.usuario.findMany.mockResolvedValue([]);
      const result = await service.validarUsuario('noexiste', 'pass');
      expect(result).toBeNull();
    });

    it('un identificador que no es texto no llega a la base', async () => {
      // El DTO tipa `string`, pero el cuerpo lo manda el cliente. Antes esto se
      // convertia en el literal "[object Object]" y se buscaba asi en la base;
      // ahora se trata como identificador vacio y el login corta antes.
      prisma.usuario.findFirst.mockClear();
      prisma.usuario.findMany.mockClear();

      const result = await service.validarUsuario(
        { correo: 'admin' } as unknown as string,
        'pass',
      );

      expect(result).toBeNull();
      expect(prisma.usuario.findFirst).not.toHaveBeenCalled();
      expect(prisma.usuario.findMany).not.toHaveBeenCalled();
    });

    it('un identificador vacio o solo espacios tampoco llega a la base', async () => {
      prisma.usuario.findFirst.mockClear();

      expect(await service.validarUsuario('   ', 'pass')).toBeNull();
      expect(prisma.usuario.findFirst).not.toHaveBeenCalled();
    });

    it('retorna null si argon2.verify lanza error inesperado', async () => {
      (argon2.verify as jest.Mock).mockRejectedValue(new Error('crypto error'));
      const result = await service.validarUsuario('Admin', 'pass');
      expect(result).toBeNull();
    });

    it('retorna el usuario SIN hashContrasena si las credenciales son válidas', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      const result = await service.validarUsuario('Admin', 'correcta');
      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty('hashContrasena');
      expect(result).toHaveProperty('id', 'user-1');
    });

    it('identifica al usuario por su nombre de usuario, no por su nombre', async () => {
      prisma.usuario.findFirst.mockResolvedValue({
        ...USUARIO_ACTIVO,
        id: 'coordinador-1',
        nombres: 'Coordinador',
        apellidos: 'Prueba',
        nombreUsuario: 'coordinador.prueba',
        rol: 'COORDINADOR',
      });
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.validarUsuario(
        'coordinador.prueba',
        'CoordinadorPrueba',
      );

      // Se busca por nombre de usuario o correo; la búsqueda por nombre y
      // apellido se retiró porque dos personas pueden llamarse igual.
      expect(prisma.usuario.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              {
                correo: {
                  equals: 'coordinador.prueba',
                  mode: 'insensitive',
                },
              },
              { nombreUsuario: 'coordinador.prueba' },
            ],
          }),
        }),
      );
      expect(result).toMatchObject({
        id: 'coordinador-1',
        nombreUsuario: 'coordinador.prueba',
      });
      expect(result).not.toHaveProperty('hashContrasena');
    });

    it('no encuentra al usuario si se intenta entrar con el nombre completo', async () => {
      prisma.usuario.findFirst.mockResolvedValue(null);

      const result = await service.validarUsuario(
        'Coordinador Prueba',
        'CoordinadorPrueba',
      );

      expect(result).toBeNull();
    });
  });
  // ── Recuperacion de contrasena ──────────────
  /**
   * La politica: la recuperacion por uno mismo es SOLO para el superadmin. Los demas
   * usuarios la piden a un superadmin o a un administrador, que usa
   * `UsersService.resetearContrasena`.
   *
   * Esa regla estaba implementada pero sin ninguna prueba que la protegiera. Si alguien
   * quita la comprobacion del rol, cualquier cobrador podria pedir un codigo a su correo y
   * cambiarse la contrasena solo; nada avisaria.
   *
   * Tambien se fija que las respuestas negativas sean INDISTINGUIBLES entre si: un correo
   * que no existe, una cuenta inactiva y un usuario que no es superadmin tienen que
   * devolver el mismo mensaje, o el endpoint sirve para averiguar quien esta registrado.
   */
  describe('solicitarRecuperacion', () => {
    const MENSAJE_GENERICO =
      'Si el correo existe y la cuenta está activa, recibirás un código en breve.';

    it('un superadmin activo si recibe codigo', async () => {
      await createModule(
        buildMockPrisma({
          ...USUARIO_ACTIVO,
          rol: 'SUPER_ADMINISTRADOR',
          estado: 'ACTIVO',
        }),
      );

      await service.solicitarRecuperacion({ correo: 'super@credisur.com' });

      const [args] = prisma.usuario.update.mock.calls.at(-1) as [
        { data: Record<string, unknown> },
      ];
      expect(args.data.resetPasswordToken).toBeTruthy();
      // El codigo se guarda hasheado, nunca en claro.
      expect(String(args.data.resetPasswordToken)).toMatch(/^\$argon2/);
    });

    it('un COBRADOR no recibe codigo, y no se distingue de un correo inexistente', async () => {
      await createModule(
        buildMockPrisma({
          ...USUARIO_ACTIVO,
          rol: 'COBRADOR',
          estado: 'ACTIVO',
        }),
      );

      const res = await service.solicitarRecuperacion({
        correo: 'cobrador@credisur.com',
      });

      expect(res.mensaje).toBe(MENSAJE_GENERICO);
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('tampoco un ADMIN: el suyo lo resetea un superadmin', async () => {
      await createModule(
        buildMockPrisma({ ...USUARIO_ACTIVO, rol: 'ADMIN', estado: 'ACTIVO' }),
      );

      const res = await service.solicitarRecuperacion({
        correo: 'admin@credisur.com',
      });

      expect(res.mensaje).toBe(MENSAJE_GENERICO);
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('un superadmin INACTIVO tampoco', async () => {
      await createModule(
        buildMockPrisma({
          ...USUARIO_ACTIVO,
          rol: 'SUPER_ADMINISTRADOR',
          estado: 'INACTIVO',
        }),
      );

      const res = await service.solicitarRecuperacion({
        correo: 'super@credisur.com',
      });

      expect(res.mensaje).toBe(MENSAJE_GENERICO);
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('un correo que no existe devuelve el mismo mensaje', async () => {
      await createModule(buildMockPrisma(null));

      const res = await service.solicitarRecuperacion({
        correo: 'nadie@credisur.com',
      });

      expect(res.mensaje).toBe(MENSAJE_GENERICO);
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });
  });
});
