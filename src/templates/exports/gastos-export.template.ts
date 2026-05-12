/**
 * ============================================================================
 * TEMPLATE: REPORTE DE GASTOS
 * ============================================================================
 * Usado en: accounting.service.ts → exportGastos()
 * Genera reporte de gastos con formato profesional igual a historial de pagos.
 * Paleta corporativa: Azul #1A5F8A / Naranja #F07A28 / Blanco
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface GastoRow {
  numero: string;
  fecha: Date | string;
  cobrador: string;
  ruta: string;
  tipo: string;
  categoria: string | null;
  descripcion: string;
  monto: number;
  estado: string;
}

export interface GastosTotales {
  totalGastos: number;
  cantidadGastos: number;
  totalOperativos?: number;
  totalPersonales?: number;
}

// ─── Paleta corporativa ───────────────────────────────────────────────────────

const C = {
  // Azul
  AZUL_DARK:    'FF1A5F8A',
  AZUL_MED:     'FF2B7BB5',
  AZUL_SOFT:    'FFD6E9F5',
  AZUL_PALE:    'FFEBF4FB',
  // Naranja
  NAR_DARK:     'FFD4600A',
  NAR_MED:      'FFF07A28',
  NAR_SOFT:     'FFFDE8D5',
  NAR_PALE:     'FFFEF3EC',
  // Neutros
  BLANCO:       'FFFFFFFF',
  GRIS_TEXTO:   'FF2D3748',
  GRIS_MED:     'FF718096',
  GRIS_CLARO:   'FFE2E8F0',
  GRIS_FONDO:   'FFF7FAFC',
  GRIS_ALT:     'FFF0F4F8',
} as const;

// ─── Utilidades ───────────────────────────────────────────────────────────────

function fmtFecha(f: Date | string): string {
  if (!f) return '';
  const d = f instanceof Date ? f : new Date(f);
  return isNaN(d.getTime()) ? String(f) : d.toLocaleDateString('es-CO');
}

function fmtCOP(val: number): string {
  return `$${(val || 0).toLocaleString('es-CO')}`;
}

function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function cellBorder(
  bottomStyle: ExcelJS.BorderStyle = 'hair',
  bottomColor: string = C.GRIS_CLARO,
): Partial<ExcelJS.Borders> {
  return {
    bottom: { style: bottomStyle, color: { argb: bottomColor } },
    right:  { style: 'hair',      color: { argb: C.GRIS_CLARO } },
  };
}

function applyHeader(cell: ExcelJS.Cell, bgArgb: string = C.AZUL_MED): void {
  cell.font      = { bold: true, size: 9, color: { argb: C.BLANCO }, name: 'Calibri' };
  cell.fill      = solidFill(bgArgb);
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border    = {
    bottom: { style: 'medium', color: { argb: C.NAR_MED } },
    right:  { style: 'thin',   color: { argb: C.BLANCO } },
  };
}

// ─── Generador Excel ──────────────────────────────────────────────────────────

export async function generarExcelGastos(
  filas: GastoRow[],
  totales: GastosTotales,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Gastos');

  // Configuración de página
  worksheet.pageSetup.paperSize = 9; // A4
  worksheet.pageSetup.orientation = 'landscape';
  worksheet.pageSetup.fitToPage = true;
  worksheet.pageSetup.fitToWidth = 1;
  worksheet.pageSetup.fitToHeight = 0;

  // Título principal
  worksheet.mergeCells('A1:I1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'HISTORIAL DE GASTOS';
  titleCell.font = { bold: true, size: 16, color: { argb: C.AZUL_DARK }, name: 'Calibri' };
  titleCell.alignment = { horizontal: 'center' };

  // Subtítulo con fecha
  worksheet.mergeCells('A2:I2');
  const subtitleCell = worksheet.getCell('A2');
  subtitleCell.value = `Reporte generado: ${new Date().toLocaleString('es-CO')}`;
  subtitleCell.font = { size: 10, color: { argb: C.GRIS_MED }, name: 'Calibri' };
  subtitleCell.alignment = { horizontal: 'center' };

  // Espacio
  worksheet.getRow(3).height = 15;

  // Headers de tabla
  const headers = [
    { key: 'numero', header: 'N° Gasto', width: 14 },
    { key: 'fecha', header: 'Fecha', width: 12 },
    { key: 'cobrador', header: 'Cobrador', width: 22 },
    { key: 'ruta', header: 'Ruta', width: 20 },
    { key: 'tipo', header: 'Tipo', width: 12 },
    { key: 'categoria', header: 'Categoría', width: 16 },
    { key: 'descripcion', header: 'Descripción', width: 30 },
    { key: 'monto', header: 'Monto', width: 14 },
    { key: 'estado', header: 'Estado', width: 12 },
  ];

  worksheet.columns = headers;
  const headerRow = worksheet.getRow(4);
  headerRow.height = 25;
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    applyHeader(cell);
  });

  // Datos
  filas.forEach((g, idx) => {
    const row = worksheet.addRow({
      numero: g.numero,
      fecha: fmtFecha(g.fecha),
      cobrador: g.cobrador,
      ruta: g.ruta,
      tipo: g.tipo,
      categoria: g.categoria || 'Sin categoría',
      descripcion: g.descripcion,
      monto: g.monto,
      estado: g.estado,
    });
    row.height = 20;
    
    // Estilo de filas alternado
    const isEven = idx % 2 === 0;
    row.eachCell((cell) => {
      cell.font = { size: 9, color: { argb: C.GRIS_TEXTO }, name: 'Calibri' };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = cellBorder();
      if (isEven) {
        cell.fill = solidFill(C.GRIS_FONDO);
      }
    });

    // Formato de moneda
    row.getCell('monto').numFmt = '$#,##0.00';
    row.getCell('monto').alignment = { horizontal: 'right', vertical: 'middle' };
  });

  // Totales
  const totalRowIndex = filas.length + 5;
  worksheet.mergeCells(`A${totalRowIndex}:G${totalRowIndex}`);
  const totalLabel = worksheet.getCell(`A${totalRowIndex}`);
  totalLabel.value = 'TOTAL GASTOS';
  totalLabel.font = { bold: true, size: 11, color: { argb: C.AZUL_DARK }, name: 'Calibri' };
  totalLabel.alignment = { horizontal: 'right', vertical: 'middle' };
  totalLabel.fill = solidFill(C.AZUL_SOFT);
  totalLabel.border = cellBorder('medium', C.AZUL_MED);

  const totalValue = worksheet.getCell(`H${totalRowIndex}`);
  totalValue.value = totales.totalGastos;
  totalValue.numFmt = '$#,##0.00';
  totalValue.font = { bold: true, size: 11, color: { argb: C.NAR_DARK }, name: 'Calibri' };
  totalValue.alignment = { horizontal: 'right', vertical: 'middle' };
  totalValue.fill = solidFill(C.NAR_SOFT);
  totalValue.border = cellBorder('medium', C.NAR_MED);

  worksheet.getCell(`I${totalRowIndex}`).value = totales.cantidadGastos;
  worksheet.getCell(`I${totalRowIndex}`).font = { bold: true, size: 11, color: { argb: C.GRIS_TEXTO }, name: 'Calibri' };
  worksheet.getCell(`I${totalRowIndex}`).alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getCell(`I${totalRowIndex}`).fill = solidFill(C.GRIS_FONDO);
  worksheet.getCell(`I${totalRowIndex}`).border = cellBorder('medium', C.GRIS_MED);

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `gastos_${fecha}.xlsx`,
  };
}

// ─── Generador PDF ────────────────────────────────────────────────────────────

export async function generarPDFGastos(
  filas: GastoRow[],
  totales: GastosTotales,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {

  const doc     = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  // ── Colores ────────────────────────────────────────────────────────────────
  const AZUL_DARK  = '#1A5F8A';
  const AZUL_MED   = '#2B7BB5';
  const AZUL_PALE  = '#EBF4FB';
  const NAR_MED    = '#F07A28';
  const NAR_DARK   = '#D4600A';
  const NAR_SOFT   = '#FDE8D5';
  const BLANCO     = '#FFFFFF';
  const GRIS_TXT   = '#2D3748';
  const GRIS_MED   = '#718096';
  const GRIS_CLR   = '#E2E8F0';

  // ── Watermark ─────────────────────────────────────────────────────────────
  const drawWatermark = () => {
    const logoPath = getLogoPath();
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

  // ── Encabezado de página ───────────────────────────────────────────────────
  let pageNumber = 1;

  const drawPageHeader = (): number => {
    const W = doc.page.width;

    // Título alineado a la izquierda
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#1A5F8A')
       .text('Créditos del Sur', 30, 25);
    doc.fontSize(9).font('Helvetica').fillColor('#F07A28')
       .text('HISTORIAL DE GASTOS', 30, 52, { characterSpacing: 0.5 });

    // Bloque fecha (derecha)
    doc.roundedRect(W - 180, 20, 148, 44, 5)
       .fillAndStroke(BLANCO, GRIS_CLR);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(GRIS_MED)
       .text('PERÍODO', W - 180, 28, { width: 148, align: 'center' });
    doc.fontSize(11).font('Helvetica-Bold').fillColor(AZUL_DARK)
       .text(fecha, W - 180, 40, { width: 148, align: 'center' });

    // ── KPIs ──────────────────────────────────────────────────────────────
    const metY = 98;
    const metW = 148;
    const gap  = 18;
    const totalW = (metW * 4) + (gap * 3);
    const startX = (W - totalW) / 2;

    [
      { label: 'TOTAL GASTOS',     val: totales.totalGastos,         color: AZUL_DARK, bg: '#D6E9F5' },
      { label: 'OPERATIVOS',      val: totales.totalOperativos ?? 0, color: GRIS_TXT,  bg: '#F0F4F8' },
      { label: 'PERSONALES',      val: totales.totalPersonales ?? 0, color: NAR_DARK,  bg: '#FDE8D5' },
      { label: 'CANTIDAD',        val: totales.cantidadGastos,       color: GRIS_TXT,  bg: '#F0F4F8' },
    ].forEach((m, i) => {
      const mx = startX + i * (metW + gap);
      doc.roundedRect(mx, metY, metW, 44, 6).fillAndStroke(m.bg, GRIS_CLR);
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(GRIS_MED)
         .text(m.label, mx, metY + 10, { width: metW, align: 'center' });
      doc.fontSize(13).font('Helvetica-Bold').fillColor(m.color)
         .text(fmtCOP(m.val), mx, metY + 23, { width: metW, align: 'center' });
    });

    return metY + 58;
  };

  // ── Configuración de columnas tabla ───────────────────────────────────────
  const cols = [
    { label: 'Fecha',        width: 53  },
    { label: 'N° Gasto',     width: 53  },
    { label: 'Cobrador',     width: 100 },
    { label: 'Ruta',         width: 80  },
    { label: 'Tipo',         width: 48  },
    { label: 'Categoría',    width: 70  },
    { label: 'Descripción',  width: 140 },
    { label: 'Monto',        width: 68  },
    { label: 'Estado',       width: 55  },
  ];
  const tableLeft  = 28;
  const rowHeight  = 20;
  const maxRowsPerPage = 35;

  // ── Función para dibujar fila ───────────────────────────────────────────────
  const drawRow = (row: GastoRow, y: number, isHeader: boolean = false) => {
    let x = tableLeft;
    const bg = isHeader ? AZUL_MED : (filas.indexOf(row) % 2 === 0 ? '#F7FAFC' : BLANCO);
    const textColor = isHeader ? BLANCO : GRIS_TXT;
    const font = isHeader ? 'Helvetica-Bold' : 'Helvetica';
    const fontSize = isHeader ? 8 : 7.5;

    cols.forEach((col, i) => {
      const cellWidth = col.width;
      doc.rect(x, y, cellWidth, rowHeight).fill(bg);
      if (!isHeader) {
        doc.rect(x, y, cellWidth, rowHeight).stroke(GRIS_CLR);
      }

      doc.fontSize(fontSize).font(font).fillColor(textColor);
      let text = '';
      switch (col.label) {
        case 'Fecha': text = fmtFecha(row.fecha); break;
        case 'N° Gasto': text = row.numero.slice(-6); break;
        case 'Cobrador': text = row.cobrador.slice(0, 12); break;
        case 'Ruta': text = row.ruta.slice(0, 10); break;
        case 'Tipo': text = row.tipo.slice(0, 8); break;
        case 'Categoría': text = (row.categoria || '-').slice(0, 10); break;
        case 'Descripción': text = row.descripcion.slice(0, 18); break;
        case 'Monto': text = fmtCOP(row.monto); break;
        case 'Estado': text = row.estado; break;
        default: text = '';
      }
      doc.text(text, x + 4, y + rowHeight / 2 + 2, { width: cellWidth - 8, align: col.label === 'Monto' ? 'right' : 'left' });
      x += cellWidth;
    });
  };

  // ── Dibujar contenido ───────────────────────────────────────────────────────
  drawWatermark();
  const tableTop = drawPageHeader();

  // Header de tabla
  let x = tableLeft;
  cols.forEach(col => {
    doc.rect(x, tableTop, col.width, rowHeight).fill(AZUL_MED);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(BLANCO)
       .text(col.label, x + 4, tableTop + rowHeight / 2 + 2, { width: col.width - 8, align: 'center' });
    x += col.width;
  });

  // Filas de datos
  let currentY = tableTop + rowHeight;
  let rowsOnPage = 0;

  filas.forEach((row, index) => {
    if (rowsOnPage >= maxRowsPerPage) {
      doc.addPage();
      drawWatermark();
      currentY = drawPageHeader();
      
      // Header en nueva página
      x = tableLeft;
      cols.forEach(col => {
        doc.rect(x, currentY, col.width, rowHeight).fill(AZUL_MED);
        doc.fontSize(8).font('Helvetica-Bold').fillColor(BLANCO)
           .text(col.label, x + 4, currentY + rowHeight / 2 + 2, { width: col.width - 8, align: 'center' });
        x += col.width;
      });
      currentY += rowHeight;
      rowsOnPage = 0;
    }

    drawRow(row, currentY);
    currentY += rowHeight;
    rowsOnPage++;
  });

  // Total al final
  doc.rect(tableLeft, currentY, cols.reduce((sum, c) => sum + c.width, 0), rowHeight).fill(NAR_SOFT);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(NAR_DARK)
     .text('TOTAL GASTOS:', tableLeft + 4, currentY + rowHeight / 2 + 2);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(NAR_DARK)
     .text(fmtCOP(totales.totalGastos), tableLeft + cols.slice(0, 7).reduce((sum, c) => sum + c.width, 0) - 4, currentY + rowHeight / 2 + 2, { align: 'right' });

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => {
      resolve({
        data: Buffer.concat(buffers),
        contentType: 'application/pdf',
        filename: `gastos_${fecha}.pdf`,
      });
    });
  });
}

// ─── Helper para logo ───────────────────────────────────────────────────────────
function getLogoPath(): string | null {
  const possiblePaths = [
    path.join(process.cwd(), 'public', 'logo.png'),
    path.join(process.cwd(), 'public', 'logo.jpg'),
    path.join(process.cwd(), 'assets', 'logo.png'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}
