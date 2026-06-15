import {
  getEstadoRevisionOperacion,
  isCuotaOperativaParaFechaRuta,
  isObligacionOperativaRuta,
  isPrestamoOperativoRuta,
  resolveCuotaObjetivoOperativa,
} from './ruta-operational-rules';

describe('ruta-operational-rules', () => {
  it('permite préstamos pendientes como provisionales y excluye rechazados/revertidos', () => {
    const pendiente = {
      id: 'prestamo-pendiente',
      estado: 'PENDIENTE_APROBACION',
      estadoAprobacion: 'PENDIENTE',
      efectoProvisional: { estado: 'PENDIENTE_REVISION' },
    };

    expect(isPrestamoOperativoRuta(pendiente)).toBe(true);
    expect(getEstadoRevisionOperacion(pendiente)).toMatchObject({
      esProvisional: true,
      esRevertido: false,
      etiquetaRevision: 'Pendiente de revisión',
    });

    expect(
      isPrestamoOperativoRuta({
        estado: 'PENDIENTE_APROBACION',
        estadoAprobacion: 'RECHAZADO',
      }),
    ).toBe(false);
    expect(
      isPrestamoOperativoRuta({
        estado: 'ACTIVO',
        efectoProvisional: { estado: 'REVERTIDO' },
      }),
    ).toBe(false);
  });

  it('resuelve una sola cuota operativa para la fecha y excluye cuotas futuras', () => {
    const prestamo = {
      estado: 'ACTIVO',
      cuotas: [
        {
          id: 'cuota-futura',
          estado: 'PENDIENTE',
          fechaVencimiento: new Date('2026-06-15T12:00:00.000Z'),
          monto: 100_000,
        },
        {
          id: 'cuota-hoy',
          estado: 'PENDIENTE',
          fechaVencimiento: new Date('2026-06-14T12:00:00.000Z'),
          monto: 100_000,
        },
      ],
    };

    expect(
      isCuotaOperativaParaFechaRuta(prestamo.cuotas[0], '2026-06-14'),
    ).toBe(false);
    expect(
      resolveCuotaObjetivoOperativa(prestamo, '2026-06-14'),
    ).toMatchObject({ id: 'cuota-hoy' });
    expect(
      isObligacionOperativaRuta(
        { prestamo, cuota: prestamo.cuotas[1] },
        '2026-06-14',
      ),
    ).toBe(true);
  });
});
