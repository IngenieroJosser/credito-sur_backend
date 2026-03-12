/**
 * ============================================================================
 * TEMPLATE: CUENTAS VENCIDAS
 * ============================================================================
 * Usado en: reports.service.ts → exportarCuentasVencidas()
 * Genera reporte de préstamos con fecha de vencimiento superada.
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface VencidasRow {
  numeroPrestamo: string;
  cliente: string;
  documento: string;
  diasVencidos: number;
  saldoPendiente: number;
  montoOriginal: number;
  interesesMora: number;
  nivelRiesgo: string;
  ruta: string;
  fechaVencimiento: string;
  estado?: string;
}

export interface VencidasTotales {
  totalVencido: number;
  totalRegistros: number;
  diasPromedioVencimiento: number;
  totalInteresesMora: number;
  totalMontoOriginal: number;
}

// ─── Utilidad: estilo de celda de encabezado ──────────────────────────────────

function appHeader(cell: ExcelJS.Cell, bg: string): void {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.border = {
    bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
    right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
  };
}

function appRow(cell: ExcelJS.Cell, par: boolean): void {
  if (par) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  cell.border = {
    bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
    right:  { style: 'hair', color: { argb: 'FFE2E8F0' } },
  };
  cell.alignment = { vertical: 'middle' };
}

// ─── Generador Excel ──────────────────────────────────────────────────────────

export async function generarExcelVencidas(
  filas: VencidasRow[],
  totales: VencidasTotales,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  workbook.created = new Date();

  // ── Hoja 1: Detalle de cuentas vencidas ──────────────────────────────────────
  const ws = workbook.addWorksheet('Cuentas Vencidas', {
    views: [{ state: 'frozen', ySplit: 5, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    properties: { tabColor: { argb: 'FF7C3AED' } },
  });

  ws.columns = [
    { key: 'num',       width: 18 },
    { key: 'cliente',   width: 30 },
    { key: 'documento', width: 13 },
    { key: 'fechaVenc', width: 14 },
    { key: 'dias',      width: 11 },
    { key: 'saldo',     width: 16 },
    { key: 'original',  width: 16 },
    { key: 'intereses', width: 16 },
    { key: 'riesgo',    width: 13 },
    { key: 'ruta',      width: 20 },
    { key: 'estado',    width: 14 },
  ] as any;

  // Fila 1: Encabezado institucional
  ws.mergeCells('A1:K1');
  const t1 = ws.getCell('A1');
  t1.value = 'CRÉDITOS DEL SUR';
  t1.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
  t1.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 32;

  // Fila 2: Nombre del reporte
  ws.mergeCells('A2:K2');
  const t2 = ws.getCell('A2');
  t2.value = 'REPORTE DE CUENTAS VENCIDAS';
  t2.font = { bold: true, size: 12, color: { argb: 'FF7C3AED' } };
  t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
  t2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;

  // Fila 3: Fecha y metadata
  ws.mergeCells('A3:E3');
  ws.getCell('A3').value = `Generado: ${new Date().toLocaleString('es-CO')}`;
  ws.getCell('A3').font = { size: 9, color: { argb: 'FF475569' } };
  ws.mergeCells('F3:K3');
  ws.getCell('F3').value = `Total registros: ${totales.totalRegistros}  |  Fecha: ${fecha}`;
  ws.getCell('F3').font = { size: 9, color: { argb: 'FF475569' } };
  ws.getCell('F3').alignment = { horizontal: 'right' };
  ws.getRow(3).height = 16;

  // Fila 4: Indicadores financieros en celdas individuales
  const kpis = [
    { label: 'Saldo Vencido Total', val: totales.totalVencido, fmt: '"$"#,##0' },
    { label: 'Monto Original',       val: totales.totalMontoOriginal, fmt: '"$"#,##0' },
    { label: 'Intereses de Mora',    val: totales.totalInteresesMora, fmt: '"$"#,##0' },
    { label: 'Promedio Días Venc.',  val: totales.diasPromedioVencimiento, fmt: '0' },
  ];
  for (let i = 0; i < kpis.length; i++) {
    const colLabel = i * 2 + 1;
    const colVal   = i * 2 + 2;
    if (colLabel > 11) break;
    const lCell = ws.getCell(4, colLabel);
    const vCell = ws.getCell(4, colVal);
    lCell.value = kpis[i].label;
    lCell.font = { bold: true, size: 8, color: { argb: 'FF64748B' } };
    vCell.value = kpis[i].val;
    vCell.numFmt = kpis[i].fmt;
    vCell.font = { bold: true, size: 9, color: { argb: 'FF7C3AED' } };
    vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
  }
  ws.getRow(4).height = 18;

  // Fila 5: Encabezados de tabla
  const headers = ['N° Préstamo','Cliente','Documento','Fecha Vencim.','Días Vencidos',
    'Saldo Pendiente','Monto Original','Intereses Mora','Nivel Riesgo','Ruta','Estado'];
  const hRow = ws.getRow(5);
  headers.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    appHeader(cell, 'FF7C3AED');
  });
  hRow.height = 22;
  ws.autoFilter = { from: 'A5', to: 'K5' };

  // Datos
  const riesgoColor: Record<string, string> = {
    ROJO: 'FFFECACA', AMARILLO: 'FFFEF9C3',
    LISTA_NEGRA: 'FFFFE4E6', VERDE: 'FFDCFCE7',
  };
  filas.forEach((fila, idx) => {
    const row = ws.addRow([
      fila.numeroPrestamo,
      fila.cliente,
      fila.documento,
      fila.fechaVencimiento,
      fila.diasVencidos,
      fila.saldoPendiente,
      fila.montoOriginal,
      fila.interesesMora,
      fila.nivelRiesgo,
      fila.ruta,
      fila.estado?.replace(/_/g, ' ') || '',
    ]);
    row.height = 18;
    const esPar = idx % 2 === 0;
    row.eachCell(cell => appRow(cell, esPar));

    // Formatos moneda
    row.getCell(6).numFmt = '"$"#,##0';
    row.getCell(7).numFmt = '"$"#,##0';
    row.getCell(8).numFmt = '"$"#,##0';

    // Alineación centrada para números
    [5, 9].forEach(c => row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' });
    [4].forEach(c => row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' });

    // Color por nivel de riesgo
    const bg = riesgoColor[fila.nivelRiesgo?.toUpperCase() || ''];
    if (bg) {
      row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    }

    // Resaltar días vencidos altos
    if (fila.diasVencidos > 90) {
      row.getCell(5).font = { bold: true, color: { argb: 'FFDC2626' } };
    }
  });

  // Fila total
  ws.addRow([]);
  const totRow = ws.addRow([
    `TOTALES — ${totales.totalRegistros} cuentas vencidas`,
    '', '', '',
    `Días prom: ${totales.diasPromedioVencimiento}`,
    totales.totalVencido,
    totales.totalMontoOriginal,
    totales.totalInteresesMora,
    '', '', '',
  ]);
  totRow.height = 20;
  ws.mergeCells(`A${totRow.number}:D${totRow.number}`);
  totRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1B4B' } };
  });
  totRow.getCell(6).numFmt = '"$"#,##0';
  totRow.getCell(7).numFmt = '"$"#,##0';
  totRow.getCell(8).numFmt = '"$"#,##0';

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer as ArrayBuffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `cuentas-vencidas-${fecha}.xlsx`,
  };
}

// ─── Generador PDF ────────────────────────────────────────────────────────────

export async function generarPDFVencidas(
  filas: VencidasRow[],
  totales: VencidasTotales,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  const BLANCO     = '#FFFFFF';
  const GRIS_CLR   = '#E2E8F0';
  const GRIS_MED   = '#94A3B8';
  const GRIS_TXT   = '#475569';
  const PURPLE     = '#7C3AED';
  const PURPLE_MED = '#8B5CF6';
  const PURPLE_DARK = '#5B21B6';
  const PURPLE_PALE = '#F5F3FF';
  const ROJO_DARK  = '#DC2626';

  const fmtCOP   = (v: number) => `$${(v || 0).toLocaleString('es-CO')}`;

  const getLogoPath = () => {
    const pProd = path.join(process.cwd(), 'dist/assets/logo.png');
    const pDev  = path.join(process.cwd(), 'src/assets/logo.png');
    return fs.existsSync(pProd) ? pProd : (fs.existsSync(pDev) ? pDev : null);
  };

  const drawWatermark = () => {
    try {
      const lp = getLogoPath();
      if (lp) {
        doc.save();
        doc.opacity(0.08); 
        const W = doc.page.width;
        const H = doc.page.height;
        doc.image(lp, (W - 300) / 2, (H - 300) / 2, { width: 300 });
        doc.restore();
      }
    } catch(e) {}
  };

  let pageNumber = 1;

  const drawPageHeader = (): number => {
    const W = doc.page.width;

    doc.fontSize(22).font('Helvetica-Bold').fillColor(PURPLE_DARK)
       .text('Créditos del Sur', 30, 25);
    doc.fontSize(9).font('Helvetica').fillColor(PURPLE)
       .text('REPORTE DE CUENTAS VENCIDAS', 30, 52, { characterSpacing: 0.5 });

    doc.roundedRect(W - 180, 20, 148, 44, 5).fillAndStroke(BLANCO, GRIS_CLR);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(GRIS_MED)
       .text('FECHA GENERACIÓN', W - 180, 28, { width: 148, align: 'center' });
    doc.fontSize(10).font('Helvetica-Bold').fillColor(PURPLE_DARK)
       .text(new Date().toLocaleDateString('es-CO'), W - 180, 40, { width: 148, align: 'center' });

    const kW = (doc.page.width - 60) / 4;
    const kY = 98;
    [
      { label: 'SALDO VENCIDO TOTAL', val: fmtCOP(totales.totalVencido), bg: PURPLE_PALE, color: PURPLE_DARK, isNum: true },
      { label: 'MONTO ORIGINAL',      val: fmtCOP(totales.totalMontoOriginal), bg: '#F0F4F8', color: GRIS_TXT, isNum: true },
      { label: 'INTERESES MORA',      val: fmtCOP(totales.totalInteresesMora), bg: '#FEF2F2', color: ROJO_DARK, isNum: true },
      { label: 'PROMEDIO DÍAS VENC.', val: String(totales.diasPromedioVencimiento), bg: '#F0F4F8', color: GRIS_TXT, isNum: false },
    ].forEach((m, i) => {
      const mx = 30 + i * (kW + 4);
      doc.roundedRect(mx, kY, kW, 44, 6).fillAndStroke(m.bg, GRIS_CLR);
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(GRIS_MED)
         .text(m.label, mx, kY + 10, { width: kW, align: 'center' });
      doc.fontSize(13).font('Helvetica-Bold').fillColor(m.color)
         .text(m.val, mx, kY + 23, { width: kW, align: 'center' });
    });
    return kY + 58;
  };

  const drawFooter = () => {
    const W = doc.page.width;
    const H = doc.page.height;
    doc.fontSize(7).font('Helvetica').fillColor(GRIS_MED);
    doc.text(`Pág. ${pageNumber}  •  Generado: ${new Date().toLocaleString('es-CO')}`, 0, H - 25, { align: 'right', width: W - 30 });
  };

  const realCols = [
    { label: 'N° Préstamo', width: 78 },
    { label: 'Cliente',      width: 140 }, // Expanded width
    { label: 'Fecha Venc.',  width: 62 },
    { label: 'Días Venc.',   width: 55 },
    { label: 'Saldo Pend.',  width: 76 },
    { label: 'Mto. Orig.',   width: 76 },
    { label: 'Int. Mora',    width: 70 },
    { label: 'Riesgo',       width: 55 },
    { label: 'Ruta',         width: 80 },
  ];
  
  // Total table width = 78+140+62+55+76+76+70+55+80 = 692 (fits landscape ~ 730 margins)

  const tableLeft = 30;
  const tableWidth = realCols.reduce((s, c) => s + c.width, 0);

  const drawTableHeader = (y: number): number => {
    doc.rect(tableLeft, y, tableWidth, 24).fill(PURPLE_MED);
    doc.rect(tableLeft, y + 24, tableWidth, 2).fill(PURPLE_DARK);
    let x = tableLeft;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(BLANCO);
    realCols.forEach(col => {
      doc.text(col.label, x + 4, y + 7, { width: col.width - 8, align: 'center' });
      x += col.width;
    });
    return y + 30;
  };

  drawWatermark();
  let y = drawPageHeader();
  y = drawTableHeader(y);

  doc.font('Helvetica').fontSize(7.5);

  filas.forEach((fila, i) => {
    let maxRowHeight = 17;
    const vals = [
      fila.numeroPrestamo || '',
      fila.cliente || '',
      fila.fechaVencimiento || '',
      String(fila.diasVencidos || 0),
      fmtCOP(fila.saldoPendiente || 0),
      fmtCOP(fila.montoOriginal || 0),
      fmtCOP(fila.interesesMora || 0),
      fila.nivelRiesgo || '',
      fila.ruta || '',
    ];

    doc.font('Helvetica').fontSize(7.5);
    vals.forEach((val, ci) => {
      if (ci === 0 || ci === 1 || ci === 4 || ci === 6) doc.font('Helvetica-Bold');
      const h = doc.heightOfString(val, { width: realCols[ci].width - 8, lineBreak: true });
      if (h + 8 > maxRowHeight) maxRowHeight = h + 8;
      doc.font('Helvetica');
    });

    if (y + maxRowHeight > doc.page.height - 70) {
      drawFooter();
      pageNumber++;
      doc.addPage();
      drawWatermark();
      y = drawPageHeader();
      y = drawTableHeader(y);
      doc.font('Helvetica').fontSize(7.5);
    }

    const riesgo = fila.nivelRiesgo?.toUpperCase() || '';
    const baseBg = i % 2 === 0 ? BLANCO : PURPLE_PALE;
    const bg = fila.diasVencidos > 90 ? '#FEF2F2' : baseBg; // Rojo claro si > 90 días
    
    doc.rect(tableLeft, y, tableWidth, maxRowHeight).fill(bg);
    doc.moveTo(tableLeft, y + maxRowHeight)
       .lineTo(tableLeft + tableWidth, y + maxRowHeight)
       .strokeColor(GRIS_CLR).lineWidth(0.4).stroke();

    let x = tableLeft;
    vals.forEach((v, ci) => {
      const align = (ci >= 4 && ci <= 6) ? 'right' : (ci === 3 || ci === 7 ? 'center' : 'left');

      if (ci === 4) {
         doc.font('Helvetica-Bold').fillColor(PURPLE_DARK);
      } else if (ci === 6) {
         doc.font('Helvetica-Bold').fillColor(ROJO_DARK);
      } else if (ci === 3 && fila.diasVencidos > 90) {
         doc.font('Helvetica-Bold').fillColor(ROJO_DARK);
      } else if (ci === 1) {
         doc.font('Helvetica-Bold').fillColor(PURPLE_DARK);
      } else if (ci === 7) {
         if (riesgo === 'ROJO' || riesgo === 'LISTA_NEGRA') doc.font('Helvetica-Bold').fillColor(ROJO_DARK);
         else doc.font('Helvetica-Bold').fillColor(GRIS_TXT);
      } else {
         doc.font('Helvetica').fillColor(GRIS_TXT);
      }

      doc.text(v, x + 4, y + 4, { width: realCols[ci].width - 8, align, lineBreak: true });
      x += realCols[ci].width;
    });
    y += maxRowHeight;
  });

  // Totales
  y += 8;
  doc.rect(tableLeft, y, tableWidth, 26).fill('#1E1B4B');
  doc.rect(tableLeft, y, tableWidth, 2).fill(PURPLE_MED);

  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BLANCO);
  doc.text(
    `TOTAL GENERAL  /  ${totales.totalRegistros} vencidas`,
    tableLeft + 6, y + 8,
    { width: realCols.slice(0, 4).reduce((s, c) => s + c.width, 0) - 10 }
  );

  let tx = tableLeft + realCols.slice(0, 4).reduce((s, c) => s + c.width, 0);
  [
    `$${totales.totalVencido.toLocaleString('es-CO')}`,
    `$${totales.totalMontoOriginal.toLocaleString('es-CO')}`,
    `$${totales.totalInteresesMora.toLocaleString('es-CO')}`,
  ].forEach((val, i) => {
    const ci = i + 4; // a partir de la columna 4
    if (ci < realCols.length) {
      doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(8);
      doc.text(val, tx + 4, y + 9, { width: realCols[ci].width - 8, align: 'right' });
      tx += realCols[ci].width;
    }
  });

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
    data: buffer,
    contentType: 'application/pdf',
    filename: `cuentas-vencidas-${fecha}.pdf`,
  };
}
