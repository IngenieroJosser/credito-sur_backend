/**
 * ============================================================================
 * TEMPLATE: RUTA DEL COBRADOR
 * ============================================================================
 * Usado en: routes.service.ts → exportarRuta()
 * Endpoints:
 *   GET /routes/:id/export/excel
 *   GET /routes/:id/export/pdf
 *
 * CAMBIOS v2:
 *  - PDF: 11 columnas = 732pt exactos (antes 11 cols = 846pt → overflow)
 *  - PDF: columna "Estado" agregada
 *  - PDF: col "✔" eliminada del PDF (queda en Excel)
 *  - PDF: fila totales centrada (igual al original)
 *  - PDF: paginación corregida (reserva 70pt para footer)
 *  - Estilo visual: idéntico al original
 * ============================================================================
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

export interface RutaCobradorRow {
  nro:            number;
  cliente:        string;
  cc:             string;
  telefono:       string;
  direccion:      string;
  numeroPrestamo: string;
  cuota:          number;
  fechaCuota:     string;
  saldo:          number;
  estadoPrestamo: string;
  diasMora:       number;
  semaforo:       'VERDE' | 'AMARILLO' | 'ROJO';
}

export interface RutaCobradorMeta {
  rutaNombre:     string;
  rutaCodigo?:    string;
  cobradorNombre: string;
  fechaExport:    string;
  totalClientes:  number;
  enMora:         number;
  totalCuota:     number;
  totalSaldo:     number;
}

const C = {
  BLANCO:         '#FFFFFF',
  GRIS_LINEA:     '#E2E8F0',
  GRIS_TXT:       '#475569',
  GRIS_MED:       '#94A3B8',
  AZUL_DARK:      '#1A5F8A',
  AZUL_MED:       '#2676AC',
  AZUL_PALE:      '#F0F9FF',
  NAR_MED:        '#F07A28',
  ROJO_PALE:      '#FEF2F2',
  ROJO_DARK:      '#DC2626',
  AMARILLO_PALE:  '#FFFBEB',
  AMARILLO_DARK:  '#D97706',
  VERDE_PALE:     '#ECFDF5',
  VERDE_DARK:     '#059669',
} as const;

const fmtCOP = (v: number) => `$${(v || 0).toLocaleString('es-CO')}`;

function getLogoPath(): string | null {
  const prod = path.join(process.cwd(), 'dist/assets/logo.png');
  const dev  = path.join(process.cwd(), 'src/assets/logo.png');
  return fs.existsSync(prod) ? prod : fs.existsSync(dev) ? dev : null;
}

// ─── Columnas PDF ─────────────────────────────────────────────────────────────
// LETTER landscape: 792 - 30(ML) - 30(MR) = 732pt
// Suma: 22+120+62+68+112+70+64+56+70+58+30 = 732 ✓

const PDF_COLS = [
  { label: 'N°',        w:  20, align: 'center' as const },
  { label: 'Cliente',   w: 116, align: 'left'   as const },
  { label: 'CC',        w:  62, align: 'center' as const },
  { label: 'Teléfono',  w:  66, align: 'center' as const },
  { label: 'Dirección', w: 104, align: 'left'   as const },
  { label: 'Préstamo',  w:  82, align: 'center' as const },  // 82pt: evita wrap en códigos tipo PR-DEMO-MORA-01
  { label: 'Cuota',     w:  62, align: 'right'  as const },
  { label: 'Fecha',     w:  56, align: 'center' as const },
  { label: 'Saldo',     w:  68, align: 'right'  as const },
  { label: 'Estado',    w:  58, align: 'center' as const },
  { label: 'Mora',      w:  38, align: 'center' as const },
];

const TABLE_LEFT  = 30;
const TABLE_WIDTH = PDF_COLS.reduce((s, c) => s + c.w, 0); // 732

// ─── EXCEL ────────────────────────────────────────────────────────────────────

export async function generarExcelRutaCobrador(
  filas: RutaCobradorRow[],
  meta:  RutaCobradorMeta,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  workbook.created = new Date();

  const ws = workbook.addWorksheet(`Ruta ${meta.rutaNombre}`, {
    views:      [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    pageSetup:  { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    properties: { tabColor: { argb: 'FF1A5F8A' } },
  });

  ws.columns = [
    { header: 'N°',          key: 'nro',            width: 5  },
    { header: 'Cliente',     key: 'cliente',        width: 28 },
    { header: 'CC / DNI',    key: 'cc',             width: 14 },
    { header: 'Teléfono',    key: 'telefono',       width: 14 },
    { header: 'Dirección',   key: 'direccion',      width: 30 },
    { header: 'N° Préstamo', key: 'numeroPrestamo', width: 14 },
    { header: 'Cuota',       key: 'cuota',          width: 14 },
    { header: 'Fecha Cuota', key: 'fechaCuota',     width: 14 },
    { header: 'Saldo',       key: 'saldo',          width: 16 },
    { header: 'Estado',      key: 'estadoPrestamo', width: 13 },
    { header: 'Días Mora',   key: 'diasMora',       width: 10 },
    { header: 'Cobrado ✔',   key: 'cobrado',        width: 14 },
    { header: 'Notas',       key: 'notas',          width: 22 },
  ] as any;

  const title = ws.addRow([
    `CRÉDITOS DEL SUR — RUTA ${meta.rutaNombre.toUpperCase()}` +
    `${meta.rutaCodigo ? ` (${meta.rutaCodigo})` : ''}`,
  ]);
  title.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  ws.mergeCells('A1:M1');
  ws.getRow(1).height = 26;

  const subtitle = ws.addRow([
    `Cobrador: ${meta.cobradorNombre}   |   Fecha: ${meta.fechaExport}   |` +
    `   Clientes: ${meta.totalClientes}   |   En mora: ${meta.enMora}`,
  ]);
  subtitle.font = { size: 10, color: { argb: 'FFFFFFFF' } };
  subtitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
  ws.mergeCells('A2:M2');
  ws.getRow(2).height = 18;

  ws.addRow([]);

  const headerRow = ws.getRow(4);
  (ws.columns as any[]).forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value     = col.header;
    cell.font      = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2676AC' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border    = {
      bottom: { style: 'thin', color: { argb: 'FFF07A28' } },
      right:  { style: 'thin', color: { argb: 'FFFFFFFF' } },
    };
  });
  headerRow.height = 22;

  filas.forEach((f, idx) => {
    const row = ws.addRow({
      nro:            f.nro,
      cliente:        f.cliente,
      cc:             f.cc,
      telefono:       f.telefono,
      direccion:      f.direccion,
      numeroPrestamo: f.numeroPrestamo,
      cuota:          f.cuota,
      fechaCuota:     f.fechaCuota,
      saldo:          f.saldo,
      estadoPrestamo: f.estadoPrestamo?.replace(/_/g, ' ') || '',
      diasMora:       f.diasMora,
      cobrado:        '',
      notas:          '',
    } as any);

    if (idx % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }

    row.getCell(7).numFmt = '#,##0';
    row.getCell(9).numFmt = '#,##0';

    const semCell = row.getCell(11);
    if (f.semaforo === 'ROJO')     semCell.font = { bold: true, color: { argb: 'FFDC2626' } };
    if (f.semaforo === 'AMARILLO') semCell.font = { bold: true, color: { argb: 'FFD97706' } };
    if (f.semaforo === 'VERDE')    semCell.font = { bold: true, color: { argb: 'FF059669' } };
  });

  ws.addRow([]);
  const totalRow = ws.addRow([
    '', 'TOTALES', '', '', '',
    `${filas.length} filas`,
    meta.totalCuota, '',
    meta.totalSaldo, '',
    `${meta.enMora} en mora`,
    '', '',
  ]);
  ws.mergeCells(`A${totalRow.number}:B${totalRow.number}`);
  totalRow.eachCell({ includeEmpty: true }, cell => {
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  });
  totalRow.getCell(7).numFmt = '#,##0';
  totalRow.getCell(9).numFmt = '#,##0';

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data:        Buffer.from(buffer as ArrayBuffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename:    `ruta-${meta.rutaNombre}-${fecha}.xlsx`,
  };
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

export async function generarPDFRutaCobrador(
  filas: RutaCobradorRow[],
  meta:  RutaCobradorMeta,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  const PW = doc.page.width;   // 792
  const PH = doc.page.height;  // 612

  // ── Watermark (sin cambios respecto al original) ──────────────────────────
  const drawWatermark = () => {
    try {
      const lp = getLogoPath();
      if (lp) {
        doc.save();
        doc.opacity(0.08);
        doc.image(lp, (PW - 300) / 2, (PH - 300) / 2, { width: 300 });
        doc.restore();
      }
    } catch {}
  };

  let pageNumber = 1;

  const drawFooter = () => {
    doc.fontSize(7).font('Helvetica').fillColor(C.GRIS_MED)
       .text(
         `Pág. ${pageNumber}  •  Generado: ${new Date().toLocaleString('es-CO')}`,
         0, PH - 25,
         { align: 'right', width: PW - 30 },
       );
  };

  // ── Header (igual que el original) ────────────────────────────────────────
  const drawHeader = (): number => {
    const W = doc.page.width;

    doc.fontSize(22).font('Helvetica-Bold').fillColor(C.AZUL_DARK)
       .text('Créditos del Sur', 30, 25);
    doc.fontSize(9).font('Helvetica').fillColor(C.NAR_MED)
       .text('RUTA DEL COBRADOR', 30, 52, { characterSpacing: 0.5 });

    doc.roundedRect(W - 180, 20, 148, 44, 5).fillAndStroke(C.BLANCO, C.GRIS_LINEA);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(C.GRIS_MED)
       .text('FECHA', W - 180, 28, { width: 148, align: 'center' });
    doc.fontSize(10).font('Helvetica-Bold').fillColor(C.AZUL_DARK)
       .text(meta.fechaExport, W - 180, 40, { width: 148, align: 'center' });

    doc.roundedRect(30, 76, W - 60, 44, 8).fillAndStroke(C.AZUL_PALE, C.GRIS_LINEA);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(C.AZUL_DARK)
       .text(
         `Ruta: ${meta.rutaNombre}${meta.rutaCodigo ? ` (${meta.rutaCodigo})` : ''}`,
         40, 85, { width: W - 80 },
       );
    doc.fontSize(9).font('Helvetica').fillColor(C.GRIS_TXT)
       .text(
         `Cobrador: ${meta.cobradorNombre}   |   Clientes: ${meta.totalClientes}   |   En mora: ${meta.enMora}`,
         40, 103, { width: W - 80 },
       );

    const kW = (W - 60) / 4;
    const kY = 132;
    const cards = [
      { label: 'TOTAL FILAS',  val: String(filas.length), bg: '#D6E9F5', color: C.AZUL_DARK, isNum: false },
      { label: 'TOTAL CUOTA',  val: meta.totalCuota,      bg: '#FDE8D5', color: '#D95C0F',   isNum: true  },
      { label: 'TOTAL SALDO',  val: meta.totalSaldo,      bg: '#F0F4F8', color: C.GRIS_TXT,  isNum: true  },
      { label: 'EN MORA',      val: String(meta.enMora),  bg: C.ROJO_PALE, color: C.ROJO_DARK, isNum: false },
    ];
    cards.forEach((m, i) => {
      const mx = 30 + i * (kW + 4);
      doc.roundedRect(mx, kY, kW, 44, 6).fillAndStroke(m.bg, C.GRIS_LINEA);
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.GRIS_MED)
         .text(m.label, mx, kY + 10, { width: kW, align: 'center' });
      doc.fontSize(13).font('Helvetica-Bold').fillColor(m.color)
         .text(
           m.isNum ? fmtCOP(m.val as number) : String(m.val),
           mx, kY + 23, { width: kW, align: 'center' },
         );
    });

    return kY + 58;
  };

  const drawTableHeader = (y: number): number => {
    doc.rect(TABLE_LEFT, y, TABLE_WIDTH, 24).fill(C.AZUL_MED);
    doc.rect(TABLE_LEFT, y + 24, TABLE_WIDTH, 2).fill(C.NAR_MED);
    let x = TABLE_LEFT;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(C.BLANCO);
    PDF_COLS.forEach(col => {
      const padX = 3;
      doc.text(col.label, x + padX, y + 7, {
        width:    col.w - padX * 2,
        align:    col.align,
        lineBreak: false,
      });
      x += col.w;
    });
    return y + 26;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  drawWatermark();
  let y = drawHeader();
  y = drawTableHeader(y);

  doc.font('Helvetica').fontSize(7.2);

  filas.forEach((fila, i) => {
    const vals: string[] = [
      String(fila.nro),
      fila.cliente              || '',
      fila.cc                   || '',
      fila.telefono             || '',
      fila.direccion            || '',
      fila.numeroPrestamo       || '',
      fila.cuota > 0  ? fmtCOP(fila.cuota)  : '—',
      fila.fechaCuota           || '',
      fila.saldo > 0  ? fmtCOP(fila.saldo)  : '—',
      (fila.estadoPrestamo || '').replace(/_/g, ' '),
      fila.diasMora > 0 ? `${fila.diasMora}d` : '',
    ];

    // Altura dinámica
    doc.font('Helvetica').fontSize(7.2);
    let rowH = 18;
    vals.forEach((v, ci) => {
      const h = doc.heightOfString(v, { width: PDF_COLS[ci].w - 8, lineBreak: true });
      if (h + 8 > rowH) rowH = h + 8;
    });
    if (rowH > 42) rowH = 42;

    // Salto de página
    if (y + rowH > PH - 70) {
      drawFooter();
      pageNumber++;
      doc.addPage();
      drawWatermark();
      y = drawHeader();
      y = drawTableHeader(y);
      doc.font('Helvetica').fontSize(7.2);
    }

    // Fondo de fila
    const baseBg = i % 2 === 0 ? C.BLANCO : C.AZUL_PALE;
    const bg =
      fila.semaforo === 'ROJO'     ? C.ROJO_PALE :
      fila.semaforo === 'AMARILLO' ? C.AMARILLO_PALE :
      baseBg;
    doc.rect(TABLE_LEFT, y, TABLE_WIDTH, rowH).fill(bg);
    doc.moveTo(TABLE_LEFT, y + rowH)
       .lineTo(TABLE_LEFT + TABLE_WIDTH, y + rowH)
       .strokeColor(C.GRIS_LINEA).lineWidth(0.4).stroke();

    // Texto de celdas.
    // Solo Cliente(1) y Dirección(4) pueden hacer wrap (cols anchas).
    // El resto usa lineBreak:false + ellipsis para que el cursor Y de PDFKit
    // no se desplace, garantizando que todas las celdas arranquen en y+4.
    const WRAP_COLS = new Set([1, 4]);

    let x = TABLE_LEFT;
    vals.forEach((v, ci) => {
      const col = PDF_COLS[ci];
      if (ci === 8) {
        doc.font('Helvetica-Bold').fillColor(C.AZUL_DARK);
      } else if (ci === 10 && fila.semaforo === 'ROJO') {
        doc.font('Helvetica-Bold').fillColor(C.ROJO_DARK);
      } else if (ci === 10 && fila.semaforo === 'AMARILLO') {
        doc.font('Helvetica-Bold').fillColor(C.AMARILLO_DARK);
      } else {
        doc.font(ci === 1 ? 'Helvetica-Bold' : 'Helvetica').fillColor(C.GRIS_TXT);
      }

      const canWrap = WRAP_COLS.has(ci);

      const padX = 3;
      const cellWidth = col.w - padX * 2;
      const textH = doc.heightOfString(v, {
        width:     cellWidth,
        align:     col.align,
        lineBreak: canWrap,
        ellipsis:  !canWrap,
      });

      const yText = canWrap
        ? (y + 4)
        : (y + Math.max(4, (rowH - textH) / 2));

      doc.text(v, x + padX, yText, {
        width:     cellWidth,
        align:     col.align,
        lineBreak: canWrap,
        ellipsis:  !canWrap,
      });

      x += col.w;
    });

    y += rowH;
  });

  // ── Totales ────────────────────────────────────────────────────────────────
  y += 10;
  doc.rect(TABLE_LEFT, y, TABLE_WIDTH, 26).fill('#1E293B');
  doc.rect(TABLE_LEFT, y, TABLE_WIDTH, 2).fill(C.NAR_MED);
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.BLANCO)
     .text(
       `TOTAL CUOTA: ${fmtCOP(meta.totalCuota)}   |   TOTAL SALDO: ${fmtCOP(meta.totalSaldo)}`,
       TABLE_LEFT + 8, y + 9,
       { width: TABLE_WIDTH - 16, align: 'center' },
     );

  y += 38;
  doc.fontSize(7.5).font('Helvetica-Oblique').fillColor(C.GRIS_MED)
     .text(
       'Documento expedido por Créditos del Sur. Las cifras presentadas son definitivas y sujetas a revisión de auditoría.',
       TABLE_LEFT, y,
       { align: 'center', width: TABLE_WIDTH },
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
    filename:    `ruta-${meta.rutaNombre}-${fecha}.pdf`,
  };
}