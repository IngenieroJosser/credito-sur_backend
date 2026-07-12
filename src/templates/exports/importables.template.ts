import * as ExcelJS from 'exceljs';

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

function setColumnsAtRowSix(
  ws: ExcelJS.Worksheet,
  columns: Array<{ header: string; key: string; width: number }>,
) {
  ws.columns = columns.map(({ key, width }) => ({ key, width })) as any;
  ws.getRow(6).values = columns.map((c) => c.header);
}

function addValoresInventario(workbook: ExcelJS.Workbook) {
  const ws = workbook.addWorksheet('Valores');
  ws.getCell('A1').value = 'Acción';
  ws.getCell('A2').value = 'CREAR';
  ws.getCell('B1').value = 'Activo';
  ws.getCell('B2').value = 'SI';
  ws.getCell('B3').value = 'NO';
  return ws;
}

function addValoresClientesCreditos(workbook: ExcelJS.Workbook) {
  const ws = workbook.addWorksheet('Valores');
  ws.getCell('A1').value = 'Acción';
  ws.getCell('A2').value = 'CREAR';
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

  const wsInicio = workbook.addWorksheet('Inicio');
  wsInicio.getCell('A1').value = 'EXPORTACIÓN COMPATIBLE CON IMPORTACIÓN DE INVENTARIO';
  wsInicio.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF004F7B' } };
  wsInicio.getCell('A3').value = 'Este archivo puede validarse en el módulo de importaciones de inventario.';
  wsInicio.getCell('A5').value = 'Los datos comienzan en la fila 7, como en la plantilla oficial.';

  const wsArticulos = workbook.addWorksheet('Artículos');
  setColumnsAtRowSix(wsArticulos, [
    { header: 'Acción*', key: 'accion', width: 15 },
    { header: 'Código*', key: 'codigo', width: 20 },
    { header: 'Nombre*', key: 'nombre', width: 35 },
    { header: 'Descripción', key: 'descripcion', width: 35 },
    { header: 'Categoría*', key: 'categoria', width: 25 },
    { header: 'Marca', key: 'marca', width: 20 },
    { header: 'Modelo', key: 'modelo', width: 20 },
    { header: 'Costo*', key: 'costo', width: 15 },
    { header: 'Stock*', key: 'stock', width: 15 },
    { header: 'Stock mínimo*', key: 'stock_minimo', width: 15 },
    { header: 'Activo*', key: 'activo', width: 15 },
    { header: 'Observaciones', key: 'observaciones', width: 30 },
  ]);
  formatHeader(wsArticulos, 'Catálogo de Artículos', 'Exportación lista para importación.', 'Escriba o revise datos desde la fila 7 hacia abajo', 'L');

  articulos.forEach((a) => {
    wsArticulos.addRow({
      accion: 'CREAR',
      codigo: text(a.codigo).toUpperCase(),
      nombre: text(a.nombre),
      descripcion: text(a.descripcion),
      categoria: text(a.categoria),
      marca: text(a.marca),
      modelo: text(a.modelo),
      costo: money(a.costo),
      stock: Number(a.stock || 0),
      stock_minimo: Number(a.stockMinimo || 0),
      activo: a.activo ? 'SI' : 'NO',
      observaciones: '',
    });
  });

  const wsPrecios = workbook.addWorksheet('Precios');
  setColumnsAtRowSix(wsPrecios, [
    { header: 'Código producto*', key: 'codigo_producto', width: 20 },
    { header: 'Meses*', key: 'meses', width: 15 },
    { header: 'Precio*', key: 'precio', width: 15 },
    { header: 'Activo*', key: 'activo', width: 15 },
  ]);
  formatHeader(wsPrecios, 'Precios a Plazos', 'Exportación lista para importación.', 'Escriba o revise datos desde la fila 7 hacia abajo', 'D');
  precios
    .filter((p) => Number(p.meses) > 0)
    .forEach((p) => {
      wsPrecios.addRow({
        codigo_producto: text(p.codigoProducto).toUpperCase(),
        meses: Number(p.meses),
        precio: money(p.precio),
        activo: p.activo ? 'SI' : 'NO',
      });
    });

  addValoresInventario(workbook);

  for (let i = DATA_START_ROW; i <= 1000; i++) {
    wsArticulos.getCell(`A${i}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['"CREAR"'] };
    wsArticulos.getCell(`K${i}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['Valores!$B$2:$B$3'] };
    wsPrecios.getCell(`D${i}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['Valores!$B$2:$B$3'] };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer as ArrayBuffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
  wsInicio.getCell('A1').value = 'EXPORTACIÓN COMPATIBLE CON IMPORTACIÓN DE CLIENTES Y CRÉDITOS';
  wsInicio.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF004F7B' } };
  wsInicio.getCell('A3').value = 'Este archivo puede validarse en el módulo de importaciones de clientes y créditos.';
  wsInicio.getCell('A5').value = 'Los créditos se exportan como HISTORICA / NO para no mover caja al reimportar.';

  const wsClientes = workbook.addWorksheet('Clientes');
  setColumnsAtRowSix(wsClientes, [
    { header: 'Acción*', key: 'accion', width: 15 },
    { header: 'Código importación*', key: 'codigo_importacion_cliente', width: 25 },
    { header: 'CC cliente*', key: 'cc', width: 20 },
    { header: 'Nombres*', key: 'nombres', width: 25 },
    { header: 'Apellidos*', key: 'apellidos', width: 25 },
    { header: 'Teléfono*', key: 'telefono', width: 20 },
    { header: 'Correo', key: 'correo', width: 25 },
    { header: 'Dirección', key: 'direccion', width: 30 },
    { header: 'Referencia', key: 'referencia', width: 20 },
    { header: 'Ref1 Nombre', key: 'referencia1_nombre', width: 25 },
    { header: 'Ref1 Teléfono', key: 'referencia1_telefono', width: 20 },
    { header: 'Ref2 Nombre', key: 'referencia2_nombre', width: 25 },
    { header: 'Ref2 Teléfono', key: 'referencia2_telefono', width: 20 },
    { header: 'Nivel riesgo', key: 'nivel_riesgo', width: 15 },
    { header: 'Ruta código', key: 'ruta_codigo', width: 15 },
    { header: 'Observaciones', key: 'observaciones', width: 30 },
  ]);
  formatHeader(wsClientes, 'Gestión de Clientes', 'Exportación lista para importación.', 'Escriba o revise datos desde la fila 7 hacia abajo', 'P');

  clientes.forEach((c) => {
    wsClientes.addRow({
      accion: 'CREAR',
      codigo_importacion_cliente: text(c.codigo).slice(0, 20),
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
      nivel_riesgo: riesgoImportable(c.nivelRiesgo),
      ruta_codigo: text(c.rutaCodigo),
      observaciones: text(c.observaciones),
    });
  });

  const wsCreditos = workbook.addWorksheet('Créditos');
  setColumnsAtRowSix(wsCreditos, [
    { header: 'Acción*', key: 'accion', width: 15 },
    { header: 'Código importación*', key: 'codigo_importacion_credito', width: 25 },
    { header: 'Número préstamo', key: 'numero_prestamo', width: 20 },
    { header: 'CC cliente*', key: 'cc_cliente', width: 20 },
    { header: 'Tipo préstamo*', key: 'tipo_prestamo', width: 15 },
    { header: 'Producto código', key: 'producto_codigo', width: 20 },
    { header: 'Monto*', key: 'monto', width: 15 },
    { header: 'Cuota inicial', key: 'cuota_inicial', width: 15 },
    { header: 'Tasa interés*', key: 'tasa_interes', width: 15 },
    { header: 'Tasa interés mora', key: 'tasa_interes_mora', width: 18 },
    { header: 'Frecuencia pago*', key: 'frecuencia_pago', width: 18 },
    { header: 'Cantidad cuotas*', key: 'cantidad_cuotas', width: 18 },
    { header: 'Plazo meses*', key: 'plazo_meses', width: 15 },
    { header: 'Tipo amortización', key: 'tipo_amortizacion', width: 20 },
    { header: 'Fecha crédito*', key: 'fecha_credito', width: 15 },
    { header: 'Fecha primer cobro', key: 'fecha_primer_cobro', width: 20 },
    { header: 'Tipo carga*', key: 'tipo_carga', width: 15 },
    { header: 'Descontar dinero de caja*', key: 'descontar_dinero_de_caja', width: 25 },
    { header: 'Garantía', key: 'garantia', width: 20 },
    { header: 'Notas', key: 'notas', width: 30 },
  ]);
  formatHeader(wsCreditos, 'Gestión de Créditos', 'Exportación lista para importación.', 'Créditos históricos: no afectan caja al confirmar', 'T');

  creditos.forEach((c) => {
    wsCreditos.addRow({
      accion: 'CREAR',
      codigo_importacion_credito: text(c.codigo).slice(0, 100),
      numero_prestamo: text(c.numeroPrestamo),
      cc_cliente: text(c.ccCliente),
      tipo_prestamo: text(c.tipoPrestamo).toUpperCase(),
      producto_codigo: text(c.productoCodigo).toUpperCase(),
      monto: money(c.monto),
      cuota_inicial: money(c.cuotaInicial),
      tasa_interes: money(c.tasaInteres),
      tasa_interes_mora: money(c.tasaInteresMora),
      frecuencia_pago: text(c.frecuenciaPago).toUpperCase(),
      cantidad_cuotas: Number(c.cantidadCuotas || 0),
      plazo_meses: Number(c.plazoMeses || 0),
      tipo_amortizacion: text(c.tipoAmortizacion) || 'Interés simple',
      fecha_credito: dateKey(c.fechaCredito),
      fecha_primer_cobro: dateKey(c.fechaPrimerCobro),
      tipo_carga: c.tipoCarga || 'HISTORICA',
      descontar_dinero_de_caja: c.descontarCaja || 'NO',
      garantia: text(c.garantia),
      notas: text(c.notas),
    });
  });

  addValoresClientesCreditos(workbook);

  for (let i = DATA_START_ROW; i <= 1000; i++) {
    wsClientes.getCell(`A${i}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['"CREAR"'] };
    wsClientes.getCell(`N${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['Valores!$B$2:$B$6'] };
    wsCreditos.getCell(`A${i}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['"CREAR"'] };
    wsCreditos.getCell(`E${i}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['Valores!$C$2:$C$3'] };
    wsCreditos.getCell(`K${i}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['Valores!$D$2:$D$5'] };
    wsCreditos.getCell(`N${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['Valores!$E$2:$E$3'] };
    wsCreditos.getCell(`Q${i}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['Valores!$F$2:$F$3'] };
    wsCreditos.getCell(`R${i}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['Valores!$G$2:$G$3'] };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer as ArrayBuffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `clientes-creditos-importable-${fecha}.xlsx`,
  };
}
