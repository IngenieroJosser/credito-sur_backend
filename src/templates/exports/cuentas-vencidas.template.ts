/**
 * ============================================================================
 * TEMPLATE: CUENTAS VENCIDAS
 * ============================================================================
 * Usado en: reports.service.ts → exportarCuentasVencidas()
 * Genera reporte de préstamos con fecha de vencimiento superada.
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface VencidasRow {
  numeroPrestamo: string;
  cliente: string;
  documento: string;
  diasVencidos: number;
  saldoPendiente: number;
  montoOriginal: number;
  interesesMora: number;
  nivelRiesgo: string;
  ruta: string;
  fechaVencimiento: string;
  estado?: string;
}

export interface VencidasTotales {
  totalVencido: number;
  totalRegistros: number;
  diasPromedioVencimiento: number;
  totalInteresesMora: number;
  totalMontoOriginal: number;
}

// ─── Utilidad: estilo de celda de encabezado ──────────────────────────────────

function appHeader(cell: ExcelJS.Cell, bg: string): void {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.border = {
    bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
    right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
  };
}

function appRow(cell: ExcelJS.Cell, par: boolean): void {
  if (par) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  cell.border = {
    bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
    right:  { style: 'hair', color: { argb: 'FFE2E8F0' } },
  };
  cell.alignment = { vertical: 'middle' };
}

// ─── Generador Excel ──────────────────────────────────────────────────────────

export async function generarExcelVencidas(
  filas: VencidasRow[],
  totales: VencidasTotales,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  workbook.created = new Date();

  // ── Hoja 1: Detalle de cuentas vencidas ──────────────────────────────────────
  const ws = workbook.addWorksheet('Cuentas Vencidas', {
    views: [{ state: 'frozen', ySplit: 5 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  ws.columns = [
    { key: 'num',       width: 18 },
    { key: 'cliente',   width: 30 },
    { key: 'documento', width: 13 },
    { key: 'fechaVenc', width: 14 },
    { key: 'dias',      width: 11 },
    { key: 'saldo',     width: 16 },
    { key: 'original',  width: 16 },
    { key: 'intereses', width: 16 },
    { key: 'riesgo',    width: 13 },
    { key: 'ruta',      width: 20 },
    { key: 'estado',    width: 14 },
  ] as any;

  // Fila 1: Encabezado institucional
  ws.mergeCells('A1:K1');
  const t1 = ws.getCell('A1');
  t1.value = 'CRÉDITOS DEL SUR';
  t1.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
  t1.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 32;

  // Fila 2: Nombre del reporte
  ws.mergeCells('A2:K2');
  const t2 = ws.getCell('A2');
  t2.value = 'REPORTE DE CUENTAS VENCIDAS';
  t2.font = { bold: true, size: 12, color: { argb: 'FF7C3AED' } };
  t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
  t2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;

  // Fila 3: Fecha y metadata
  ws.mergeCells('A3:E3');
  ws.getCell('A3').value = `Generado: ${new Date().toLocaleString('es-CO')}`;
  ws.getCell('A3').font = { size: 9, color: { argb: 'FF475569' } };
  ws.mergeCells('F3:K3');
  ws.getCell('F3').value = `Total registros: ${totales.totalRegistros}  |  Fecha: ${fecha}`;
  ws.getCell('F3').font = { size: 9, color: { argb: 'FF475569' } };
  ws.getCell('F3').alignment = { horizontal: 'right' };
  ws.getRow(3).height = 16;

  // Fila 4: Indicadores financieros en celdas individuales
  const kpis = [
    { label: 'Saldo Vencido Total', val: totales.totalVencido, fmt: '"$"#,##0' },
    { label: 'Monto Original',       val: totales.totalMontoOriginal, fmt: '"$"#,##0' },
    { label: 'Intereses de Mora',    val: totales.totalInteresesMora, fmt: '"$"#,##0' },
    { label: 'Promedio Días Venc.',  val: totales.diasPromedioVencimiento, fmt: '0' },
  ];
  for (let i = 0; i < kpis.length; i++) {
    const colLabel = i * 2 + 1;
    const colVal   = i * 2 + 2;
    if (colLabel > 11) break;
    const lCell = ws.getCell(4, colLabel);
    const vCell = ws.getCell(4, colVal);
    lCell.value = kpis[i].label;
    lCell.font = { bold: true, size: 8, color: { argb: 'FF64748B' } };
    vCell.value = kpis[i].val;
    vCell.numFmt = kpis[i].fmt;
    vCell.font = { bold: true, size: 9, color: { argb: 'FF7C3AED' } };
    vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
  }
  // Última KPI en K4
  const lK = ws.getCell('J4');
  lK.value = 'Días Promedio';
  lK.font = { bold: true, size: 8, color: { argb: 'FF64748B' } };
  const vK = ws.getCell('K4');
  vK.value = totales.diasPromedioVencimiento;
  vK.font = { bold: true, size: 9, color: { argb: 'FF7C3AED' } };
  vK.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
  ws.getRow(4).height = 18;

  // Fila 5: Encabezados de tabla
  const headers = ['N° Préstamo','Cliente','Documento','Fecha Vencim.','Días Vencidos',
    'Saldo Pendiente','Monto Original','Intereses Mora','Nivel Riesgo','Ruta','Estado'];
  const hRow = ws.getRow(5);
  headers.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    appHeader(cell, 'FF7C3AED');
  });
  hRow.height = 22;
  ws.autoFilter = { from: 'A5', to: 'K5' };

  // Datos
  const riesgoColor: Record<string, string> = {
    ROJO: 'FFFECACA', AMARILLO: 'FFFEF9C3',
    LISTA_NEGRA: 'FFFFE4E6', VERDE: 'FFDCFCE7',
  };
  filas.forEach((fila, idx) => {
    const row = ws.addRow([
      fila.numeroPrestamo,
      fila.cliente,
      fila.documento,
      fila.fechaVencimiento,
      fila.diasVencidos,
      fila.saldoPendiente,
      fila.montoOriginal,
      fila.interesesMora,
      fila.nivelRiesgo,
      fila.ruta,
      fila.estado || '',
    ]);
    row.height = 18;
    const esPar = idx % 2 === 0;
    row.eachCell(cell => appRow(cell, esPar));

    // Formatos moneda
    row.getCell(6).numFmt = '"$"#,##0';
    row.getCell(7).numFmt = '"$"#,##0';
    row.getCell(8).numFmt = '"$"#,##0';

    // Alineación centrada para números
    [5, 9].forEach(c => row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' });
    [4].forEach(c => row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' });

    // Color por nivel de riesgo
    const bg = riesgoColor[fila.nivelRiesgo?.toUpperCase() || ''];
    if (bg) {
      row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    }

    // Resaltar días vencidos altos
    if (fila.diasVencidos > 90) {
      row.getCell(5).font = { bold: true, color: { argb: 'FFDC2626' } };
    }
  });

  // Fila total
  ws.addRow([]);
  const totRow = ws.addRow([
    `TOTALES — ${totales.totalRegistros} cuentas vencidas`,
    '', '', '',
    `Días prom: ${totales.diasPromedioVencimiento}`,
    totales.totalVencido,
    totales.totalMontoOriginal,
    totales.totalInteresesMora,
    '', '', '',
  ]);
  totRow.height = 20;
  totRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1B4B' } };
  });
  totRow.getCell(6).numFmt = '"$"#,##0';
  totRow.getCell(7).numFmt = '"$"#,##0';
  totRow.getCell(8).numFmt = '"$"#,##0';

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer as ArrayBuffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `cuentas-vencidas-${fecha}.xlsx`,
  };
}

// ─── Generador PDF ────────────────────────────────────────────────────────────

export async function generarPDFVencidas(
  filas: VencidasRow[],
  totales: VencidasTotales,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  const PURPLE = '#7C3AED';

  const drawHeader = () => {
    doc.rect(0, 0, doc.page.width, 50).fill(PURPLE);
    doc.fontSize(16).font('Helvetica-Bold').fillColor('white')
      .text('CRÉDITOS DEL SUR', 30, 10);
    doc.fontSize(10).font('Helvetica').fillColor('white')
      .text('REPORTE DE CUENTAS VENCIDAS', 30, 30);
    doc.fontSize(8).fillColor('white')
      .text(`Generado: ${new Date().toLocaleString('es-CO')}`,
        0, 36, { align: 'right', width: doc.page.width - 30 });

    const metW = (doc.page.width - 60) / 4;
    const mets = [
      { label: 'Saldo Vencido', val: `$${totales.totalVencido.toLocaleString('es-CO')}` },
      { label: 'Monto Original', val: `$${totales.totalMontoOriginal.toLocaleString('es-CO')}` },
      { label: 'Intereses Mora', val: `$${totales.totalInteresesMora.toLocaleString('es-CO')}` },
      { label: 'Días Prom.', val: `${totales.diasPromedioVencimiento}d` },
    ];
    const metY = 58;
    mets.forEach((m, i) => {
      const mx = 30 + i * (metW + 4);
      doc.rect(mx, metY, metW, 26).fill('#5B21B6');
      doc.fontSize(7).font('Helvetica').fillColor('white').text(m.label, mx + 4, metY + 3, { width: metW - 8 });
      doc.fontSize(10).font('Helvetica-Bold').fillColor('white').text(m.val, mx + 4, metY + 12, { width: metW - 8 });
    });
    return metY + 34;
  };

  const cols = [
    { label: 'N° Préstamo', width: 78 },
    { label: 'Cliente',      width: 110 },
    { label: 'Fecha Venc.',  width: 62 },
    { label: 'Días Venc.',   width: 55 },
    { label: 'Saldo Pend.',  width: 80 },
    { label: 'Mto. Orig.',   width: 80 },
    { label: 'Int. Mora',    width: 70 },
    { label: 'Riesgo',       width: 55 },
    { label: 'Ruta',         width: 85 },
  ];
  const tableLeft = 30;
  const rowH = 16;
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);

  const drawTableHeader = (y: number): number => {
    doc.rect(tableLeft, y, tableWidth, 18).fill(PURPLE);
    let x = tableLeft;
    doc.fontSize(7).font('Helvetica-Bold').fillColor('white');
    cols.forEach(col => {
      doc.text(col.label, x + 2, y + 5, { width: col.width - 4, align: 'center' });
      x += col.width;
    });
    return y + 18;
  };

  let y = drawHeader();
  y = drawTableHeader(y);

  doc.font('Helvetica').fontSize(7);
  const riesgoColors: Record<string, string> = {
    ROJO: '#FEF2F2', AMARILLO: '#FEFCE8',
    LISTA_NEGRA: '#FFF1F2', VERDE: '#F0FDF4',
  };

  filas.forEach((fila, i) => {
    if (y > 520) {
      doc.addPage();
      y = drawHeader();
      y = drawTableHeader(y);
      doc.font('Helvetica').fontSize(7);
    }
    const bg = riesgoColors[fila.nivelRiesgo?.toUpperCase() || ''] || (i % 2 === 0 ? '#F8FAFC' : 'white');
    doc.rect(tableLeft, y, tableWidth, rowH).fill(bg);
    doc.fillColor('black');

    let x = tableLeft;
    [
      fila.numeroPrestamo || '',
      (fila.cliente || '').substring(0, 22),
      fila.fechaVencimiento || '',
      String(fila.diasVencidos || 0),
      `$${(fila.saldoPendiente || 0).toLocaleString('es-CO')}`,
      `$${(fila.montoOriginal || 0).toLocaleString('es-CO')}`,
      `$${(fila.interesesMora || 0).toLocaleString('es-CO')}`,
      fila.nivelRiesgo || '',
      (fila.ruta || '').substring(0, 14),
    ].forEach((val, ci) => {
      const isNum = ci >= 3 && ci <= 6;
      doc.text(val, x + 2, y + 4, { width: cols[ci].width - 4, align: isNum ? 'right' : 'left' });
      x += cols[ci].width;
    });
    y += rowH;
  });

  // Totales
  y += 4;
  doc.rect(tableLeft, y, tableWidth, 18).fill('#1E1B4B');
  doc.fontSize(7).font('Helvetica-Bold').fillColor('white');
  let x = tableLeft;
  const totData = [
    `TOTALES (${totales.totalRegistros})`, '',
    '', '',
    `$${totales.totalVencido.toLocaleString('es-CO')}`,
    `$${totales.totalMontoOriginal.toLocaleString('es-CO')}`,
    `$${totales.totalInteresesMora.toLocaleString('es-CO')}`,
    '', '',
  ];
  totData.forEach((v, ci) => {
    if (ci < cols.length) {
      const isNum = ci >= 4 && ci <= 6;
      doc.text(v, x + 2, y + 5, { width: cols[ci].width - 4, align: isNum ? 'right' : 'left' });
      x += cols[ci].width;
    }
  });

  doc.end();
  const buffer = await new Promise<Buffer>(resolve => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });

  return {
    data: buffer,
    contentType: 'application/pdf',
    filename: `cuentas-vencidas-${fecha}.pdf`,
  };
}
