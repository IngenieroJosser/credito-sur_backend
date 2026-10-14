import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import { LedgerService } from '../accounting/ledger.service';

/**
 * El valor del inventario y el aviso de stock bajo.
 *
 * Por qué existe este archivo: `inventory` no tenía ni una prueba, y es de los
 * pocos módulos sin cobertura que toca dinero. `getInventoryStats` multiplica
 * costo por stock y ese número se muestra como el valor de la bodega; si se
 * equivoca, nadie lo nota hasta que no cuadra con el conteo físico.
 *
 * Lo que se fija aquí es el comportamiento observable, no la implementación:
 * qué entra, qué sale, y qué pasa en los bordes —bodega vacía, costo con
 * centavos, stock exactamente en el mínimo—.
 */

/** Un producto tal como lo lee `getInventoryStats` (solo los tres campos que pide). */
const producto = (costo: number | string, stock: number, stockMinimo = 0) => ({
  costo,
  stock,
  stockMinimo,
});

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: { producto: { count: jest.Mock; findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      producto: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
        // El gateway y el libro contable no participan en las estadísticas: van
        // como dobles mudos para poder construir el servicio.
        { provide: NotificacionesGateway, useValue: { emitir: jest.fn() } },
        { provide: LedgerService, useValue: { registrar: jest.fn() } },
      ],
    }).compile();

    service = modulo.get<InventoryService>(InventoryService);
  });

  describe('getInventoryStats', () => {
    it('el valor de la bodega es la suma de costo por stock', async () => {
      prisma.producto.count.mockResolvedValue(3);
      prisma.producto.findMany.mockResolvedValue([
        producto(1000, 5), // 5.000
        producto(2500, 2), // 5.000
        producto(300, 10), // 3.000
      ]);

      const stats = await service.getInventoryStats();

      expect(stats.totalValorInventario).toBe(13000);
      expect(stats.totalReferencias).toBe(3);
    });

    it('cuenta como stock bajo el que está EN el mínimo, no solo por debajo', async () => {
      // El borde que decide si aparece o no la alerta de reposición. Con `<` en
      // vez de `<=`, un producto que acaba de tocar su mínimo no avisaría.
      prisma.producto.count.mockResolvedValue(3);
      prisma.producto.findMany.mockResolvedValue([
        producto(100, 2, 5), // por debajo
        producto(100, 5, 5), // justo en el mínimo
        producto(100, 9, 5), // por encima
      ]);

      const stats = await service.getInventoryStats();

      expect(stats.productosBajoStock).toBe(2);
    });

    it('una bodega vacía vale cero y no revienta', async () => {
      prisma.producto.count.mockResolvedValue(0);
      prisma.producto.findMany.mockResolvedValue([]);

      const stats = await service.getInventoryStats();

      expect(stats).toEqual(
        expect.objectContaining({
          totalReferencias: 0,
          totalValorInventario: 0,
          productosBajoStock: 0,
        }),
      );
    });

    it('suma bien un costo que llega como Decimal en texto', async () => {
      // Prisma devuelve `Decimal`, que al serializar es una cadena. Sin el
      // `Number(...)` esto concatenaría en vez de sumar: "0" + "1000" + "2000".
      prisma.producto.count.mockResolvedValue(2);
      prisma.producto.findMany.mockResolvedValue([
        producto('1000.00', 2),
        producto('2000.50', 1),
      ]);

      const stats = await service.getInventoryStats();

      expect(stats.totalValorInventario).toBeCloseTo(4000.5, 2);
      expect(typeof stats.totalValorInventario).toBe('number');
    });

    it('solo mira productos activos y no eliminados', async () => {
      // Un artículo archivado sigue en la tabla. Si entrara en la cuenta, el
      // valor de la bodega incluiría mercancía que ya no está.
      prisma.producto.count.mockResolvedValue(1);
      prisma.producto.findMany.mockResolvedValue([producto(100, 1)]);

      await service.getInventoryStats();

      const filtro = { activo: true, eliminadoEn: null };
      expect(prisma.producto.count).toHaveBeenCalledWith({ where: filtro });
      expect(prisma.producto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: filtro }),
      );
    });

    it('un stock negativo resta del valor en vez de ignorarse', async () => {
      // No es una regla deseada: es lo que hace hoy, y se deja escrito para que
      // un cambio futuro sea deliberado. Un stock negativo es un dato corrupto
      // —no existe media caja de menos— y ahora mismo baja el valor de la
      // bodega en silencio en lugar de avisar.
      prisma.producto.count.mockResolvedValue(2);
      prisma.producto.findMany.mockResolvedValue([
        producto(1000, 5), // 5.000
        producto(1000, -2), // -2.000
      ]);

      const stats = await service.getInventoryStats();

      expect(stats.totalValorInventario).toBe(3000);
    });
  });
});
