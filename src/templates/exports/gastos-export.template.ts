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
  titleCell.value = 'HISTORIAL DE PAGOS Y GASTOS';
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
       .text('HISTORIAL DE PAGOS Y GASTOS', 30, 52, { characterSpacing: 0.5 });

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
      { label: 'TOTAL GASTOS',     val: totales.totalGastos,         color: AZUL_DARK, bg: '#D6E9F5', fmt: 'money' },
      { label: 'OPERATIVOS',      val: totales.totalOperativos ?? 0, color: GRIS_TXT,  bg: '#F0F4F8', fmt: 'money' },
      { label: 'PERSONALES',      val: totales.totalPersonales ?? 0, color: NAR_DARK,  bg: '#FDE8D5', fmt: 'money' },
      { label: 'CANTIDAD',        val: totales.cantidadGastos,       color: GRIS_TXT,  bg: '#F0F4F8', fmt: 'count' },
    ].forEach((m, i) => {
      const mx = startX + i * (metW + gap);
      doc.roundedRect(mx, metY, metW, 44, 6).fillAndStroke(m.bg, GRIS_CLR);
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(GRIS_MED)
         .text(m.label, mx, metY + 10, { width: metW, align: 'center' });
      const displayVal = m.fmt === 'count' ? String(m.val) : fmtCOP(m.val);
      doc.fontSize(13).font('Helvetica-Bold').fillColor(m.color)
         .text(displayVal, mx, metY + 23, { width: metW, align: 'center' });
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
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);

  const drawTableHeader = (y: number): number => {
    doc.rect(tableLeft, y, tableWidth, 24).fill(AZUL_MED);
    doc.rect(tableLeft, y + 24, tableWidth, 2).fill(NAR_MED);

    let x = tableLeft;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(BLANCO);
    cols.forEach(col => {
      doc.text(col.label, x + 4, y + 7, { width: col.width - 8, align: 'center' });
      x += col.width;
    });
    return y + 30;
  };

  // ── Pie de página ─────────────────────────────────────────────────────────
  const drawFooter = () => {
    const W = doc.page.width;
    const H = doc.page.height;
    doc.fontSize(7).font('Helvetica').fillColor(GRIS_MED);
    doc.text(`Pág. ${pageNumber}  •  Generado: ${new Date().toLocaleString('es-CO')}`, 0, H - 25, { align: 'right', width: W - 30 });
  };

  // ── Primera página ────────────────────────────────────────────────────────
  drawWatermark();
  let y = drawPageHeader();
  y     = drawTableHeader(y);

  doc.font('Helvetica').fontSize(7.5);

  // ── Filas de datos ────────────────────────────────────────────────────────
  filas.forEach((fila, i) => {

    let maxRowHeight = 17;
    const rowVals = [
      fmtFecha(fila.fecha),
      fila.numero.slice(-6),
      fila.cobrador,
      fila.ruta,
      fila.tipo,
      fila.categoria || 'Sin categoría',
      fila.descripcion,
      fmtCOP(fila.monto),
      fila.estado,
    ];

    doc.font('Helvetica').fontSize(7.5);
    rowVals.forEach((val, ci) => {
      const isBold = ci === 2 || ci === 7;
      if (isBold) doc.font('Helvetica-Bold');
      const h = doc.heightOfString(val, { width: cols[ci].width - 8, lineBreak: true });
      if (h + 8 > maxRowHeight) maxRowHeight = h + 8;
      doc.font('Helvetica');
    });

    // Nueva página si no hay espacio
    if (y + maxRowHeight > doc.page.height - 70) {
      drawFooter();
      pageNumber++;
      doc.addPage();
      drawWatermark();
      y = drawPageHeader();
      y = drawTableHeader(y);
      doc.font('Helvetica').fontSize(7.5);
    }

    // Fondo de fila alterno
    const par = i % 2 === 0;
    doc.rect(tableLeft, y, tableWidth, maxRowHeight).fill(par ? BLANCO : AZUL_PALE);

    // Línea separadora
    doc.moveTo(tableLeft, y + maxRowHeight)
       .lineTo(tableLeft + tableWidth, y + maxRowHeight)
       .strokeColor(GRIS_CLR).lineWidth(0.4).stroke();

    let x = tableLeft;
    rowVals.forEach((val, ci) => {
      const isMoneyCol = ci === 7;
      const align      = isMoneyCol ? 'right' : (ci === 4 || ci === 8 ? 'center' : 'left');

      if (ci === 7) {
        doc.font('Helvetica-Bold').fillColor(NAR_DARK);
      } else if (ci === 4) {
        doc.font('Helvetica-Bold').fillColor(fila.tipo === 'OPERATIVO' ? AZUL_DARK : NAR_DARK);
      } else if (ci === 2) {
        doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
      } else if (ci === 8) {
        doc.font('Helvetica').fillColor(GRIS_MED);
      } else {
        doc.font('Helvetica').fillColor(GRIS_TXT);
      }

      doc.text(val, x + 4, y + 4, { width: cols[ci].width - 8, align, lineBreak: true });
      x += cols[ci].width;
    });

    y += maxRowHeight;
  });

  // ── Fila totales ──────────────────────────────────────────────────────────
  y += 8;
  doc.rect(tableLeft, y, tableWidth, 26).fill(AZUL_DARK);
  doc.rect(tableLeft, y, tableWidth, 2).fill(NAR_MED);

  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BLANCO);
  doc.text(
    `TOTAL GENERAL  /  ${totales.cantidadGastos} gastos`,
    tableLeft + 6, y + 8,
    { width: cols.slice(0, 7).reduce((s, c) => s + c.width, 0) - 10 }
  );

  let tx = tableLeft + cols.slice(0, 7).reduce((s, c) => s + c.width, 0);
  doc.fillColor(NAR_MED).font('Helvetica-Bold').fontSize(9);
  doc.text(fmtCOP(totales.totalGastos), tx + 4, y + 7,
    { width: cols[7].width - 8, align: 'right', lineBreak: false });

  // ── Nota al pie ───────────────────────────────────────────────────────────
  y += 38;
  doc.fontSize(7.5).font('Helvetica-Oblique').fillColor(GRIS_MED)
     .text(
       'Documento expedido por Créditos del Sur. Las cifras presentadas son definitivas y sujetas a revisión de auditoría.',
       tableLeft, y, { align: 'center', width: tableWidth }
     );

  drawFooter();

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
    doc.end();
  });

  return {
    data:        buffer,
    contentType: 'application/pdf',
    filename:    `gastos_${fecha}.pdf`,
  };
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
