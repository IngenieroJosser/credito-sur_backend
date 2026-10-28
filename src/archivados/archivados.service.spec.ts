import { Test, TestingModule } from '@nestjs/testing';
import { ArchivadosService } from './archivados.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * La papelera: lo que se borró y sigue recuperable.
 *
 * Por qué existe este archivo: `archivados` no tenía ninguna prueba y es la
 * única pantalla desde la que se puede recuperar algo eliminado. Si una entidad
 * deja de aparecer aquí, para quien usa el sistema está perdida aunque la fila
 * siga en la base.
 *
 * El punto frágil es que junta cuatro consultas distintas —clientes, préstamos,
 * productos y usuarios— y les da forma común a mano. Cada una tiene su propio
 * mapeo, así que un campo mal puesto solo rompe su tipo y pasa desapercibido
 * entre los otros tres.
 */
describe('ArchivadosService', () => {
  let service: ArchivadosService;
  let prisma: {
    cliente: { findMany: jest.Mock };
    prestamo: { findMany: jest.Mock };
    producto: { findMany: jest.Mock };
    usuario: { findMany: jest.Mock };
    registroAuditoria: { findMany: jest.Mock };
  };

  const vacio = () => ({ findMany: jest.fn().mockResolvedValue([]) });

  beforeEach(async () => {
    prisma = {
      cliente: vacio(),
      prestamo: vacio(),
      producto: vacio(),
      usuario: vacio(),
      // El servicio cruza con la auditoria para decir QUIEN borro cada cosa.
      registroAuditoria: vacio(),
    };

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        ArchivadosService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = modulo.get<ArchivadosService>(ArchivadosService);
  });

  it('las cuatro consultas piden SOLO lo eliminado', async () => {
    // Si alguna se dejara el filtro, la papelera mostraría registros vivos y
    // alguien podría "restaurar" algo que nunca se borró.
    await service.listar();

    for (const tabla of ['cliente', 'prestamo', 'producto', 'usuario'] as const) {
      expect(prisma[tabla].findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ eliminadoEn: { not: null } }),
        }),
      );
    }
  });

  it('con la papelera vacía devuelve una lista vacía, no un error', async () => {
    await expect(service.listar()).resolves.toEqual([]);
  });

  it('el id lleva el tipo por delante para no chocar entre tablas', async () => {
    // Un cliente y un préstamo pueden tener el mismo uuid en tablas distintas.
    // Sin el prefijo, la lista de la pantalla tendría claves repetidas.
    prisma.cliente.findMany.mockResolvedValue([
      {
        id: 'mismo-id',
        nombres: 'Ana',
        apellidos: 'Pérez',
        eliminadoEn: new Date('2026-10-01'),
        asignacionesRuta: [],
      },
    ]);
    prisma.prestamo.findMany.mockResolvedValue([
      {
        id: 'mismo-id',
        numeroPrestamo: 'PRES-1',
        eliminadoEn: new Date('2026-10-02'),
        ruta: null,
        cliente: null,
      },
    ]);

    const filas = await service.listar();
    const ids = filas.map((f) => f.id);

    expect(ids).toContain('cliente-mismo-id');
    expect(ids).toContain('prestamo-mismo-id');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('un cliente sin apellidos no sale con un espacio colgando', async () => {
    prisma.cliente.findMany.mockResolvedValue([
      {
        id: 'c-1',
        nombres: 'Ana',
        apellidos: null,
        eliminadoEn: new Date(),
        asignacionesRuta: [],
      },
    ]);

    const [fila] = await service.listar();

    expect(fila.nombre).toBe('Ana');
  });

  it('un cliente archivado conserva la ruta en la que estaba', async () => {
    // Es lo que permite saber de qué cobrador era antes de restaurarlo.
    prisma.cliente.findMany.mockResolvedValue([
      {
        id: 'c-1',
        nombres: 'Ana',
        apellidos: 'Pérez',
        eliminadoEn: new Date(),
        asignacionesRuta: [{ ruta: { id: 'r-1', nombre: 'Centro' } }],
      },
    ]);

    const [fila] = await service.listar();

    expect(fila.ruta).toBe('Centro');
    expect(fila.rutaId).toBe('r-1');
  });

  it('un cliente sin ruta sale con ruta nula, no revienta', async () => {
    prisma.cliente.findMany.mockResolvedValue([
      {
        id: 'c-1',
        nombres: 'Ana',
        apellidos: 'Pérez',
        eliminadoEn: new Date(),
        asignacionesRuta: [],
      },
    ]);

    const [fila] = await service.listar();

    expect(fila.ruta).toBeNull();
    expect(fila.rutaId).toBeNull();
  });

  it('un préstamo sin cliente se identifica por su número', async () => {
    // Pasa cuando el cliente se borró antes que el préstamo: la fila tiene que
    // seguir siendo reconocible en vez de salir sin nombre.
    prisma.prestamo.findMany.mockResolvedValue([
      {
        id: 'p-1',
        numeroPrestamo: 'PRES-000043',
        eliminadoEn: new Date(),
        ruta: null,
        cliente: null,
      },
    ]);

    const [fila] = await service.listar();

    expect(fila.nombre).toBe('PRES-000043');
  });

  it('un producto sin nombre cae a su código', async () => {
    prisma.producto.findMany.mockResolvedValue([
      {
        id: 'a-1',
        nombre: '',
        codigo: 'CEL-A15',
        eliminadoEn: new Date(),
      },
    ]);

    const [fila] = await service.listar();

    expect(fila.nombre).toBe('CEL-A15');
    expect(fila.motivo).toBe('Archivado en inventario');
  });
});
