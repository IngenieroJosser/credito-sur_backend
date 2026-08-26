import * as ExcelJS from 'exceljs';
import {
  agregarValoresInventario,
  construirHojaArticulos,
  escribirFilaArticulo,
} from '../../importaciones/plantillas/plantilla-inventario';
import { forzarRecalculo } from '../../importaciones/plantillas/plantillas.util';
import { etiquetaTipoAmortizacion } from '../../importaciones/interes-credito';

export interface InventarioImportableArticulo {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  categoria: string;
  marca?: string | null;
  modelo?: string | null;
  costo: number;
  stock: number;
  stockMinimo: number;
  activo: boolean;
}

export interface InventarioImportablePrecio {
  codigoProducto: string;
  meses: number;
  precio: number;
  activo: boolean;
}

export interface ClienteImportableRow {
  codigo: string;
  dni: string;
  nombres: string;
  apellidos: string;
  telefono: string;
  correo?: string | null;
  direccion?: string | null;
  referencia?: string | null;
  referencia1Nombre?: string | null;
  referencia1Telefono?: string | null;
  referencia2Nombre?: string | null;
  referencia2Telefono?: string | null;
  nivelRiesgo?: string | null;
  rutaCodigo?: string | null;
  observaciones?: string | null;
}

export interface CreditoImportableRow {
  codigo: string;
  numeroPrestamo: string;
  ccCliente: string;
  tipoPrestamo: string;
  productoCodigo?: string | null;
  monto: number;
  cuotaInicial?: number | null;
  tasaInteres: number;
  tasaInteresMora?: number | null;
  frecuenciaPago: string;
  cantidadCuotas: number;
  plazoMeses: number;
  tipoAmortizacion?: string | null;
  fechaCredito: Date | string;
  fechaPrimerCobro?: Date | string | null;
  tipoCarga?: string;
  descontarCaja?: string;
  garantia?: string | null;
  notas?: string | null;
  /** Estado de avance del crédito, para poder reimportarlo tal como está hoy. */
  cuotasPagadas?: number | null;
  abonoAdicional?: number | null;
  fechaUltimoPago?: Date | string | null;
}

const DATA_START_ROW = 7;

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function money(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function dateKey(value: Date | string | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function riesgoImportable(nivel?: string | null): string {
  const n = text(nivel).toUpperCase();
  if (n === 'AMARILLO') return 'Precaución';
  if (n === 'ROJO' || n === 'LISTA_NEGRA') return 'Crítico';
  return 'Mínimo';
}

function formatHeader(
  ws: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  instruction: string,
  lastColumn: string,
) {
  ws.mergeCells(`A1:${lastColumn}1`);
  const titleCell = ws.getCell('A1');
  titleCell.value = title;
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF004F7B' },
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 30;

  ws.mergeCells(`A2:${lastColumn}2`);
  const subtitleCell = ws.getCell('A2');
  subtitleCell.value = subtitle;
  subtitleCell.font = { italic: true, color: { argb: 'FF555555' } };

  ws.mergeCells(`A4:${lastColumn}4`);
  const instructionCell = ws.getCell('A4');
  instructionCell.value = instruction;
  instructionCell.font = { bold: true, color: { argb: 'FF004F7B' } };

  ws.getRow(6).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(6).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F81BD' },
  };
  ws.views = [{ state: 'frozen', ySplit: 6 }];
}

/** Letra de la columna que tiene esa clave, para no fijar letras a mano. */
function letraDe(columnas: Array<{ key: string }>, clave: string): string {
  const indice = columnas.findIndex((c) => c.key === clave);
  if (indice < 0) throw new Error(`No existe la columna "${clave}" en la hoja`);

  let n = indice + 1;
  let letra = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    n = Math.floor((n - 1) / 26);
  }
  return letra;
}

function setColumnsAtRowSix(
  ws: ExcelJS.Worksheet,
  columns: Array<{ header: string; key: string; width: number }>,
) {
  ws.columns = columns.map(({ key, width }) => ({ key, width })) as any;
  ws.getRow(6).values = columns.map((c) => c.header);
}

function addValoresClientesCreditos(workbook: ExcelJS.Workbook) {
  const ws = workbook.addWorksheet('Valores');
  ws.getCell('B1').value = 'Nivel Riesgo';
  ['Mínimo', 'Leve', 'Precaución', 'Moderado', 'Crítico'].forEach((v, i) => {
    ws.getCell(`B${i + 2}`).value = v;
  });
  ws.getCell('C1').value = 'Tipo Préstamo';
  ws.getCell('C2').value = 'EFECTIVO';
  ws.getCell('C3').value = 'ARTICULO';
  ws.getCell('D1').value = 'Frecuencia Pago';
  ['DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL'].forEach((v, i) => {
    ws.getCell(`D${i + 2}`).value = v;
  });
  ws.getCell('E1').value = 'Tipo Amortización';
  ws.getCell('E2').value = 'Interés simple';
  ws.getCell('E3').value = 'Amortización fija';
  ws.getCell('F1').value = 'Tipo Carga';
  ws.getCell('F2').value = 'HISTORICA';
  ws.getCell('F3').value = 'OPERATIVA';
  ws.getCell('G1').value = 'Descontar Caja';
  ws.getCell('G2').value = 'SI';
  ws.getCell('G3').value = 'NO';
  return ws;
}

export async function generarExcelInventarioImportable(
  articulos: InventarioImportableArticulo[],
  precios: InventarioImportablePrecio[],
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  forzarRecalculo(workbook);

  const wsInicio = workbook.addWorksheet('Inicio');
  wsInicio.getColumn(1).width = 120;
  wsInicio.getCell('A1').value =
    'EXPORTACIÓN COMPATIBLE CON IMPORTACIÓN DE INVENTARIO';
  wsInicio.getCell('A1').font = {
    bold: true,
    size: 16,
    color: { argb: 'FF004F7B' },
  };
  wsInicio.getCell('A3').value =
    'Este archivo puede validarse tal cual en el módulo de importaciones de inventario.';
  wsInicio.getCell('A4').value =
    'Cada fila es un artículo completo, con su precio de contado y sus opciones de plazo.';
  wsInicio.getCell('A5').value =
    'Las columnas grises de utilidad las calcula Excel y no se leen al importar.';

  // Se agrupan los precios por artículo: el contado es la opción de 0 meses y
  // el resto son las opciones de crédito, en orden de plazo.
  const preciosPorArticulo = new Map<string, InventarioImportablePrecio[]>();
  precios.forEach((precio) => {
    const clave = text(precio.codigoProducto).toUpperCase();
    const lista = preciosPorArticulo.get(clave) ?? [];
    lista.push(precio);
    preciosPorArticulo.set(clave, lista);
  });

  const filasPreparadas = Math.max(articulos.length, 50);
  const ws = await construirHojaArticulos(workbook, {
    subtitulo: 'Exportación lista para volver a importarse.',
    instruccion:
      'Revise o ajuste los datos desde la fila 7 hacia abajo. Las columnas grises se calculan solas.',
    filas: filasPreparadas,
  });

  articulos.forEach((articulo, indice) => {
    const clave = text(articulo.codigo).toUpperCase();
    const delArticulo = (preciosPorArticulo.get(clave) ?? []).sort(
      (a, b) => Number(a.meses) - Number(b.meses),
    );

    const contado = delArticulo.find((p) => Number(p.meses) === 0);
    const opciones = delArticulo
      .filter((p) => Number(p.meses) > 0)
      .map((p) => ({ meses: Number(p.meses), precio: money(p.precio) }));

    escribirFilaArticulo(ws, DATA_START_ROW + indice, {
      codigo: clave,
      nombre: text(articulo.nombre),
      descripcion: text(articulo.descripcion),
      categoria: text(articulo.categoria),
      marca: text(articulo.marca),
      modelo: text(articulo.modelo),
      costo: money(articulo.costo),
      precioContado: contado ? money(contado.precio) : null,
      stock: Number(articulo.stock || 0),
      stockMinimo: Number(articulo.stockMinimo || 0),
      activo: Boolean(articulo.activo),
      opciones,
    });
  });

  agregarValoresInventario(workbook, ws, filasPreparadas);

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer as ArrayBuffer),
    contentType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `inventario-importable-${fecha}.xlsx`,
  };
}

export async function generarExcelClientesCreditosImportable(
  clientes: ClienteImportableRow[],
  creditos: CreditoImportableRow[],
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';

  const wsInicio = workbook.addWorksheet('Inicio');
  wsInicio.getCell('A1').value =
    'EXPORTACIÓN COMPATIBLE CON IMPORTACIÓN DE CLIENTES Y CRÉDITOS';
  wsInicio.getCell('A1').font = {
    bold: true,
    size: 16,
    color: { argb: 'FF004F7B' },
  };
  wsInicio.getCell('A3').value =
    'Este archivo puede validarse en el módulo de importaciones de clientes y créditos.';
  wsInicio.getCell('A5').value =
    'Los créditos se exportan como HISTORICA / NO para no mover caja al reimportar.';

  const wsClientes = workbook.addWorksheet('Clientes');
  const columnasClientes = [
    { header: 'CC cliente*', key: 'cc', width: 20 },
    { header: 'Nombres*', key: 'nombres', width: 25 },
    { header: 'Apellidos*', key: 'apellidos', width: 25 },
    { header: 'Teléfono*', key: 'telefono', width: 20 },
    { header: 'Correo', key: 'correo', width: 25 },
    { header: 'Dirección', key: 'direccion', width: 30 },
    { header: 'Punto de referencia', key: 'referencia', width: 24 },
    { header: 'Ref1 Nombre', key: 'referencia1_nombre', width: 25 },
    { header: 'Ref1 Teléfono', key: 'referencia1_telefono', width: 20 },
    { header: 'Ref2 Nombre', key: 'referencia2_nombre', width: 25 },
    { header: 'Ref2 Teléfono', key: 'referencia2_telefono', width: 20 },
    { header: 'Ruta código', key: 'ruta_codigo', width: 15 },
  ];
  setColumnsAtRowSix(wsClientes, columnasClientes);
  formatHeader(
    wsClientes,
    'Gestión de Clientes',
    'Exportación lista para importación.',
    'Escriba o revise datos desde la fila 7 hacia abajo',
    letraDe(columnasClientes, 'ruta_codigo'),
  );

  clientes.forEach((c) => {
    wsClientes.addRow({
      cc: text(c.dni),
      nombres: text(c.nombres),
      apellidos: text(c.apellidos),
      telefono: text(c.telefono),
      correo: text(c.correo),
      direccion: text(c.direccion),
      referencia: text(c.referencia),
      referencia1_nombre: text(c.referencia1Nombre),
      referencia1_telefono: text(c.referencia1Telefono),
      referencia2_nombre: text(c.referencia2Nombre),
      referencia2_telefono: text(c.referencia2Telefono),
      ruta_codigo: text(c.rutaCodigo),
    });
  });

  const esArticulo = (c: CreditoImportableRow) =>
    text(c.tipoPrestamo).toUpperCase() === 'ARTICULO';

  const wsCreditos = workbook.addWorksheet('Créditos de dinero');
  const columnasCreditos = [
    { header: 'Número de crédito', key: 'numero_prestamo', width: 20 },
    { header: 'CC cliente*', key: 'cc_cliente', width: 20 },
    { header: 'Monto*', key: 'monto', width: 15 },
    { header: 'Cuota inicial', key: 'cuota_inicial', width: 15 },
    { header: 'Tasa interés*', key: 'tasa_interes', width: 15 },
    { header: 'Frecuencia pago*', key: 'frecuencia_pago', width: 18 },
    { header: 'Cantidad cuotas*', key: 'cantidad_cuotas', width: 18 },
    { header: 'Tipo de interés', key: 'tipo_amortizacion', width: 20 },
    { header: 'Fecha crédito*', key: 'fecha_credito', width: 15 },
    { header: 'Fecha primer cobro', key: 'fecha_primer_cobro', width: 20 },
    { header: 'Tipo carga*', key: 'tipo_carga', width: 15 },
    { header: 'Notas', key: 'notas', width: 30 },
    { header: 'Cuotas pagadas', key: 'cuotas_pagadas', width: 15 },
    { header: 'Abono adicional', key: 'abono_adicional', width: 16 },
    { header: 'Fecha último pago', key: 'fecha_ultimo_pago', width: 18 },
  ];
  setColumnsAtRowSix(wsCreditos, columnasCreditos);
  formatHeader(
    wsCreditos,
    'Gestión de Créditos',
    'Exportación lista para importación, con el avance de cobro de cada crédito.',
    'Créditos históricos: no afectan caja al confirmar',
    letraDe(columnasCreditos, 'fecha_ultimo_pago'),
  );

  creditos
    .filter((c) => !esArticulo(c))
    .forEach((c) => {
      wsCreditos.addRow({
        numero_prestamo: text(c.numeroPrestamo),
        cc_cliente: text(c.ccCliente),
        monto: money(c.monto),
        cuota_inicial: money(c.cuotaInicial),
        tasa_interes: money(c.tasaInteres),
        frecuencia_pago: text(c.frecuenciaPago).toUpperCase(),
        cantidad_cuotas: Number(c.cantidadCuotas || 0),
        tipo_amortizacion: etiquetaTipoAmortizacion(c.tipoAmortizacion),
        fecha_credito: dateKey(c.fechaCredito),
        fecha_primer_cobro: dateKey(c.fechaPrimerCobro),
        tipo_carga: c.tipoCarga || 'HISTORICA',
        notas: text(c.notas),
        cuotas_pagadas: Number(c.cuotasPagadas || 0),
        abono_adicional: money(c.abonoAdicional),
        fecha_ultimo_pago: dateKey(c.fechaUltimoPago),
      });
    });

  const wsCreditosArticulo = workbook.addWorksheet('Créditos de artículo');
  const columnasCreditosArticulo = [
    { header: 'Número de crédito', key: 'numero_prestamo', width: 20 },
    { header: 'CC cliente*', key: 'cc_cliente', width: 20 },
    { header: 'Producto código*', key: 'producto_codigo', width: 20 },
    { header: 'Plazo meses*', key: 'plazo_meses', width: 15 },
    { header: 'Frecuencia pago*', key: 'frecuencia_pago', width: 18 },
    { header: 'Fecha crédito*', key: 'fecha_credito', width: 15 },
    { header: 'Tipo carga*', key: 'tipo_carga', width: 15 },
    { header: 'Monto', key: 'monto', width: 15 },
    { header: 'Cuota inicial', key: 'cuota_inicial', width: 15 },
    { header: 'Tasa interés mora', key: 'tasa_interes_mora', width: 18 },
    { header: 'Fecha primer cobro', key: 'fecha_primer_cobro', width: 20 },
    { header: 'Notas', key: 'notas', width: 30 },
    { header: 'Cuotas pagadas', key: 'cuotas_pagadas', width: 15 },
    { header: 'Abono adicional', key: 'abono_adicional', width: 16 },
    { header: 'Fecha último pago', key: 'fecha_ultimo_pago', width: 18 },
  ];
  setColumnsAtRowSix(wsCreditosArticulo, columnasCreditosArticulo);
  formatHeader(
    wsCreditosArticulo,
    'Créditos de artículo',
    'Exportación lista para importación. El precio del plazo ya incluye el financiamiento.',
    'Créditos históricos: no afectan caja al confirmar',
    letraDe(columnasCreditosArticulo, 'fecha_ultimo_pago'),
  );

  creditos.filter(esArticulo).forEach((c) => {
    wsCreditosArticulo.addRow({
      numero_prestamo: text(c.numeroPrestamo),
      cc_cliente: text(c.ccCliente),
      producto_codigo: text(c.productoCodigo).toUpperCase(),
      plazo_meses: Number(c.plazoMeses || 0),
      frecuencia_pago: text(c.frecuenciaPago).toUpperCase(),
      fecha_credito: dateKey(c.fechaCredito),
      tipo_carga: c.tipoCarga || 'HISTORICA',
      monto: money(c.monto),
      cuota_inicial: money(c.cuotaInicial),
      tasa_interes_mora: money(c.tasaInteresMora),
      fecha_primer_cobro: dateKey(c.fechaPrimerCobro),
      notas: text(c.notas),
      cuotas_pagadas: Number(c.cuotasPagadas || 0),
      abono_adicional: money(c.abonoAdicional),
      fecha_ultimo_pago: dateKey(c.fechaUltimoPago),
    });
  });

  addValoresClientesCreditos(workbook);

  const listas: Array<
    [ExcelJS.Worksheet, Array<{ key: string }>, string, string, boolean]
  > = [
    [
      wsCreditos,
      columnasCreditos,
      'frecuencia_pago',
      'Valores!$D$2:$D$5',
      false,
    ],
    [
      wsCreditos,
      columnasCreditos,
      'tipo_amortizacion',
      'Valores!$E$2:$E$3',
      true,
    ],
    [wsCreditos, columnasCreditos, 'tipo_carga', 'Valores!$F$2:$F$3', false],
    [
      wsCreditosArticulo,
      columnasCreditosArticulo,
      'frecuencia_pago',
      'Valores!$D$2:$D$5',
      false,
    ],
    [
      wsCreditosArticulo,
      columnasCreditosArticulo,
      'tipo_carga',
      'Valores!$F$2:$F$3',
      false,
    ],
  ];

  for (let i = DATA_START_ROW; i <= 1000; i++) {
    listas.forEach(([hoja, columnas, clave, formula, permitirVacio]) => {
      hoja.getCell(`${letraDe(columnas, clave)}${i}`).dataValidation = {
        type: 'list',
        allowBlank: permitirVacio,
        formulae: [formula],
      };
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer as ArrayBuffer),
    contentType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `clientes-creditos-importable-${fecha}.xlsx`,
  };
}
