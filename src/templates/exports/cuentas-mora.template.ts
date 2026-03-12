/**
 * ============================================================================
 * TEMPLATE: CUENTAS EN MORA
 * ============================================================================
 * Usado en: reports.service.ts → generarReporteMora()
 * Genera reportes Excel y PDF de préstamos en estado de mora.
 * Formato Excel inspirado en el modelo de Estado de Cuentas Diarias.
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

// ─── Paleta corporativa ────────────────────────────────────────────────────────
const COLOR = {
  rojo:        'FFDC2626',
  rojoClaro:   'FFFEF2F2',
  rojoBorde:   'FFEF4444',
  gris:        'FF1E293B',
  grisClaro:   'FFF8FAFC',
  grisTexto:   'FF475569',
  blanco:      'FFFFFFFF',
  amarillo:    'FFFEF08A',
  naranjaClaro:'FFFFF7ED',
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface MoraRow {
  numeroPrestamo: string;
  cliente: string;
  documento: string;
  diasMora: number;
  montoMora: number;
  montoTotalDeuda: number;
  cuotasVencidas: number;
  ruta: string;
  cobrador: string;
  nivelRiesgo: string;
  ultimoPago?: string;
  // Campos financieros adicionales (§4.2, §5.6 propuesta)
  tasaMoraAplicada?: number;       // % de mora por día aplicado (ej: 0.5%)
  interesEspecial?: number;        // Monto de interés especial si fue aprobado
  interesEspecialAprobado?: boolean; // Si el coordinador aprobó un interés especial
  comentario?: string;             // Nota del cobrador o supervisor
  capitalPendiente?: number;       // Solo capital, sin intereses ni mora
  interesesPendientes?: number;    // Total intereses aún no pagados
}

export interface MoraTotales {
  totalMora: number;
  totalDeuda: number;
  totalCasosCriticos: number;
  totalRegistros: number;
  totalCapitalPendiente?: number;  // Suma del capital puro pendiente
  totalInteresesPendientes?: number; // Suma de intereses aún no pagados
  totalCasosInteresEspecial?: number; // Cuantos tienen interés especial aprobado
}

// ─── Utilidades Excel ─────────────────────────────────────────────────────────

function estiloEncabezado(cell: ExcelJS.Cell, bgArgb: string): void {
  cell.font = { bold: true, color: { argb: COLOR.blanco }, size: 10 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
  cell.border = {
    top: { style: 'thin', color: { argb: bgArgb } },
    bottom: { style: 'medium', color: { argb: COLOR.blanco } },
    left: { style: 'thin', color: { argb: COLOR.blanco } },
    right: { style: 'thin', color: { argb: COLOR.blanco } },
  };
}

function estiloFila(cell: ExcelJS.Cell, par: boolean): void {
  if (par) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.grisClaro } };
  }
  cell.border = {
    bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
    right: { style: 'hair', color: { argb: 'FFE2E8F0' } },
  };
  cell.alignment = { vertical: 'middle' };
}

// ─── Generador Excel ──────────────────────────────────────────────────────────

export async function generarExcelMora(
  filas: MoraRow[],
  totales: MoraTotales,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  workbook.created = new Date();
  workbook.properties.date1904 = false;

  // ── Hoja 1: Detalle de cuentas en mora ──────────────────────────────────────
  const ws = workbook.addWorksheet('Cuentas en Mora', {
    views: [{ state: 'frozen', ySplit: 5, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    properties: { tabColor: { argb: 'FFDC2626' } },
  });

  ws.columns = [
    { key: 'num',           width: 18 },
    { key: 'cliente',       width: 30 },
    { key: 'documento',     width: 14 },
    { key: 'diasMora',      width: 11 },
    { key: 'capitalPend',   width: 16 },
    { key: 'interesesPend', width: 16 },
    { key: 'montoMora',     width: 16 },
    { key: 'deudaTotal',    width: 18 },
    { key: 'cuotas',        width: 13 },
    { key: 'tasaMora',      width: 13 },
    { key: 'intEspecial',   width: 16 },
    { key: 'ruta',          width: 20 },
    { key: 'cobrador',      width: 24 },
    { key: 'riesgo',        width: 13 },
    { key: 'ultimoPago',    width: 14 },
    { key: 'comentario',    width: 28 },
  ] as any;
  const moraLastCol = 'P';

  // Fila 1: Encabezado institucional
  ws.mergeCells(`A1:${moraLastCol}1`);
  const tituloCell = ws.getCell('A1');
  tituloCell.value = 'CRÉDITOS DEL SUR';
  tituloCell.font = { bold: true, size: 18, color: { argb: COLOR.blanco } };
  tituloCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.rojo } };
  tituloCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 32;

  // Fila 2: Subtítulo del reporte
  ws.mergeCells(`A2:${moraLastCol}2`);
  const subCell = ws.getCell('A2');
  subCell.value = 'REPORTE DE CARTERA EN MORA';
  subCell.font = { bold: true, size: 12, color: { argb: COLOR.rojo } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0F0' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;

  // Fila 3: Metadatos
  ws.mergeCells('A3:D3');
  ws.getCell('A3').value = `Fecha de Generación: ${new Date().toLocaleString('es-CO')}`;
  ws.getCell('A3').font = { size: 9, color: { argb: COLOR.grisTexto } };
  ws.mergeCells('E3:H3');
  ws.getCell('E3').value = `Casos Críticos: ${totales.totalCasosCriticos}  |  Int. Especial: ${totales.totalCasosInteresEspecial ?? 0} casos`;
  ws.getCell('E3').font = { bold: true, size: 9, color: { argb: COLOR.rojo } };
  ws.getCell('E3').alignment = { horizontal: 'center' };
  ws.mergeCells('I3:P3');
  ws.getCell('I3').value = `Total Registros: ${totales.totalRegistros}`;
  ws.getCell('I3').font = { size: 9, color: { argb: COLOR.grisTexto } };
  ws.getCell('I3').alignment = { horizontal: 'right' };
  ws.getRow(3).height = 16;

  // Fila 4: Resumen financiero en celdas
  const moraKpis = [
    { label: 'Mora Acumulada',     val: totales.totalMora,                fmt: '"$"#,##0' },
    { label: 'Deuda Total',        val: totales.totalDeuda,               fmt: '"$"#,##0' },
    { label: 'Capital Pendiente',  val: totales.totalCapitalPendiente ?? 0, fmt: '"$"#,##0' },
    { label: 'Interés Pendiente',  val: totales.totalInteresesPendientes ?? 0, fmt: '"$"#,##0' },
  ];
  moraKpis.forEach((kpi, i) => {
    const colL = i * 2 + 1;
    const colV = i * 2 + 2;
    const lc = ws.getCell(4, colL);
    const vc = ws.getCell(4, colV);
    lc.value = kpi.label;
    lc.font = { bold: true, size: 8, color: { argb: COLOR.grisTexto } };
    vc.value = kpi.val;
    vc.numFmt = kpi.fmt;
    vc.font = { bold: true, size: 9, color: { argb: COLOR.rojo } };
    vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.rojoClaro } };
  });
  ws.mergeCells('I4:J4');
  ws.getCell('I4').value = `Casos Críticos: ${totales.totalCasosCriticos}`;
  ws.getCell('I4').font = { bold: true, size: 9, color: { argb: COLOR.rojo } };
  ws.mergeCells('K4:P4');
  ws.getCell('K4').value = `Int. Especial Aprobado: ${totales.totalCasosInteresEspecial ?? 0} casos`;
  ws.getCell('K4').font = { bold: true, size: 8, color: { argb: 'FFB45309' } };
  ws.getRow(4).height = 18;

  // Fila 5: Encabezados de columnas
  const headers = [
    'N° Préstamo','Cliente','Documento','Días Mora',
    'Capital Pend.','Interés Pend.','Monto Mora','Deuda Total',
    'Cuotas Venc.','Tasa Mora %','Int. Especial',
    'Ruta','Cobrador','Nivel Riesgo','Ultimo Pago','Comentario',
  ];
  const hRow = ws.getRow(5);
  headers.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    estiloEncabezado(cell, COLOR.rojo);
  });
  hRow.height = 22;
  ws.autoFilter = { from: 'A5', to: `${moraLastCol}5` };

  // Datos
  filas.forEach((fila, idx) => {
    const row = ws.addRow([
      fila.numeroPrestamo,
      fila.cliente,
      fila.documento,
      fila.diasMora,
      fila.capitalPendiente ?? 0,
      fila.interesesPendientes ?? 0,
      fila.montoMora,
      fila.montoTotalDeuda,
      fila.cuotasVencidas,
      fila.tasaMoraAplicada != null ? `${fila.tasaMoraAplicada}%` : '-',
      fila.interesEspecial ?? 0,
      fila.ruta,
      fila.cobrador,
      fila.nivelRiesgo,
      fila.ultimoPago || 'Sin pagos',
      fila.comentario || '',
    ]);
    row.height = 18;
    const esPar = idx % 2 === 0;
    row.eachCell(cell => estiloFila(cell, esPar));

    // Formato moneda
    [5, 6, 7, 8, 11].forEach(c => {
      row.getCell(c).numFmt = '"$"#,##0';
      row.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    // Centrar números
    [4, 9].forEach(c => row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' });

    // Resaltar interés especial aprobado en naranja
    if (fila.interesEspecialAprobado) {
      row.getCell(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      row.getCell(11).font = { bold: true, color: { argb: 'FFB45309' } };
    }

    // Resaltar casos críticos
    const riesgo = fila.nivelRiesgo?.toUpperCase() || '';
    if (riesgo === 'ROJO' || riesgo === 'LISTA_NEGRA') {
      row.getCell(2).font  = { bold: true, color: { argb: COLOR.rojo }, size: 10 };
      row.getCell(14).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
    }
  });

  // Fila de totales
  ws.addRow([]);
  const totRow = ws.addRow([
    `TOTALES — ${totales.totalRegistros} préstamos en mora`,
    '', '', '',
    totales.totalCapitalPendiente ?? 0,
    totales.totalInteresesPendientes ?? 0,
    totales.totalMora,
    totales.totalDeuda,
    '', '', '', '', '', '', '', '',
  ]);
  totRow.height = 20;
  ws.mergeCells(`A${totRow.number}:D${totRow.number}`);
  totRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: COLOR.blanco }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.gris } };
  });
  [5, 6, 7, 8].forEach(c => {
    totRow.getCell(c).numFmt = '"$"#,##0';
    totRow.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
  });

  // ── Hoja 2: Resumen por nivel de riesgo ──────────────────────────────────────
  const wsResumen = workbook.addWorksheet('Resumen por Riesgo', {
    views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    properties: { tabColor: { argb: 'FFEF4444' } },
  });
  wsResumen.columns = [
    { key: 'nivel', width: 22 },
    { key: 'casos', width: 12 },
    { key: 'mora',  width: 20 },
    { key: 'deuda', width: 20 },
  ] as any;

  wsResumen.mergeCells('A1:D1');
  const rT = wsResumen.getCell('A1');
  rT.value = 'CRÉDITOS DEL SUR — Resumen por Nivel de Riesgo';
  rT.font = { bold: true, size: 14, color: { argb: COLOR.blanco } };
  rT.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.rojo } };
  rT.alignment = { horizontal: 'center', vertical: 'middle' };
  wsResumen.getRow(1).height = 28;

  wsResumen.addRow([]);
  const rhRow = wsResumen.getRow(3);
  ['Nivel de Riesgo','Casos','Mora Acumulada','Deuda Total'].forEach((h, i) => {
    const cell = rhRow.getCell(i + 1);
    cell.value = h;
    estiloEncabezado(cell, COLOR.rojo);
  });
  rhRow.height = 20;

  const porNivel: Record<string, { casos: number; mora: number; deuda: number }> = {};
  filas.forEach(f => {
    const n = f.nivelRiesgo || 'Sin clasificar';
    if (!porNivel[n]) porNivel[n] = { casos: 0, mora: 0, deuda: 0 };
    porNivel[n].casos++;
    porNivel[n].mora  += f.montoMora || 0;
    porNivel[n].deuda += f.montoTotalDeuda || 0;
  });

  const nivelColors: Record<string, string> = {
    ROJO: 'FFFECACA', AMARILLO: 'FFFEF9C3', VERDE: 'FFDCFCE7', LISTA_NEGRA: 'FFFFE4E6',
  };

  Object.entries(porNivel).forEach(([nivel, datos], idx) => {
    const row = wsResumen.addRow([nivel, datos.casos, datos.mora, datos.deuda]);
    row.height = 18;
    const bg = nivelColors[nivel.toUpperCase()] || (idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF');
    row.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.alignment = { vertical: 'middle' };
    });
    row.getCell(3).numFmt = '"$"#,##0';
    row.getCell(4).numFmt = '"$"#,##0';
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer as ArrayBuffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `cuentas-mora-${fecha}.xlsx`,
  };
}

// ─── Generador PDF ────────────────────────────────────────────────────────────

export async function generarPDFMora(
  filas: MoraRow[],
  totales: MoraTotales,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  const BLANCO     = '#FFFFFF';
  const GRIS_CLR   = '#E2E8F0';
  const GRIS_MED   = '#94A3B8';
  const GRIS_TXT   = '#475569';
  const AZUL_DARK  = '#1A5F8A';
  const AZUL_MED   = '#2676AC';
  const AZUL_PALE  = '#F0F9FF';
  const NAR_DARK   = '#D95C0F';
  const NAR_MED    = '#F07A28';
  const NAR_SOFT   = '#FDE8D5';
  const ROJO_DARK  = '#B91C1C';
  const ROJO_PALE  = '#FEF2F2';

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

    doc.fontSize(22).font('Helvetica-Bold').fillColor(AZUL_DARK)
       .text('Créditos del Sur', 30, 25);
    doc.fontSize(9).font('Helvetica').fillColor(ROJO_DARK) // Mora uses red subtitle
       .text('REPORTE DE CARTERA EN MORA', 30, 52, { characterSpacing: 0.5 });

    doc.roundedRect(W - 180, 20, 148, 44, 5).fillAndStroke(BLANCO, GRIS_CLR);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(GRIS_MED)
       .text('FECHA', W - 180, 28, { width: 148, align: 'center' });
    doc.fontSize(11).font('Helvetica-Bold').fillColor(AZUL_DARK)
       .text(fecha, W - 180, 40, { width: 148, align: 'center' });

    const kW = (doc.page.width - 60) / 4;
    const kY = 98;
    [
      { label: 'MORA ACUMULADA',  val: totales.totalMora, bg: ROJO_PALE, color: ROJO_DARK, isNum: true },
      { label: 'DEUDA TOTAL',     val: totales.totalDeuda, bg: '#F0F4F8', color: GRIS_TXT, isNum: true },
      { label: 'CASOS CRÍTICOS',  val: totales.totalCasosCriticos, bg: ROJO_PALE, color: ROJO_DARK, isNum: false },
      { label: 'INT. ESPECIAL',   val: (totales.totalCasosInteresEspecial ?? 0) + ' casos', bg: NAR_SOFT, color: NAR_DARK, isNum: false },
    ].forEach((m, i) => {
      const mx = 30 + i * (kW + 4);
      doc.roundedRect(mx, kY, kW, 44, 6).fillAndStroke(m.bg, GRIS_CLR);
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(GRIS_MED)
         .text(m.label, mx, kY + 10, { width: kW, align: 'center' });
      doc.fontSize(13).font('Helvetica-Bold').fillColor(m.color)
         .text(m.isNum ? fmtCOP(m.val as number) : String(m.val), mx, kY + 23, { width: kW, align: 'center' });
    });
    return kY + 58;
  };

  const drawFooter = () => {
    const W = doc.page.width;
    const H = doc.page.height;
    doc.fontSize(7).font('Helvetica').fillColor(GRIS_MED);
    doc.text(`Pág. ${pageNumber}  •  Generado: ${new Date().toLocaleString('es-CO')}`, 0, H - 25, { align: 'right', width: W - 30 });
  };

  const cols = [
    { label: 'N° Préstamo', width: 78 },
    { label: 'Cliente',      width: 140 },
    { label: 'Días Mora',   width: 55 },
    { label: 'Monto Mora',  width: 78 },
    { label: 'Deuda Total', width: 78 },
    { label: 'Cuotas',      width: 48 },
    { label: 'Ruta',        width: 80 },
    { label: 'Cobrador',    width: 110 },
    { label: 'Riesgo',      width: 65 },
  ];
  const tableLeft = 30;
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);

  const drawTableHeader = (y: number): number => {
    doc.rect(tableLeft, y, tableWidth, 24).fill(AZUL_MED);
    doc.rect(tableLeft, y + 24, tableWidth, 2).fill(ROJO_DARK); // Red line instead of orange
    let x = tableLeft;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(BLANCO);
    cols.forEach(col => {
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
      String(fila.diasMora || 0),
      fmtCOP(fila.montoMora || 0),
      fmtCOP(fila.montoTotalDeuda || 0),
      String(fila.cuotasVencidas || 0),
      fila.ruta || '',
      fila.cobrador || '',
      fila.nivelRiesgo || '',
    ];

    doc.font('Helvetica').fontSize(7.5);
    vals.forEach((val, ci) => {
      if (ci === 1 || ci === 3 || ci === 4) doc.font('Helvetica-Bold');
      const h = doc.heightOfString(val, { width: cols[ci].width - 8, lineBreak: true });
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
    const baseBg = i % 2 === 0 ? BLANCO : AZUL_PALE;
    const bg = (riesgo === 'ROJO' || riesgo === 'LISTA_NEGRA') ? ROJO_PALE : baseBg;
    
    doc.rect(tableLeft, y, tableWidth, maxRowHeight).fill(bg);
    doc.moveTo(tableLeft, y + maxRowHeight)
       .lineTo(tableLeft + tableWidth, y + maxRowHeight)
       .strokeColor(GRIS_CLR).lineWidth(0.4).stroke();

    let x = tableLeft;
    vals.forEach((v, ci) => {
      const align = ci >= 2 && ci <= 5 ? 'right' : (ci === 8 ? 'center' : 'left');

      if (ci === 3) {
         doc.font('Helvetica-Bold').fillColor(ROJO_DARK);
      } else if (ci === 4) {
         doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
      } else if (ci === 1) {
         doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
      } else if (ci === 8) {
         doc.font('Helvetica-Bold').fillColor((riesgo === 'ROJO' || riesgo === 'LISTA_NEGRA') ? ROJO_DARK : GRIS_TXT);
      } else {
         doc.font('Helvetica').fillColor(GRIS_TXT);
      }

      doc.text(v, x + 4, y + 4, { width: cols[ci].width - 8, align, lineBreak: true });
      x += cols[ci].width;
    });
    y += maxRowHeight;
  });

  // Totales
  y += 8;
  doc.rect(tableLeft, y, tableWidth, 26).fill(AZUL_DARK);
  doc.rect(tableLeft, y, tableWidth, 2).fill(ROJO_DARK); // Red bottom line on headers

  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BLANCO);
  doc.text(
    `TOTAL GENERAL  /  ${totales.totalRegistros} préstamos en mora`,
    tableLeft + 6, y + 8,
    { width: cols.slice(0, 3).reduce((s, c) => s + c.width, 0) - 10 }
  );

  let tx = tableLeft + cols.slice(0, 3).reduce((s, c) => s + c.width, 0);
  [
    `$${totales.totalMora.toLocaleString('es-CO')}`,
    `$${totales.totalDeuda.toLocaleString('es-CO')}`,
  ].forEach((val, i) => {
    const ci = i + 3; // a partir de la columna 4
    if (ci < cols.length) {
      doc.fillColor(i === 0 ? '#FECACA' : BLANCO).font('Helvetica-Bold').fontSize(8);
      doc.text(val, tx + 4, y + 9, { width: cols[ci].width - 8, align: 'right' });
      tx += cols[ci].width;
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
    filename: `cuentas-mora-${fecha}.pdf`,
  };
}
