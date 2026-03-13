/**
 * ============================================================================
 * TEMPLATE: INVENTARIO / ARTÍCULOS
 * ============================================================================
 * Endpoint esperado: GET /inventory/export?format=excel|pdf
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

export interface InventarioRow {
  codigo: string;
  nombre: string;
  categoria: string;
  marca: string | null;
  modelo: string | null;
  costo: number;
  stock: number;
  stockMinimo: number;
  activo: boolean;
  creadoEn: Date | string;
}

export interface InventarioTotales {
  totalProductos: number;
  totalValorInventario: number;
  productosBajoStock: number;
}

const C = {
  AZUL_DARK: 'FF1A5F8A',
  AZUL_MED: 'FF2B7BB5',
  AZUL_PALE: 'FFEBF4FB',
  NAR_MED: 'FFF07A28',
  NAR_PALE: 'FFFEF3EC',
  BLANCO: 'FFFFFFFF',
  GRIS_TEXTO: 'FF1E293B',
  GRIS_MED: 'FF64748B',
  GRIS_CLARO: 'FFE2E8F0',
} as const;

function fmtFecha(f: Date | string): string {
  if (!f) return '';
  const d = f instanceof Date ? f : new Date(f);
  return isNaN(d.getTime()) ? String(f) : d.toLocaleDateString('es-CO');
}

function fmtCOP(v: number): string {
  return `$${(v || 0).toLocaleString('es-CO')}`;
}

function getLogoPath(): string | null {
  const prod = path.join(process.cwd(), 'dist/assets/logo.png');
  const dev = path.join(process.cwd(), 'src/assets/logo.png');
  return fs.existsSync(prod) ? prod : fs.existsSync(dev) ? dev : null;
}

function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function borderHair(): Partial<ExcelJS.Borders> {
  return {
    bottom: { style: 'hair', color: { argb: C.GRIS_CLARO } },
    right: { style: 'hair', color: { argb: C.GRIS_CLARO } },
  };
}

export async function generarExcelInventario(
  filas: InventarioRow[],
  totales: InventarioTotales,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Inventario', {
    views: [{ state: 'frozen', ySplit: 6, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    properties: { tabColor: { argb: C.AZUL_MED } },
  });

  ws.columns = [
    { header: 'Código', key: 'codigo', width: 14 },
    { header: 'Artículo', key: 'nombre', width: 30 },
    { header: 'Categoría', key: 'categoria', width: 20 },
    { header: 'Marca', key: 'marca', width: 18 },
    { header: 'Modelo', key: 'modelo', width: 18 },
    { header: 'Costo', key: 'costo', width: 16, style: { numFmt: '"$"#,##0' } },
    { header: 'Stock', key: 'stock', width: 10 },
    { header: 'Stock mínimo', key: 'stockMinimo', width: 14 },
    { header: 'Estado', key: 'activo', width: 12 },
    { header: 'Registrado', key: 'creadoEn', width: 16 },
  ] as any;

  ws.getRow(1).height = 6;
  for (let c = 1; c <= 10; c++) ws.getCell(1, c).fill = solidFill(C.AZUL_DARK);

  ws.getRow(2).height = 45;
  ws.getRow(3).height = 20;

  ws.mergeCells('A2:C3');
  const logoPath = getLogoPath();
  if (logoPath) {
    const logoId = workbook.addImage({ filename: logoPath, extension: 'png' });
    ws.addImage(logoId, { tl: { col: 0, row: 1 }, ext: { width: 110, height: 55 } });
  }

  ws.mergeCells('D2:J2');
  ws.getCell('D2').value = 'CRÉDITOS DEL SUR';
  ws.getCell('D2').font = { bold: true, size: 18, color: { argb: C.AZUL_DARK } };
  ws.getCell('D2').alignment = { vertical: 'middle', horizontal: 'left' };

  ws.mergeCells('D3:J3');
  ws.getCell('D3').value = 'REPORTE DE INVENTARIO';
  ws.getCell('D3').font = { bold: true, size: 11, color: { argb: C.NAR_MED } };
  ws.getCell('D3').alignment = { vertical: 'middle', horizontal: 'left' };

  ws.mergeCells('A4:J4');
  ws.getCell('A4').value = `Generado: ${new Date().toLocaleString('es-CO')}  |  Total: ${totales.totalProductos}  |  Bajo stock: ${totales.productosBajoStock}  |  Valor: ${fmtCOP(totales.totalValorInventario)}`;
  ws.getCell('A4').font = { italic: true, size: 9, color: { argb: C.GRIS_MED } };

  ws.addRow([]);

  const headerRow = ws.getRow(6);
  headerRow.height = 22;
  ws.columns.forEach((col: any, i: number) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, size: 9, color: { argb: C.BLANCO } };
    cell.fill = solidFill(C.AZUL_MED);
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      bottom: { style: 'medium', color: { argb: C.NAR_MED } },
      right: { style: 'thin', color: { argb: C.BLANCO } },
    };
  });
  ws.autoFilter = { from: 'A6', to: 'J6' };

  filas.forEach((f, idx) => {
    const row = ws.addRow({
      codigo: f.codigo,
      nombre: f.nombre,
      categoria: f.categoria,
      marca: f.marca || '',
      modelo: f.modelo || '',
      costo: Number(f.costo) || 0,
      stock: Number(f.stock) || 0,
      stockMinimo: Number(f.stockMinimo) || 0,
      activo: f.activo ? 'Activo' : 'Inactivo',
      creadoEn: fmtFecha(f.creadoEn),
    });

    const par = idx % 2 === 0;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = solidFill(par ? C.BLANCO : C.AZUL_PALE);
      cell.font = { size: 9, color: { argb: C.GRIS_TEXTO } };
      cell.alignment = { vertical: 'middle' };
      cell.border = borderHair();
    });

    row.getCell(6).numFmt = '"$"#,##0';

    if (Number(f.stock) <= Number(f.stockMinimo)) {
      row.getCell(7).font = { bold: true, color: { argb: 'FFdc2626' } };
      row.getCell(8).font = { bold: true, color: { argb: 'FFdc2626' } };
    }

    if (!f.activo) {
      row.getCell(9).font = { bold: true, color: { argb: C.GRIS_MED } };
    }
  });

  ws.addRow([]);
  const tRow = ws.addRow([
    'TOTALES',
    '',
    '',
    '',
    '',
    totales.totalValorInventario,
    '',
    '',
    '',
    '',
  ]);
  ws.mergeCells(`A${tRow.number}:E${tRow.number}`);
  tRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
  tRow.eachCell({ includeEmpty: true }, (cell, cn) => {
    if (cn <= 5) {
      cell.fill = solidFill(C.NAR_MED);
      cell.font = { bold: true, color: { argb: C.BLANCO } };
    } else {
      cell.fill = solidFill(C.NAR_PALE);
      cell.font = { bold: true, color: { argb: C.GRIS_TEXTO } };
    }
    cell.border = {
      top: { style: 'medium', color: { argb: C.NAR_MED } },
      right: { style: 'thin', color: { argb: C.GRIS_CLARO } },
    };
  });
  tRow.getCell(6).numFmt = '"$"#,##0';

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `inventario_${fecha}.xlsx`,
  };
}

export async function generarPDFInventario(
  filas: InventarioRow[],
  totales: InventarioTotales,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  const logoPath = getLogoPath();
  const drawWatermark = () => {
    if (!logoPath) return;
    try {
      doc.save();
      doc.opacity(0.08);
      const W = doc.page.width;
      const H = doc.page.height;
      doc.image(logoPath, (W - 300) / 2, (H - 300) / 2, { width: 300 });
      doc.restore();
    } catch (_) {}
  };

  drawWatermark();

  // Header
  doc.fontSize(22).font('Helvetica-Bold').fillColor('#1A5F8A').text('Créditos del Sur', 30, 25);
  doc.fontSize(9).font('Helvetica').fillColor('#F07A28').text('REPORTE DE INVENTARIO', 30, 52);

  const meta = `Generado: ${new Date().toLocaleString('es-CO')}  |  Total: ${totales.totalProductos}  |  Bajo stock: ${totales.productosBajoStock}  |  Valor: ${fmtCOP(totales.totalValorInventario)}`;
  doc.fontSize(8).fillColor('#475569').text(meta, 30, 68);

  // Table
  const startY = 90;
  const colX = [30, 105, 310, 430, 520, 600, 675, 740];
  // codigo, nombre, categoria, costo, stock, min, estado, creado

  doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
  doc.rect(30, startY, doc.page.width - 60, 18).fill('#2B7BB5');
  const headers = ['Código', 'Artículo', 'Categoría', 'Costo', 'Stock', 'Min', 'Estado', 'Fecha'];
  headers.forEach((h, i) => {
    doc.text(h, colX[i], startY + 5, { width: (i === 1 ? 200 : 90), align: 'left' });
  });

  doc.font('Helvetica').fillColor('#0f172a');
  let y = startY + 20;
  const rowH = 16;

  filas.slice(0, 60).forEach((f, idx) => {
    if (y + rowH > doc.page.height - 40) {
      doc.addPage();
      drawWatermark();
      y = 30;
    }

    if (idx % 2 === 0) {
      doc.rect(30, y, doc.page.width - 60, rowH).fill('#EBF4FB');
    }

    doc.fillColor('#0f172a');
    doc.text(String(f.codigo || ''), colX[0], y + 4, { width: 70 });
    doc.text(String(f.nombre || ''), colX[1], y + 4, { width: 200 });
    doc.text(String(f.categoria || ''), colX[2], y + 4, { width: 110 });
    doc.text(fmtCOP(Number(f.costo) || 0), colX[3], y + 4, { width: 80, align: 'right' });

    const lowStock = Number(f.stock) <= Number(f.stockMinimo);
    doc.fillColor(lowStock ? '#dc2626' : '#0f172a');
    doc.text(String(f.stock ?? ''), colX[4], y + 4, { width: 55, align: 'right' });
    doc.text(String(f.stockMinimo ?? ''), colX[5], y + 4, { width: 55, align: 'right' });

    doc.fillColor(f.activo ? '#0f172a' : '#64748b');
    doc.text(f.activo ? 'Activo' : 'Inactivo', colX[6], y + 4, { width: 70 });
    doc.fillColor('#0f172a');
    doc.text(fmtFecha(f.creadoEn), colX[7], y + 4, { width: 80 });

    y += rowH;
  });

  // Footer totals
  y += 10;
  doc.font('Helvetica-Bold').fillColor('#F07A28').text(`Total valor inventario: ${fmtCOP(totales.totalValorInventario)}`, 30, y);

  doc.end();

  const data = await new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });

  return {
    data,
    contentType: 'application/pdf',
    filename: `inventario_${fecha}.pdf`,
  };
}
