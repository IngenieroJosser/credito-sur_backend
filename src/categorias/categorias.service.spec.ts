import { Test, TestingModule } from '@nestjs/testing';
import { CategoriasService } from './categorias.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Las categorías: borrado lógico y qué se ve después de borrar.
 *
 * Por qué existe este archivo: `categorias` no tenía ninguna prueba. El módulo
 * es pequeño, pero de él cuelga la clasificación de los artículos, y borra en
 * lógico —marca `activa: false` y pone fecha— en vez de eliminar la fila.
 *
 * Donde eso se rompe es en la consulta: si una pantalla lee una categoría
 * borrada y la pinta como viva, el artículo aparece clasificado en algo que ya
 * no existe.
 */
describe('CategoriasService', () => {
  let service: CategoriasService;
  let prisma: {
    categoria: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      categoria: {
        create: jest.fn().mockResolvedValue({ id: 'c-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ id: 'c-1' }),
      },
    };

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriasService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = modulo.get<CategoriasService>(CategoriasService);
  });

  describe('findAll', () => {
    it('solo devuelve las vivas: ni inactivas ni borradas', async () => {
      await service.findAll();

      expect(prisma.categoria.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ activa: true, eliminadoEn: null }),
        }),
      );
    });

    it('filtra por tipo cuando se pide uno', async () => {
      await service.findAll('ARTICULO');

      const { where } = prisma.categoria.findMany.mock.calls[0][0];
      expect(where.tipo).toBe('ARTICULO');
    });

    it('sin tipo no filtra por tipo, en vez de buscar la cadena vacía', async () => {
      // `tipo: ''` traería cero resultados y la pantalla saldría vacía. Por eso
      // el servicio lo convierte en `undefined`, que Prisma ignora.
      await service.findAll('');

      const { where } = prisma.categoria.findMany.mock.calls[0][0];
      expect(where.tipo).toBeUndefined();
    });

    it('las ordena por nombre, que es como se leen en un desplegable', async () => {
      await service.findAll();

      expect(prisma.categoria.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { nombre: 'asc' } }),
      );
    });
  });

  describe('remove', () => {
    it('no borra la fila: la marca inactiva y le pone fecha', async () => {
      // El borrado duro rompería los artículos que ya apuntan a esa categoría.
      await service.remove('c-1');

      const llamada = prisma.categoria.update.mock.calls[0][0];
      expect(llamada.where).toEqual({ id: 'c-1' });
      expect(llamada.data.activa).toBe(false);
      expect(llamada.data.eliminadoEn).toBeInstanceOf(Date);
    });
  });

  describe('findOne y update', () => {
    it('ACTUAL, NO DESEADO: `findOne` devuelve también una categoría borrada', async () => {
      // `findAll` filtra `eliminadoEn: null` y `findOne` no. O sea que una
      // categoría borrada desaparece del listado pero sigue siendo consultable
      // por su id, y la pantalla que la lea así la pintará como si viviera.
      //
      // Queda escrito para que cerrarlo sea una decisión: hay sitios que
      // legítimamente necesitan leer una categoría archivada —el detalle de un
      // artículo viejo, un reporte histórico— y filtrar aquí sin mirarlos los
      // rompería.
      await service.findOne('c-borrada');

      expect(prisma.categoria.findUnique).toHaveBeenCalledWith({
        where: { id: 'c-borrada' },
      });
    });

    it('ACTUAL, NO DESEADO: `update` puede modificar una categoría ya borrada', async () => {
      // Mismo hueco que arriba, del lado de la escritura: nada impide revivir
      // campos de una categoría archivada sin pasar por una restauración
      // explícita.
      await service.update('c-borrada', { nombre: 'Otra cosa' });

      const { where } = prisma.categoria.update.mock.calls[0][0];
      expect(where).toEqual({ id: 'c-borrada' });
      expect(where).not.toHaveProperty('eliminadoEn');
    });
  });
});
