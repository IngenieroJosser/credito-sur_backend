/**
 * ============================================================================
 * TEMPLATE: INVENTARIO / ARTÍCULOS
 * ============================================================================
 * Usado en: inventory.service.ts → exportarInventario()
 * Endpoints:
 *   GET /inventory/export?format=excel
 *   GET /inventory/export?format=pdf
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface InventarioRow {
  codigo:      string;
  nombre:      string;
  categoria:   string;
  marca:       string | null;
  modelo:      string | null;
  costo:       number;
  stock:       number;
  stockMinimo: number;
  activo:      boolean;
  creadoEn:    Date | string;
}

export interface InventarioTotales {
  totalProductos:       number;
  totalValorInventario: number;
  productosBajoStock:   number;
}

// ─── Paleta ───────────────────────────────────────────────────────────────────

const XL = {
  AZUL_DARK:  'FF1A5F8A',
  AZUL_MED:   'FF2B7BB5',
  AZUL_PALE:  'FFEBF4FB',
  NAR_MED:    'FFF07A28',
  NAR_PALE:   'FFFEF3EC',
  BLANCO:     'FFFFFFFF',
  GRIS_TEXTO: 'FF2D3748',
  GRIS_MED:   'FF718096',
  GRIS_CLARO: 'FFE2E8F0',
  ROJO_PALE:  'FFFEF2F2',
  ROJO_DARK:  'FFDC2626',
  SLATE:      'FF334155',
} as const;

const PDF = {
  AZUL_DARK:  '#1A5F8A',
  AZUL_MED:   '#2B7BB5',
  AZUL_PALE:  '#EBF4FB',
  AZUL_SOFT:  '#D6E9F5',
  NAR_MED:    '#F07A28',
  NAR_SOFT:   '#FDE8D5',
  NAR_DARK:   '#C05A18',
  BLANCO:     '#FFFFFF',
  GRIS_TXT:   '#2D3748',
  GRIS_MED:   '#718096',
  GRIS_LINEA: '#E2E8F0',
  GRIS_FONDO: '#F7FAFC',
  ROJO_PALE:  '#FEF2F2',
  ROJO_DARK:  '#DC2626',
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  const dev  = path.join(process.cwd(), 'src/assets/logo.png');
  return fs.existsSync(prod) ? prod : fs.existsSync(dev) ? dev : null;
}

function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function borderHair(): Partial<ExcelJS.Borders> {
  return {
    bottom: { style: 'hair', color: { argb: XL.GRIS_CLARO } },
    right:  { style: 'hair', color: { argb: XL.GRIS_CLARO } },
  };
}

// ─── Definición de columnas (compartida Excel/PDF lógicamente) ────────────────

const EXCEL_COLS = [
  { key: 'codigo',      label: 'Código',       width: 14 },
  { key: 'nombre',      label: 'Artículo',     width: 30 },
  { key: 'categoria',   label: 'Categoría',    width: 20 },
  { key: 'marca',       label: 'Marca',        width: 18 },
  { key: 'modelo',      label: 'Modelo',       width: 18 },
  { key: 'costo',       label: 'Costo',        width: 16 },
  { key: 'stock',       label: 'Stock',        width: 10 },
  { key: 'stockMinimo', label: 'Stock mínimo', width: 14 },
  { key: 'activo',      label: 'Estado',       width: 12 },
  { key: 'creadoEn',    label: 'Registrado',   width: 16 },
];

// ─── EXCEL ────────────────────────────────────────────────────────────────────

export async function generarExcelInventario(
  filas:   InventarioRow[],
  totales: InventarioTotales,
  fecha:   string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Inventario', {
    // ySplit=4: filas 1-3 son título/meta/vacía → headers en fila 4
    views:      [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    pageSetup:  { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    properties: { tabColor: { argb: XL.AZUL_MED } },
  });

  // IMPORTANTE: ws.columns SIN header — el campo 'header' haría que ExcelJS
  // inserte una fila de headers automáticamente en la fila 1, antes de
  // cualquier addRow(). Solo definimos key y width.
  ws.columns = EXCEL_COLS.map(c => ({
    key:   c.key,
    width: c.width,
    ...(c.key === 'costo' ? { style: { numFmt: '"$"#,##0' } } : {}),
  })) as any;

  // ── Fila 1: Título ──────────────────────────────────────────────────────────
  const titleRow = ws.addRow([
    `CRÉDITOS DEL SUR — INVENTARIO DE ARTÍCULOS`,
  ]);
  titleRow.font      = { bold: true, size: 14, color: { argb: XL.BLANCO } };
  titleRow.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.AZUL_DARK } };
  titleRow.height    = 28;
  ws.mergeCells('A1:J1');

  // ── Fila 2: Metadatos ───────────────────────────────────────────────────────
  const metaRow = ws.addRow([
    `Generado: ${new Date().toLocaleString('es-CO')}` +
    `  |  Total: ${totales.totalProductos}` +
    `  |  Bajo stock: ${totales.productosBajoStock}` +
    `  |  Valor: ${fmtCOP(totales.totalValorInventario)}`,
  ]);
  metaRow.font   = { size: 9, color: { argb: XL.BLANCO } };
  metaRow.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.SLATE } };
  metaRow.height = 18;
  ws.mergeCells('A2:J2');

  // ── Fila 3: vacía ───────────────────────────────────────────────────────────
  ws.addRow([]);
  ws.getRow(3).height = 4;

  // ── Fila 4: Encabezados ─────────────────────────────────────────────────────
  const headerRow = ws.addRow(EXCEL_COLS.map(c => c.label));
  headerRow.height = 22;
  headerRow.eachCell((cell, colNum) => {
    cell.font      = { bold: true, size: 9, color: { argb: XL.BLANCO } };
    cell.fill      = solidFill(XL.AZUL_MED);
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border    = {
      bottom: { style: 'medium', color: { argb: XL.NAR_MED } },
      right:  { style: 'thin',   color: { argb: XL.BLANCO } },
    };
  });
  ws.autoFilter = { from: 'A4', to: 'J4' };

  // ── Filas de datos ──────────────────────────────────────────────────────────
  filas.forEach((f, idx) => {
    const lowStock = Number(f.stock) <= Number(f.stockMinimo);
    const par      = idx % 2 === 0;
    const rowBg    = lowStock ? XL.ROJO_PALE : (par ? XL.BLANCO : XL.AZUL_PALE);

    const row = ws.addRow({
      codigo:      f.codigo,
      nombre:      f.nombre,
      categoria:   f.categoria,
      marca:       f.marca     || '',
      modelo:      f.modelo    || '',
      costo:       Number(f.costo)       || 0,
      stock:       Number(f.stock)       || 0,
      stockMinimo: Number(f.stockMinimo) || 0,
      activo:      f.activo ? 'Activo' : 'Inactivo',
      creadoEn:    fmtFecha(f.creadoEn),
    });

    row.eachCell({ includeEmpty: true }, cell => {
      cell.fill      = solidFill(rowBg);
      cell.font      = { size: 9, color: { argb: XL.GRIS_TEXTO } };
      cell.alignment = { vertical: 'middle' };
      cell.border    = borderHair();
    });

    row.getCell(6).numFmt = '"$"#,##0';  // Costo

    if (lowStock) {
      row.getCell(7).font = { bold: true, size: 9, color: { argb: XL.ROJO_DARK } };
      row.getCell(8).font = { bold: true, size: 9, color: { argb: XL.ROJO_DARK } };
    }
    if (!f.activo) {
      row.getCell(9).font = { size: 9, color: { argb: XL.GRIS_MED } };
    }
  });

  // ── Fila de totales ─────────────────────────────────────────────────────────
  ws.addRow([]);
  const tRow = ws.addRow([
    'TOTALES', '', '', '', '',
    totales.totalValorInventario,
    '', '', '', '',
  ]);
  ws.mergeCells(`A${tRow.number}:E${tRow.number}`);
  tRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
  tRow.height = 22;
  tRow.eachCell({ includeEmpty: true }, (cell, cn) => {
    cell.fill   = solidFill(cn <= 5 ? XL.NAR_MED : XL.NAR_PALE);
    cell.font   = { bold: true, color: { argb: cn <= 5 ? XL.BLANCO : XL.GRIS_TEXTO } };
    cell.border = {
      top:   { style: 'medium', color: { argb: XL.NAR_MED } },
      right: { style: 'thin',   color: { argb: XL.GRIS_CLARO } },
    };
  });
  tRow.getCell(6).numFmt = '"$"#,##0';

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data:        Buffer.from(buffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename:    `inventario_${fecha}.xlsx`,
  };
}

// ─── PDF ──────────────────────────────────────────────────────────────────────
// Columnas PDF: 8 cols, suman 732pt exactos (792 - 30 - 30)
// Base: 68+200+112+78+48+48+66+112 = 732 ✓

const PDF_COLS = [
  { label: 'Código',     w:  68, align: 'left'   as const },
  { label: 'Artículo',   w: 200, align: 'left'   as const },  // única col que wrapea
  { label: 'Categoría',  w: 112, align: 'left'   as const },
  { label: 'Costo',      w:  78, align: 'right'  as const },
  { label: 'Stock',      w:  48, align: 'center' as const },
  { label: 'Mín.',       w:  48, align: 'center' as const },
  { label: 'Estado',     w:  66, align: 'center' as const },
  { label: 'Registrado', w: 112, align: 'center' as const },
];

const TABLE_LEFT  = 30;
const TABLE_WIDTH = PDF_COLS.reduce((s, c) => s + c.w, 0); // 732

export async function generarPDFInventario(
  filas:   InventarioRow[],
  totales: InventarioTotales,
  fecha:   string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  const PW = doc.page.width;   // 792
  const PH = doc.page.height;  // 612

  // ── Watermark ──────────────────────────────────────────────────────────────
  const logoPath = getLogoPath();
  const drawWatermark = () => {
    if (!logoPath) return;
    try {
      doc.save();
      doc.opacity(0.08);
      doc.image(logoPath, (PW - 300) / 2, (PH - 300) / 2, { width: 300 });
      doc.restore();
    } catch (_) {}
  };

  // ── Footer ─────────────────────────────────────────────────────────────────
  let pageNumber = 1;
  const drawFooter = () => {
    doc.fontSize(7).font('Helvetica').fillColor(PDF.GRIS_MED)
       .text(
         `Pág. ${pageNumber}  •  Generado: ${new Date().toLocaleString('es-CO')}`,
         0, PH - 25, { align: 'right', width: PW - 30 },
       );
  };

  // ── Header — retorna Y donde empieza la tabla ──────────────────────────────
  const drawHeader = (): number => {
    doc.fontSize(22).font('Helvetica-Bold').fillColor(PDF.AZUL_DARK)
       .text('Créditos del Sur', TABLE_LEFT, 25);
    doc.fontSize(9).font('Helvetica').fillColor(PDF.NAR_MED)
       .text('REPORTE DE INVENTARIO', TABLE_LEFT, 52, { characterSpacing: 0.5 });

    // Badge fecha
    doc.roundedRect(PW - 180, 20, 148, 44, 5).fillAndStroke(PDF.BLANCO, PDF.GRIS_LINEA);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(PDF.GRIS_MED)
       .text('FECHA', PW - 180, 28, { width: 148, align: 'center' });
    doc.fontSize(10).font('Helvetica-Bold').fillColor(PDF.AZUL_DARK)
       .text(fecha, PW - 180, 40, { width: 148, align: 'center' });

    // Banda de contexto
    doc.roundedRect(TABLE_LEFT, 76, PW - 60, 36, 8).fillAndStroke(PDF.AZUL_PALE, PDF.GRIS_LINEA);
    doc.fontSize(9).font('Helvetica').fillColor(PDF.GRIS_TXT)
       .text(
         `Total: ${totales.totalProductos}   |   Bajo stock: ${totales.productosBajoStock}   |   Valor total: ${fmtCOP(totales.totalValorInventario)}`,
         40, 91, { width: PW - 80 },
       );

    // 3 KPI cards
    const kY = 124;
    const kH = 44;
    const kW = (TABLE_WIDTH - 8) / 3;
    const cards = [
      { label: 'TOTAL PRODUCTOS',  val: String(totales.totalProductos),        bg: PDF.AZUL_SOFT, color: PDF.AZUL_DARK },
      { label: 'BAJO STOCK',       val: String(totales.productosBajoStock),    bg: PDF.ROJO_PALE, color: PDF.ROJO_DARK },
      { label: 'VALOR INVENTARIO', val: fmtCOP(totales.totalValorInventario),  bg: PDF.NAR_SOFT,  color: PDF.NAR_DARK  },
    ];
    cards.forEach((card, i) => {
      const kx = TABLE_LEFT + i * (kW + 4);
      doc.roundedRect(kx, kY, kW, kH, 6).fillAndStroke(card.bg, PDF.GRIS_LINEA);
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(PDF.GRIS_MED)
         .text(card.label, kx, kY + 9, { width: kW, align: 'center' });
      doc.fontSize(12).font('Helvetica-Bold').fillColor(card.color)
         .text(card.val, kx, kY + 23, { width: kW, align: 'center' });
    });

    return kY + kH + 8;
  };

  // ── Encabezado de tabla ─────────────────────────────────────────────────────
  const drawTableHeader = (y: number): number => {
    doc.rect(TABLE_LEFT, y, TABLE_WIDTH, 22).fill(PDF.AZUL_MED);
    doc.rect(TABLE_LEFT, y + 22, TABLE_WIDTH, 2).fill(PDF.NAR_MED);
    let x = TABLE_LEFT;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(PDF.BLANCO);
    PDF_COLS.forEach(col => {
      doc.text(col.label, x + 3, y + 6, {
        width:     col.w - 6,
        align:     'center',
        lineBreak: false,
      });
      x += col.w;
    });
    return y + 26;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  drawWatermark();
  let y = drawHeader();
  y     = drawTableHeader(y);

  const PAD        = 4;
  const FOOTER_RSV = 50;

  filas.forEach((fila, i) => {
    const lowStock = Number(fila.stock) <= Number(fila.stockMinimo);

    // Valores en orden exacto de PDF_COLS
    const vals: string[] = [
      fila.codigo || '',
      fila.nombre || '',
      fila.categoria || '',
      fmtCOP(Number(fila.costo) || 0),
      String(fila.stock      ?? ''),
      String(fila.stockMinimo ?? ''),
      fila.activo ? 'Activo' : 'Inactivo',
      fmtFecha(fila.creadoEn),
    ];

    // rowH determinado SOLO por Artículo (ci=1) — la única col que puede wrappear
    doc.font('Helvetica-Bold').fontSize(7.5);
    const hNombre = doc.heightOfString(vals[1], { width: PDF_COLS[1].w - 6, lineBreak: true });
    let rowH = Math.max(16, hNombre + PAD * 2);
    if (rowH > 40) rowH = 40;

    // Salto de página
    if (y + rowH > PH - FOOTER_RSV) {
      drawFooter();
      pageNumber++;
      doc.addPage();
      drawWatermark();
      y = drawHeader();
      y = drawTableHeader(y);
    }

    // Fondo: bajo stock > cebra
    const baseBg = i % 2 === 0 ? PDF.BLANCO : PDF.AZUL_PALE;
    const rowBg  = lowStock ? PDF.ROJO_PALE : baseBg;
    doc.rect(TABLE_LEFT, y, TABLE_WIDTH, rowH).fill(rowBg);
    if (lowStock) {
      doc.rect(TABLE_LEFT, y, 3, rowH).fill(PDF.ROJO_DARK);
    }
    doc.moveTo(TABLE_LEFT, y + rowH)
       .lineTo(TABLE_LEFT + TABLE_WIDTH, y + rowH)
       .strokeColor(PDF.GRIS_LINEA).lineWidth(0.3).stroke();

    // ── Render de celdas ─────────────────────────────────────────────────────
    // REGLA: solo ci===1 (Artículo) usa lineBreak:true.
    // Todas las demás usan lineBreak:false + ellipsis:true para que el cursor
    // Y de PDFKit NO se desplace, garantizando alineación horizontal perfecta.
    let x = TABLE_LEFT;
    vals.forEach((v, ci) => {
      const col = PDF_COLS[ci];

      // Estilo
      if (ci === 3) {                               // Costo: bold azul
        doc.font('Helvetica-Bold').fillColor(PDF.AZUL_DARK);
      } else if ((ci === 4 || ci === 5) && lowStock) { // Stock/Mín bajo stock
        doc.font('Helvetica-Bold').fillColor(PDF.ROJO_DARK);
      } else if (ci === 6 && !fila.activo) {        // Inactivo: gris
        doc.font('Helvetica').fillColor(PDF.GRIS_MED);
      } else {
        doc.font(ci === 1 ? 'Helvetica-Bold' : 'Helvetica').fillColor(PDF.GRIS_TXT);
      }

      const wrap = ci === 1;
      doc.text(v, x + 3, y + PAD, {
        width:     col.w - 6,
        align:     col.align,
        lineBreak: wrap,
        ellipsis:  !wrap,
      });

      x += col.w;
    });

    y += rowH;
  });

  // ── Fila de totales ─────────────────────────────────────────────────────────
  const TOTAL_H = 28;
  if (y + TOTAL_H + 20 > PH - FOOTER_RSV) {
    drawFooter();
    pageNumber++;
    doc.addPage();
    drawWatermark();
    y = 40;
  }

  y += 8;
  doc.rect(TABLE_LEFT, y, TABLE_WIDTH, TOTAL_H).fill(PDF.AZUL_DARK);
  doc.rect(TABLE_LEFT, y, TABLE_WIDTH, 2).fill(PDF.NAR_MED);

  // Texto izquierdo
  const descW = PDF_COLS.slice(0, 3).reduce((s, c) => s + c.w, 0);
  doc.fontSize(8).font('Helvetica-Bold').fillColor(PDF.BLANCO)
     .text(
       `TOTALES — ${totales.totalProductos} producto${totales.totalProductos !== 1 ? 's' : ''}` +
       `   |   Bajo stock: ${totales.productosBajoStock}`,
       TABLE_LEFT + 8, y + 9,
       { width: descW - 12 },
     );

  // Valor alineado a columna Costo (ci=3)
  const costoX = TABLE_LEFT + PDF_COLS.slice(0, 3).reduce((s, c) => s + c.w, 0);
  doc.font('Helvetica-Bold').fillColor(PDF.NAR_MED).fontSize(8)
     .text(
       fmtCOP(totales.totalValorInventario),
       costoX + 2, y + 9,
       { width: PDF_COLS[3].w - 4, align: 'right' },
     );

  y += TOTAL_H + 10;

  doc.fontSize(7).font('Helvetica-Oblique').fillColor(PDF.GRIS_MED)
     .text(
       'Documento expedido por Créditos del Sur. Las cifras son definitivas y sujetas a revisión de auditoría.',
       TABLE_LEFT, y, { align: 'center', width: TABLE_WIDTH },
     );

  drawFooter();

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    doc.on('end',   () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
    doc.end();
  });

  return {
    data:        buffer,
    contentType: 'application/pdf',
    filename:    `inventario_${fecha}.pdf`,
  };
}