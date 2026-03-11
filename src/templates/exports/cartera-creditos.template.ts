/**
 * ============================================================================
 * TEMPLATE: CARTERA DE CRÉDITOS
 * ============================================================================
 * Usado en: loans.service.ts → exportLoans()
 * Endpoint: GET /loans/export?format=excel|pdf
 *
 * Recibe los datos ya procesados desde el servicio y genera el documento.
 * El servicio solo consulta la BD; este archivo genera el archivo descargable.
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

// ─── Tipos de datos esperados ────────────────────────────────────────────────

export interface CarteraRow {
  numeroPrestamo: string;
  cliente: string;
  dni: string;
  producto: string;
  estado: string;
  montoTotal: number;
  montoPendiente: number;
  montoPagado: number;
  mora: number;
  cuotasPagadas: number;
  cuotasTotales: number;
  progreso: number;
  riesgo: string;
  ruta: string;
  fechaInicio: Date | string;
  fechaFin: Date | string;
}

export interface CarteraTotales {
  montoTotal: number;
  montoPendiente: number;
  mora: number;
}

// ─── Constantes de estilo ─────────────────────────────────────────────────────

const HEADER_COLOR = 'FF08557F';
const ALT_ROW_COLOR = 'FFF8FAFC';
const PDF_HEADER_COLOR = '#08557F';
const PDF_ALT_ROW_COLOR = '#F8FAFC';

// ─── Generador Excel ──────────────────────────────────────────────────────────

export async function generarExcelCartera(
  filas: CarteraRow[],
  totales: CarteraTotales,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Cartera de Créditos', {
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  // Columnas
  ws.columns = [
    { header: 'N° Préstamo', key: 'numeroPrestamo', width: 18 },
    { header: 'Cliente', key: 'cliente', width: 30 },
    { header: 'Cédula', key: 'dni', width: 15 },
    { header: 'Producto', key: 'producto', width: 22 },
    { header: 'Estado', key: 'estado', width: 15 },
    { header: 'Monto Total', key: 'montoTotal', width: 18 },
    { header: 'Pendiente', key: 'montoPendiente', width: 18 },
    { header: 'Pagado', key: 'montoPagado', width: 18 },
    { header: 'Mora', key: 'mora', width: 15 },
    { header: 'Cuotas Pag.', key: 'cuotasPagadas', width: 13 },
    { header: 'Cuotas Tot.', key: 'cuotasTotales', width: 13 },
    { header: 'Progreso %', key: 'progreso', width: 12 },
    { header: 'Riesgo', key: 'riesgo', width: 12 },
    { header: 'Ruta', key: 'ruta', width: 18 },
    { header: 'Fecha Inicio', key: 'fechaInicio', width: 14 },
    { header: 'Fecha Fin', key: 'fechaFin', width: 14 },
  ] as any;

  // Fila 1: Título
  const titleRow = ws.addRow(['CRÉDITOS DEL SUR — CARTERA DE CRÉDITOS']);
  titleRow.font = { bold: true, size: 16, color: { argb: 'FF08557F' } };
  ws.mergeCells('A1:P1');

  // Fila 2: Fecha de generación
  const subtitleRow = ws.addRow([`Generado: ${new Date().toLocaleString('es-CO')}   |   Total registros: ${filas.length}`]);
  subtitleRow.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
  ws.mergeCells('A2:P2');

  // Fila 3: Vacía
  ws.addRow([]);

  // Fila 4: Encabezados
  const headerRow = ws.getRow(4);
  ws.columns.forEach((col: any, i: number) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = (col as any).header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_COLOR } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF05405F' } },
    };
  });
  headerRow.height = 22;

  // Autofilter
  ws.autoFilter = { from: 'A4', to: 'P4' };

  // Filas de datos
  const colsMoneda = ['montoTotal', 'montoPendiente', 'montoPagado', 'mora'];
  filas.forEach((fila, idx) => {
    const row = ws.addRow({
      numeroPrestamo: fila.numeroPrestamo,
      cliente: fila.cliente,
      dni: fila.dni,
      producto: fila.producto,
      estado: fila.estado,
      montoTotal: fila.montoTotal,
      montoPendiente: fila.montoPendiente,
      montoPagado: fila.montoPagado,
      mora: fila.mora,
      cuotasPagadas: fila.cuotasPagadas,
      cuotasTotales: fila.cuotasTotales,
      progreso: fila.progreso,
      riesgo: fila.riesgo,
      ruta: fila.ruta,
      fechaInicio: fila.fechaInicio,
      fechaFin: fila.fechaFin,
    });

    // Filas alternas
    if (idx % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_ROW_COLOR } };
      });
    }

    // Formato moneda
    colsMoneda.forEach(key => {
      const colIdx = ws.columns.findIndex((c: any) => c.key === key) + 1;
      if (colIdx > 0) row.getCell(colIdx).numFmt = '#,##0';
    });

    // Formato porcentaje
    const progresoIdx = ws.columns.findIndex((c: any) => c.key === 'progreso') + 1;
    if (progresoIdx > 0) row.getCell(progresoIdx).numFmt = '0"%"';
  });

  // Fila de totales
  ws.addRow([]);
  const totalRow = ws.addRow({
    numeroPrestamo: 'TOTALES',
    montoTotal: totales.montoTotal,
    montoPendiente: totales.montoPendiente,
    mora: totales.mora,
  });
  totalRow.font = { bold: true };
  colsMoneda.forEach(key => {
    const colIdx = ws.columns.findIndex((c: any) => c.key === key) + 1;
    if (colIdx > 0) totalRow.getCell(colIdx).numFmt = '#,##0';
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer as ArrayBuffer),
    contentType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
    filename: `cartera-creditos-${fecha}.xlsm`,
  };
}

// ─── Generador PDF ────────────────────────────────────────────────────────────

export async function generarPDFCartera(
  filas: CarteraRow[],
  totales: CarteraTotales,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  // Encabezado
  doc.fontSize(16).font('Helvetica-Bold').fillColor(PDF_HEADER_COLOR)
    .text('Créditos del Sur — Cartera de Créditos', { align: 'center' });
  doc.fontSize(9).font('Helvetica').fillColor('#475569')
    .text(`Generado: ${new Date().toLocaleString('es-CO')}`, { align: 'center' });
  doc.moveDown(0.4);

  // Barra de estadísticas
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#1E293B');
  doc.text(
    `Total Registros: ${filas.length}  |  Capital Total: $${totales.montoTotal.toLocaleString('es-CO')}  |  Pendiente: $${totales.montoPendiente.toLocaleString('es-CO')}  |  Mora: $${totales.mora.toLocaleString('es-CO')}`,
    { align: 'center' },
  );
  doc.moveDown(0.5);

  // Tabla
  const cols = [
    { label: 'N° Préstamo', width: 80 },
    { label: 'Cliente', width: 130 },
    { label: 'Estado', width: 65 },
    { label: 'Monto Total', width: 85 },
    { label: 'Pendiente', width: 80 },
    { label: 'Mora', width: 65 },
    { label: 'Cuotas', width: 55 },
    { label: 'Progreso', width: 55 },
    { label: 'Ruta', width: 80 },
    { label: 'Fecha Inicio', width: 70 },
  ];

  const tableLeft = 30;
  const rowH = 16;
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);
  let y = doc.y + 5;

  // Header de tabla
  doc.fontSize(7).font('Helvetica-Bold');
  doc.rect(tableLeft, y, tableWidth, rowH).fill(PDF_HEADER_COLOR);
  let x = tableLeft;
  cols.forEach(col => {
    doc.fillColor('white').text(col.label, x + 2, y + 4, { width: col.width - 4, align: 'left' });
    x += col.width;
  });
  y += rowH;

  // Filas de datos
  doc.font('Helvetica').fontSize(7).fillColor('black');
  filas.forEach((fila, i) => {
    if (y > 540) {
      doc.addPage();
      y = 30;
      // Re-dibujar header en nueva página
      doc.fontSize(7).font('Helvetica-Bold');
      doc.rect(tableLeft, y, tableWidth, rowH).fill(PDF_HEADER_COLOR);
      x = tableLeft;
      cols.forEach(col => {
        doc.fillColor('white').text(col.label, x + 2, y + 4, { width: col.width - 4 });
        x += col.width;
      });
      y += rowH;
      doc.font('Helvetica').fontSize(7).fillColor('black');
    }

    if (i % 2 === 0) {
      doc.rect(tableLeft, y, tableWidth, rowH).fill(PDF_ALT_ROW_COLOR);
      doc.fillColor('black');
    }

    const fechaStr = fila.fechaInicio
      ? new Date(fila.fechaInicio).toLocaleDateString('es-CO')
      : '';

    x = tableLeft;
    [
      fila.numeroPrestamo || '',
      (fila.cliente || '').substring(0, 22),
      fila.estado || '',
      `$${(fila.montoTotal || 0).toLocaleString('es-CO')}`,
      `$${(fila.montoPendiente || 0).toLocaleString('es-CO')}`,
      `$${(fila.mora || 0).toLocaleString('es-CO')}`,
      `${fila.cuotasPagadas}/${fila.cuotasTotales}`,
      `${fila.progreso}%`,
      (fila.ruta || '').substring(0, 14),
      fechaStr,
    ].forEach((val, ci) => {
      doc.text(val, x + 2, y + 4, { width: cols[ci].width - 4, align: 'left' });
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
    filename: `cartera-creditos-${fecha}.pdf`,
  };
}
