import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BackupService } from './backup.service';
import { BackupExcelService } from './backup-excel.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Los respaldos: qué se devuelve al pedir un archivo y qué se niega.
 *
 * Por qué existe este archivo: `backup` es el módulo más grande sin una sola
 * prueba (1.848 líneas) y es el que decide qué fichero del disco se entrega a
 * quien lo pide. La ruta no la escribe el usuario, viene de la base, pero sale
 * del servidor igual: si `getArtifactPath` devuelve algo que no debía, el
 * controlador lo transmite.
 *
 * Lo otro que se fija aquí es el tope del historial. `getHistory` acota el
 * límite entre 1 y 100, y eso es lo que evita que una petición con `?limit=
 * 999999` se traiga la tabla entera.
 */
describe('BackupService', () => {
  let service: BackupService;
  let prisma: {
    backupRun: { findUnique: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      backupRun: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        BackupService,
        { provide: PrismaService, useValue: prisma },
        // El exportador a Excel solo participa al generar el respaldo, no al
        // consultarlo: doble mudo para poder construir el servicio.
        {
          provide: BackupExcelService,
          useValue: { exportSnapshotToXlsx: jest.fn() },
        },
      ],
    }).compile();

    service = modulo.get<BackupService>(BackupService);
  });

  describe('getArtifactPath', () => {
    it('niega un respaldo que no existe', async () => {
      prisma.backupRun.findUnique.mockResolvedValue(null);

      await expect(service.getArtifactPath('no-existe', 'dump')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('devuelve la ruta del volcado y su tipo de contenido', async () => {
      prisma.backupRun.findUnique.mockResolvedValue({
        id: 'r-1',
        metadata: { artifacts: { dump: { path: '/backups/b.dump' } } },
      });

      const info = await service.getArtifactPath('r-1', 'dump');

      expect(info.path).toBe('/backups/b.dump');
      expect(info.contentType).toBe('application/octet-stream');
      // `baseDir` viaja con la respuesta porque es lo que el controlador usa
      // para comprobar que el archivo está dentro del directorio permitido.
      expect(info.baseDir).toBeTruthy();
    });

    it('el Excel sale con el tipo de contenido de una hoja de cálculo', async () => {
      prisma.backupRun.findUnique.mockResolvedValue({
        id: 'r-1',
        metadata: { artifacts: { xlsx: { path: '/backups/b.xlsx' } } },
      });

      const info = await service.getArtifactPath('r-1', 'xlsx');

      expect(info.contentType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    });

    it('cae a `filePath` cuando el respaldo es anterior a los metadatos', async () => {
      // Las filas viejas no tienen `metadata.artifacts`. Sin este respaldo, los
      // respaldos de antes del cambio dejarían de poder descargarse.
      prisma.backupRun.findUnique.mockResolvedValue({
        id: 'r-viejo',
        filePath: '/backups/antiguo.dump',
        metadata: null,
      });

      const info = await service.getArtifactPath('r-viejo', 'dump');

      expect(info.path).toBe('/backups/antiguo.dump');
    });

    it('niega el Excel cuando ese respaldo no lo generó', async () => {
      // Un respaldo puede tener volcado y no hoja de cálculo. Pedir la que no
      // existe tiene que fallar claro, no devolver una ruta vacía que luego el
      // controlador intente abrir.
      prisma.backupRun.findUnique.mockResolvedValue({
        id: 'r-1',
        metadata: { artifacts: { dump: { path: '/backups/b.dump' } } },
      });

      await expect(service.getArtifactPath('r-1', 'xlsx')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getHistory', () => {
    it('devuelve 20 por omisión', async () => {
      prisma.backupRun.findMany.mockResolvedValue([]);

      await service.getHistory();

      expect(prisma.backupRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it('no deja pedir más de 100 aunque se pida un millón', async () => {
      // El tope es lo que evita que `?limit=999999` se traiga la tabla entera.
      prisma.backupRun.findMany.mockResolvedValue([]);

      await service.getHistory(999999);

      expect(prisma.backupRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('un límite de cero o negativo se sube a 1, no se queda en cero', async () => {
      // `take: 0` en Prisma devuelve una lista vacía: la pantalla saldría sin
      // historial y pareciendo que nunca hubo respaldos.
      prisma.backupRun.findMany.mockResolvedValue([]);

      await service.getHistory(0);
      expect(prisma.backupRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );

      prisma.backupRun.findMany.mockClear();
      await service.getHistory(-5);
      expect(prisma.backupRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1 }),
      );
    });

    it('un límite que no es número cae en el valor por omisión', async () => {
      prisma.backupRun.findMany.mockResolvedValue([]);

      await service.getHistory('abc' as unknown as number);

      expect(prisma.backupRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it('ordena del más reciente al más antiguo', async () => {
      prisma.backupRun.findMany.mockResolvedValue([]);

      await service.getHistory();

      expect(prisma.backupRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { startedAt: 'desc' } }),
      );
    });
  });

  describe('getStatus', () => {
    it('informa del último respaldo y de dónde se guardan', async () => {
      prisma.backupRun.findFirst.mockResolvedValue({ id: 'r-1', status: 'OK' });

      const status = await service.getStatus();

      expect(status.lastRun).toEqual({ id: 'r-1', status: 'OK' });
      expect(status.config.backupDir).toBeTruthy();
      expect(status.config.pgDumpPath).toBeTruthy();
    });

    it('sin ningún respaldo hecho, `lastRun` es nulo y no revienta', async () => {
      prisma.backupRun.findFirst.mockResolvedValue(null);

      const status = await service.getStatus();

      expect(status.lastRun).toBeNull();
    });
  });
});
