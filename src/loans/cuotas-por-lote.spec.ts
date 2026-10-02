import { RolUsuario } from '@prisma/client';
import { LoansService } from './loans.service';
import {
  comoDependencia,
  comoPrisma,
  dependenciaSinUsar,
  type DobleDePrisma,
  type MetodosDeModelo,
} from '../common/testing/dobles';

/**
 * Las cuotas de varios préstamos en UNA petición.
 *
 * Existe por una medición: el tablero pedía 104 veces `GET /loans/:id/cuotas`, una por
 * préstamo, y solo eso agotaba el límite del servidor (300 por minuto). Lo que estas pruebas
 * fijan es lo que no se puede perder al agrupar: el alcance por cobrador.
 */
class PrestamosParaPrueba extends LoansService {}

const hacerServicio = (prisma: DobleDePrisma) =>
  new PrestamosParaPrueba(
    comoPrisma(prisma),
    dependenciaSinUsar(),
    dependenciaSinUsar(),
    dependenciaSinUsar(),
    dependenciaSinUsar(),
    dependenciaSinUsar(),
    dependenciaSinUsar(),
  );

describe('LoansService.getCuotasDeVariosPrestamos', () => {
  const dobleCon = (
    prestamosPermitidos: Array<{ id: string }>,
    cuotas: Array<{ prestamoId: string; numeroCuota: number }>,
  ) => {
    const prestamo: MetodosDeModelo = {
      findMany: jest.fn().mockResolvedValue(prestamosPermitidos),
    };
    const cuota: MetodosDeModelo = {
      findMany: jest.fn().mockResolvedValue(cuotas),
    };
    return { prisma: { prestamo, cuota }, prestamo, cuota };
  };

  it('agrupa las cuotas por préstamo', async () => {
    const { prisma } = dobleCon(
      [{ id: 'p1' }, { id: 'p2' }],
      [
        { prestamoId: 'p1', numeroCuota: 1 },
        { prestamoId: 'p1', numeroCuota: 2 },
        { prestamoId: 'p2', numeroCuota: 1 },
      ],
    );

    const salida = await hacerServicio(prisma).getCuotasDeVariosPrestamos(
      ['p1', 'p2'],
      { id: 'admin-1', rol: RolUsuario.ADMIN },
    );

    expect(Object.keys(salida).sort()).toEqual(['p1', 'p2']);
    expect(salida.p1).toHaveLength(2);
    expect(salida.p2).toHaveLength(1);
  });

  it('hace UNA consulta de cuotas, no una por préstamo', async () => {
    // Es el punto entero del cambio: si esto vuelve a ser N, el problema regresó.
    const { prisma, cuota } = dobleCon(
      [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
      [],
    );

    await hacerServicio(prisma).getCuotasDeVariosPrestamos(['p1', 'p2', 'p3'], {
      id: 'admin-1',
      rol: RolUsuario.ADMIN,
    });

    expect(cuota.findMany).toHaveBeenCalledTimes(1);
  });

  it('a un cobrador solo le devuelve los créditos de su alcance', async () => {
    // El doble de `prestamo.findMany` ya devuelve solo p1: lo que se comprueba es que el
    // servicio NO lea cuotas de los ids que el filtro descartó.
    const { prisma, cuota } = dobleCon(
      [{ id: 'p1' }],
      [{ prestamoId: 'p1', numeroCuota: 1 }],
    );

    const salida = await hacerServicio(prisma).getCuotasDeVariosPrestamos(
      ['p1', 'p2-ajeno'],
      { id: 'cobrador-1', rol: RolUsuario.COBRADOR },
    );

    expect(Object.keys(salida)).toEqual(['p1']);
    const argumentos = cuota.findMany.mock.calls[0][0] as {
      where?: { prestamoId?: { in?: string[] } };
    };
    expect(argumentos.where?.prestamoId?.in).toEqual(['p1']);
  });

  it('devuelve una entrada vacía para el préstamo sin cuotas', async () => {
    // Así quien llama distingue "no tiene cuotas" de "no te dejaron verlo".
    const { prisma } = dobleCon([{ id: 'p1' }], []);

    const salida = await hacerServicio(prisma).getCuotasDeVariosPrestamos(
      ['p1'],
      {
        id: 'admin-1',
        rol: RolUsuario.ADMIN,
      },
    );

    expect(salida).toEqual({ p1: [] });
  });

  it('no consulta nada si no le pasan ids', async () => {
    const { prisma, prestamo } = dobleCon([], []);

    const salida = await hacerServicio(prisma).getCuotasDeVariosPrestamos(
      [],
      null,
    );

    expect(salida).toEqual({});
    expect(prestamo.findMany).not.toHaveBeenCalled();
  });

  it('ignora los ids repetidos', async () => {
    const { prisma, prestamo } = dobleCon([{ id: 'p1' }], []);

    await hacerServicio(prisma).getCuotasDeVariosPrestamos(['p1', 'p1', 'p1'], {
      id: 'admin-1',
      rol: RolUsuario.ADMIN,
    });

    const argumentos = prestamo.findMany.mock.calls[0][0] as {
      where?: { id?: { in?: string[] } };
    };
    expect(argumentos.where?.id?.in).toEqual(['p1']);
  });
});
