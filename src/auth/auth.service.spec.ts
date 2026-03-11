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

function buildMockPrisma(usuarioOverride: Record<string, unknown> | null = USUARIO_ACTIVO) {
  return {
    usuario: {
      findFirst: jest.fn().mockResolvedValue(usuarioOverride),
      update: jest.fn().mockResolvedValue({ ...USUARIO_ACTIVO, ultimoIngreso: new Date() }),
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
        nombres: 'admin@test.com',
        contrasena: 'contraseña-correcta',
      });

      expect(resultado).toHaveProperty('access_token');
      expect(resultado.access_token).toBe('jwt-token-mock');
      expect(resultado.usuario).toHaveProperty('id', 'user-1');
      // No debe incluir el hash de la contraseña en la respuesta
      expect(resultado.usuario).not.toHaveProperty('hashContrasena');
    });

    it('lanza UnauthorizedException si el usuario no existe', async () => {
      (prisma.usuario.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login({ nombres: 'noexiste@test.com', contrasena: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si la contraseña es incorrecta', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ nombres: 'admin@test.com', contrasena: 'contraseña-mal' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si el usuario está INACTIVO', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      (prisma.usuario.findFirst as jest.Mock).mockResolvedValue({
        ...USUARIO_ACTIVO,
        estado: 'INACTIVO',
      });

      await expect(
        service.login({ nombres: 'admin@test.com', contrasena: 'correcta' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('actualiza ultimoIngreso después de un login exitoso', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await service.login({ nombres: 'admin@test.com', contrasena: 'correcta' });

      expect(prisma.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ ultimoIngreso: expect.any(Date) }),
        }),
      );
    });
  });

  // ── validarUsuario ─────────────────────────
  describe('validarUsuario', () => {
    it('retorna null si el usuario no existe en BD', async () => {
      (prisma.usuario.findFirst as jest.Mock).mockResolvedValue(null);
      const result = await service.validarUsuario('noexiste', 'pass');
      expect(result).toBeNull();
    });

    it('retorna null si argon2.verify lanza error inesperado', async () => {
      (argon2.verify as jest.Mock).mockRejectedValue(new Error('crypto error'));
      const result = await service.validarUsuario('admin@test.com', 'pass');
      expect(result).toBeNull();
    });

    it('retorna el usuario SIN hashContrasena si las credenciales son válidas', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      const result = await service.validarUsuario('admin@test.com', 'correcta');
      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty('hashContrasena');
      expect(result).toHaveProperty('id', 'user-1');
    });
  });
});
