import { NotFoundException } from '@nestjs/common';
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
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      categoria: {
        create: jest.fn().mockResolvedValue({ id: 'c-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        // Por omisión la categoría EXISTE y está viva: lo contrario se declara
        // en cada prueba que lo necesite.
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'c-1', nombre: 'Celulares' }),
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

  describe('findOne', () => {
    it('pide la categoría filtrando las borradas', async () => {
      // `findAll` descartaba las borradas y esto no, así que una categoría
      // eliminada desaparecía del listado pero seguía siendo consultable por su
      // id, y la pantalla que la leyera así la pintaba como si viviera.
      await service.findOne('c-1');

      expect(prisma.categoria.findFirst).toHaveBeenCalledWith({
        where: { id: 'c-1', eliminadoEn: null },
      });
    });

    it('avisa con 404 si no existe, en vez de devolver null', async () => {
      // Un `null` salía del controlador como un 200 con cuerpo vacío, que quien
      // llama lee como "la categoría existe y no tiene datos".
      prisma.categoria.findFirst.mockResolvedValue(null);

      await expect(service.findOne('c-borrada')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('no modifica una categoría archivada', async () => {
      // El hueco de `findOne` del lado de la escritura: nada impedía revivir
      // campos de una categoría borrada sin restaurarla antes.
      prisma.categoria.findFirst.mockResolvedValue(null);

      await expect(
        service.update('c-borrada', { nombre: 'Otra cosa' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.categoria.update).not.toHaveBeenCalled();
    });

    it('actualiza la que sí está viva', async () => {
      await service.update('c-1', { nombre: 'Celulares y tablets' });

      expect(prisma.categoria.update).toHaveBeenCalledWith({
        where: { id: 'c-1' },
        data: { nombre: 'Celulares y tablets' },
      });
    });
  });

  describe('remove, de nuevo', () => {
    it('borrar dos veces no reescribe la fecha del primer borrado', async () => {
      // Perder cuándo se archivó de verdad es perder el dato que justifica la
      // papelera.
      prisma.categoria.findFirst.mockResolvedValue(null);

      await expect(service.remove('c-ya-borrada')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.categoria.update).not.toHaveBeenCalled();
    });
  });
});
