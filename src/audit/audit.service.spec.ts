import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * El rastro de quién hizo qué.
 *
 * Por qué existe este archivo: `audit` no tenía ninguna prueba y es la tabla a
 * la que se acude cuando hay que explicar un movimiento de dinero. Si el
 * registro no se guarda, o se guarda incompleto, esa explicación no existe.
 *
 * Tres de estas pruebas fijan comportamientos que NO son los deseados sino los
 * actuales, y están marcadas como tales. Se escriben para que al cambiarlos sea
 * una decisión y no un accidente, y para que queden a la vista de quien lea.
 */
describe('AuditService', () => {
  let service: AuditService;
  let prisma: {
    registroAuditoria: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
  };

  const entrada = {
    usuarioId: 'u-1',
    accion: 'APROBAR_CREDITO',
    entidad: 'Prestamo',
    entidadId: 'p-1',
  };

  beforeEach(async () => {
    prisma = {
      registroAuditoria: {
        create: jest.fn().mockResolvedValue({ id: 'a-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = modulo.get<AuditService>(AuditService);
  });

  describe('create', () => {
    it('guarda quién, qué y sobre qué', async () => {
      await service.create(entrada);

      expect(prisma.registroAuditoria.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          usuarioId: 'u-1',
          accion: 'APROBAR_CREDITO',
          entidad: 'Prestamo',
          entidadId: 'p-1',
        }),
      });
    });

    it('guarda la huella de la petición: IP, navegador y endpoint', async () => {
      // Sin esto, un registro dice qué pasó pero no desde dónde, que es la mitad
      // de lo que se busca al revisar un movimiento sospechoso.
      await service.create({
        ...entrada,
        metadata: {
          ip: '190.0.0.1',
          userAgent: 'Mozilla/5.0',
          endpoint: 'POST /payments',
        },
      });

      expect(prisma.registroAuditoria.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          direccionIP: '190.0.0.1',
          agenteUsuario: 'Mozilla/5.0',
          endpoint: 'POST /payments',
        }),
      });
    });

    it('sin valores previos ni nuevos, guarda objetos vacíos y no nulos', async () => {
      // Columnas Json: un `null` y un `{}` se leen distinto al consultar después.
      await service.create(entrada);

      const { data } = prisma.registroAuditoria.create.mock.calls[0][0];
      expect(data.valoresAnteriores).toEqual({});
      expect(data.valoresNuevos).toEqual({});
    });

    it('ACTUAL, NO DESEADO: `cambios` dice "calculated" sin calcular nada', async () => {
      // El servicio tiene escrito «aquí podrías implementar una lógica para
      // calcular diferencias» y en su lugar guarda el literal
      // `{ diff: 'calculated' }`. O sea que la columna `cambios` afirma que se
      // calculó un diff que nunca se hizo.
      //
      // No es inofensivo: quien lea la auditoría buscando QUÉ campo cambió no
      // encuentra nada, y el registro aparenta tenerlo. Los valores anteriores y
      // nuevos sí se guardan completos, así que el diff se puede derivar de
      // ellos cuando se implemente.
      await service.create({
        ...entrada,
        datosAnteriores: { monto: 100 },
        datosNuevos: { monto: 200 },
      });

      const { data } = prisma.registroAuditoria.create.mock.calls[0][0];
      expect(data.cambios).toEqual({ diff: 'calculated' });
      expect(data.valoresAnteriores).toEqual({ monto: 100 });
      expect(data.valoresNuevos).toEqual({ monto: 200 });
    });
  });

  describe('findAllPaginated', () => {
    it('pide la primera página de 50 por omisión', async () => {
      await service.findAllPaginated();

      expect(prisma.registroAuditoria.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50, skip: 0 }),
      );
    });

    it('calcula el salto a partir de la página', async () => {
      await service.findAllPaginated(3, 20);

      expect(prisma.registroAuditoria.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 40 }),
      );
    });

    it('devuelve el total y el número de páginas', async () => {
      prisma.registroAuditoria.count.mockResolvedValue(95);

      const res = await service.findAllPaginated(1, 20);

      expect(res.total).toBe(95);
      expect(res.totalPaginas).toBe(5);
    });

    it('ACTUAL, NO DESEADO: no hay tope de tamaño de página', async () => {
      // `backup.getHistory` acota su límite entre 1 y 100; esto no acota nada.
      // Una petición con `?limite=999999` contra una tabla de auditoría grande
      // se trae todo a memoria. Es el tipo de cosa que no se nota en desarrollo
      // —donde la tabla tiene cien filas— y tumba el servidor en producción.
      await service.findAllPaginated(1, 999999);

      expect(prisma.registroAuditoria.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 999999 }),
      );
    });

    it('ACTUAL, NO DESEADO: la página 0 pide un salto negativo', async () => {
      // `skip = (0 - 1) * 50 = -50`. Prisma rechaza un `skip` negativo, así que
      // esto sale como error 500 en vez de como una petición mal formada.
      await service.findAllPaginated(0, 50);

      expect(prisma.registroAuditoria.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: -50 }),
      );
    });
  });
});
