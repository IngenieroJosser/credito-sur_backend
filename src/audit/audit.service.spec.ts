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

    it('`cambios` dice QUE campo cambio, con su antes y su despues', async () => {
      // Aqui habia un `{ diff: "calculated" }` escrito a mano: la columna
      // afirmaba haber calculado un diff que nunca se hizo, y quien abria la
      // auditoria buscando que cambio no encontraba nada.
      await service.create({
        ...entrada,
        datosAnteriores: { monto: 100, estado: 'PENDIENTE' },
        datosNuevos: { monto: 200, estado: 'PENDIENTE' },
      });

      const { data } = prisma.registroAuditoria.create.mock.calls[0][0];
      expect(data.cambios).toEqual({ monto: { antes: 100, despues: 200 } });
      // `estado` no cambio, asi que no aparece: si salieran todos los campos el
      // diff seria tan ilegible como comparar los dos objetos enteros.
      expect(data.cambios).not.toHaveProperty('estado');
    });

    it('sin un lado de la comparacion, `cambios` queda vacio', async () => {
      await service.create({ ...entrada, datosNuevos: { monto: 200 } });

      const { data } = prisma.registroAuditoria.create.mock.calls[0][0];
      expect(data.cambios).toEqual({});
    });

    it('un campo que aparece o desaparece cuenta como cambio', async () => {
      await service.create({
        ...entrada,
        datosAnteriores: { monto: 100 },
        datosNuevos: { monto: 100, notas: 'reprogramado' },
      });

      const { data } = prisma.registroAuditoria.create.mock.calls[0][0];
      expect(data.cambios).toEqual({
        notas: { antes: undefined, despues: 'reprogramado' },
      });
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

    it('acota el tamaño de página a 100 aunque se pida un millón', async () => {
      // Sin el tope, un `?limite=999999` contra una tabla de auditoría grande se
      // traía todo a memoria: no se nota en desarrollo —cien filas— y tumba el
      // servidor en producción.
      const res = await service.findAllPaginated(1, 999999);

      expect(prisma.registroAuditoria.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
      // La respuesta dice el límite REAL servido, no el que llegó.
      expect(res.limite).toBe(100);
    });

    it('la página 0 se sirve como la 1 en vez de reventar', async () => {
      // Antes calculaba `skip = (0 - 1) * 50 = -50`, y Prisma rechaza un salto
      // negativo: una petición mal formada salía como error 500 del servidor.
      const res = await service.findAllPaginated(0, 50);

      expect(prisma.registroAuditoria.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 }),
      );
      expect(res.pagina).toBe(1);
    });

    it('una página negativa tampoco produce un salto negativo', async () => {
      await service.findAllPaginated(-3, 50);

      expect(prisma.registroAuditoria.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 }),
      );
    });
  });
});
