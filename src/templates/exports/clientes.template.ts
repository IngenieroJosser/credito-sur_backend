/**
 * ============================================================================
 * TEMPLATE: LISTADO DE CLIENTES
 * ============================================================================
 * Usado en: clients.service.ts → exportarClientes()
 * Endpoint: GET /clients/export?format=excel|pdf
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ClienteExportRow {
  codigo: string;
  nombres: string;
  apellidos: string;
  dni: string;
  telefono: string;
  correo: string | null;
  direccion: string | null;
  nivelRiesgo: string;
  estadoAprobacion: string;
  prestamosActivos: number;
  montoTotal: number;
  montoMora: number;
  rutaNombre: string;
  creadoEn: string | Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

const RISGO_COLOR: Record<string, string> = {
  VERDE: 'FF16a34a',
  AMARILLO: 'FFca8a04',
  ROJO: 'FFdc2626',
  LISTA_NEGRA: 'FF1e293b',
};

// ─── Generador Excel ──────────────────────────────────────────────────────────

export async function generarExcelClientes(
  filas: ClienteExportRow[],
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Clientes', {
    views: [{ state: 'frozen', ySplit: 4 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  ws.columns = [
    { header: 'Código', key: 'codigo', width: 12 },
    { header: 'Nombres', key: 'nombres', width: 22 },
    { header: 'Apellidos', key: 'apellidos', width: 22 },
    { header: 'Documento', key: 'dni', width: 14 },
    { header: 'Teléfono', key: 'telefono', width: 14 },
    { header: 'Correo', key: 'correo', width: 28 },
    { header: 'Dirección', key: 'direccion', width: 30 },
    { header: 'Nivel Riesgo', key: 'nivelRiesgo', width: 14 },
    { header: 'Estado', key: 'estadoAprobacion', width: 14 },
    { header: 'Créditos Activos', key: 'prestamosActivos', width: 16 },
    { header: 'Saldo Total', key: 'montoTotal', width: 18 },
    { header: 'Saldo en Mora', key: 'montoMora', width: 18 },
    { header: 'Ruta', key: 'rutaNombre', width: 20 },
    { header: 'Registrado', key: 'creadoEn', width: 18 },
  ] as any;

  // Título
  const titleRow = ws.addRow(['CRÉDITOS DEL SUR — LISTADO DE CLIENTES']);
  titleRow.font = { bold: true, size: 16, color: { argb: 'FF08557f' } };
  ws.mergeCells('A1:N1');

  // Subtítulo
  const subRow = ws.addRow([
    `Generado: ${new Date().toLocaleString('es-CO')}   |   Total clientes: ${filas.length}`,
  ]);
  subRow.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
  ws.mergeCells('A2:N2');

  ws.addRow([]);

  // Encabezados
  const headerRow = ws.getRow(4);
  ws.columns.forEach((col: any, i: number) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF08557f' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF0369a1' } },
    };
  });
  headerRow.height = 24;
  ws.autoFilter = { from: 'A4', to: 'N4' };

  // Datos
  filas.forEach((fila, idx) => {
    const row = ws.addRow({
      codigo: fila.codigo,
      nombres: fila.nombres,
      apellidos: fila.apellidos,
      dni: fila.dni,
      telefono: fila.telefono,
      correo: fila.correo || '',
      direccion: fila.direccion || '',
      nivelRiesgo: fila.nivelRiesgo,
      estadoAprobacion: fila.estadoAprobacion?.replace(/_/g, ' '),
      prestamosActivos: fila.prestamosActivos,
      montoTotal: COP(fila.montoTotal),
      montoMora: COP(fila.montoMora),
      rutaNombre: fila.rutaNombre || 'Sin ruta',
      creadoEn: fila.creadoEn ? new Date(fila.creadoEn).toLocaleDateString('es-CO') : '',
    });

    // Fila cebra
    if (idx % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
      });
    }

    // Color en celda de nivel de riesgo
    const riesgoCell = row.getCell(8);
    const color = RISGO_COLOR[fila.nivelRiesgo] || 'FF64748B';
    riesgoCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    riesgoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    riesgoCell.alignment = { horizontal: 'center' };

    // Mora en rojo si tiene
    if (fila.montoMora > 0) {
      row.getCell(12).font = { color: { argb: 'FFdc2626' }, bold: true };
    }
  });

  // Fila total
  ws.addRow([]);
  const totalRow = ws.addRow({
    codigo: `TOTAL: ${filas.length} clientes`,
    prestamosActivos: filas.reduce((s, f) => s + f.prestamosActivos, 0),
    montoTotal: COP(filas.reduce((s, f) => s + f.montoTotal, 0)),
    montoMora: COP(filas.reduce((s, f) => s + f.montoMora, 0)),
  });
  totalRow.font = { bold: true };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer as ArrayBuffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `clientes-${fecha}.xlsx`,
  };
}

// ─── Generador PDF ────────────────────────────────────────────────────────────

export async function generarPDFClientes(
  filas: ClienteExportRow[],
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  // Encabezado
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#08557f')
    .text('Créditos del Sur — Listado de Clientes', { align: 'center' });
  doc.fontSize(9).font('Helvetica').fillColor('#64748b')
    .text(
      `Generado: ${new Date().toLocaleString('es-CO')}  |  Total clientes: ${filas.length}`,
      { align: 'center' },
    );
  doc.moveDown(0.5);

  const cols = [
    { label: 'Código', width: 55 },
    { label: 'Nombre Completo', width: 130 },
    { label: 'Documento', width: 75 },
    { label: 'Teléfono', width: 75 },
    { label: 'Nivel Riesgo', width: 70 },
    { label: 'Estado', width: 70 },
    { label: 'Créditos', width: 55 },
    { label: 'Saldo Total', width: 90 },
    { label: 'En Mora', width: 90 },
    { label: 'Ruta', width: 72 },
  ];

  const tableLeft = 30;
  const rowH = 16;
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);
  let y = doc.y + 5;

  const drawHeader = () => {
    doc.fontSize(7).font('Helvetica-Bold');
    doc.rect(tableLeft, y, tableWidth, rowH).fill('#08557f');
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
      doc.rect(tableLeft, y, tableWidth, rowH).fill('#F0F9FF');
      doc.fillColor('black');
    }

    let x = tableLeft;
    [
      fila.codigo,
      `${fila.nombres} ${fila.apellidos}`.substring(0, 26),
      fila.dni,
      fila.telefono,
      fila.nivelRiesgo,
      fila.estadoAprobacion?.replace(/_/g, ' '),
      String(fila.prestamosActivos),
      COP(fila.montoTotal),
      COP(fila.montoMora),
      (fila.rutaNombre || 'Sin ruta').substring(0, 14),
    ].forEach((val, ci) => {
      doc.fillColor(ci === 8 && fila.montoMora > 0 ? '#dc2626' : 'black');
      doc.text(val, x + 2, y + 4, { width: cols[ci].width - 4 });
      x += cols[ci].width;
    });
    y += rowH;
  });

  // Totales
  doc.moveDown(0.5);
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#08557f')
    .text(
      `Total clientes: ${filas.length}   |   Saldo total: ${COP(filas.reduce((s, f) => s + f.montoTotal, 0))}   |   En mora: ${COP(filas.reduce((s, f) => s + f.montoMora, 0))}`,
      { align: 'right' },
    );

  doc.end();
  const buffer = await new Promise<Buffer>(resolve => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });

  return {
    data: buffer,
    contentType: 'application/pdf',
    filename: `clientes-${fecha}.pdf`,
  };
}
