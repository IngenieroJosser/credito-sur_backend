/**
 * ============================================================================
 * TEMPLATE: HISTORIAL DE PAGOS
 * ============================================================================
 * Usado en: payments.service.ts → exportPayments()
 * Genera reporte de pagos recibidos en el período con formato profesional.
 * Inspirado en el modelo de Estado de Cuentas Diarias Ruta de referencia.
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface PagoRow {
  fecha: Date | string;
  numeroPago: string;
  cliente: string;
  documento: string;
  numeroPrestamo: string;
  montoTotal: number;
  metodoPago: string;
  cobrador: string;
  capitalPagado?: number;     // Capital amortizado en este pago
  interesPagado?: number;     // Interés cobrado en este pago
  moraPagada?: number;        // Mora cobrada en este pago
  esAbono: boolean;           // true = abono parcial, false = cuota completa (§119 propuesta)
  comentario?: string;        // Comentario por cuota (§5.5 propuesta)
  origenCaja?: string;        // Caja de cobrador o caja principal (§4.5 propuesta)
}

export interface PagosTotales {
  totalRecaudado: number;
  totalPagos: number;
  totalCapital?: number;
  totalIntereses?: number;
  totalMora?: number;
  totalAbonos?: number;         // Suma de pagos que son abonos parciales
  cantidadAbonos?: number;      // Cuántos pagos son abonos
  cantidadCuotasCompletas?: number; // Cuántos son cuotas completas
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

const VERDE       = 'FF059669';
const VERDE_CLARO = 'FFF0FDF4';
const GRIS        = 'FF1E293B';

function hdr(cell: ExcelJS.Cell, bg: string): void {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.border = {
    bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
    right:  { style: 'thin',   color: { argb: 'FFFFFFFF' } },
  };
}

function dataRow(cell: ExcelJS.Cell, par: boolean): void {
  if (par) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  cell.border = {
    bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
    right:  { style: 'hair', color: { argb: 'FFE2E8F0' } },
  };
  cell.alignment = { vertical: 'middle' };
}

function fmtFecha(f: Date | string): string {
  if (!f) return '';
  const d = f instanceof Date ? f : new Date(f);
  return isNaN(d.getTime()) ? String(f) : d.toLocaleDateString('es-CO');
}

// ─── Generador Excel ──────────────────────────────────────────────────────────

export async function generarExcelPagos(
  filas: PagoRow[],
  totales: PagosTotales,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  workbook.created = new Date();

  // ── Hoja 1: Detalle de pagos ──────────────────────────────────────────────
  const ws = workbook.addWorksheet('Historial de Pagos', {
    views: [{ state: 'frozen', ySplit: 5 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  const hasMoney = (totales.totalCapital ?? 0) > 0 || (totales.totalIntereses ?? 0) > 0;

  ws.columns = [
    { key: 'fecha',         width: 14 },
    { key: 'numeroPago',    width: 14 },
    { key: 'numeroPrest',   width: 17 },
    { key: 'cliente',       width: 30 },
    { key: 'documento',     width: 13 },
    { key: 'tipoPago',      width: 13 },  // ABONO / CUOTA
    { key: 'monto',         width: 16 },
    { key: 'capital',       width: 16 },
    { key: 'interes',       width: 16 },
    { key: 'mora',          width: 16 },
    { key: 'metodo',        width: 14 },
    { key: 'cobrador',      width: 22 },
    { key: 'comentario',    width: 30 },
  ] as any;
  const numCols = 13;
  const lastCol = 'M';

  // Fila 1 — Encabezado corporativo
  ws.mergeCells(`A1:${lastCol}1`);
  const h1 = ws.getCell('A1');
  h1.value = 'CRÉDITOS DEL SUR';
  h1.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  h1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } };
  h1.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 32;

  // Fila 2 — Nombre del reporte
  ws.mergeCells(`A2:${lastCol}2`);
  const h2 = ws.getCell('A2');
  h2.value = 'HISTORIAL DE PAGOS RECIBIDOS';
  h2.font = { bold: true, size: 12, color: { argb: VERDE } };
  h2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_CLARO } };
  h2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;

  // Fila 3 — Metadata
  ws.mergeCells('A3:E3');
  ws.getCell('A3').value = `Generado: ${new Date().toLocaleString('es-CO')}`;
  ws.getCell('A3').font = { size: 9, color: { argb: 'FF475569' } };
  ws.mergeCells('F3:K3');
  ws.getCell('F3').value = `Total registros: ${totales.totalPagos}  |  Fecha: ${fecha}`;
  ws.getCell('F3').font = { size: 9, color: { argb: 'FF475569' } };
  ws.getCell('F3').alignment = { horizontal: 'right' };
  ws.getRow(3).height = 16;

  // Fila 4 — KPIs financieros
  const kpis = [
    ['Total Recaudado', totales.totalRecaudado],
    ['Total Capital',   totales.totalCapital ?? 0],
    ['Total Intereses', totales.totalIntereses ?? 0],
    ['Total Mora',      totales.totalMora ?? 0],
  ];
  kpis.forEach(([label, val], i) => {
    const col = i * 2 + 1;
    if (col + 1 > 13) return;
    const lc = ws.getCell(4, col);
    const vc = ws.getCell(4, col + 1);
    lc.value = label;
    lc.font = { bold: true, size: 8, color: { argb: 'FF64748B' } };
    vc.value = val as number;
    vc.numFmt = '"$"#,##0';
    vc.font = { bold: true, size: 9, color: { argb: VERDE } };
    vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_CLARO } };
  });
  ws.getCell('K4').value = `Abonos: ${totales.cantidadAbonos ?? 0} / Cuotas: ${totales.cantidadCuotasCompletas ?? 0}`;
  ws.getCell('K4').font = { bold: true, size: 8, color: { argb: VERDE } };
  ws.mergeCells('K4:M4');
  ws.getRow(4).height = 18;

  // Fila 5 — Encabezados de tabla
  const headers = ['Fecha','N° Pago','N° Préstamo','Cliente','Documento',
    'Tipo','Monto Total','Capital','Interés','Mora','Método','Cobrador','Comentario'];
  const hRow = ws.getRow(5);
  headers.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    hdr(cell, VERDE);
  });
  hRow.height = 22;
  ws.autoFilter = { from: 'A5', to: `${lastCol}5` };

  // Datos
  filas.forEach((fila, idx) => {
    const tipoPago = fila.esAbono ? 'ABONO' : 'CUOTA';
    const row = ws.addRow([
      fmtFecha(fila.fecha),
      fila.numeroPago,
      fila.numeroPrestamo,
      fila.cliente,
      fila.documento,
      tipoPago,
      fila.montoTotal,
      fila.capitalPagado ?? 0,
      fila.interesPagado ?? 0,
      fila.moraPagada ?? 0,
      fila.metodoPago,
      fila.cobrador,
      fila.comentario || '',
    ]);
    row.height = 18;
    const par = idx % 2 === 0;
    row.eachCell(cell => dataRow(cell, par));

    // Resaltar abonos en amarillo claro
    if (fila.esAbono) {
      row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
      row.getCell(6).font = { bold: true, color: { argb: 'FF854D0E' } };
    } else {
      row.getCell(6).font = { color: { argb: 'FF166534' } };
    }

    // Formato moneda
    [7, 8, 9, 10].forEach(c => {
      row.getCell(c).numFmt = '"$"#,##0';
      row.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    // Resaltar pagos grandes
    if (fila.montoTotal > 500000) {
      row.getCell(7).font = { bold: true, color: { argb: VERDE } };
    }
  });

  // Fila de totales
  ws.addRow([]);
  const totRow = ws.addRow([
    `TOTALES — ${totales.totalPagos} pagos`,
    '', '',
    '', '',
    `Abonos: ${totales.cantidadAbonos ?? 0}`,
    totales.totalRecaudado,
    totales.totalCapital ?? 0,
    totales.totalIntereses ?? 0,
    totales.totalMora ?? 0,
    '', '', '',
  ]);
  totRow.height = 20;
  totRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } };
  });
  [7, 8, 9, 10].forEach(c => {
    totRow.getCell(c).numFmt = '"$"#,##0';
    totRow.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
  });

  // ── Hoja 2: Resumen por cobrador ──────────────────────────────────────────
  const ws2 = workbook.addWorksheet('Por Cobrador');
  ws2.columns = [
    { key: 'cobrador', width: 28 },
    { key: 'cantidad', width: 12 },
    { key: 'monto',    width: 20 },
  ] as any;

  ws2.mergeCells('A1:C1');
  const ws2T = ws2.getCell('A1');
  ws2T.value = 'Recaudo por Cobrador';
  ws2T.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  ws2T.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } };
  ws2T.alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(1).height = 26;
  ws2.addRow([]);

  const ws2H = ws2.getRow(3);
  ['Cobrador','Pagos Registrados','Monto Recaudado'].forEach((label, i) => {
    const cell = ws2H.getCell(i + 1);
    cell.value = label;
    hdr(cell, VERDE);
  });
  ws2H.height = 20;

  const porCobrador: Record<string, { cantidad: number; monto: number }> = {};
  filas.forEach(f => {
    const k = f.cobrador || 'Sin asignar';
    if (!porCobrador[k]) porCobrador[k] = { cantidad: 0, monto: 0 };
    porCobrador[k].cantidad++;
    porCobrador[k].monto += f.montoTotal || 0;
  });

  Object.entries(porCobrador)
    .sort((a, b) => b[1].monto - a[1].monto)
    .forEach(([cobrador, datos], idx) => {
      const row = ws2.addRow([cobrador, datos.cantidad, datos.monto]);
      row.height = 18;
      if (idx % 2 === 0) row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
      row.getCell(3).numFmt = '"$"#,##0';
      row.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    });

  // Sub-total cobrador
  ws2.addRow([]);
  const ct = ws2.addRow(['TOTAL', filas.length, totales.totalRecaudado]);
  ct.height = 18;
  ct.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } };
  });
  ct.getCell(3).numFmt = '"$"#,##0';

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer as ArrayBuffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `historial-pagos-${fecha}.xlsx`,
  };
}

// ─── Generador PDF ────────────────────────────────────────────────────────────

export async function generarPDFPagos(
  filas: PagoRow[],
  totales: PagosTotales,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  const fs = require('fs');
  const path = require('path');
  const drawWatermark = () => {
    try {
      const pProd = path.join(process.cwd(), 'dist/assets/logo.png');
      const pDev = path.join(process.cwd(), 'src/assets/logo.png');
      const logoPath = fs.existsSync(pProd) ? pProd : (fs.existsSync(pDev) ? pDev : null);
      if (logoPath) {
        doc.save();
        doc.opacity(0.08);
        doc.image(logoPath, (doc.page.width - 300) / 2, (doc.page.height - 300) / 2, { width: 300 });
        doc.restore();
      }
    } catch(e) {}
  };

  const GREEN = '#004F7B'; // Usamos AZUL pero dejamos val GREEN para no romper logic

  const drawPageHeader = (): number => {
    doc.rect(0, 0, doc.page.width, 50).fill(GREEN);
    doc.fontSize(16).font('Helvetica-Bold').fillColor('white')
      .text('CRÉDITOS DEL SUR', 30, 10);
    doc.fontSize(10).font('Helvetica').fillColor('white')
      .text('HISTORIAL DE PAGOS RECIBIDOS', 30, 30);
    doc.fontSize(8).fillColor('white')
      .text(`Fecha: ${fecha}   |   Generado: ${new Date().toLocaleString('es-CO')}`,
        0, 36, { align: 'right', width: doc.page.width - 30 });

    const metY = 58;
    const metW = (doc.page.width - 60) / 4;
    [
      { label: 'TOTAL RECAUDADO', val: `$${totales.totalRecaudado.toLocaleString('es-CO')}` },
      { label: 'TOTAL CAPITAL',   val: `$${(totales.totalCapital ?? 0).toLocaleString('es-CO')}` },
      { label: 'TOTAL INTERESES', val: `$${(totales.totalIntereses ?? 0).toLocaleString('es-CO')}` },
      { label: 'TOTAL MORA',      val: `$${(totales.totalMora ?? 0).toLocaleString('es-CO')}` },
    ].forEach((m, i) => {
      const mx = 30 + i * (metW + 4);
      doc.rect(mx, metY, metW, 26).fill('#047857');
      doc.fontSize(7).font('Helvetica').fillColor('white').text(m.label, mx + 4, metY + 3, { width: metW - 8 });
      doc.fontSize(10).font('Helvetica-Bold').fillColor('white').text(m.val, mx + 4, metY + 13, { width: metW - 8 });
    });
    return metY + 34;
  };

  const cols = [
    { label: 'Fecha',       width: 62 },
    { label: 'N° Pago',    width: 62 },
    { label: 'N° Préstamo',width: 78 },
    { label: 'Cliente',    width: 110 },
    { label: 'Monto Total',width: 78 },
    { label: 'Capital',    width: 70 },
    { label: 'Interés',    width: 70 },
    { label: 'Método',     width: 62 },
    { label: 'Cobrador',   width: 85 },
  ];
  const tableLeft = 30;
  const rowH = 16;
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);

  const drawTableHeader = (y: number): number => {
    doc.rect(tableLeft, y, tableWidth, 18).fill(GREEN);
    let x = tableLeft;
    doc.fontSize(7).font('Helvetica-Bold').fillColor('white');
    cols.forEach(col => {
      doc.text(col.label, x + 2, y + 5, { width: col.width - 4, align: 'center' });
      x += col.width;
    });
    return y + 18;
  };

  drawWatermark();
  let y = drawPageHeader();
  y = drawTableHeader(y);
  doc.font('Helvetica').fontSize(7);

  filas.forEach((fila, i) => {
    if (y > 520) {
      doc.addPage();
      drawWatermark();
      y = drawPageHeader();
      y = drawTableHeader(y);
      doc.font('Helvetica').fontSize(7);
    }
    const bg = i % 2 === 0 ? '#F0FDF4' : 'white';
    doc.rect(tableLeft, y, tableWidth, rowH).fill(bg);
    doc.fillColor('black');

    let x = tableLeft;
    [
      fmtFecha(fila.fecha),
      fila.numeroPago || '',
      fila.numeroPrestamo || '',
      (fila.cliente || '').substring(0, 22),
      `$${(fila.montoTotal || 0).toLocaleString('es-CO')}`,
      `$${(fila.capitalPagado || 0).toLocaleString('es-CO')}`,
      `$${(fila.interesPagado || 0).toLocaleString('es-CO')}`,
      fila.metodoPago || '',
      (fila.cobrador || '').substring(0, 14),
    ].forEach((val, ci) => {
      const align = ci >= 4 && ci <= 6 ? 'right' : 'left';
      doc.text(val, x + 2, y + 4, { width: cols[ci].width - 4, align });
      x += cols[ci].width;
    });
    y += rowH;
  });

  // Totales
  y += 4;
  doc.rect(tableLeft, y, tableWidth, 18).fill('#1E293B');
  doc.fontSize(7).font('Helvetica-Bold').fillColor('white');
  let x = tableLeft;
  [
    `TOTALES (${totales.totalPagos} pagos)`, '', '',
    '',
    `$${totales.totalRecaudado.toLocaleString('es-CO')}`,
    `$${(totales.totalCapital ?? 0).toLocaleString('es-CO')}`,
    `$${(totales.totalIntereses ?? 0).toLocaleString('es-CO')}`,
    '', '',
  ].forEach((v, ci) => {
    if (ci < cols.length) {
      const align = ci >= 4 && ci <= 6 ? 'right' : 'left';
      doc.text(v, x + 2, y + 5, { width: cols[ci].width - 4, align });
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
    filename: `historial-pagos-${fecha}.pdf`,
  };
}
