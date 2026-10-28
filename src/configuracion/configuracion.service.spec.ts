import { Test, TestingModule } from '@nestjs/testing';
import { ConfiguracionService } from './configuracion.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * La configuración que decide si un crédito se aprueba solo.
 *
 * Por qué existe este archivo: `configuracion` no tenía ninguna prueba, y de él
 * cuelgan `shouldAutoApproveClients` y `shouldAutoApproveCredits`, que son las
 * dos banderas que deciden si una solicitud pasa sin que nadie la revise. Un
 * cambio accidental aquí —un valor por defecto que pase a `true`, un `??` donde
 * iba un `||`— aprueba créditos en silencio, y eso no se ve en ninguna pantalla
 * hasta que el dinero ya salió.
 *
 * Lo que se fija es que el sistema sea seguro por omisión: si no hay
 * configuración, o si el campo viene vacío, la respuesta es NO aprobar.
 */
describe('ConfiguracionService', () => {
  let service: ConfiguracionService;
  let prisma: {
    configuracionSistema: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      configuracionSistema: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        ConfiguracionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = modulo.get<ConfiguracionService>(ConfiguracionService);
  });

  describe('getConfiguracion', () => {
    it('la crea con las dos aprobaciones automáticas APAGADAS si no existe', async () => {
      // El arranque en limpio: una instalación nueva no debe aprobar nada sola.
      prisma.configuracionSistema.findUnique.mockResolvedValue(null);
      prisma.configuracionSistema.create.mockImplementation(
        ({ data }: { data: unknown }) => Promise.resolve(data),
      );

      const config = await service.getConfiguracion();

      expect(prisma.configuracionSistema.create).toHaveBeenCalledWith({
        data: {
          id: 'default',
          autoAprobarClientes: false,
          autoAprobarCreditos: false,
        },
      });
      expect(config).toEqual(
        expect.objectContaining({
          autoAprobarClientes: false,
          autoAprobarCreditos: false,
        }),
      );
    });

    it('no vuelve a crearla si ya existe', async () => {
      prisma.configuracionSistema.findUnique.mockResolvedValue({
        id: 'default',
        autoAprobarClientes: true,
        autoAprobarCreditos: false,
      });

      await service.getConfiguracion();

      expect(prisma.configuracionSistema.create).not.toHaveBeenCalled();
    });
  });

  describe('shouldAutoApproveCredits', () => {
    it('es false cuando la bandera está apagada', async () => {
      prisma.configuracionSistema.findUnique.mockResolvedValue({
        id: 'default',
        autoAprobarCreditos: false,
      });

      await expect(service.shouldAutoApproveCredits()).resolves.toBe(false);
    });

    it('es true solo cuando la bandera está encendida', async () => {
      prisma.configuracionSistema.findUnique.mockResolvedValue({
        id: 'default',
        autoAprobarCreditos: true,
      });

      await expect(service.shouldAutoApproveCredits()).resolves.toBe(true);
    });

    it('un campo nulo NO aprueba: ante la duda, se revisa a mano', async () => {
      // La columna puede llegar nula desde una fila vieja o una migración a
      // medias. Lo seguro es tratarla como "no", nunca como "sí".
      prisma.configuracionSistema.findUnique.mockResolvedValue({
        id: 'default',
        autoAprobarCreditos: null,
      });

      await expect(service.shouldAutoApproveCredits()).resolves.toBe(false);
    });
  });

  describe('shouldAutoApproveClients', () => {
    it('un campo nulo NO aprueba', async () => {
      prisma.configuracionSistema.findUnique.mockResolvedValue({
        id: 'default',
        autoAprobarClientes: null,
      });

      await expect(service.shouldAutoApproveClients()).resolves.toBe(false);
    });

    it('es true solo cuando la bandera está encendida', async () => {
      prisma.configuracionSistema.findUnique.mockResolvedValue({
        id: 'default',
        autoAprobarClientes: true,
      });

      await expect(service.shouldAutoApproveClients()).resolves.toBe(true);
    });
  });

  describe('updateConfiguracion', () => {
    it('deja constancia de quién la cambió', async () => {
      // Encender la aprobación automática es una decisión con consecuencias de
      // dinero: tiene que quedar el rastro de quién la tomó.
      prisma.configuracionSistema.findUnique.mockResolvedValue({
        id: 'default',
        autoAprobarCreditos: false,
      });
      prisma.configuracionSistema.update.mockResolvedValue({});

      await service.updateConfiguracion({ autoAprobarCreditos: true }, 'u-123');

      expect(prisma.configuracionSistema.update).toHaveBeenCalledWith({
        where: { id: 'default' },
        data: { autoAprobarCreditos: true, actualizadoPorId: 'u-123' },
      });
    });
  });
});
