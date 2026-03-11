/**
 * ============================================================================
 * TEMPLATE: REPORTE FINANCIERO
 * ============================================================================
 * Usado en: reports.service.ts → exportFinancialReport()
 * Endpoint: GET /reports/financial/export?format=excel|pdf
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface FinancieroResumen {
  ingresos: number;
  egresos: number;
  utilidad: number;
  margen: number;
}

export interface FinancieroMensual {
  mes: string;
  ingresos: number;
  egresos: number;
  utilidad: number;
}

export interface FinancieroGasto {
  categoria: string;
  monto: number;
}

// ─── Generador Excel ──────────────────────────────────────────────────────────

export async function generarExcelFinanciero(
  resumen: FinancieroResumen,
  evolucionMensual: FinancieroMensual[],
  distribucionGastos: FinancieroGasto[],
  fecha: string,
  startDate?: Date,
  endDate?: Date,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  workbook.created = new Date();

  const totalGastos = distribucionGastos.reduce((s, g) => s + g.monto, 0);
  const periodoStr = startDate && endDate
    ? `${startDate.toLocaleDateString('es-CO')} — ${endDate.toLocaleDateString('es-CO')}`
    : 'Período no definido';

  // ── Hoja 1: Resumen Financiero ──
  const ws1 = workbook.addWorksheet('Resumen Financiero');
  ws1.columns = [
    { header: 'Concepto', key: 'concepto', width: 28 },
    { header: 'Monto', key: 'monto', width: 22 },
    { header: 'Detalle', key: 'detalle', width: 25 },
  ] as any;

  const t1 = ws1.addRow(['CRÉDITOS DEL SUR — REPORTE FINANCIERO']);
  t1.font = { bold: true, size: 16, color: { argb: 'FF059669' } };
  ws1.mergeCells('A1:C1');

  const s1 = ws1.addRow([`Período: ${periodoStr}`]);
  s1.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
  ws1.mergeCells('A2:C2');

  ws1.addRow([]);

  const h1 = ws1.getRow(4);
  ws1.columns.forEach((col: any, i: number) => {
    const cell = h1.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  h1.height = 22;

  const items = [
    { concepto: 'Ingresos Totales', monto: resumen.ingresos, detalle: 'Pagos recibidos en el período' },
    { concepto: 'Egresos Totales', monto: resumen.egresos, detalle: 'Gastos aprobados en el período' },
    { concepto: 'Utilidad Neta', monto: resumen.utilidad, detalle: 'Ingresos − Egresos' },
    { concepto: 'Margen de Ganancia (%)', monto: resumen.margen, detalle: '(Utilidad / Ingresos) × 100' },
  ];

  items.forEach((item, idx) => {
    const row = ws1.addRow({ concepto: item.concepto, monto: item.monto, detalle: item.detalle });
    if (idx % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
      });
    }
    const montoCell = row.getCell(2);
    if (item.concepto.includes('%')) {
      montoCell.numFmt = '0.00"%"';
    } else {
      montoCell.numFmt = '#,##0';
    }
    // Utilidad negativa en rojo
    if (item.concepto === 'Utilidad Neta' && resumen.utilidad < 0) {
      montoCell.font = { bold: true, color: { argb: 'FFDC2626' } };
    }
  });

  // ── Hoja 2: Evolución Mensual ──
  const ws2 = workbook.addWorksheet('Evolución Mensual');
  ws2.columns = [
    { header: 'Mes', key: 'mes', width: 18 },
    { header: 'Ingresos', key: 'ingresos', width: 18 },
    { header: 'Egresos', key: 'egresos', width: 18 },
    { header: 'Utilidad', key: 'utilidad', width: 18 },
  ] as any;

  const t2 = ws2.addRow(['Evolución Mensual']);
  t2.font = { bold: true, size: 14, color: { argb: 'FF059669' } };
  ws2.mergeCells('A1:D1');

  ws2.addRow([]);

  const h2 = ws2.getRow(3);
  ws2.columns.forEach((col: any, i: number) => {
    const cell = h2.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    cell.alignment = { horizontal: 'center' };
  });
  h2.height = 20;

  evolucionMensual.forEach((m, idx) => {
    const row = ws2.addRow({ mes: m.mes, ingresos: m.ingresos, egresos: m.egresos, utilidad: m.utilidad });
    if (idx % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
      });
    }
    ['ingresos', 'egresos', 'utilidad'].forEach(key => {
      const colIdx = ws2.columns.findIndex((c: any) => c.key === key) + 1;
      if (colIdx > 0) row.getCell(colIdx).numFmt = '#,##0';
    });
  });

  // ── Hoja 3: Distribución de Gastos ──
  const ws3 = workbook.addWorksheet('Distribución Gastos');
  ws3.columns = [
    { header: 'Categoría', key: 'categoria', width: 28 },
    { header: 'Monto', key: 'monto', width: 18 },
    { header: 'Porcentaje', key: 'porcentaje', width: 16 },
  ] as any;

  const t3 = ws3.addRow(['Distribución de Gastos']);
  t3.font = { bold: true, size: 14, color: { argb: 'FF059669' } };
  ws3.mergeCells('A1:C1');

  ws3.addRow([]);

  const h3 = ws3.getRow(3);
  ws3.columns.forEach((col: any, i: number) => {
    const cell = h3.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    cell.alignment = { horizontal: 'center' };
  });

  distribucionGastos.forEach((g, idx) => {
    const pct = totalGastos > 0 ? ((g.monto / totalGastos) * 100).toFixed(1) : '0.0';
    const row = ws3.addRow({ categoria: g.categoria, monto: g.monto, porcentaje: `${pct}%` });
    if (idx % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
      });
    }
    row.getCell(2).numFmt = '#,##0';
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer as ArrayBuffer),
    contentType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
    filename: `reporte-financiero-${fecha}.xlsm`,
  };
}

// ─── Generador PDF ────────────────────────────────────────────────────────────

export async function generarPDFFinanciero(
  resumen: FinancieroResumen,
  evolucionMensual: FinancieroMensual[],
  distribucionGastos: FinancieroGasto[],
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const doc = new PDFDocument({ layout: 'portrait', size: 'LETTER', margin: 40 });
  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  const totalGastos = distribucionGastos.reduce((s, g) => s + g.monto, 0);

  // Encabezado
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#059669')
    .text('Créditos del Sur — Reporte Financiero', { align: 'center' });
  doc.fontSize(9).font('Helvetica').fillColor('#475569')
    .text(`Generado: ${new Date().toLocaleString('es-CO')}`, { align: 'center' });
  doc.moveDown(1);

  // ── Sección 1: Resumen ──
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#059669').text('Resumen del Período');
  doc.moveDown(0.3);

  const resumenCols = [{ l: 'Concepto', w: 200 }, { l: 'Monto', w: 180 }];
  let y = doc.y + 5;
  doc.fontSize(9).font('Helvetica-Bold');
  doc.rect(40, y, 380, 18).fill('#059669');
  let x = 40;
  resumenCols.forEach(c => { doc.fillColor('white').text(c.l, x + 4, y + 5, { width: c.w - 8 }); x += c.w; });
  y += 18;

  const resumenItems = [
    { concepto: 'Ingresos Totales', monto: `$${resumen.ingresos.toLocaleString('es-CO')}` },
    { concepto: 'Egresos Totales', monto: `$${resumen.egresos.toLocaleString('es-CO')}` },
    { concepto: 'Utilidad Neta', monto: `$${resumen.utilidad.toLocaleString('es-CO')}` },
    { concepto: 'Margen de Ganancia', monto: `${resumen.margen}%` },
  ];

  doc.font('Helvetica').fontSize(9).fillColor('black');
  resumenItems.forEach((item, i) => {
    if (i % 2 === 0) { doc.rect(40, y, 380, 18).fill('#F0FDF4'); doc.fillColor('black'); }
    x = 40;
    const color = item.concepto === 'Utilidad Neta' && resumen.utilidad < 0 ? '#DC2626' : 'black';
    doc.fillColor('black').text(item.concepto, x + 4, y + 5, { width: resumenCols[0].w - 8 });
    x += resumenCols[0].w;
    doc.fillColor(color).text(item.monto, x + 4, y + 5, { width: resumenCols[1].w - 8 });
    doc.fillColor('black');
    y += 18;
  });

  doc.y = y + 20;
  doc.moveDown(0.5);

  // ── Sección 2: Evolución Mensual ──
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#059669').text('Evolución Mensual');
  doc.moveDown(0.3);

  const mCols = [
    { l: 'Mes', w: 80 }, { l: 'Ingresos', w: 120 }, { l: 'Egresos', w: 120 }, { l: 'Utilidad', w: 120 },
  ];
  y = doc.y + 5;
  doc.fontSize(8).font('Helvetica-Bold');
  doc.rect(40, y, mCols.reduce((s, c) => s + c.w, 0), 16).fill('#059669');
  x = 40;
  mCols.forEach(c => { doc.fillColor('white').text(c.l, x + 2, y + 4, { width: c.w - 4 }); x += c.w; });
  y += 16;

  doc.font('Helvetica').fontSize(8).fillColor('black');
  evolucionMensual.forEach((m, i) => {
    if (y > 700) {
      doc.addPage();
      y = 40;
    }
    if (i % 2 === 0) { doc.rect(40, y, mCols.reduce((s, c) => s + c.w, 0), 16).fill('#F0FDF4'); doc.fillColor('black'); }
    x = 40;
    [m.mes, `$${m.ingresos.toLocaleString('es-CO')}`, `$${m.egresos.toLocaleString('es-CO')}`, `$${m.utilidad.toLocaleString('es-CO')}`]
      .forEach((v, ci) => { doc.text(v, x + 2, y + 4, { width: mCols[ci].w - 4 }); x += mCols[ci].w; });
    y += 16;
  });

  doc.y = y + 20;

  // ── Sección 3: Distribución de Gastos ──
  if (distribucionGastos.length > 0) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#059669').text('Distribución de Gastos');
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica').fillColor('#1E293B');
    distribucionGastos.forEach(g => {
      const pct = totalGastos > 0 ? ((g.monto / totalGastos) * 100).toFixed(1) : '0.0';
      doc.text(`• ${g.categoria}: $${g.monto.toLocaleString('es-CO')} (${pct}%)`);
    });
  }

  doc.end();
  const buffer = await new Promise<Buffer>(resolve => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });

  return {
    data: buffer,
    contentType: 'application/pdf',
    filename: `reporte-financiero-${fecha}.pdf`,
  };
}
