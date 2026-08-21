import * as ExcelJS from 'exceljs';
import * as JSZip from 'jszip';
import { FrecuenciaPago, TipoAmortizacion } from '@prisma/client';
import { LoansService } from '../loans/loans.service';
import { generarPlantillaInventario } from './plantillas/plantilla-inventario';
import { generarPlantillaClientesCreditos } from './plantillas/plantilla-clientes-creditos';
import { InventarioParser } from './parsers/inventario.parser';
import { ClientesCreditosParser } from './parsers/clientes-creditos.parser';
import {
  aplicarAvanceHistorico,
  construirPlanCuotas,
  resolverEstadoPrestamoImportado,
} from './avance-historico';
import {
  calcularInteresTotal,
  construirTablaCuotas,
  derivarCantidadCuotas,
  derivarPlazoMeses,
} from './interes-credito';

const FILA_DATOS = 7;

/**
 * Generar una plantilla cuesta cerca de medio segundo, y casi todas las pruebas
 * necesitan la misma. Se genera una vez y se reutiliza: `editarLibro` parte del
 * buffer sin modificarlo.
 */
const cachePlantillas = new Map<
  string,
  Promise<{ data: Buffer; filename: string }>
>();

function plantillaCacheada(
  clave: string,
  generar: () => Promise<{
    data: Buffer;
    contentType: string;
    filename: string;
  }>,
) {
  if (!cachePlantillas.has(clave)) cachePlantillas.set(clave, generar());
  return cachePlantillas.get(clave)!;
}

const plantillaInventarioCacheada = () =>
  plantillaCacheada('inventario', generarPlantillaInventario);

const plantillaClientesCacheada = () =>
  plantillaCacheada('clientes', () =>
    generarPlantillaClientesCreditos(datosPlantillaVacios),
  );

const prismaMock = (datos?: {
  clientes?: any[];
  productos?: any[];
  prestamos?: any[];
  rutas?: any[];
}) =>
  ({
    cliente: { findMany: jest.fn().mockResolvedValue(datos?.clientes ?? []) },
    producto: { findMany: jest.fn().mockResolvedValue(datos?.productos ?? []) },
    prestamo: { findMany: jest.fn().mockResolvedValue(datos?.prestamos ?? []) },
    ruta: { findMany: jest.fn().mockResolvedValue(datos?.rutas ?? []) },
  }) as any;

const datosPlantillaVacios = {
  clientes: [],
  articulos: [],
  codigosArticulo: [],
  numerosPrestamo: [],
  rutas: [],
};

const clienteEnBd = {
  dni: '12345678',
  codigo: 'C-0001',
  idempotencyKey: null,
  nombres: 'Juan',
  apellidos: 'Pérez',
};

/** Abre un libro generado, deja escribir en él y lo devuelve como buffer. */
async function editarLibro(
  data: Buffer,
  editar: (workbook: ExcelJS.Workbook) => void,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data as any);
  editar(workbook);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

const normalizarEncabezado = (texto: any) =>
  String(texto ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\*/g, '')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Escribe una fila localizando cada columna por su encabezado, igual que hace
 * el parser. Así las pruebas no se rompen al reordenar o insertar columnas.
 */
function escribirFila(
  hoja: ExcelJS.Worksheet,
  fila: number,
  valores: Record<string, any>,
) {
  const columnas = new Map<string, number>();
  hoja.getRow(6).eachCell({ includeEmpty: false }, (celda, numero) => {
    const clave = normalizarEncabezado(celda.value);
    if (clave && !columnas.has(clave)) columnas.set(clave, numero);
  });

  Object.entries(valores).forEach(([encabezado, valor]) => {
    const columna = columnas.get(normalizarEncabezado(encabezado));
    if (!columna) {
      throw new Error(
        `La hoja "${hoja.name}" no tiene la columna "${encabezado}"`,
      );
    }
    hoja.getCell(fila, columna).value = valor;
  });
}

/** Datos mínimos de un crédito válido; cada prueba sobreescribe lo que necesita. */
const creditoMinimo = {
  'Número de crédito': 'IMP-001',
  'CC cliente': '12345678',
  Monto: 500000,
  'Tasa interés': 10,
  'Frecuencia pago': 'DIARIO',
  'Cantidad cuotas': 30,
  'Tipo amortización': 'Interés simple',
  'Fecha crédito': '2026-05-01',
  'Tipo carga': 'HISTORICA',
};

async function validarCredito(
  valores: Record<string, any>,
  datosBd: Parameters<typeof prismaMock>[0] = { clientes: [clienteEnBd] },
  hojaCredito = 'Créditos de dinero',
) {
  const plantilla = await plantillaClientesCacheada();
  const archivo = await editarLibro(plantilla.data, (workbook) => {
    escribirFila(workbook.getWorksheet(hojaCredito)!, FILA_DATOS, valores);
  });
  return new ClientesCreditosParser(prismaMock(datosBd)).parseAndValidate(
    archivo,
    'clientes.xlsx',
  );
}

/** Datos mínimos de un crédito de artículo; la hoja ya fija el tipo. */
const creditoArticuloMinimo = {
  'Número de crédito': 'IMP-ART-1',
  'CC cliente': '12345678',
  'Producto código': 'CEL-A15',
  'Plazo meses': 3,
  'Frecuencia pago': 'DIARIO',
  'Fecha crédito': '2026-05-01',
  'Tipo carga': 'HISTORICA',
};

const validarCreditoArticulo = (
  valores: Record<string, any>,
  datosBd: Parameters<typeof prismaMock>[0] = {
    clientes: [clienteEnBd],
    productos: [
      {
        codigo: 'CEL-A15',
        nombre: 'Samsung Galaxy A15',
        precios: [
          { meses: 0, precio: 540000 },
          { meses: 3, precio: 690000 },
        ],
      },
    ],
  },
) => validarCredito(valores, datosBd, 'Créditos de artículo');

async function validarArticulo(valores: Record<string, any>, datosBd?: any) {
  const plantilla = await plantillaInventarioCacheada();
  const archivo = await editarLibro(plantilla.data, (workbook) => {
    escribirFila(workbook.getWorksheet('Artículos')!, FILA_DATOS, valores);
  });
  return new InventarioParser(prismaMock(datosBd)).parseAndValidate(
    archivo,
    'inventario.xlsx',
  );
}

describe('Plantilla de inventario', () => {
  it('recién descargada no reporta filas ni errores', async () => {
    const plantilla = await generarPlantillaInventario();
    const resultado = await new InventarioParser(prismaMock()).parseAndValidate(
      plantilla.data,
      plantilla.filename,
    );

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.resumen.totalFilas).toBe(0);
  });

  it('lee en una sola hoja el precio de contado y varias opciones de plazo', async () => {
    const resultado = await validarArticulo({
      Código: 'NEV-200',
      Nombre: 'Nevera 200L',
      Categoría: 'Electrodomésticos',
      Costo: 900000,
      'Precio contado': 1050000,
      Stock: 5,
      'Stock mínimo': 1,
      Activo: 'SI',
      'Meses opción 1': 1,
      'Precio opción 1': 1150000,
      'Meses opción 2': 3,
      'Precio opción 2': 1290000,
      'Meses opción 3': 6,
      'Precio opción 3': 1450000,
    });

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.articulos?.[0]).toEqual(
      expect.objectContaining({ codigo: 'NEV-200', precioContado: 1050000 }),
    );
    expect(resultado.precios?.map((p: any) => p.meses)).toEqual([0, 1, 3, 6]);
    expect(resultado.precios?.map((p: any) => p.utilidad)).toEqual([
      150000, 250000, 390000, 550000,
    ]);
  });

  it('solo exige código, nombre, categoría y costo', async () => {
    const resultado = await validarArticulo({
      Código: 'NEV-200',
      Nombre: 'Nevera 200L',
      Categoría: 'Electrodomésticos',
      Costo: 900000,
      'Precio contado': 1050000,
      'Meses opción 1': 1,
      'Precio opción 1': 1150000,
    });

    expect(resultado.errores).toHaveLength(0);
    // Acción, stock, stock mínimo y activo se completan solos.
    expect(resultado.articulos?.[0]).toEqual(
      expect.objectContaining({ stock: 0, stockMinimo: 0, activo: 'SI' }),
    );
  });

  it('rechaza dos opciones con el mismo plazo en un artículo', async () => {
    const resultado = await validarArticulo({
      Código: 'NEV-200',
      Nombre: 'Nevera 200L',
      Categoría: 'Electrodomésticos',
      Costo: 900000,
      'Precio contado': 1050000,
      'Meses opción 1': 3,
      'Precio opción 1': 1290000,
      'Meses opción 2': 3,
      'Precio opción 2': 1300000,
    });

    expect(resultado.errores).toEqual([
      expect.objectContaining({ campo: 'opcion_2_meses' }),
    ]);
  });

  it('avisa cuando el artículo ya existe en el sistema, sin bloquear la carga', async () => {
    const resultado = await validarArticulo(
      {
        Código: 'NEV-200',
        Nombre: 'Nevera 200L',
        Categoría: 'Electrodomésticos',
        Costo: 900000,
        'Precio contado': 1050000,
        'Meses opción 1': 1,
        'Precio opción 1': 1150000,
      },
      { productos: [{ codigo: 'NEV-200', nombre: 'Nevera 200L' }] },
    );

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.advertencias).toEqual([
      expect.objectContaining({ campo: 'codigo' }),
    ]);
  });

  it('avisa cuando un precio queda por debajo del costo', async () => {
    const resultado = await validarArticulo({
      Código: 'NEV-200',
      Nombre: 'Nevera 200L',
      Categoría: 'Electrodomésticos',
      Costo: 900000,
      'Precio contado': 800000,
      'Meses opción 1': 1,
      'Precio opción 1': 1150000,
    });

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.advertencias).toEqual([
      expect.objectContaining({ campo: 'precio_contado' }),
    ]);
  });
});

describe('Plantilla de clientes y créditos', () => {
  it('recién descargada no reporta filas ni errores', async () => {
    const plantilla =
      await generarPlantillaClientesCreditos(datosPlantillaVacios);
    const resultado = await new ClientesCreditosParser(
      prismaMock(),
    ).parseAndValidate(plantilla.data, plantilla.filename);

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.resumen.totalFilas).toBe(0);
  });

  it('marca como error una cédula que ya está registrada en el sistema', async () => {
    const plantilla = await generarPlantillaClientesCreditos({
      ...datosPlantillaVacios,
      clientes: [{ dni: '12345678', nombre: 'Juan Pérez' }],
    });

    const archivo = await editarLibro(plantilla.data, (workbook) => {
      escribirFila(workbook.getWorksheet('Clientes')!, FILA_DATOS, {
        'CC cliente': '12345678',
        Nombres: 'Juan',
        Apellidos: 'Pérez',
        Teléfono: '3001234567',
      });
    });

    const resultado = await new ClientesCreditosParser(
      prismaMock({ clientes: [clienteEnBd] }),
    ).parseAndValidate(archivo, 'clientes.xlsx');

    expect(resultado.errores).toEqual([
      expect.objectContaining({
        hoja: 'Clientes',
        campo: 'cc',
        mensaje: expect.stringContaining('ya está registrada'),
      }),
    ]);
    expect(resultado.clientes).toHaveLength(0);
  });

  it('crea el cliente sin exigir acción ni código de importación', async () => {
    const plantilla =
      await generarPlantillaClientesCreditos(datosPlantillaVacios);

    const archivo = await editarLibro(plantilla.data, (workbook) => {
      escribirFila(workbook.getWorksheet('Clientes')!, FILA_DATOS, {
        'CC cliente': '12345678',
        Nombres: 'Juan',
        Apellidos: 'Pérez',
        Teléfono: '3001234567',
      });
    });

    const resultado = await new ClientesCreditosParser(
      prismaMock(),
    ).parseAndValidate(archivo, 'clientes.xlsx');

    expect(resultado.errores).toHaveLength(0);
    // El código de importación se genera a partir de la cédula.
    expect(resultado.clientes?.[0].codigoImp).toBe('CLI-12345678');
  });

  it('marca como error un número de préstamo que ya existe', async () => {
    const resultado = await validarCredito(creditoMinimo, {
      clientes: [clienteEnBd],
      prestamos: [{ numeroPrestamo: 'IMP-001', idempotencyKey: null }],
    });

    expect(resultado.errores).toEqual([
      expect.objectContaining({ campo: 'numero_prestamo' }),
    ]);
  });

  it('genera el número de préstamo y el código cuando se dejan vacíos', async () => {
    const { 'Número de crédito': _numero, ...resto } = creditoMinimo;
    const resultado = await validarCredito(resto);

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.creditos?.[0].numeroPrestamo).toMatch(/^IMP-/);
    expect(resultado.creditos?.[0].codigoImp).toBeTruthy();
  });

  it('asume interés simple cuando no se indica el tipo de amortización', async () => {
    const { 'Tipo amortización': _tipo, ...resto } = creditoMinimo;
    const resultado = await validarCredito(resto);

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.creditos?.[0].tipoAmortizacion).toBe('INTERES_SIMPLE');
    expect(resultado.advertencias).toEqual([
      expect.objectContaining({ campo: 'tipo_amortizacion' }),
    ]);
  });

  it('distingue interés simple de amortización al calcular el interés', async () => {
    // $500.000 al 10% a 2 meses.
    const base = { ...creditoMinimo, 'Cantidad cuotas': 60 };

    const simple = await validarCredito({
      ...base,
      'Tipo amortización': 'Interés simple',
    });
    expect(simple.errores).toHaveLength(0);
    expect(simple.creditos?.[0].tipoAmortizacion).toBe('INTERES_SIMPLE');
    // La tasa se aplica por cada mes de plazo.
    expect(simple.creditos?.[0].interesTotal).toBe(100000);

    const amortizacion = await validarCredito({
      ...base,
      'Tipo amortización': 'Amortización',
    });
    expect(amortizacion.errores).toHaveLength(0);
    expect(amortizacion.creditos?.[0].tipoAmortizacion).toBe('INTERES_PLANO');
    // La tasa se aplica una sola vez sobre el capital.
    expect(amortizacion.creditos?.[0].interesTotal).toBe(50000);
  });

  it('los dos métodos coinciden cuando el plazo es de un mes', async () => {
    const simple = await validarCredito({
      ...creditoMinimo,
      'Tipo amortización': 'Interés simple',
    });
    const amortizacion = await validarCredito({
      ...creditoMinimo,
      'Tipo amortización': 'Amortización',
    });

    expect(simple.creditos?.[0].interesTotal).toBe(50000);
    expect(amortizacion.creditos?.[0].interesTotal).toBe(50000);
  });

  it('rechaza un método de interés que no existe', async () => {
    const resultado = await validarCredito({
      ...creditoMinimo,
      'Tipo amortización': 'Francesa alemana',
    });

    expect(resultado.errores).toEqual([
      expect.objectContaining({ campo: 'tipo_amortizacion' }),
    ]);
  });

  it('deduce si se descuenta caja a partir del tipo de carga', async () => {
    const historico = await validarCredito(creditoMinimo);
    expect(historico.creditos?.[0].descontarCaja).toBe('NO');

    const operativo = await validarCredito({
      ...creditoMinimo,
      'Tipo carga': 'OPERATIVA',
    });
    expect(operativo.creditos?.[0].descontarCaja).toBe('SI');
  });

  it('exige la cantidad de cuotas en un crédito de dinero', async () => {
    const { 'Cantidad cuotas': _cuotas, ...resto } = creditoMinimo;
    const resultado = await validarCredito(resto);

    expect(resultado.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ campo: 'cantidad_cuotas' }),
      ]),
    );
  });

  it('no permite que un crédito OPERATIVA traiga cuotas pagadas', async () => {
    const resultado = await validarCredito({
      ...creditoMinimo,
      'Tipo carga': 'OPERATIVA',
      'Cuotas pagadas': 5,
    });

    expect(resultado.errores).toEqual([
      expect.objectContaining({ campo: 'cuotas_pagadas' }),
    ]);
  });

  it('acepta un crédito histórico con cuotas pagadas y abono parcial', async () => {
    const resultado = await validarCredito({
      ...creditoMinimo,
      Monto: 600000,
      'Fecha crédito': '2026-06-01',
      'Cuotas pagadas': 12,
      'Abono adicional': 10000,
      'Fecha último pago': '2026-07-10',
    });

    expect(resultado.errores).toHaveLength(0);
    const credito = resultado.creditos?.[0];
    expect(credito.cuotasPagadas).toBe(12);
    expect(credito.abonoAdicional).toBe(10000);
    // 600.000 + 10% x 1 mes = 660.000 · cuota 22.000 · 12 cuotas + 10.000
    expect(credito.totalCredito).toBe(660000);
    expect(credito.totalAbonado).toBe(274000);
    expect(credito.saldoPendiente).toBe(386000);
  });

  it('rechaza un abono mayor que el total del crédito', async () => {
    const resultado = await validarCredito({
      ...creditoMinimo,
      Monto: 600000,
      'Cuotas pagadas': 29,
      'Abono adicional': 500000,
    });

    expect(resultado.errores).toEqual([
      expect.objectContaining({ campo: 'abono_adicional' }),
    ]);
  });

  it('avisa cuando un precio trae centavos, porque el sistema maneja pesos enteros', async () => {
    const resultado = await validarCredito({
      ...creditoMinimo,
      Monto: 500000.75,
    });

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.advertencias).toEqual([
      expect.objectContaining({ campo: 'monto' }),
    ]);
    expect(resultado.creditos?.[0].monto).toBe(500000);
  });
});

describe('Plazo y cuotas, como los deriva el modal', () => {
  it('deriva el plazo desde las cuotas y la frecuencia, admitiendo fracciones', () => {
    expect(derivarPlazoMeses(30, 'DIARIO')).toBe(1);
    // 45 cuotas diarias son mes y medio: el modal no lo redondea.
    expect(derivarPlazoMeses(45, 'DIARIO')).toBe(1.5);
    expect(derivarPlazoMeses(8, 'SEMANAL')).toBe(2);
    expect(derivarPlazoMeses(4, 'QUINCENAL')).toBe(2);
    expect(derivarPlazoMeses(6, 'MENSUAL')).toBe(6);
  });

  it('deriva las cuotas desde el plazo con los mismos factores', () => {
    expect(derivarCantidadCuotas(1, 'DIARIO')).toBe(30);
    expect(derivarCantidadCuotas(2, 'SEMANAL')).toBe(8);
    expect(derivarCantidadCuotas(2, 'QUINCENAL')).toBe(4);
    expect(derivarCantidadCuotas(6, 'MENSUAL')).toBe(6);
    expect(derivarCantidadCuotas(0, 'DIARIO')).toBe(0);
  });
});

describe('Avance histórico de créditos importados', () => {
  const fechas = (cantidad: number, desde = '2026-01-01') =>
    Array.from({ length: cantidad }, (_, i) => {
      const fecha = new Date(desde);
      fecha.setDate(fecha.getDate() + i);
      return fecha;
    });

  const planDe = (cantidadCuotas: number) =>
    construirPlanCuotas({
      tipoAmortizacion: 'INTERES_SIMPLE',
      monto: 600000,
      interesTotal: 60000,
      cantidadCuotas,
      fechasVencimiento: fechas(cantidadCuotas),
    });

  it('deja pagadas las primeras cuotas y parcial la siguiente', () => {
    const plan = planDe(30);
    const avance = aplicarAvanceHistorico(plan, 12, 10000, null);

    expect(plan.slice(0, 12).every((c) => c.estado === 'PAGADA')).toBe(true);
    expect(plan[12].estado).toBe('PARCIAL');
    expect(plan[12].montoPagado).toBe(10000);
    expect(plan[13].estado).toBe('PENDIENTE');

    expect(avance.cuotasPagadas).toBe(12);
    expect(avance.totalPagado).toBe(274000);
    // El reparto respeta el orden interés → capital de los pagos reales.
    expect(avance.interesPagado + avance.capitalPagado).toBe(
      avance.totalPagado,
    );
    expect(avance.montoNoAplicado).toBe(0);
  });

  it('un abono que completa la cuota siguiente la deja pagada', () => {
    const plan = planDe(10);
    const montoCuota = plan[0].monto;
    aplicarAvanceHistorico(plan, 2, montoCuota, null);

    expect(plan.slice(0, 3).every((c) => c.estado === 'PAGADA')).toBe(true);
    expect(plan[3].estado).toBe('PENDIENTE');
  });

  it('no aplica más dinero del que suma el crédito', () => {
    const plan = planDe(5);
    const avance = aplicarAvanceHistorico(plan, 5, 50000, null);

    expect(avance.totalPagado).toBe(660000);
    expect(avance.montoNoAplicado).toBe(50000);
  });

  it('usa la fecha de último pago informada en la última cuota abonada', () => {
    const plan = planDe(10);
    const fechaUltimoPago = new Date('2026-03-15');
    aplicarAvanceHistorico(plan, 3, 0, fechaUltimoPago);

    expect(plan[2].fechaPago).toEqual(fechaUltimoPago);
    expect(plan[1].fechaPago).toEqual(plan[1].fechaVencimiento);
  });

  it('resuelve el estado del préstamo según el saldo y las cuotas vencidas', () => {
    const hoy = new Date('2026-02-01');

    const pagado = planDe(5);
    aplicarAvanceHistorico(pagado, 5, 0, null);
    expect(resolverEstadoPrestamoImportado(pagado, 0, hoy)).toBe('PAGADO');

    const enMora = planDe(5);
    expect(resolverEstadoPrestamoImportado(enMora, 660000, hoy)).toBe(
      'EN_MORA',
    );

    const alDia = construirPlanCuotas({
      tipoAmortizacion: 'INTERES_SIMPLE',
      monto: 600000,
      interesTotal: 60000,
      cantidadCuotas: 5,
      fechasVencimiento: fechas(5, '2026-03-01'),
    });
    expect(resolverEstadoPrestamoImportado(alDia, 660000, hoy)).toBe('ACTIVO');
  });
});

describe('Equivalencia con la creación de créditos del sistema', () => {
  /**
   * `calculateInterestAndCuotas` es puro: no toca Prisma ni los demás servicios,
   * así que se puede instanciar el servicio con dependencias vacías y comparar
   * su resultado contra el que produce la importación.
   */
  const servicioPrestamos = new LoansService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  const calcularConElSistema = (
    tipo: 'INTERES_SIMPLE' | 'INTERES_PLANO',
    monto: number,
    tasa: number,
    cantidadCuotas: number,
    plazoMeses: number,
    frecuencia: FrecuenciaPago = FrecuenciaPago.DIARIO,
  ) =>
    (servicioPrestamos as any).calculateInterestAndCuotas(
      tipo as TipoAmortizacion,
      monto,
      tasa,
      cantidadCuotas,
      plazoMeses,
      frecuencia,
      new Date('2026-05-01'),
      new Date('2026-05-01'),
    );

  const casos: Array<{
    nombre: string;
    tipo: 'INTERES_SIMPLE' | 'INTERES_PLANO';
    monto: number;
    tasa: number;
    cuotas: number;
    frecuencia: FrecuenciaPago;
  }> = [
    {
      nombre: 'interés simple, 30 cuotas diarias',
      tipo: 'INTERES_SIMPLE',
      monto: 500000,
      tasa: 10,
      cuotas: 30,
      frecuencia: FrecuenciaPago.DIARIO,
    },
    {
      nombre: 'interés simple, 45 cuotas diarias (plazo fraccionario)',
      tipo: 'INTERES_SIMPLE',
      monto: 500000,
      tasa: 10,
      cuotas: 45,
      frecuencia: FrecuenciaPago.DIARIO,
    },
    {
      nombre: 'amortización, 30 cuotas diarias',
      tipo: 'INTERES_PLANO',
      monto: 500000,
      tasa: 10,
      cuotas: 30,
      frecuencia: FrecuenciaPago.DIARIO,
    },
    {
      nombre: 'amortización, 8 cuotas semanales',
      tipo: 'INTERES_PLANO',
      monto: 1300000,
      tasa: 15,
      cuotas: 8,
      frecuencia: FrecuenciaPago.SEMANAL,
    },
    {
      nombre: 'interés simple, monto que no divide exacto',
      tipo: 'INTERES_SIMPLE',
      monto: 777777,
      tasa: 7.5,
      cuotas: 13,
      frecuencia: FrecuenciaPago.QUINCENAL,
    },
  ];

  it.each(casos)(
    'produce el mismo interés y las mismas cuotas que el sistema: $nombre',
    ({ tipo, monto, tasa, cuotas, frecuencia }) => {
      const plazoMeses = derivarPlazoMeses(cuotas, frecuencia);

      const delSistema = calcularConElSistema(
        tipo,
        monto,
        tasa,
        cuotas,
        plazoMeses,
        frecuencia,
      );

      const interesImportacion = calcularInteresTotal(
        tipo,
        monto,
        tasa,
        plazoMeses,
      );
      const cuotasImportacion = construirTablaCuotas(
        tipo,
        monto,
        interesImportacion,
        cuotas,
      );

      expect(interesImportacion).toBe(delSistema.interesTotal);
      expect(cuotasImportacion).toHaveLength(delSistema.cuotas.length);

      cuotasImportacion.forEach((cuota, i) => {
        expect({
          numeroCuota: cuota.numeroCuota,
          monto: cuota.monto,
          montoCapital: cuota.montoCapital,
          montoInteres: cuota.montoInteres,
        }).toEqual({
          numeroCuota: delSistema.cuotas[i].numeroCuota,
          monto: delSistema.cuotas[i].monto,
          montoCapital: delSistema.cuotas[i].montoCapital,
          montoInteres: delSistema.cuotas[i].montoInteres,
        });
      });

      // El capital repartido suma el monto y el interés repartido suma el total.
      const sumaCapital = cuotasImportacion.reduce(
        (s, c) => s + c.montoCapital,
        0,
      );
      const sumaInteres = cuotasImportacion.reduce(
        (s, c) => s + c.montoInteres,
        0,
      );
      expect(sumaCapital).toBe(monto);
      expect(sumaInteres).toBe(interesImportacion);
    },
  );
});

describe('Limpieza de datos al importar', () => {
  it('normaliza nombres en mayúsculas, teléfonos y correos', async () => {
    const plantilla =
      await generarPlantillaClientesCreditos(datosPlantillaVacios);
    const archivo = await editarLibro(plantilla.data, (workbook) => {
      escribirFila(workbook.getWorksheet('Clientes')!, FILA_DATOS, {
        'CC cliente': '12345678',
        Nombres: 'MARIA  DE LOS ANGELES',
        Apellidos: 'PEREZ  GOMEZ',
        Teléfono: '300-123 45 67',
        Correo: '  Juan.Perez@Example.COM ',
      });
    });

    const { clientes } = await new ClientesCreditosParser(
      prismaMock(),
    ).parseAndValidate(archivo, 'clientes.xlsx');

    expect(clientes?.[0]).toEqual(
      expect.objectContaining({
        nombres: 'Maria de los Angeles',
        apellidos: 'Perez Gomez',
        telefono: '3001234567',
        correo: 'juan.perez@example.com',
      }),
    );
  });

  it('respeta el nombre cuando la persona ya lo escribió con formato propio', async () => {
    const plantilla =
      await generarPlantillaClientesCreditos(datosPlantillaVacios);
    const archivo = await editarLibro(plantilla.data, (workbook) => {
      escribirFila(workbook.getWorksheet('Clientes')!, FILA_DATOS, {
        'CC cliente': '12345678',
        Nombres: 'María del Carmen',
        Apellidos: 'McDonald',
        Teléfono: '3001234567',
      });
    });

    const { clientes } = await new ClientesCreditosParser(
      prismaMock(),
    ).parseAndValidate(archivo, 'clientes.xlsx');

    expect(clientes?.[0].nombres).toBe('María del Carmen');
    expect(clientes?.[0].apellidos).toBe('McDonald');
  });
});

describe('Posibles clientes duplicados', () => {
  const escribirClientes = async (
    filas: Array<Record<string, any>>,
    datosBd?: Parameters<typeof prismaMock>[0],
  ) => {
    const plantilla =
      await generarPlantillaClientesCreditos(datosPlantillaVacios);
    const archivo = await editarLibro(plantilla.data, (workbook) => {
      const hoja = workbook.getWorksheet('Clientes')!;
      filas.forEach((fila, i) => escribirFila(hoja, FILA_DATOS + i, fila));
    });
    return new ClientesCreditosParser(prismaMock(datosBd)).parseAndValidate(
      archivo,
      'clientes.xlsx',
    );
  };

  it('avisa cuando dos filas tienen el mismo nombre y cédulas distintas', async () => {
    const resultado = await escribirClientes([
      {
        'CC cliente': '11111111',
        Nombres: 'Juan',
        Apellidos: 'Pérez',
        Teléfono: '3001111111',
      },
      {
        'CC cliente': '11111112',
        Nombres: 'JUAN',
        Apellidos: 'PEREZ',
        Teléfono: '3002222222',
      },
    ]);

    expect(resultado.errores).toHaveLength(0);
    expect(
      resultado.advertencias.filter((a) => a.campo === 'nombres'),
    ).toHaveLength(2);
  });

  it('avisa cuando el nombre ya existe en el sistema con otra cédula', async () => {
    const resultado = await escribirClientes(
      [
        {
          'CC cliente': '99999999',
          Nombres: 'Juan',
          Apellidos: 'Pérez',
          Teléfono: '3001111111',
        },
      ],
      { clientes: [clienteEnBd] },
    );

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.advertencias).toEqual([
      expect.objectContaining({
        campo: 'nombres',
        mensaje: expect.stringContaining('12345678'),
      }),
    ]);
  });

  it('no avisa cuando es la misma persona con la misma cédula', async () => {
    const resultado = await escribirClientes([
      {
        'CC cliente': '11111111',
        Nombres: 'Juan',
        Apellidos: 'Pérez',
        Teléfono: '3001111111',
      },
    ]);

    expect(
      resultado.advertencias.filter((a) => a.campo === 'nombres'),
    ).toHaveLength(0);
  });
});

describe('Acción ACTUALIZAR', () => {
  it('permite actualizar un cliente que ya existe', async () => {
    const plantilla =
      await generarPlantillaClientesCreditos(datosPlantillaVacios);
    const archivo = await editarLibro(plantilla.data, (workbook) => {
      escribirFila(workbook.getWorksheet('Clientes')!, FILA_DATOS, {
        Acción: 'ACTUALIZAR',
        'CC cliente': '12345678',
        Nombres: 'Juan Carlos',
        Apellidos: 'Pérez',
        Teléfono: '3009999999',
      });
    });

    const resultado = await new ClientesCreditosParser(
      prismaMock({ clientes: [clienteEnBd] }),
    ).parseAndValidate(archivo, 'clientes.xlsx');

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.clientes?.[0]).toEqual(
      expect.objectContaining({
        esActualizacion: true,
        nombres: 'Juan Carlos',
      }),
    );
  });

  it('rechaza ACTUALIZAR sobre una cédula que no existe', async () => {
    const plantilla =
      await generarPlantillaClientesCreditos(datosPlantillaVacios);
    const archivo = await editarLibro(plantilla.data, (workbook) => {
      escribirFila(workbook.getWorksheet('Clientes')!, FILA_DATOS, {
        Acción: 'ACTUALIZAR',
        'CC cliente': '55555555',
        Nombres: 'Nadie',
        Apellidos: 'Nuevo',
        Teléfono: '3001111111',
      });
    });

    const resultado = await new ClientesCreditosParser(
      prismaMock(),
    ).parseAndValidate(archivo, 'clientes.xlsx');

    expect(resultado.errores).toEqual([
      expect.objectContaining({ campo: 'cc' }),
    ]);
  });

  it('sugiere ACTUALIZAR cuando se intenta crear una cédula existente', async () => {
    const plantilla =
      await generarPlantillaClientesCreditos(datosPlantillaVacios);
    const archivo = await editarLibro(plantilla.data, (workbook) => {
      escribirFila(workbook.getWorksheet('Clientes')!, FILA_DATOS, {
        'CC cliente': '12345678',
        Nombres: 'Juan',
        Apellidos: 'Pérez',
        Teléfono: '3001234567',
      });
    });

    const resultado = await new ClientesCreditosParser(
      prismaMock({ clientes: [clienteEnBd] }),
    ).parseAndValidate(archivo, 'clientes.xlsx');

    expect(resultado.errores).toEqual([
      expect.objectContaining({
        campo: 'cc',
        mensaje: expect.stringContaining('ACTUALIZAR'),
      }),
    ]);
  });

  it('rechaza actualizar un crédito que ya tiene pagos registrados', async () => {
    const resultado = await validarCredito(
      { ...creditoMinimo, Acción: 'ACTUALIZAR' },
      {
        clientes: [clienteEnBd],
        prestamos: [
          {
            numeroPrestamo: 'IMP-001',
            idempotencyKey: null,
            _count: { pagos: 3 },
          },
        ],
      },
    );

    expect(resultado.errores).toEqual([
      expect.objectContaining({
        campo: 'numero_prestamo',
        mensaje: expect.stringContaining('pagos registrados'),
      }),
    ]);
  });

  it('permite actualizar un crédito importado sin pagos', async () => {
    const resultado = await validarCredito(
      { ...creditoMinimo, Acción: 'ACTUALIZAR', 'Cuotas pagadas': 5 },
      {
        clientes: [clienteEnBd],
        prestamos: [
          {
            numeroPrestamo: 'IMP-001',
            idempotencyKey: null,
            _count: { pagos: 0 },
          },
        ],
      },
    );

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.creditos?.[0]).toEqual(
      expect.objectContaining({ esActualizacion: true, cuotasPagadas: 5 }),
    );
  });

  it('permite actualizar un artículo existente', async () => {
    const resultado = await validarArticulo(
      {
        Acción: 'ACTUALIZAR',
        Código: 'NEV-200',
        Nombre: 'Nevera 200L Nueva',
        Categoría: 'Electrodomésticos',
        Costo: 950000,
        'Precio contado': 1100000,
        'Meses opción 1': 1,
        'Precio opción 1': 1200000,
      },
      { productos: [{ codigo: 'NEV-200', nombre: 'Nevera 200L' }] },
    );

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.articulos?.[0]).toEqual(
      expect.objectContaining({ esActualizacion: true, costo: 950000 }),
    );
    // Al actualizar no se repite la advertencia de "ya existe".
    expect(resultado.advertencias).toHaveLength(0);
  });

  it('rechaza actualizar un artículo que no existe', async () => {
    const resultado = await validarArticulo({
      Acción: 'ACTUALIZAR',
      Código: 'NO-EXISTE',
      Nombre: 'Fantasma',
      Categoría: 'Electrodomésticos',
      Costo: 100000,
      'Precio contado': 120000,
    });

    expect(resultado.errores).toEqual([
      expect.objectContaining({ campo: 'codigo' }),
    ]);
  });

  it('rechaza una acción que no existe', async () => {
    const resultado = await validarArticulo({
      Acción: 'BORRAR',
      Código: 'NEV-200',
      Nombre: 'Nevera 200L',
      Categoría: 'Electrodomésticos',
      Costo: 900000,
      'Precio contado': 1050000,
    });

    expect(resultado.errores).toEqual([
      expect.objectContaining({ campo: 'accion' }),
    ]);
  });
});

describe('Diferencias entre crédito de artículo y préstamo en efectivo', () => {
  it('no exige tasa de interés en un crédito de artículo', async () => {
    const resultado = await validarCreditoArticulo(creditoArticuloMinimo);

    expect(resultado.errores).toHaveLength(0);
    // Sin tasa, el crédito de artículo no genera interés aparte: el
    // financiamiento ya está dentro del precio del plazo.
    expect(resultado.creditos?.[0].interesTotal).toBe(0);
    expect(resultado.creditos?.[0].tipoPrestamo).toBe('ARTICULO');
  });

  it('la hoja de artículo no tiene columna de tasa ni de amortización', async () => {
    const plantilla =
      await generarPlantillaClientesCreditos(datosPlantillaVacios);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(plantilla.data as any);
    const encabezados = (
      wb.getWorksheet('Créditos de artículo')!.getRow(6).values as any[]
    )
      .slice(1)
      .filter(Boolean)
      .map(String);

    expect(encabezados).not.toContain('Tasa interés*');
    expect(encabezados).not.toContain('Tipo amortización');
    expect(encabezados).toContain('Producto código*');
  });

  it('sigue exigiendo la tasa en un préstamo en efectivo', async () => {
    const { 'Tasa interés': _tasa, ...resto } = creditoMinimo;
    const resultado = await validarCredito(resto);

    expect(resultado.errores).toEqual([
      expect.objectContaining({ campo: 'tasa_interes' }),
    ]);
  });

  it('en artículo el plazo manda y las cuotas se derivan de él', async () => {
    const resultado = await validarCreditoArticulo(creditoArticuloMinimo);

    expect(resultado.errores).toHaveLength(0);
    // 3 meses en frecuencia diaria = 90 cuotas.
    expect(resultado.creditos?.[0].cantidadCuotas).toBe(90);
  });

  it('en efectivo mandan las cuotas y el plazo se deriva de ellas', async () => {
    const resultado = await validarCredito({
      ...creditoMinimo,
      'Cantidad cuotas': 45,
    });

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.creditos?.[0].cantidadCuotas).toBe(45);
    expect(resultado.creditos?.[0].plazoMeses).toBe(1.5);
  });

  it('exige el código del artículo en su hoja', async () => {
    const { 'Producto código': _cod, ...resto } = creditoArticuloMinimo;
    const resultado = await validarCreditoArticulo(resto);

    // Sin artículo tampoco se puede deducir el monto: se reportan ambos.
    expect(resultado.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ campo: 'producto_codigo' }),
      ]),
    );
  });
});

describe('Filas más allá del rango preparado', () => {
  it('avisa cuando se pegan filas donde la plantilla ya no tiene fórmulas', async () => {
    const plantilla = await plantillaClientesCacheada();
    const filaFueraDeRango = FILA_DATOS + 1000; // la plantilla llega hasta 1006

    const archivo = await editarLibro(plantilla.data, (workbook) => {
      const hoja = workbook.getWorksheet('Clientes')!;
      escribirFila(hoja, FILA_DATOS, {
        'CC cliente': '11111111',
        Nombres: 'Dentro',
        Apellidos: 'Del rango',
        Teléfono: '3001111111',
      });
      escribirFila(hoja, filaFueraDeRango, {
        'CC cliente': '22222222',
        Nombres: 'Fuera',
        Apellidos: 'Del rango',
        Teléfono: '3002222222',
      });
    });

    const resultado = await new ClientesCreditosParser(
      prismaMock(),
    ).parseAndValidate(archivo, 'clientes.xlsx');

    // Las dos filas se importan; solo se avisa de la que quedó sin fórmulas.
    expect(resultado.errores).toHaveLength(0);
    expect(resultado.clientes).toHaveLength(2);
    expect(resultado.advertencias).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          campo: 'GLOBAL',
          mensaje: expect.stringContaining('más allá de la fila'),
        }),
      ]),
    );
  });

  it('no avisa cuando todas las filas están dentro del rango', async () => {
    const resultado = await validarCredito(creditoMinimo);

    expect(
      resultado.advertencias.filter((a) => a.campo === 'GLOBAL'),
    ).toHaveLength(0);
  });
});

describe('Cuota inicial en créditos de artículo', () => {
  it('financia el precio del plazo menos la cuota inicial, como el sistema', async () => {
    const resultado = await validarCreditoArticulo({
      ...creditoArticuloMinimo,
      'Cuota inicial': 190000,
    });

    expect(resultado.errores).toHaveLength(0);
    // Precio del plazo de 3 meses: 690.000 · inicial 190.000 → se financian 500.000
    expect(resultado.creditos?.[0].monto).toBe(500000);
    expect(resultado.creditos?.[0].cuotaInicial).toBe(190000);
  });

  it('sin cuota inicial financia el precio completo del plazo', async () => {
    const resultado = await validarCreditoArticulo(creditoArticuloMinimo);

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.creditos?.[0].monto).toBe(690000);
  });

  it('respeta el monto escrito a mano por encima del cálculo', async () => {
    const resultado = await validarCreditoArticulo({
      ...creditoArticuloMinimo,
      Monto: 400000,
      'Cuota inicial': 190000,
    });

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.creditos?.[0].monto).toBe(400000);
  });
});

describe('Las fórmulas del Excel dan lo mismo que el sistema', () => {
  const servicioPrestamos = new LoansService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  /**
   * Transcripción de las fórmulas que la plantilla escribe en las columnas
   * grises. Si alguien cambia una fórmula sin cambiar esto, la prueba se cae.
   */
  const comoLoCalculaElExcel = (
    monto: number,
    tasa: number,
    cuotas: number,
    plazoMeses: number,
  ) => {
    // =ROUND(monto*(tasa/100)*MAX(1,plazo),0)
    const interesTotal = Math.round(
      monto * (tasa / 100) * Math.max(1, plazoMeses),
    );
    // =monto+interés
    const totalPagar = monto + interesTotal;
    // =INT((total-interés)/cuotas)+INT(interés/cuotas)
    const valorCuota =
      Math.trunc((totalPagar - interesTotal) / cuotas) +
      Math.trunc(interesTotal / cuotas);
    return { interesTotal, totalPagar, valorCuota };
  };

  const casos = [
    {
      nombre: '30 cuotas diarias',
      monto: 500000,
      tasa: 10,
      cuotas: 30,
      frecuencia: FrecuenciaPago.DIARIO,
    },
    {
      nombre: '45 cuotas diarias (plazo fraccionario)',
      monto: 500000,
      tasa: 10,
      cuotas: 45,
      frecuencia: FrecuenciaPago.DIARIO,
    },
    {
      nombre: '13 quincenales con monto que no divide exacto',
      monto: 777777,
      tasa: 7.5,
      cuotas: 13,
      frecuencia: FrecuenciaPago.QUINCENAL,
    },
    {
      nombre: '8 semanales',
      monto: 1300000,
      tasa: 15,
      cuotas: 8,
      frecuencia: FrecuenciaPago.SEMANAL,
    },
    {
      nombre: '6 mensuales',
      monto: 2400000,
      tasa: 4,
      cuotas: 6,
      frecuencia: FrecuenciaPago.MENSUAL,
    },
  ];

  it.each(casos)(
    'interés, total y valor de cuota coinciden: $nombre',
    ({ monto, tasa, cuotas, frecuencia }) => {
      const plazoMeses = derivarPlazoMeses(cuotas, frecuencia);

      const delSistema = (servicioPrestamos as any).calculateInterestAndCuotas(
        'INTERES_SIMPLE' as TipoAmortizacion,
        monto,
        tasa,
        cuotas,
        plazoMeses,
        frecuencia,
        new Date('2026-05-01'),
        new Date('2026-05-01'),
      );

      const excel = comoLoCalculaElExcel(monto, tasa, cuotas, plazoMeses);

      expect(excel.interesTotal).toBe(delSistema.interesTotal);
      expect(excel.totalPagar).toBe(monto + delSistema.interesTotal);
      // La primera cuota es la que el Excel muestra como "Valor cuota".
      expect(excel.valorCuota).toBe(delSistema.cuotas[0].monto);
    },
  );

  it('la fórmula de amortización aplica la tasa una sola vez', () => {
    const monto = 500000;
    const tasa = 10;
    const cuotas = 60;
    const plazoMeses = derivarPlazoMeses(cuotas, FrecuenciaPago.DIARIO);

    // =ROUND(monto*(tasa/100),0), sin multiplicar por el plazo
    const excelInteres = Math.round(monto * (tasa / 100));

    const delSistema = (servicioPrestamos as any).calculateInterestAndCuotas(
      'INTERES_PLANO' as TipoAmortizacion,
      monto,
      tasa,
      cuotas,
      plazoMeses,
      FrecuenciaPago.DIARIO,
      new Date('2026-05-01'),
      new Date('2026-05-01'),
    );

    expect(excelInteres).toBe(delSistema.interesTotal);
  });

  it('la plantilla sigue usando exactamente esas fórmulas', async () => {
    const plantilla = await plantillaClientesCacheada();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(plantilla.data as any);
    const hoja = wb.getWorksheet('Créditos de dinero')!;
    const encabezados = (hoja.getRow(6).values as any[]).slice(1) as string[];

    const formulaDe = (nombre: string) => {
      const i = encabezados.findIndex((h) => h && h.startsWith(nombre));
      return String((hoja.getCell(7, i + 1).value as any)?.formula || '');
    };

    // Si alguien cambia el orden de operaciones o el redondeo, esta prueba lo
    // delata: son justo los dos puntos donde aparecía el peso de diferencia.
    const interes = formulaDe('Interés total');
    // Interés simple: multiplica todo y divide al final.
    expect(interes).toContain('ROUND($C7*$D7*MAX(1,$R7)/100,0)');
    // Amortización: la tasa se aplica una sola vez dividiendo primero, que es
    // como lo hace `calcularInteresPlano`.
    expect(interes).toContain('ROUND($C7*($D7/100),0)');

    const cuota = formulaDe('Valor cuota');
    expect(cuota).toContain('INT(');
    expect(cuota).not.toContain('ROUND(');
  });
});

describe('El archivo que se descarga abre sin que Excel pida repararlo', () => {
  // Excel no admite dos validaciones de datos sobre una misma celda: al abrir
  // avisa que se perdió contenido y, si uno no acepta la reparación, el libro
  // queda en blanco. Pasó de verdad, y no lo detectaba ninguna prueba porque el
  // XML seguía siendo válido: el archivo se leía bien con ExcelJS y solo Excel
  // se quejaba. Por eso esto se revisa sobre el .xlsx ya comprimido.
  const hojasDe = async (data: Buffer) => {
    const zip = await JSZip.loadAsync(data);
    const nombres = Object.keys(zip.files).filter((n) =>
      /^xl\/worksheets\/sheet\d+\.xml$/.test(n),
    );
    return Promise.all(
      nombres.map(async (n) => ({
        nombre: n,
        xml: await zip.files[n].async('string'),
      })),
    );
  };

  const aRango = (ref: string) => {
    const m = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(ref);
    if (!m) return null;
    const num = (c: string) =>
      c.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
    return {
      col1: num(m[1]),
      fila1: Number(m[2]),
      col2: num(m[3] ?? m[1]),
      fila2: Number(m[4] ?? m[2]),
    };
  };

  const seSolapan = (a: any, b: any) =>
    !(
      a.col2 < b.col1 ||
      b.col2 < a.col1 ||
      a.fila2 < b.fila1 ||
      b.fila2 < a.fila1
    );

  const solapes = (xml: string, patron: RegExp) => {
    const refs = [...xml.matchAll(patron)]
      .map((m) => aRango(m[1]))
      .filter(Boolean);
    const encontrados: string[] = [];
    for (let i = 0; i < refs.length; i++) {
      for (let j = i + 1; j < refs.length; j++) {
        if (seSolapan(refs[i], refs[j])) encontrados.push(`${i}-${j}`);
      }
    }
    return encontrados;
  };

  const revisar = async (data: Buffer) => {
    for (const hoja of await hojasDe(data)) {
      // Dos desplegables sobre la misma celda: el error que rompía el archivo.
      expect({
        hoja: hoja.nombre,
        solapes: solapes(hoja.xml, /<dataValidation\b[^>]*sqref="([^"]+)"/g),
      }).toEqual({ hoja: hoja.nombre, solapes: [] });

      // Celdas combinadas encimadas: Excel las rechaza igual.
      expect({
        hoja: hoja.nombre,
        solapes: solapes(hoja.xml, /<mergeCell ref="([^"]+)"/g),
      }).toEqual({ hoja: hoja.nombre, solapes: [] });
    }
  };

  it('la plantilla de clientes y créditos', async () => {
    const { data } =
      await generarPlantillaClientesCreditos(datosPlantillaVacios);
    await revisar(data);
  });

  it('la plantilla de clientes y créditos con datos de referencia', async () => {
    const { data } = await generarPlantillaClientesCreditos({
      clientes: [{ dni: '1088123456', nombre: 'Ana Gómez' }],
      articulos: [
        {
          codigo: 'TV-01',
          nombre: 'Televisor 32',
          meses: 0,
          precio: 900000,
          costo: 700000,
        },
        {
          codigo: 'TV-01',
          nombre: 'Televisor 32',
          meses: 6,
          precio: 1200000,
          costo: 700000,
        },
      ],
      codigosArticulo: ['TV-01'],
      numerosPrestamo: ['PR-001'],
      rutas: ['Ruta Centro'],
    });
    await revisar(data);
  });

  it('la plantilla de inventario', async () => {
    const { data } = await generarPlantillaInventario();
    await revisar(data);
  });
});
