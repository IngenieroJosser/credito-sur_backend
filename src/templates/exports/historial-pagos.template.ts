/**
 * ============================================================================
 * TEMPLATE: HISTORIAL DE PAGOS
 * ============================================================================
 * Usado en: payments.service.ts → exportPayments()
 * Genera reporte de pagos recibidos en el período con formato profesional.
 * Paleta corporativa: Azul #1A5F8A / Naranja #F07A28 / Blanco
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

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
  capitalPagado?: number;
  interesPagado?: number;
  moraPagada?: number;
  esAbono: boolean;
  comentario?: string;
  origenCaja?: string;
}

export interface PagosTotales {
  totalRecaudado: number;
  totalPagos: number;
  totalCapital?: number;
  totalIntereses?: number;
  totalMora?: number;
  totalAbonos?: number;
  cantidadAbonos?: number;
  cantidadCuotasCompletas?: number;
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

function applyDataCell(
  cell: ExcelJS.Cell,
  par: boolean,
  overrideBg?: string,
): void {
  cell.fill      = solidFill(overrideBg ?? (par ? C.BLANCO : C.AZUL_PALE));
  cell.font      = { size: 9, color: { argb: C.GRIS_TEXTO }, name: 'Calibri' };
  cell.alignment = { vertical: 'middle' };
  cell.border    = cellBorder();
}

// ─── Logo helper ──────────────────────────────────────────────────────────────

function getLogoPath(): string | null {
  const prod = path.join(process.cwd(), 'dist/assets/logo.png');
  const dev  = path.join(process.cwd(), 'src/assets/logo.png');
  return fs.existsSync(prod) ? prod : fs.existsSync(dev) ? dev : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERADOR EXCEL
// ═══════════════════════════════════════════════════════════════════════════════

export async function generarExcelPagos(
  filas: PagoRow[],
  totales: PagosTotales,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {

  const workbook  = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  workbook.created = new Date();

  // ── Hoja 1: Detalle de pagos ──────────────────────────────────────────────
  const ws = workbook.addWorksheet('Historial de Pagos', {
    views:     [{ state: 'frozen', ySplit: 9, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    properties: { tabColor: { argb: C.AZUL_DARK } },
  });

  // Anchos — generosos en Cliente y Cobrador para que quepan nombres completos
  ws.columns = [
    { key: 'fecha',        width: 14 },
    { key: 'numeroPago',   width: 15 },
    { key: 'numeroPrest',  width: 18 },
    { key: 'cliente',      width: 36 },   // ← amplio
    { key: 'documento',    width: 14 },
    { key: 'tipo',         width: 12 },
    { key: 'monto',        width: 18 },
    { key: 'capital',      width: 17 },
    { key: 'interes',      width: 17 },
    { key: 'mora',         width: 14 },
    { key: 'metodo',       width: 14 },
    { key: 'cobrador',     width: 36 },   // ← amplio
    { key: 'origenCaja',   width: 15 },
    { key: 'comentario',   width: 32 },
  ] as ExcelJS.Column[];

  const LAST = 'N';
  const NCOLS = 14;

  // ── Fila 1: Banda azul decorativa ─────────────────────────────────────────
  ws.getRow(1).height = 6;
  for (let c = 1; c <= NCOLS; c++) ws.getCell(1, c).fill = solidFill(C.AZUL_DARK);

  // ── Filas 2-3: Logo + Título ───────────────────────────────────────────────
  ws.getRow(2).height = 45;
  ws.getRow(3).height = 20;
  ws.mergeCells('A2:C3');

  const logoPath = getLogoPath();
  if (logoPath) {
    const logoId = workbook.addImage({ filename: logoPath, extension: 'png' });
    ws.addImage(logoId, {
      tl: { col: 0, row: 1 },
      ext: { width: 110, height: 55 },
    });
  }

  ws.mergeCells('D2:M2');
  const tituloCell = ws.getCell('D2');
  tituloCell.value     = 'CRÉDITOS DEL SUR';
  tituloCell.font      = { bold: true, size: 20, color: { argb: C.AZUL_DARK }, name: 'Calibri' };
  tituloCell.alignment = { horizontal: 'left', vertical: 'middle' };
  tituloCell.fill      = solidFill(C.BLANCO);

  ws.mergeCells('D3:M3');
  const subCell = ws.getCell('D3');
  subCell.value     = 'HISTORIAL DE PAGOS';
  subCell.font      = { size: 10, italic: true, color: { argb: C.NAR_MED }, name: 'Calibri' };
  subCell.alignment = { horizontal: 'left', vertical: 'middle' };
  subCell.fill      = solidFill(C.BLANCO);

  // ── Fila 4: Separador naranja ──────────────────────────────────────────────
  ws.getRow(4).height = 3;
  for (let c = 1; c <= NCOLS; c++) ws.getCell(4, c).fill = solidFill(C.NAR_MED);

  // ── Fila 5: Meta ───────────────────────────────────────────────────────────
  ws.getRow(5).height = 18;
  ws.mergeCells('A5:F5');
  const metaL = ws.getCell('A5');
  metaL.value     = `Generado: ${new Date().toLocaleString('es-CO')}  |  Período: ${fecha}`;
  metaL.font      = { size: 9, color: { argb: C.GRIS_MED }, name: 'Calibri' };
  metaL.alignment = { horizontal: 'left', vertical: 'middle' };
  metaL.fill      = solidFill(C.GRIS_FONDO);

  ws.mergeCells('G5:M5');
  const metaR = ws.getCell('G5');
  metaR.value     = `Total: ${totales.totalPagos}  |  Abonos: ${totales.cantidadAbonos ?? 0}  |  Cuotas: ${totales.cantidadCuotasCompletas ?? 0}`;
  metaR.font      = { size: 9, color: { argb: C.GRIS_MED }, name: 'Calibri' };
  metaR.alignment = { horizontal: 'right', vertical: 'middle' };
  metaR.fill      = solidFill(C.GRIS_FONDO);

  // ── Filas 6-7: KPIs ───────────────────────────────────────────────────────
  ws.getRow(6).height = 16;
  ws.getRow(7).height = 26;

  const kpis: [string, number, string, string][] = [
    ['TOTAL RECAUDADO', totales.totalRecaudado,        C.AZUL_DARK, C.AZUL_SOFT],
    ['CAPITAL',          totales.totalCapital  ?? 0,   C.GRIS_TEXTO, C.GRIS_ALT],
    ['INTERESES',        totales.totalIntereses ?? 0,  C.NAR_DARK,  C.NAR_SOFT],
    ['MORA',             totales.totalMora      ?? 0,  C.GRIS_TEXTO, C.GRIS_ALT],
  ];

  const kpiRanges: [string, string][] = [['A','C'],['D','F'],['G','J'],['K','M']];

  kpis.forEach(([label, val, fg, bg], i) => {
    const [sc, ec] = kpiRanges[i];
    ws.mergeCells(`${sc}6:${ec}6`);
    const lc = ws.getCell(`${sc}6`);
    lc.value     = label;
    lc.font      = { bold: true, size: 8, color: { argb: C.GRIS_MED }, name: 'Calibri' };
    lc.alignment = { horizontal: 'center', vertical: 'middle' };
    lc.fill      = solidFill(bg);

    ws.mergeCells(`${sc}7:${ec}7`);
    const vc = ws.getCell(`${sc}7`);
    vc.value      = val;
    vc.numFmt     = '"$"#,##0';
    vc.font       = { bold: true, size: 14, color: { argb: fg }, name: 'Calibri' };
    vc.alignment  = { horizontal: 'center', vertical: 'middle' };
    vc.fill       = solidFill(bg);
  });

  // ── Fila 8: Separador ─────────────────────────────────────────────────────
  ws.getRow(8).height = 2;
  for (let c = 1; c <= NCOLS; c++) ws.getCell(8, c).fill = solidFill(C.GRIS_CLARO);

  // ── Fila 9: Encabezados tabla ─────────────────────────────────────────────
  ws.getRow(9).height = 28;
  const headers = ['Fecha','N° Pago','N° Préstamo','Cliente','Documento',
    'Tipo','Monto Total','Capital','Interés','Mora','Método','Cobrador','Caja/P.V.','Comentario'];
  headers.forEach((h, i) => applyHeader(ws.getCell(9, i + 1)));
  headers.forEach((h, i) => { ws.getCell(9, i + 1).value = h; });
  ws.autoFilter = { from: 'A9', to: `${LAST}9` };

  // ── Filas de datos ────────────────────────────────────────────────────────
  filas.forEach((fila, idx) => {
    const r   = 10 + idx;
    const par = idx % 2 === 0;
    ws.getRow(r).height = 20;

    const tipo = fila.esAbono ? 'ABONO' : 'CUOTA';
    const vals: any[] = [
      fmtFecha(fila.fecha),
      fila.numeroPago,
      fila.numeroPrestamo,
      fila.cliente,
      fila.documento,
      tipo,
      fila.montoTotal,
      fila.capitalPagado  ?? 0,
      fila.interesPagado  ?? 0,
      fila.moraPagada     ?? 0,
      fila.metodoPago,
      fila.cobrador,
      fila.origenCaja     || '',
      fila.comentario     ?? '',
    ];

    vals.forEach((val, ci) => {
      const cell = ws.getCell(r, ci + 1);
      cell.value = val;
      applyDataCell(cell, par);

      // Moneda
      if ([7,8,9,10].includes(ci + 1)) {
        cell.numFmt    = '"$"#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }

      // Wrap en nombre cliente / cobrador / comentario
      if ([4, 12, 14].includes(ci + 1)) {
        cell.alignment = { vertical: 'middle', wrapText: true };
      }

      // Caja/PV
      if (ci + 1 === 13) {
        cell.font = { size: 9, bold: true, color: { argb: C.NAR_DARK }, name: 'Calibri' };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      // Tipo pago destacado
      if (ci + 1 === 6) {
        if (fila.esAbono) {
          cell.fill = solidFill(C.NAR_PALE);
          cell.font = { bold: true, size: 9, color: { argb: C.NAR_DARK }, name: 'Calibri' };
        } else {
          cell.fill = solidFill(par ? C.AZUL_PALE : C.AZUL_SOFT);
          cell.font = { bold: true, size: 9, color: { argb: C.AZUL_DARK }, name: 'Calibri' };
        }
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      // Monto total en azul bold
      if (ci + 1 === 7) {
        cell.font = { bold: true, size: 9, color: { argb: C.AZUL_DARK }, name: 'Calibri' };
      }
    });
  });

  // ── Fila totales ──────────────────────────────────────────────────────────
  const tr = 10 + filas.length + 1;
  ws.getRow(tr).height = 26;

  ws.mergeCells(`A${tr}:F${tr}`);
  const totLabel = ws.getCell(`A${tr}`);
  totLabel.value     = `TOTALES — ${totales.totalPagos} pagos registrados`;
  totLabel.font      = { bold: true, size: 10, color: { argb: C.BLANCO }, name: 'Calibri' };
  totLabel.fill      = solidFill(C.AZUL_DARK);
  totLabel.alignment = { horizontal: 'left', vertical: 'middle' };
  totLabel.border    = { top: { style: 'medium', color: { argb: C.NAR_MED } } };

  const totVals: [string, number][] = [
    ['G', totales.totalRecaudado],
    ['H', totales.totalCapital   ?? 0],
    ['I', totales.totalIntereses ?? 0],
    ['J', totales.totalMora      ?? 0],
  ];
  totVals.forEach(([col, val]) => {
    const cell    = ws.getCell(`${col}${tr}`);
    cell.value    = val;
    cell.numFmt   = '"$"#,##0';
    cell.font     = { bold: true, size: 10, color: { argb: C.NAR_SOFT }, name: 'Calibri' };
    cell.fill     = solidFill(C.AZUL_DARK);
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
    cell.border   = { top: { style: 'medium', color: { argb: C.NAR_MED } } };
  });
  for (let c = 11; c <= NCOLS; c++) {
    ws.getCell(tr, c).fill   = solidFill(C.AZUL_DARK);
    ws.getCell(tr, c).border = { top: { style: 'medium', color: { argb: C.NAR_MED } } };
  }

  // ── Watermark: logo semitransparente flotante ──────────────────────────────
  // Nota: ExcelJS no soporta opacidad nativa en imágenes. Para un watermark
  // real, pre-genera un PNG con transparencia reducida (10-12% alpha) usando
  // sharp o jimp y referencíalo aquí. Ejemplo:
  //
  //   const wmPath = path.join(process.cwd(), 'src/assets/logo-watermark.png');
  //   if (fs.existsSync(wmPath)) {
  //     const wmId = workbook.addImage({ filename: wmPath, extension: 'png' });
  //     ws.addImage(wmId, { tl: { col: 4, row: 11 }, ext: { width: 340, height: 170 } });
  //   }
  //
  // Para generar logo-watermark.png una sola vez:
  //   sharp('logo.png').ensureAlpha().modulate().composite([{...}]).toFile('logo-watermark.png')

  // ── Hoja 2: Por cobrador ───────────────────────────────────────────────────
  const ws2 = workbook.addWorksheet('Por Cobrador', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    properties: { tabColor: { argb: C.NAR_MED } },
  });
  ws2.getColumn('A').width = 38;
  ws2.getColumn('B').width = 16;
  ws2.getColumn('C').width = 22;

  ws2.getRow(1).height = 5;
  for (let c = 1; c <= 3; c++) ws2.getCell(1, c).fill = solidFill(C.AZUL_DARK);

  ws2.mergeCells('A2:C2');
  ws2.getRow(2).height = 30;
  const ws2T = ws2.getCell('A2');
  ws2T.value     = 'RECAUDO POR COBRADOR';
  ws2T.font      = { bold: true, size: 14, color: { argb: C.AZUL_DARK }, name: 'Calibri' };
  ws2T.fill      = solidFill(C.AZUL_SOFT);
  ws2T.alignment = { horizontal: 'center', vertical: 'middle' };

  ws2.getRow(3).height = 3;
  for (let c = 1; c <= 3; c++) ws2.getCell(3, c).fill = solidFill(C.NAR_MED);

  ws2.getRow(4).height = 22;
  ['Cobrador', 'Pagos', 'Monto Recaudado'].forEach((h, i) => {
    const cell = ws2.getCell(4, i + 1);
    cell.value = h;
    applyHeader(cell);
  });

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
      const r   = 5 + idx;
      const par = idx % 2 === 0;
      ws2.getRow(r).height = 20;

      const c1 = ws2.getCell(r, 1);
      c1.value     = cobrador;
      c1.font      = { size: 9, color: { argb: C.GRIS_TEXTO }, name: 'Calibri' };
      c1.fill      = solidFill(par ? C.BLANCO : C.AZUL_PALE);
      c1.alignment = { vertical: 'middle' };

      const c2 = ws2.getCell(r, 2);
      c2.value     = datos.cantidad;
      c2.font      = { bold: true, size: 9, color: { argb: C.AZUL_DARK }, name: 'Calibri' };
      c2.fill      = solidFill(par ? C.BLANCO : C.AZUL_PALE);
      c2.alignment = { horizontal: 'center', vertical: 'middle' };

      const c3 = ws2.getCell(r, 3);
      c3.value     = datos.monto;
      c3.numFmt    = '"$"#,##0';
      c3.font      = { bold: true, size: 9, color: { argb: C.NAR_DARK }, name: 'Calibri' };
      c3.fill      = solidFill(par ? C.BLANCO : C.AZUL_PALE);
      c3.alignment = { horizontal: 'right', vertical: 'middle' };
    });

  const tr2 = 5 + Object.keys(porCobrador).length + 1;
  ws2.getRow(tr2).height = 22;
  const t1 = ws2.getCell(tr2, 1);
  t1.value = 'TOTAL GENERAL'; t1.font = { bold: true, size: 10, color: { argb: C.BLANCO }, name: 'Calibri' };
  t1.fill = solidFill(C.AZUL_DARK); t1.alignment = { vertical: 'middle' };

  const t2 = ws2.getCell(tr2, 2);
  t2.value = filas.length; t2.font = { bold: true, size: 10, color: { argb: C.BLANCO }, name: 'Calibri' };
  t2.fill = solidFill(C.AZUL_DARK); t2.alignment = { horizontal: 'center', vertical: 'middle' };

  const t3 = ws2.getCell(tr2, 3);
  t3.value = totales.totalRecaudado; t3.numFmt = '"$"#,##0';
  t3.font = { bold: true, size: 10, color: { argb: C.NAR_SOFT }, name: 'Calibri' };
  t3.fill = solidFill(C.AZUL_DARK); t3.alignment = { horizontal: 'right', vertical: 'middle' };

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data:        Buffer.from(buffer as ArrayBuffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename:    `historial-pagos-${fecha}.xlsx`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERADOR PDF
// ═══════════════════════════════════════════════════════════════════════════════

export async function generarPDFPagos(
  filas: PagoRow[],
  totales: PagosTotales,
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
      doc.opacity(0.08);                          // Igual que en otros pdfs
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

    // Quitamos los colores de la cabecera superior y el fondo gris.

    // Título alineado a la izquierda (donde iría el logo)
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#1A5F8A') // Volvemos a Bold pero mantenemos mayúsculas/minúsculas
       .text('Créditos del Sur', 30, 25);
    doc.fontSize(9).font('Helvetica').fillColor('#F07A28')
       .text('HISTORIAL DE PAGOS', 30, 52, { characterSpacing: 0.5 });

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
      { label: 'TOTAL RECAUDADO', val: totales.totalRecaudado,        color: AZUL_DARK, bg: '#D6E9F5' },
      { label: 'TOTAL CAPITAL',   val: totales.totalCapital   ?? 0,   color: GRIS_TXT,  bg: '#F0F4F8' },
      { label: 'TOTAL INTERESES', val: totales.totalIntereses ?? 0,   color: NAR_DARK,  bg: '#FDE8D5' },
      { label: 'TOTAL MORA',      val: totales.totalMora      ?? 0,   color: GRIS_TXT,  bg: '#F0F4F8' },
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
    { label: 'N° Pago',      width: 53  },
    { label: 'N° Préstamo',  width: 63  },
    { label: 'Cliente',      width: 125 }, // Ya no truncamos
    { label: 'Tipo',         width: 48  }, // Nueva columna para ABONO / CUOTA
    { label: 'Monto Total',  width: 68  },
    { label: 'Capital',      width: 60  },
    { label: 'Interés',      width: 60  },
    { label: 'Método',       width: 55  },
    { label: 'Cobrador',     width: 90  }, 
    { label: 'Caja/P.V.',    width: 45  },
  ];
  const tableLeft  = 28;
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);

  const drawTableHeader = (y: number): number => {
    // Fondo cabecera
    doc.rect(tableLeft, y, tableWidth, 24).fill(AZUL_MED);
    // Línea naranja inferior
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
    
    // Primero, pre-calcular la altura que tomará esta fila
    let maxRowHeight = 17; // Altura mínima base
    const rowVals = [
      fmtFecha(fila.fecha),
      fila.numeroPago      || '',
      fila.numeroPrestamo  || '',
      fila.cliente         || '',
      fila.esAbono ? 'ABONO' : 'CUOTA',
      fmtCOP(fila.montoTotal),
      fmtCOP(fila.capitalPagado  ?? 0),
      fmtCOP(fila.interesPagado  ?? 0),
      fila.metodoPago      || '',
      fila.cobrador        || '',
      fila.origenCaja      || '', 
    ];

    doc.font('Helvetica').fontSize(7.5); // Asegurar fuente para medir
    rowVals.forEach((val, ci) => {
      const isBold = ci === 3 || ci === 5 || ci === 4;
      if (isBold) doc.font('Helvetica-Bold');
      const h = doc.heightOfString(val, { width: cols[ci].width - 8, lineBreak: true });
      if (h + 8 > maxRowHeight) maxRowHeight = h + 8; // + 8 de padding (Arriba y abajo)
      doc.font('Helvetica'); // Restaurar
    });

    // Nueva página si no hay espacio para la fila entera
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
      const isMoneyCol = ci >= 5 && ci <= 7;
      const align      = isMoneyCol ? 'right' : (ci === 4 || ci === 10 ? 'center' : 'left');

      if (ci === 5) {
        // Monto total: amarillo si abono o azul si cuota
        doc.font('Helvetica-Bold').fillColor(fila.esAbono ? NAR_DARK : AZUL_DARK);
      } else if (ci === 4) {
        // BADGE Tipo de pago
        doc.font('Helvetica-Bold').fillColor(fila.esAbono ? NAR_DARK : AZUL_DARK);
      } else if (ci === 6 || ci === 7) {
        doc.font('Helvetica').fillColor(GRIS_TXT);
      } else if (ci === 8) {
        doc.font('Helvetica').fillColor(GRIS_MED); // Metodo Pago
      } else if (ci === 9) {
        doc.font('Helvetica').fillColor(GRIS_TXT); // Cobrador
      } else if (ci === 10) {
        doc.font('Helvetica-Bold').fillColor(NAR_MED); // Caja/PV
      } else {
        doc.font('Helvetica').fillColor(ci === 3 ? AZUL_DARK : GRIS_TXT);
        if (ci === 3) doc.font('Helvetica-Bold');
      }

      doc.text(val, x + 4, y + 4, { width: cols[ci].width - 8, align, lineBreak: true });
      x += cols[ci].width;
    });

    y += maxRowHeight;
  });

  // ── Fila totales ──────────────────────────────────────────────────────────
  y += 8;
  doc.rect(tableLeft, y, tableWidth, 26).fill(AZUL_DARK);
  // Línea naranja superior totales
  doc.rect(tableLeft, y, tableWidth, 2).fill(NAR_MED);

  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BLANCO);
  doc.text(
    `TOTAL GENERAL  /  ${totales.totalPagos} pagos`,
    tableLeft + 6, y + 8,
    { width: cols.slice(0, 5).reduce((s, c) => s + c.width, 0) - 10 }
  );

  // Totales numéricos
  let tx = tableLeft + cols.slice(0, 5).reduce((s, c) => s + c.width, 0);
  [
    { val: totales.totalRecaudado,        color: NAR_MED  },
    { val: totales.totalCapital   ?? 0,   color: NAR_SOFT },
    { val: totales.totalIntereses ?? 0,   color: NAR_SOFT },
  ].forEach(({ val, color }, ci) => {
    doc.fillColor(color).font('Helvetica-Bold').fontSize(ci === 0 ? 9 : 8);
    doc.text(fmtCOP(val), tx + 4, y + (ci === 0 ? 7 : 9),
      { width: cols[5 + ci].width - 8, align: 'right', lineBreak: false });
    tx += cols[5 + ci].width;
  });

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
    filename:    `historial-pagos-${fecha}.pdf`,
  };
}