/**
 * ============================================================================
 * TEMPLATE: REPORTE CONTABLE
 * ============================================================================
 * Usado en: accounting.service.ts → exportAccountingReport()
 * Endpoint: GET /accounting/export?format=excel|pdf
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface CajaRow {
  nombre: string;
  codigo: string;
  tipo: string;
  responsable: string;
  ruta: string;
  saldo: number;
}

export interface TransaccionRow {
  fecha: Date | string;
  tipo: string;
  monto: number;
  descripcion: string;
  caja: string;
  usuario: string;
}

// ─── Generador Excel ──────────────────────────────────────────────────────────

export async function generarExcelContable(
  cajas: CajaRow[],
  transacciones: TransaccionRow[],
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  workbook.created = new Date();

  const totalSaldo = cajas.reduce((s, c) => s + c.saldo, 0);

  // ── Hoja 1: Estado de Cajas ──
  const ws1 = workbook.addWorksheet('Estado de Cajas');
  ws1.columns = [
    { header: 'Caja', key: 'nombre', width: 20 },
    { header: 'Código', key: 'codigo', width: 16 },
    { header: 'Tipo', key: 'tipo', width: 16 },
    { header: 'Responsable', key: 'responsable', width: 28 },
    { header: 'Ruta', key: 'ruta', width: 20 },
    { header: 'Saldo Actual', key: 'saldo', width: 18 },
  ] as any;

  const t1 = ws1.addRow(['CRÉDITOS DEL SUR — ESTADO DE CAJAS']);
  t1.font = { bold: true, size: 16, color: { argb: 'FF0369A1' } };
  ws1.mergeCells('A1:F1');

  const s1 = ws1.addRow([`Generado: ${new Date().toLocaleString('es-CO')}   |   Total cajas: ${cajas.length}`]);
  s1.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
  ws1.mergeCells('A2:F2');

  ws1.addRow([]);

  const h1 = ws1.getRow(4);
  ws1.columns.forEach((col: any, i: number) => {
    const cell = h1.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0369A1' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  h1.height = 22;
  ws1.autoFilter = { from: 'A4', to: 'F4' };

  cajas.forEach((caja, idx) => {
    const row = ws1.addRow({
      nombre: caja.nombre,
      codigo: caja.codigo,
      tipo: caja.tipo,
      responsable: caja.responsable,
      ruta: caja.ruta,
      saldo: caja.saldo,
    });

    if (idx % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
      });
    }

    row.getCell(6).numFmt = '#,##0';
  });

  ws1.addRow([]);
  const totalRow = ws1.addRow({ nombre: 'TOTAL SALDOS', saldo: totalSaldo });
  totalRow.font = { bold: true };
  totalRow.getCell(6).numFmt = '#,##0';

  // ── Hoja 2: Últimos Movimientos ──
  const ws2 = workbook.addWorksheet('Movimientos');
  ws2.columns = [
    { header: 'Fecha', key: 'fecha', width: 22 },
    { header: 'Tipo', key: 'tipo', width: 16 },
    { header: 'Monto', key: 'monto', width: 18 },
    { header: 'Descripción', key: 'descripcion', width: 38 },
    { header: 'Caja', key: 'caja', width: 20 },
    { header: 'Usuario', key: 'usuario', width: 25 },
  ] as any;

  const t2 = ws2.addRow(['Últimos Movimientos']);
  t2.font = { bold: true, size: 14, color: { argb: 'FF0369A1' } };
  ws2.mergeCells('A1:F1');

  ws2.addRow([]);

  const h2 = ws2.getRow(3);
  ws2.columns.forEach((col: any, i: number) => {
    const cell = h2.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0369A1' } };
    cell.alignment = { horizontal: 'center' };
  });
  h2.height = 20;

  transacciones.forEach((t, idx) => {
    const row = ws2.addRow({
      fecha: t.fecha ? new Date(t.fecha).toLocaleString('es-CO') : '',
      tipo: t.tipo,
      monto: t.monto,
      descripcion: t.descripcion || '',
      caja: t.caja,
      usuario: t.usuario,
    });

    if (idx % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
      });
    }

    row.getCell(3).numFmt = '#,##0';

    // Ingresos en verde, egresos en rojo
    const tipoCell = row.getCell(2);
    if (t.tipo === 'INGRESO') tipoCell.font = { color: { argb: 'FF059669' }, bold: true };
    else if (t.tipo === 'EGRESO') tipoCell.font = { color: { argb: 'FFDC2626' }, bold: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer as ArrayBuffer),
    contentType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
    filename: `reporte-contable-${fecha}.xlsm`,
  };
}

// ─── Generador PDF ────────────────────────────────────────────────────────────

export async function generarPDFContable(
  cajas: CajaRow[],
  transacciones: TransaccionRow[],
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  const totalSaldo = cajas.reduce((s, c) => s + c.saldo, 0);

  // Encabezado
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#0369A1')
    .text('Créditos del Sur — Reporte Contable', { align: 'center' });
  doc.fontSize(9).font('Helvetica').fillColor('#475569')
    .text(`Generado: ${new Date().toLocaleString('es-CO')}`, { align: 'center' });
  doc.moveDown(0.4);
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#1E293B');
  doc.text(`Total Cajas: ${cajas.length}  |  Saldo Total: $${totalSaldo.toLocaleString('es-CO')}`, { align: 'center' });
  doc.moveDown(0.5);

  // ── Tabla: Estado de Cajas ──
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#0369A1').text('Estado de Cajas');
  doc.moveDown(0.3);

  const cajaCols = [
    { label: 'Caja', width: 100 },
    { label: 'Código', width: 80 },
    { label: 'Tipo', width: 80 },
    { label: 'Responsable', width: 130 },
    { label: 'Ruta', width: 100 },
    { label: 'Saldo', width: 100 },
  ];

  const tableLeft = 30;
  const rowH = 16;
  const cajaTableWidth = cajaCols.reduce((s, c) => s + c.width, 0);
  let y = doc.y + 5;

  doc.fontSize(7).font('Helvetica-Bold');
  doc.rect(tableLeft, y, cajaTableWidth, rowH).fill('#0369A1');
  let x = tableLeft;
  cajaCols.forEach(c => { doc.fillColor('white').text(c.label, x + 2, y + 4, { width: c.width - 4 }); x += c.width; });
  y += rowH;

  doc.font('Helvetica').fontSize(7).fillColor('black');
  cajas.forEach((caja, i) => {
    if (i % 2 === 0) { doc.rect(tableLeft, y, cajaTableWidth, rowH).fill('#F0F9FF'); doc.fillColor('black'); }
    x = tableLeft;
    [
      caja.nombre, caja.codigo, caja.tipo, caja.responsable || 'Sin asignar',
      caja.ruta || 'N/A', `$${(caja.saldo || 0).toLocaleString('es-CO')}`,
    ].forEach((v, ci) => {
      doc.text(v, x + 2, y + 4, { width: cajaCols[ci].width - 4 });
      x += cajaCols[ci].width;
    });
    y += rowH;
  });

  // ── Tabla: Últimos Movimientos ──
  y += 20;
  doc.y = y;
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#0369A1').text('Últimos Movimientos');
  doc.moveDown(0.3);

  const movCols = [
    { label: 'Fecha', width: 110 },
    { label: 'Tipo', width: 80 },
    { label: 'Monto', width: 90 },
    { label: 'Descripción', width: 200 },
    { label: 'Caja', width: 100 },
    { label: 'Usuario', width: 110 },
  ];
  const movTableWidth = movCols.reduce((s, c) => s + c.width, 0);
  y = doc.y + 5;

  doc.fontSize(7).font('Helvetica-Bold');
  doc.rect(tableLeft, y, movTableWidth, rowH).fill('#0369A1');
  x = tableLeft;
  movCols.forEach(c => { doc.fillColor('white').text(c.label, x + 2, y + 4, { width: c.width - 4 }); x += c.width; });
  y += rowH;

  doc.font('Helvetica').fontSize(7).fillColor('black');
  transacciones.slice(0, 40).forEach((t, i) => {
    if (y > 540) { doc.addPage(); y = 30; }
    if (i % 2 === 0) { doc.rect(tableLeft, y, movTableWidth, rowH).fill('#F0F9FF'); doc.fillColor('black'); }
    x = tableLeft;
    [
      t.fecha ? new Date(t.fecha).toLocaleString('es-CO') : '',
      t.tipo,
      `$${(t.monto || 0).toLocaleString('es-CO')}`,
      (t.descripcion || '').substring(0, 35),
      t.caja || '',
      t.usuario || '',
    ].forEach((v, ci) => {
      doc.text(v, x + 2, y + 4, { width: movCols[ci].width - 4 });
      x += movCols[ci].width;
    });
    y += rowH;
  });

  doc.end();
  const buffer = await new Promise<Buffer>(resolve => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });

  return {
    data: buffer,
    contentType: 'application/pdf',
    filename: `reporte-contable-${fecha}.pdf`,
  };
}
