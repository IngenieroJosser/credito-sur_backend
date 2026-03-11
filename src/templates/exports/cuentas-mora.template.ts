/**
 * ============================================================================
 * TEMPLATE: CUENTAS EN MORA
 * ============================================================================
 * Usado en: reports.service.ts → generarReporteMora()
 * Genera reportes Excel y PDF de préstamos en estado de mora.
 * Formato Excel inspirado en el modelo de Estado de Cuentas Diarias.
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

// ─── Paleta corporativa ────────────────────────────────────────────────────────
const COLOR = {
  rojo:        'FFDC2626',
  rojoClaro:   'FFFEF2F2',
  rojoBorde:   'FFEF4444',
  gris:        'FF1E293B',
  grisClaro:   'FFF8FAFC',
  grisTexto:   'FF475569',
  blanco:      'FFFFFFFF',
  amarillo:    'FFFEF08A',
  naranjaClaro:'FFFFF7ED',
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface MoraRow {
  numeroPrestamo: string;
  cliente: string;
  documento: string;
  diasMora: number;
  montoMora: number;
  montoTotalDeuda: number;
  cuotasVencidas: number;
  ruta: string;
  cobrador: string;
  nivelRiesgo: string;
  ultimoPago?: string;
}

export interface MoraTotales {
  totalMora: number;
  totalDeuda: number;
  totalCasosCriticos: number;
  totalRegistros: number;
}

// ─── Utilidades Excel ─────────────────────────────────────────────────────────

function estiloEncabezado(cell: ExcelJS.Cell, bgArgb: string): void {
  cell.font = { bold: true, color: { argb: COLOR.blanco }, size: 10 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
  cell.border = {
    top: { style: 'thin', color: { argb: bgArgb } },
    bottom: { style: 'medium', color: { argb: COLOR.blanco } },
    left: { style: 'thin', color: { argb: COLOR.blanco } },
    right: { style: 'thin', color: { argb: COLOR.blanco } },
  };
}

function estiloFila(cell: ExcelJS.Cell, par: boolean): void {
  if (par) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.grisClaro } };
  }
  cell.border = {
    bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
    right: { style: 'hair', color: { argb: 'FFE2E8F0' } },
  };
  cell.alignment = { vertical: 'middle' };
}

// ─── Generador Excel ──────────────────────────────────────────────────────────

export async function generarExcelMora(
  filas: MoraRow[],
  totales: MoraTotales,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  workbook.created = new Date();
  workbook.properties.date1904 = false;

  // ── Hoja 1: Detalle de cuentas en mora ──────────────────────────────────────
  const ws = workbook.addWorksheet('Cuentas en Mora', {
    views: [{ state: 'frozen', ySplit: 5, xSplit: 0 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  ws.columns = [
    { key: 'num',        width: 18 },
    { key: 'cliente',    width: 30 },
    { key: 'documento',  width: 14 },
    { key: 'diasMora',   width: 11 },
    { key: 'montoMora',  width: 16 },
    { key: 'deudaTotal', width: 16 },
    { key: 'cuotas',     width: 13 },
    { key: 'ruta',       width: 20 },
    { key: 'cobrador',   width: 24 },
    { key: 'riesgo',     width: 13 },
    { key: 'ultimoPago', width: 14 },
  ] as any;

  // Fila 1: Logo + Título institucional
  ws.mergeCells('A1:K1');
  const tituloCell = ws.getCell('A1');
  tituloCell.value = 'CRÉDITOS DEL SUR';
  tituloCell.font = { bold: true, size: 18, color: { argb: COLOR.blanco } };
  tituloCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.rojo } };
  tituloCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 32;

  // Fila 2: Subtítulo del reporte
  ws.mergeCells('A2:K2');
  const subCell = ws.getCell('A2');
  subCell.value = 'REPORTE DE CARTERA EN MORA';
  subCell.font = { bold: true, size: 12, color: { argb: COLOR.rojo } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0F0' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;

  // Fila 3: Metadatos
  ws.mergeCells('A3:D3');
  ws.getCell('A3').value = `Fecha de Generación: ${new Date().toLocaleString('es-CO')}`;
  ws.getCell('A3').font = { size: 9, color: { argb: COLOR.grisTexto } };
  ws.mergeCells('E3:H3');
  ws.getCell('E3').value = `Casos Críticos: ${totales.totalCasosCriticos}`;
  ws.getCell('E3').font = { bold: true, size: 9, color: { argb: COLOR.rojo } };
  ws.getCell('E3').alignment = { horizontal: 'center' };
  ws.mergeCells('I3:K3');
  ws.getCell('I3').value = `Total Registros: ${totales.totalRegistros}`;
  ws.getCell('I3').font = { size: 9, color: { argb: COLOR.grisTexto } };
  ws.getCell('I3').alignment = { horizontal: 'right' };
  ws.getRow(3).height = 16;

  // Fila 4: Resumen financiero en celdas
  ws.getCell('A4').value = 'Mora Acumulada';
  ws.getCell('B4').value = totales.totalMora;
  ws.getCell('B4').numFmt = '"$"#,##0';
  ws.getCell('C4').value = 'Deuda Total Cartera';
  ws.getCell('D4').value = totales.totalDeuda;
  ws.getCell('D4').numFmt = '"$"#,##0';
  ['A4','C4'].forEach(ref => {
    ws.getCell(ref).font = { bold: true, size: 9, color: { argb: COLOR.grisTexto } };
  });
  ['B4','D4'].forEach(ref => {
    ws.getCell(ref).font = { bold: true, size: 9, color: { argb: COLOR.rojo } };
    ws.getCell(ref).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.rojoClaro } };
  });
  ws.getRow(4).height = 16;

  // Fila 5: Encabezados de columnas
  const headers = ['N° Préstamo','Cliente','Documento','Días Mora','Monto Mora',
    'Deuda Total','Cuotas Venc.','Ruta','Cobrador','Nivel Riesgo','Último Pago'];
  const hRow = ws.getRow(5);
  headers.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    estiloEncabezado(cell, COLOR.rojo);
  });
  hRow.height = 22;
  ws.autoFilter = { from: 'A5', to: 'K5' };

  // Filas de datos
  filas.forEach((fila, idx) => {
    const row = ws.addRow([
      fila.numeroPrestamo,
      fila.cliente,
      fila.documento,
      fila.diasMora,
      fila.montoMora,
      fila.montoTotalDeuda,
      fila.cuotasVencidas,
      fila.ruta,
      fila.cobrador,
      fila.nivelRiesgo,
      fila.ultimoPago || 'Sin pagos',
    ]);
    row.height = 18;
    const esPar = idx % 2 === 0;
    row.eachCell(cell => estiloFila(cell, esPar));

    // Formato moneda
    row.getCell(5).numFmt = '"$"#,##0';
    row.getCell(6).numFmt = '"$"#,##0';

    // Alineación numérica
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };

    // Resaltar casos críticos
    const riesgo = fila.nivelRiesgo?.toUpperCase() || '';
    if (riesgo === 'ROJO' || riesgo === 'LISTA_NEGRA') {
      row.getCell(2).font  = { bold: true, color: { argb: COLOR.rojo }, size: 10 };
      row.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
    }
  });

  // Fila de totales
  ws.addRow([]);
  const totRow = ws.addRow([
    'TOTALES', '', '',
    '',
    totales.totalMora,
    totales.totalDeuda,
    totales.totalRegistros,
    '', '', '', '',
  ]);
  totRow.height = 20;
  totRow.getCell(1).value = `TOTALES — ${totales.totalRegistros} préstamos en mora`;
  totRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: COLOR.blanco }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.gris } };
  });
  totRow.getCell(5).numFmt = '"$"#,##0';
  totRow.getCell(6).numFmt = '"$"#,##0';

  // ── Hoja 2: Resumen por nivel de riesgo ──────────────────────────────────────
  const wsResumen = workbook.addWorksheet('Resumen por Riesgo');
  wsResumen.columns = [
    { key: 'nivel', width: 22 },
    { key: 'casos', width: 12 },
    { key: 'mora',  width: 20 },
    { key: 'deuda', width: 20 },
  ] as any;

  ws.mergeCells('A1:D1');
  const rT = wsResumen.getCell('A1');
  rT.value = 'CRÉDITOS DEL SUR — Resumen por Nivel de Riesgo';
  rT.font = { bold: true, size: 14, color: { argb: COLOR.blanco } };
  rT.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.rojo } };
  rT.alignment = { horizontal: 'center', vertical: 'middle' };
  wsResumen.getRow(1).height = 28;

  wsResumen.addRow([]);
  const rhRow = wsResumen.getRow(3);
  ['Nivel de Riesgo','Casos','Mora Acumulada','Deuda Total'].forEach((h, i) => {
    const cell = rhRow.getCell(i + 1);
    cell.value = h;
    estiloEncabezado(cell, COLOR.rojo);
  });
  rhRow.height = 20;

  const porNivel: Record<string, { casos: number; mora: number; deuda: number }> = {};
  filas.forEach(f => {
    const n = f.nivelRiesgo || 'Sin clasificar';
    if (!porNivel[n]) porNivel[n] = { casos: 0, mora: 0, deuda: 0 };
    porNivel[n].casos++;
    porNivel[n].mora  += f.montoMora || 0;
    porNivel[n].deuda += f.montoTotalDeuda || 0;
  });

  const nivelColors: Record<string, string> = {
    ROJO: 'FFFECACA', AMARILLO: 'FFFEF9C3', VERDE: 'FFDCFCE7', LISTA_NEGRA: 'FFFFE4E6',
  };

  Object.entries(porNivel).forEach(([nivel, datos], idx) => {
    const row = wsResumen.addRow([nivel, datos.casos, datos.mora, datos.deuda]);
    row.height = 18;
    const bg = nivelColors[nivel.toUpperCase()] || (idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF');
    row.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.alignment = { vertical: 'middle' };
    });
    row.getCell(3).numFmt = '"$"#,##0';
    row.getCell(4).numFmt = '"$"#,##0';
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer as ArrayBuffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `cuentas-mora-${fecha}.xlsx`,
  };
}

// ─── Generador PDF ────────────────────────────────────────────────────────────

export async function generarPDFMora(
  filas: MoraRow[],
  totales: MoraTotales,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  const drawPageHeader = () => {
    // Barra roja de título
    doc.rect(0, 0, doc.page.width, 50).fill('#DC2626');
    doc.fontSize(16).font('Helvetica-Bold').fillColor('white')
      .text('CRÉDITOS DEL SUR', 30, 10, { align: 'left' });
    doc.fontSize(10).font('Helvetica').fillColor('white')
      .text('REPORTE DE CARTERA EN MORA', 30, 30, { align: 'left' });
    doc.fontSize(8).fillColor('white')
      .text(`Fecha: ${new Date().toLocaleDateString('es-CO')}   |   Generado: ${new Date().toLocaleString('es-CO')}`,
        0, 36, { align: 'right', width: doc.page.width - 30 });

    // Métricas resumen
    const metY = 58;
    const metW = (doc.page.width - 60) / 3;
    [
      { label: 'MORA ACUMULADA',  val: `$${totales.totalMora.toLocaleString('es-CO')}` },
      { label: 'DEUDA TOTAL',     val: `$${totales.totalDeuda.toLocaleString('es-CO')}` },
      { label: 'CASOS CRÍTICOS',  val: String(totales.totalCasosCriticos) },
    ].forEach((m, i) => {
      const mx = 30 + i * (metW + 5);
      doc.rect(mx, metY, metW, 28).fill(i === 2 ? '#7f1d1d' : '#991b1b');
      doc.fontSize(7).font('Helvetica').fillColor('white')
        .text(m.label, mx + 4, metY + 4, { width: metW - 8 });
      doc.fontSize(11).font('Helvetica-Bold').fillColor('white')
        .text(m.val, mx + 4, metY + 13, { width: metW - 8 });
    });
    return metY + 36;
  };

  const cols = [
    { label: 'N° Préstamo', width: 78 },
    { label: 'Cliente',      width: 110 },
    { label: 'Días Mora',   width: 55 },
    { label: 'Monto Mora',  width: 78 },
    { label: 'Deuda Total', width: 78 },
    { label: 'Cuotas',      width: 48 },
    { label: 'Ruta',        width: 80 },
    { label: 'Cobrador',    width: 90 },
    { label: 'Riesgo',      width: 58 },
  ];
  const tableLeft = 30;
  const rowH = 16;
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);

  const drawTableHeader = (y: number): number => {
    doc.fontSize(7).font('Helvetica-Bold');
    doc.rect(tableLeft, y, tableWidth, rowH + 2).fill('#DC2626');
    let x = tableLeft;
    cols.forEach(col => {
      doc.fillColor('white').text(col.label, x + 2, y + 4, { width: col.width - 4, align: 'center' });
      x += col.width;
    });
    return y + rowH + 2;
  };

  let y = drawPageHeader();
  y = drawTableHeader(y);

  doc.font('Helvetica').fontSize(7).fillColor('black');
  filas.forEach((fila, i) => {
    if (y > 530) {
      doc.addPage();
      y = drawPageHeader();
      y = drawTableHeader(y);
      doc.font('Helvetica').fontSize(7).fillColor('black');
    }
    const riesgo = fila.nivelRiesgo?.toUpperCase() || '';
    const bgColor = riesgo === 'ROJO' || riesgo === 'LISTA_NEGRA'
      ? '#FEF2F2'
      : (i % 2 === 0 ? '#F8FAFC' : 'white');
    doc.rect(tableLeft, y, tableWidth, rowH).fill(bgColor);

    let x = tableLeft;
    const vals = [
      fila.numeroPrestamo || '',
      (fila.cliente || '').substring(0, 20),
      String(fila.diasMora || 0),
      `$${(fila.montoMora || 0).toLocaleString('es-CO')}`,
      `$${(fila.montoTotalDeuda || 0).toLocaleString('es-CO')}`,
      String(fila.cuotasVencidas || 0),
      (fila.ruta || '').substring(0, 14),
      (fila.cobrador || '').substring(0, 16),
      fila.nivelRiesgo || '',
    ];
    vals.forEach((val, ci) => {
      const color = (ci === 8 && (riesgo === 'ROJO' || riesgo === 'LISTA_NEGRA')) ? '#DC2626' : 'black';
      doc.fillColor(color).text(val, x + 2, y + 4, { width: cols[ci].width - 4, align: ci >= 2 && ci <= 5 ? 'right' : 'left' });
      x += cols[ci].width;
    });
    doc.fillColor('black');
    y += rowH;
  });

  // Fila totales
  y += 4;
  doc.rect(tableLeft, y, tableWidth, rowH + 2).fill('#1E293B');
  doc.fontSize(7).font('Helvetica-Bold').fillColor('white');
  let x = tableLeft;
  const totData = [
    `TOTALES (${totales.totalRegistros})`, '',
    '',
    `$${totales.totalMora.toLocaleString('es-CO')}`,
    `$${totales.totalDeuda.toLocaleString('es-CO')}`,
    '', '', '', '',
  ];
  totData.forEach((val, ci) => {
    doc.text(val, x + 2, y + 4, { width: cols[ci].width - 4, align: ci >= 3 && ci <= 4 ? 'right' : 'left' });
    x += cols[ci].width;
  });

  doc.end();
  const buffer = await new Promise<Buffer>(resolve => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });

  return {
    data: buffer,
    contentType: 'application/pdf',
    filename: `cuentas-mora-${fecha}.pdf`,
  };
}
