import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { comoPrisma, dependenciaSinUsar } from '../common/testing/dobles';

const ultimo = new Date('2027-01-01T04:59:59.999Z');
const inicio = new Date('2026-01-01T05:00:00.000Z');

function reporte() {
  const pago = {
    findMany: jest.fn().mockResolvedValue([
      { fechaPago: new Date('2026-12-01T04:30:00Z'), montoTotal: 100 },
      { fechaPago: ultimo, montoTotal: 200 },
    ]),
  };
  const gasto = {
    findMany: jest.fn().mockResolvedValue([
      { fechaGasto: new Date('2026-12-01T04:59:59.999Z'), monto: 12 },
      { fechaGasto: new Date('2026-12-01T05:00:00Z'), monto: 15 },
    ]),
  };
  const servicio = new ReportsService(
    comoPrisma({ pago, gasto }),
    dependenciaSinUsar(),
    dependenciaSinUsar(),
  );
  return {
    pago,
    gasto,
    servicio,
    controlador: new ReportsController(servicio),
  };
}

afterEach(() => jest.useRealTimers());

it('cuenta noviembre y diciembre y consulta los límites colombianos completos', async () => {
  jest.useFakeTimers().setSystemTime(ultimo);
  const { pago, gasto, controlador } = reporte();
  const meses = await controlador.getMonthlyEvolution();
  expect(pago.findMany.mock.calls[0][0].where.fechaPago).toEqual({
    gte: inicio,
    lte: ultimo,
  });
  expect(gasto.findMany.mock.calls[0][0].where.fechaGasto).toEqual({
    gte: inicio,
    lte: ultimo,
  });
  expect(meses).toHaveLength(12);
  expect(meses[10]).toEqual({
    mes: 'nov',
    ingresos: 100,
    egresos: 12,
    utilidad: 88,
  });
  expect(meses[11]).toEqual({
    mes: 'dic',
    ingresos: 200,
    egresos: 15,
    utilidad: 185,
  });
});

it('una fecha civil de enero no consulta diciembre en el resumen', async () => {
  const { controlador, servicio } = reporte();
  const spy = jest
    .spyOn(servicio, 'getFinancialSummary')
    .mockResolvedValue({ ingresos: 0, egresos: 0, utilidad: 0, margen: 0 });
  await controlador.getFinancialSummary('2026-01-01', '2026-01-01');
  expect(spy).toHaveBeenCalledWith(
    inicio,
    new Date('2026-01-02T04:59:59.999Z'),
  );
  expect(() => controlador.getMonthlyEvolution('2026abc')).toThrow();
});

it('la exportación pide el año operativo de la fecha inicial', async () => {
  const { servicio } = reporte();
  const spy = jest.spyOn(servicio, 'getMonthlyEvolution').mockResolvedValue([]);
  jest
    .spyOn(servicio, 'getFinancialSummary')
    .mockResolvedValue({ ingresos: 0, egresos: 0, utilidad: 0, margen: 0 });
  jest.spyOn(servicio, 'getExpenseDistribution').mockResolvedValue([]);
  const archivo = await servicio.exportFinancialReport(ultimo, ultimo, 'excel');
  expect(spy).toHaveBeenCalledWith(2026);
  expect(archivo.data.subarray(0, 2).toString()).toBe('PK');
});
