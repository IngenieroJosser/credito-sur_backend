import * as ExcelJS from 'exceljs';
import { FrecuenciaPago, TipoAmortizacion } from '@prisma/client';
import { LoansService } from '../loans/loans.service';
import { generarPlantillaClientesCreditos } from './plantillas/plantilla-clientes-creditos';
import { evaluarFormula, ValorCelda } from './evaluador-formulas';
import { derivarPlazoMeses } from './interes-credito';

/**
 * El Excel tiene que dar lo mismo que el sistema, y hay que comprobarlo con la
 * fórmula que el archivo trae de verdad.
 *
 * Antes esta comprobación se hacía copiando la fórmula dentro de la prueba, y
 * la copia se quedó vieja dos veces: una con el orden de las operaciones del
 * interés —que solo falla en 1 de cada 450 casos, así que pasó desapercibido— y
 * otra al mover una columna. Una copia solo se comprueba contra sí misma.
 *
 * Aquí se genera la plantilla, se lee la fórmula de cada columna gris tal como
 * quedó escrita, se evalúa con los valores de una fila, y se compara contra
 * `LoansService`, que es lo que usa la pantalla de crear créditos. Si alguien
 * cambia una fórmula, esta prueba evalúa la nueva.
 */

const CASOS = [
  {
    nombre: '30 diarias',
    monto: 500_000,
    tasa: 10,
    cuotas: 30,
    frecuencia: FrecuenciaPago.DIARIO,
  },
  {
    nombre: '45 diarias (plazo 1,5 meses)',
    monto: 1_200_000,
    tasa: 20,
    cuotas: 45,
    frecuencia: FrecuenciaPago.DIARIO,
  },
  {
    nombre: '10 diarias (plazo 0,33 meses)',
    monto: 300_000,
    tasa: 15,
    cuotas: 10,
    frecuencia: FrecuenciaPago.DIARIO,
  },
  {
    nombre: '4 quincenales',
    monto: 500_000,
    tasa: 20,
    cuotas: 4,
    frecuencia: FrecuenciaPago.QUINCENAL,
  },
  {
    nombre: '13 quincenales, monto feo',
    monto: 777_777,
    tasa: 7.5,
    cuotas: 13,
    frecuencia: FrecuenciaPago.QUINCENAL,
  },
  {
    nombre: '8 semanales',
    monto: 600_000,
    tasa: 10,
    cuotas: 8,
    frecuencia: FrecuenciaPago.SEMANAL,
  },
  {
    nombre: '6 mensuales',
    monto: 2_400_000,
    tasa: 4,
    cuotas: 6,
    frecuencia: FrecuenciaPago.MENSUAL,
  },
  {
    nombre: '1 mensual',
    monto: 1_000_000,
    tasa: 33.33,
    cuotas: 1,
    frecuencia: FrecuenciaPago.MENSUAL,
  },
  {
    nombre: 'monto que delató el orden',
    monto: 14_227_937,
    tasa: 10,
    cuotas: 60,
    frecuencia: FrecuenciaPago.MENSUAL,
  },
  {
    nombre: 'el peso mínimo',
    monto: 1,
    tasa: 20,
    cuotas: 12,
    frecuencia: FrecuenciaPago.MENSUAL,
  },

  // Estos cuatro no están por bonitos: son combinaciones donde dividir la tasa
  // antes de multiplicar da un peso distinto que multiplicar y dividir al
  // final. Se buscaron a propósito, porque el fallo aparece en 1 de cada 450
  // casos y una lista de montos redondos nunca lo toca.
  {
    nombre: 'divergencia · 69 diarias',
    monto: 18_740_625,
    tasa: 4,
    cuotas: 69,
    frecuencia: FrecuenciaPago.DIARIO,
  },
  {
    nombre: 'divergencia · 10 mensuales',
    monto: 2_003_986,
    tasa: 7.5,
    cuotas: 10,
    frecuencia: FrecuenciaPago.MENSUAL,
  },
  {
    nombre: 'divergencia · 15 quincenales',
    monto: 19_805_692,
    tasa: 5,
    cuotas: 15,
    frecuencia: FrecuenciaPago.QUINCENAL,
  },
  {
    nombre: 'divergencia · 65 semanales',
    monto: 11_515_194,
    tasa: 20,
    cuotas: 65,
    frecuencia: FrecuenciaPago.SEMANAL,
  },
];

const METODOS = [
  { etiqueta: 'Interés simple', enum: 'INTERES_SIMPLE' as const },
  { etiqueta: 'Amortización', enum: 'INTERES_PLANO' as const },
];

/** Columnas grises que se calculan solas, en el orden en que dependen entre sí. */
const CADENA = [
  'Plazo en meses',
  'Interés total',
  'Total en cuotas',
  'Valor cuota',
  'Ya abonado',
  'Saldo pendiente',
];

describe('El Excel da lo mismo que el sistema, con sus fórmulas de verdad', () => {
  const servicio = new LoansService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  let hoja: ExcelJS.Worksheet;
  /** Encabezado -> letra de columna, leído del archivo. */
  let columnas: Record<string, string>;

  beforeAll(async () => {
    const { data } = await generarPlantillaClientesCreditos({
      clientes: [],
      articulos: [],
      codigosArticulo: [],
      numerosPrestamo: [],
      rutas: [],
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(data as any);
    hoja = workbook.getWorksheet('Créditos de dinero')!;

    columnas = {};
    hoja.getRow(6).eachCell({ includeEmpty: false }, (celda, numero) => {
      const encabezado = typeof celda.value === 'string' ? celda.value : '';
      if (encabezado) columnas[encabezado] = hoja.getColumn(numero).letter;
    });
  });

  const letraDe = (empiezaPor: string) => {
    const encabezado = Object.keys(columnas).find((h) =>
      h.startsWith(empiezaPor),
    );
    if (!encabezado) throw new Error(`No existe la columna "${empiezaPor}"`);
    return columnas[encabezado];
  };

  const formulaDe = (empiezaPor: string) => {
    const letra = letraDe(empiezaPor);
    const columna = hoja.getColumn(letra).number;
    const formula = (hoja.getCell(7, columna).value as any)?.formula;
    if (!formula) throw new Error(`"${empiezaPor}" no tiene fórmula`);
    return String(formula);
  };

  /** Llena la fila 7 con los datos de captura y evalúa la cadena de cálculos. */
  const calcularConElExcel = (caso: {
    monto: number;
    tasa: number;
    cuotas: number;
    frecuencia: FrecuenciaPago;
    metodo: string;
    abonado: number;
  }) => {
    const celdas: Record<string, ValorCelda> = {};
    const poner = (encabezado: string, valor: ValorCelda) => {
      celdas[`${letraDe(encabezado)}7`] = valor;
    };

    poner('Monto', caso.monto);
    poner('Tasa interés', caso.tasa);
    poner('Frecuencia pago', caso.frecuencia);
    poner('Cantidad cuotas', caso.cuotas);
    poner('Tipo de interés', caso.metodo);
    poner('Total abonado', caso.abonado);

    for (const columna of CADENA) {
      celdas[`${letraDe(columna)}7`] = evaluarFormula(
        formulaDe(columna),
        celdas,
      );
    }

    const leer = (columna: string) => celdas[`${letraDe(columna)}7`];
    return {
      plazoMeses: leer('Plazo en meses'),
      interesTotal: leer('Interés total'),
      totalEnCuotas: leer('Total en cuotas'),
      valorCuota: leer('Valor cuota'),
      yaAbonado: leer('Ya abonado'),
      saldoPendiente: leer('Saldo pendiente'),
    };
  };

  const combinaciones = METODOS.flatMap((metodo) =>
    CASOS.map((caso) => ({ ...caso, metodo })),
  );

  it.each(combinaciones)(
    'coincide en $nombre por $metodo.etiqueta',
    ({ monto, tasa, cuotas, frecuencia, metodo }) => {
      const delExcel = calcularConElExcel({
        monto,
        tasa,
        cuotas,
        frecuencia,
        metodo: metodo.etiqueta,
        abonado: 0,
      });

      const plazoMeses = derivarPlazoMeses(cuotas, frecuencia);
      const delSistema = (servicio as any).calculateInterestAndCuotas(
        metodo.enum as TipoAmortizacion,
        monto,
        tasa,
        cuotas,
        plazoMeses,
        frecuencia,
        new Date('2026-05-01T12:00:00.000Z'),
        new Date('2026-05-01T12:00:00.000Z'),
      );

      expect(delExcel.plazoMeses).toBeCloseTo(plazoMeses, 10);
      expect(delExcel.interesTotal).toBe(delSistema.interesTotal);
      expect(delExcel.totalEnCuotas).toBe(monto + delSistema.interesTotal);
      // La primera cuota es la que el Excel muestra; la última absorbe el
      // residuo y por eso puede ser distinta.
      expect(delExcel.valorCuota).toBe(delSistema.cuotas[0].monto);
    },
  );

  it('lo abonado y el saldo salen de lo que se escribe, sin inventar nada', () => {
    const fallos: string[] = [];

    for (const { monto, tasa, cuotas, frecuencia, nombre } of CASOS) {
      for (const abonado of [0, 1, 150_000]) {
        const r = calcularConElExcel({
          monto,
          tasa,
          cuotas,
          frecuencia,
          metodo: 'Interés simple',
          abonado,
        });
        const total = Number(r.totalEnCuotas);

        if (r.yaAbonado !== abonado) {
          fallos.push(
            `${nombre} · abonado ${abonado} → el Excel dice ${r.yaAbonado}`,
          );
        }
        if (r.saldoPendiente !== total - abonado) {
          fallos.push(
            `${nombre} · abonado ${abonado} → saldo ${r.saldoPendiente} en vez de ${total - abonado}`,
          );
        }
      }
    }

    expect(fallos).toEqual([]);
  });

  it('una fila vacía no muestra ninguna cifra', () => {
    // Mil filas preparadas: si las fórmulas calcularan sobre celdas en blanco,
    // la hoja se vería llena de ceros y de errores.
    const celdas: Record<string, ValorCelda> = {};
    for (const encabezado of [
      'Monto',
      'Tasa interés',
      'Frecuencia pago',
      'Cantidad cuotas',
      'Tipo de interés',
      'Total abonado',
    ]) {
      celdas[`${letraDe(encabezado)}7`] = '';
    }

    for (const columna of CADENA) {
      celdas[`${letraDe(columna)}7`] = evaluarFormula(
        formulaDe(columna),
        celdas,
      );
    }

    expect(celdas[`${letraDe('Plazo en meses')}7`]).toBe('');
    expect(celdas[`${letraDe('Interés total')}7`]).toBe('');
    expect(celdas[`${letraDe('Total en cuotas')}7`]).toBe('');
    expect(celdas[`${letraDe('Valor cuota')}7`]).toBe('');
    expect(celdas[`${letraDe('Saldo pendiente')}7`]).toBe('');
  });
});
