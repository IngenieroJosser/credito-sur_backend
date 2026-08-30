import * as ExcelJS from 'exceljs';
import { FrecuenciaPago, TipoAmortizacion } from '@prisma/client';
import { LoansService } from '../loans/loans.service';
import { generarPlantillaClientesCreditos } from './plantillas/plantilla-clientes-creditos';
import { evaluarFormula, ValorCelda } from './evaluador-formulas';
import {
  calcularInteresTotal,
  construirTablaCuotas,
  derivarPlazoMeses,
} from './interes-credito';

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
  'Cuotas pagadas (automático)',
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
    totalAbonado: number;
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
    poner('Total abonado', caso.totalAbonado);

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
      cuotasPagadas: leer('Cuotas pagadas (automático)'),
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
        totalAbonado: 0,
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

  it('la columna gris reparte en cuotas la plata abonada', () => {
    // Es la razón de que exista. Antes se escribían dos casillas —cuotas y
    // abono— que se sumaban sin que se notara: quien anotaba una cuota pagada
    // y un abono de 150.000 esperaba que el saldo bajara 150.000 y bajaba
    // 325.000. Ahora se escribe la plata y las cuotas se deducen, así que esa
    // lectura doble ya no existe.
    const fallos: string[] = [];

    for (const { monto, tasa, cuotas, frecuencia, nombre } of CASOS) {
      const base = calcularConElExcel({
        monto,
        tasa,
        cuotas,
        frecuencia,
        metodo: 'Interés simple',
        totalAbonado: 0,
      });
      const cuota = Number(base.valorCuota);
      const total = Number(base.totalEnCuotas);

      // Con montos ínfimos la cuota puede caer a cero y no hay nada que
      // repartir; la fórmula deja la celda en blanco a propósito.
      if (!(cuota > 0)) continue;

      const abonos = [
        0,
        1,
        cuota - 1,
        cuota,
        cuota + 1,
        cuota * 2,
        total - 1,
        total,
      ];

      for (const totalAbonado of abonos) {
        if (totalAbonado < 0 || totalAbonado > total) continue;

        const r = calcularConElExcel({
          monto,
          tasa,
          cuotas,
          frecuencia,
          metodo: 'Interés simple',
          totalAbonado,
        });
        const donde = `${nombre} · abonado ${totalAbonado}`;

        // Cuántas cuotas completas caben en esa plata, sin pasarse del
        // crédito: la última absorbe el residuo y vale unos pesos más.
        const esperado = Math.min(cuotas, Math.floor(totalAbonado / cuota));

        if (r.cuotasPagadas !== esperado) {
          fallos.push(
            `${donde} → el Excel dice ${r.cuotasPagadas} cuotas, no ${esperado}`,
          );
        }
        // El saldo baja exactamente lo que se abonó: ni un peso más.
        if (r.saldoPendiente !== total - totalAbonado) {
          fallos.push(
            `${donde} → saldo ${r.saldoPendiente} en vez de ${total - totalAbonado}`,
          );
        }
      }
    }

    expect(fallos).toEqual([]);
  });

  it('el caso que se venía escribiendo mal ahora da 550.000', () => {
    // 500.000 al 20% en 4 quincenas son 2 meses: 700.000 en total, cuotas de
    // 175.000. Un abono de 150.000 tiene que dejar 550.000 de saldo.
    const r = calcularConElExcel({
      monto: 500_000,
      tasa: 20,
      cuotas: 4,
      frecuencia: FrecuenciaPago.QUINCENAL,
      metodo: 'Interés simple',
      totalAbonado: 150_000,
    });

    expect(r.totalEnCuotas).toBe(700_000);
    expect(r.valorCuota).toBe(175_000);
    // No alcanza para una cuota completa: la primera queda PARCIAL.
    expect(r.cuotasPagadas).toBe(0);
    expect(r.saldoPendiente).toBe(550_000);
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
    expect(celdas[`${letraDe('Cuotas pagadas')}7`]).toBe('');
    expect(celdas[`${letraDe('Saldo pendiente')}7`]).toBe('');
  });

  // ── Barrido masivo ───────────────────────────────────────────────────

  /**
   * El fallo del orden de operaciones aparecía en 1 de cada 450 combinaciones.
   * Eso no significa que hoy falle 1 de cada 450: significa que era así de
   * difícil de ver, y por eso pasó desapercibido. Aquí se comprueba que no
   * aparece en ninguna.
   *
   * Se compara contra `calcularInteresTotal` y `construirTablaCuotas`, que son
   * lo que usa la importación, y que a su vez se comparan contra
   * `LoansService` en toda su malla en consistencia-dinero.spec.
   */
  const semilla = 20260826;
  let estado = semilla;
  const aleatorio = () => {
    // Generador propio para que el barrido sea siempre el mismo: si algún día
    // falla, falla con los mismos números y se puede reproducir.
    estado = (estado * 1103515245 + 12345) & 0x7fffffff;
    return estado / 0x7fffffff;
  };
  const entre = (min: number, max: number) =>
    min + Math.floor(aleatorio() * (max - min + 1));

  const TASAS = [2, 4, 5, 7.5, 10, 12.5, 15, 20, 33.33];
  const FRECUENCIAS = [
    FrecuenciaPago.DIARIO,
    FrecuenciaPago.SEMANAL,
    FrecuenciaPago.QUINCENAL,
    FrecuenciaPago.MENSUAL,
  ];

  it('50.000 combinaciones al azar, ni una diferencia', () => {
    const fallos: string[] = [];

    for (let i = 0; i < 50_000 && fallos.length < 5; i++) {
      const monto = entre(1, 50_000_000);
      const tasa = TASAS[entre(0, TASAS.length - 1)];
      const cuotas = entre(1, 72);
      const frecuencia = FRECUENCIAS[entre(0, FRECUENCIAS.length - 1)];
      const metodo = aleatorio() < 0.5 ? METODOS[0] : METODOS[1];

      const delExcel = calcularConElExcel({
        monto,
        tasa,
        cuotas,
        frecuencia,
        metodo: metodo.etiqueta,
        totalAbonado: 0,
      });

      const plazoMeses = derivarPlazoMeses(cuotas, frecuencia);
      const interes = calcularInteresTotal(
        metodo.enum,
        monto,
        tasa,
        plazoMeses,
      );
      const tabla = construirTablaCuotas(metodo.enum, monto, interes, cuotas);
      const donde = `${metodo.etiqueta} · ${monto} · ${tasa}% · ${cuotas} ${frecuencia}`;

      if (delExcel.interesTotal !== interes) {
        fallos.push(
          `${donde} — interés ${delExcel.interesTotal} contra ${interes}`,
        );
      }
      if (delExcel.totalEnCuotas !== monto + interes) {
        fallos.push(`${donde} — total ${delExcel.totalEnCuotas}`);
      }
      if (delExcel.valorCuota !== tabla[0].monto) {
        fallos.push(
          `${donde} — cuota ${delExcel.valorCuota} contra ${tabla[0].monto}`,
        );
      }
    }

    expect(fallos).toEqual([]);
  });
});
