/**
 * ============================================================================
 * TEMPLATE: LOG DE AUDITORÍA
 * ============================================================================
 * Usado en: audit.service.ts → exportAuditLog()
 * Endpoint: GET /audit/export?format=excel|pdf
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AuditoriaRow {
  fecha: Date | string;
  usuario: string;
  accion: string;
  entidad: string;
  entidadId: string;
  datosAnteriores?: any;
  datosNuevos?: any;
}

// ─── Generador Excel ──────────────────────────────────────────────────────────

export async function generarExcelAuditoria(
  filas: AuditoriaRow[],
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Log de Auditoría', {
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  ws.columns = [
    { header: 'Fecha', key: 'fecha', width: 22 },
    { header: 'Usuario', key: 'usuario', width: 28 },
    { header: 'Acción', key: 'accion', width: 24 },
    { header: 'Entidad', key: 'entidad', width: 18 },
    { header: 'ID Entidad', key: 'entidadId', width: 20 },
    { header: 'Datos Anteriores', key: 'datosAnteriores', width: 40 },
    { header: 'Datos Nuevos', key: 'datosNuevos', width: 40 },
  ] as any;

  // Título
  const titleRow = ws.addRow(['CRÉDITOS DEL SUR — LOG DE AUDITORÍA']);
  titleRow.font = { bold: true, size: 16, color: { argb: 'FF475569' } };
  ws.mergeCells('A1:G1');

  // Subtítulo
  const subRow = ws.addRow([`Generado: ${new Date().toLocaleString('es-CO')}   |   Total registros: ${filas.length}`]);
  subRow.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
  ws.mergeCells('A2:G2');

  ws.addRow([]);

  // Encabezados
  const headerRow = ws.getRow(4);
  ws.columns.forEach((col: any, i: number) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  headerRow.height = 22;
  ws.autoFilter = { from: 'A4', to: 'G4' };

  // Datos
  filas.forEach((fila, idx) => {
    const row = ws.addRow({
      fecha: fila.fecha ? new Date(fila.fecha).toLocaleString('es-CO') : '',
      usuario: fila.usuario || '',
      accion: fila.accion || '',
      entidad: fila.entidad || '',
      entidadId: fila.entidadId || '',
      datosAnteriores: fila.datosAnteriores
        ? JSON.stringify(fila.datosAnteriores).substring(0, 150)
        : '',
      datosNuevos: fila.datosNuevos
        ? JSON.stringify(fila.datosNuevos).substring(0, 150)
        : '',
    });

    if (idx % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });

  ws.addRow([]);
  const totalRow = ws.addRow({ fecha: `Total registros: ${filas.length}` });
  totalRow.font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer as ArrayBuffer),
    contentType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
    filename: `auditoria-${fecha}.xlsm`,
  };
}

// ─── Generador PDF ────────────────────────────────────────────────────────────

export async function generarPDFAuditoria(
  filas: AuditoriaRow[],
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  doc.fontSize(16).font('Helvetica-Bold').fillColor('#475569')
    .text('Créditos del Sur — Log de Auditoría', { align: 'center' });
  doc.fontSize(9).font('Helvetica').fillColor('#475569')
    .text(`Generado: ${new Date().toLocaleString('es-CO')}  |  Total registros: ${filas.length}`, { align: 'center' });
  doc.moveDown(0.5);

  const cols = [
    { label: 'Fecha', width: 100 },
    { label: 'Usuario', width: 110 },
    { label: 'Acción', width: 120 },
    { label: 'Entidad', width: 80 },
    { label: 'ID Entidad', width: 100 },
    { label: 'Detalle (Nuevo)', width: 210 },
  ];

  const tableLeft = 30;
  const rowH = 16;
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);
  let y = doc.y + 5;

  const drawHeader = () => {
    doc.fontSize(7).font('Helvetica-Bold');
    doc.rect(tableLeft, y, tableWidth, rowH).fill('#475569');
    let x = tableLeft;
    cols.forEach(col => {
      doc.fillColor('white').text(col.label, x + 2, y + 4, { width: col.width - 4 });
      x += col.width;
    });
    return y + rowH;
  };

  y = drawHeader();
  doc.font('Helvetica').fontSize(7).fillColor('black');

  filas.forEach((fila, i) => {
    if (y > 540) {
      doc.addPage();
      y = 30;
      y = drawHeader();
      doc.font('Helvetica').fontSize(7).fillColor('black');
    }

    if (i % 2 === 0) {
      doc.rect(tableLeft, y, tableWidth, rowH).fill('#F8FAFC');
      doc.fillColor('black');
    }

    const detalle = fila.datosNuevos
      ? JSON.stringify(fila.datosNuevos).substring(0, 50)
      : '';

    let x = tableLeft;
    [
      fila.fecha ? new Date(fila.fecha).toLocaleString('es-CO') : '',
      (fila.usuario || '').substring(0, 20),
      (fila.accion || '').substring(0, 22),
      fila.entidad || '',
      (fila.entidadId || '').substring(0, 16),
      detalle,
    ].forEach((val, ci) => {
      doc.text(val, x + 2, y + 4, { width: cols[ci].width - 4 });
      x += cols[ci].width;
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
    filename: `auditoria-${fecha}.pdf`,
  };
}
