/**
 * ============================================================================
 * TEMPLATE: CARTERA DE CRÉDITOS
 * ============================================================================
 * Usado en: loans.service.ts → exportLoans()
 * Endpoint: GET /loans/export?format=excel|pdf
 *
 * Por cada cuenta se reporta:
 *   Capital original, capital actual (pendiente), total adeudado,
 *   interés recogido, moras, recaudo, progreso — filtrable por fechas.
 * Fuente: Propuesta de Desarrollo §114
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface CarteraRow {
  numeroPrestamo: string;
  cliente: string;
  dni: string;
  producto: string;
  estado: string;
  // Montos
  montoTotal: number;         // Capital original prestado
  montoPendiente: number;     // Capital actual (saldo de capital sin intereses)
  montoPagado: number;        // Capital ya pagado
  totalAdeudado: number;      // Capital pendiente + intereses pendientes + mora
  interesRecogido: number;    // Total de intereses ya cobrados
  mora: number;               // Mora acumulada pendiente
  recaudo: number;            // Suma total de todo lo recibido (capital + interés + mora)
  // Cuotas
  cuotasPagadas: number;
  cuotasTotales: number;
  progreso: number;           // % cuotas pagadas
  // Clasificación
  riesgo: string;
  ruta: string;
  cobrador?: string;
  // Fechas
  fechaInicio: Date | string;
  fechaFin: Date | string;
  diasVencidos?: number;      // Si está vencido, cuántos días
}

export interface CarteraTotales {
  montoTotal: number;         // Capital total prestado en la cartera
  montoPendiente: number;     // Capital actual total
  totalAdeudado: number;      // Total adeudado (capital + intereses + mora)
  interesRecogido: number;    // Total intereses cobrados
  mora: number;               // Mora total pendiente
  recaudo: number;            // Total recaudado
  montoPagado: number;        // Capital total pagado
  totalRegistros: number;
}

// ─── Colores corporativos ─────────────────────────────────────────────────────
const AZUL       = 'FF004F7B';
const AZUL_CLARO = 'FFF0F9FF';
const NARANJA    = 'FFF37920';
const NARANJA_CLARO = 'FFFFEDD5';
const GRIS_OSC   = 'FF1E293B';

function colHdr(cell: ExcelJS.Cell): void {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.border = {
    bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
    right:  { style: 'thin',   color: { argb: 'FFFFFFFF' } },
  };
}

function fmtF(f: Date | string | undefined): string {
  if (!f) return '';
  const d = f instanceof Date ? f : new Date(f as string);
  return isNaN(d.getTime()) ? String(f) : d.toLocaleDateString('es-CO');
}

// ─── Generador Excel ──────────────────────────────────────────────────────────

export async function generarExcelCartera(
  filas: CarteraRow[],
  totales: CarteraTotales,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  workbook.created = new Date();

  // ── Hoja 1: Detalle de cartera ────────────────────────────────────────────
  const ws = workbook.addWorksheet('Cartera de Créditos', {
    views: [{ state: 'frozen', ySplit: 5, xSplit: 2 }],  // Congela N° y Cliente
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  ws.columns = [
    { key: 'num',            width: 17 },
    { key: 'cliente',        width: 28 },
    { key: 'dni',            width: 13 },
    { key: 'producto',       width: 20 },
    { key: 'estado',         width: 14 },
    { key: 'capitalOrig',    width: 16 },
    { key: 'capitalActual',  width: 16 },
    { key: 'capitalPagado',  width: 16 },
    { key: 'interesRecog',   width: 16 },
    { key: 'mora',           width: 14 },
    { key: 'recaudo',        width: 16 },
    { key: 'totalAdeudado',  width: 18 },
    { key: 'cuotas',         width: 12 },
    { key: 'progreso',       width: 11 },
    { key: 'riesgo',         width: 12 },
    { key: 'ruta',           width: 18 },
    { key: 'cobrador',       width: 20 },
    { key: 'fechaInicio',    width: 13 },
    { key: 'fechaFin',       width: 13 },
    { key: 'diasVenc',       width: 11 },
  ] as any;

  const numCols = 20;
  const lastColLetter = 'T';

  // F1 — Encabezado institucional
  ws.mergeCells(`A1:${lastColLetter}1`);
  const c1 = ws.getCell('A1');
  c1.value = 'CRÉDITOS DEL SUR';
  c1.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
  c1.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 32;

  // F2 — Nombre del reporte
  ws.mergeCells(`A2:${lastColLetter}2`);
  const c2 = ws.getCell('A2');
  c2.value = 'LISTADO DE CRÉDITOS';
  c2.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NARANJA } };
  c2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;

  // F3 — Metadata
  ws.mergeCells('A3:G3');
  ws.getCell('A3').value = `Generado: ${new Date().toLocaleString('es-CO')}`;
  ws.getCell('A3').font = { size: 9, color: { argb: 'FF475569' } };
  ws.mergeCells('H3:T3');
  ws.getCell('H3').value = `Total registros: ${totales.totalRegistros}  |  Fecha: ${fecha}`;
  ws.getCell('H3').font = { size: 9, color: { argb: 'FF475569' } };
  ws.getCell('H3').alignment = { horizontal: 'right' };
  ws.getRow(3).height = 16;

  // F4 — KPIs financieros (cada uno en su celda)
  const kpis: Array<{ label: string; val: number; fmt: string }> = [
    { label: 'Capital Original',  val: totales.montoTotal,       fmt: '"$"#,##0' },
    { label: 'Capital Actual',    val: totales.montoPendiente,   fmt: '"$"#,##0' },
    { label: 'Capital Pagado',    val: totales.montoPagado,      fmt: '"$"#,##0' },
    { label: 'Interés Recogido',  val: totales.interesRecogido,  fmt: '"$"#,##0' },
    { label: 'Mora Total',        val: totales.mora,             fmt: '"$"#,##0' },
    { label: 'Total Recaudo',     val: totales.recaudo,          fmt: '"$"#,##0' },
    { label: 'Total Adeudado',    val: totales.totalAdeudado,    fmt: '"$"#,##0' },
  ];
  // Usar columnas A–G para labels, H–N para valores (2 cols por KPI)
  kpis.forEach((kpi, i) => {
    const colL = i * 2 + 1;
    const colV = i * 2 + 2;
    if (colV > numCols) return;
    const lc = ws.getCell(4, colL);
    const vc = ws.getCell(4, colV);
    lc.value = kpi.label;
    lc.font = { bold: true, size: 8, color: { argb: 'FF64748B' } };
    vc.value = kpi.val;
    vc.numFmt = kpi.fmt;
    vc.font = { bold: true, size: 9, color: { argb: 'FF000000' } };
    vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NARANJA_CLARO } };
    vc.alignment = { horizontal: 'right', vertical: 'middle' };
  });
  ws.getRow(4).height = 18;

  // F5 — Encabezados de tabla
  const headers = [
    'N° Préstamo', 'Cliente', 'Cédula', 'Producto', 'Estado',
    'Capital Orig.', 'Capital Actual', 'Capital Pagado', 'Interés Recog.',
    'Mora', 'Recaudo', 'Total Adeudado',
    'Cuotas', 'Progreso %', 'Riesgo', 'Ruta', 'Cobrador',
    'Fecha Inicio', 'Fecha Fin', 'Días Venc.',
  ];
  const hRow = ws.getRow(5);
  headers.forEach((h, i) => { const cell = hRow.getCell(i + 1); cell.value = h; colHdr(cell); });
  hRow.height = 22;
  ws.autoFilter = { from: 'A5', to: `${lastColLetter}5` };

  // Colores por riesgo
  const riesgoFill: Record<string, string> = {
    ROJO: 'FFFECACA', AMARILLO: 'FFFEF9C3', VERDE: 'FFDCFCE7', LISTA_NEGRA: 'FFFFE4E6',
  };
  // Colores por estado
  const estadoFill: Record<string, string> = {
    ACTIVO: 'FFDCFCE7', EN_MORA: 'FFFECACA', VENCIDO: 'FFFFE4E6',
    CANCELADO: 'FFE0E7FF', CASTIGADO: 'FFF1F5F9',
  };

  filas.forEach((fila, idx) => {
    const row = ws.addRow([
      fila.numeroPrestamo,
      fila.cliente,
      fila.dni,
      fila.producto,
      fila.estado?.replace(/_/g, ' '),
      fila.montoTotal,
      fila.montoPendiente,
      fila.montoPagado,
      fila.interesRecogido,
      fila.mora,
      fila.recaudo,
      fila.totalAdeudado,
      `${fila.cuotasPagadas}/${fila.cuotasTotales}`,
      fila.progreso,
      fila.riesgo,
      fila.ruta,
      fila.cobrador || '',
      fmtF(fila.fechaInicio),
      fmtF(fila.fechaFin),
      fila.diasVencidos || 0,
    ]);
    row.height = 18;

    // Fondo alterno
    if (idx % 2 === 0) {
      row.eachCell(cell => {
        if (!cell.fill || (cell.fill as any).fgColor?.argb === 'FFFFFFFF') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
      });
    }

    // Bordes
    row.eachCell(cell => {
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
      cell.alignment = { ...cell.alignment, vertical: 'middle' };
    });

    // Formato moneda (cols 6–12)
    [6, 7, 8, 9, 10, 11, 12].forEach(c => {
      row.getCell(c).numFmt = '"$"#,##0';
      row.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    // Formato progreso
    row.getCell(14).numFmt = '0"%"';
    row.getCell(14).alignment = { horizontal: 'center', vertical: 'middle' };

    // Color estado (col 5)
    const estadoBg = estadoFill[fila.estado?.toUpperCase() || ''];
    if (estadoBg) row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: estadoBg } };

    // Color riesgo (col 15)
    const riesgoBg = riesgoFill[fila.riesgo?.toUpperCase() || ''];
    if (riesgoBg) row.getCell(15).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: riesgoBg } };

    // Días vencidos en rojo si > 0
    if ((fila.diasVencidos || 0) > 0) {
      row.getCell(20).font = { bold: true, color: { argb: 'FFDC2626' } };
    }

    // Fórmulas recomendadas
    if ((fila.montoTotal || 0) > 0) {
      row.getCell(14).value = { formula: `H${row.number}/F${row.number}` };
    }
  });

  const endRow = 5 + filas.length;
  // Fila de suma (fórmulas)
  const sumRow = ws.addRow([
    'TOTALES', '', '', '', '',
    { formula: `SUM(F6:F${endRow})` }, // Capital Orig
    { formula: `SUM(G6:G${endRow})` }, // Capital Actual
    { formula: `SUM(H6:H${endRow})` }, // Capital Pagado
    { formula: `SUM(I6:I${endRow})` }, // Interes Recogido
    { formula: `SUM(J6:J${endRow})` }, // Mora
    { formula: `SUM(K6:K${endRow})` }, // Recaudo
    { formula: `SUM(L6:L${endRow})` }, // Total adeudado
  ]);
  sumRow.height = 20;
  ws.mergeCells(`A${sumRow.number}:E${sumRow.number}`);
  const stCell = sumRow.getCell(1);
  stCell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
  stCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NARANJA } };
  stCell.alignment = { horizontal: 'right', vertical: 'middle' };
  
  [6, 7, 8, 9, 10, 11, 12].forEach(c => {
    sumRow.getCell(c).numFmt = '"$"#,##0';
    sumRow.getCell(c).font = { bold: true, color: { argb: 'FF000000' } };
    sumRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NARANJA_CLARO } };
    sumRow.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
  });

  // Fila totales
  ws.addRow([]);
  const totRow = ws.addRow([
    `TOTALES — ${totales.totalRegistros} créditos`,
    '', '', '', '',
    totales.montoTotal,
    totales.montoPendiente,
    totales.montoPagado,
    totales.interesRecogido,
    totales.mora,
    totales.recaudo,
    totales.totalAdeudado,
    '', '', '', '', '', '', '', '',
  ]);
  totRow.height = 20;
  totRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_OSC } };
  });
  [6, 7, 8, 9, 10, 11, 12].forEach(c => {
    totRow.getCell(c).numFmt = '"$"#,##0';
    totRow.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
  });

  // ── Hoja 2: Resumen por estado ────────────────────────────────────────────
  const ws2 = workbook.addWorksheet('Resumen por Estado');
  ws2.columns = [
    { key: 'estado',     width: 20 },
    { key: 'cantidad',   width: 12 },
    { key: 'capital',    width: 20 },
    { key: 'pendiente',  width: 20 },
    { key: 'recaudo',    width: 20 },
    { key: 'mora',       width: 20 },
    { key: 'adeudado',   width: 20 },
  ] as any;

  ws2.mergeCells('A1:G1');
  const ws2T = ws2.getCell('A1');
  ws2T.value = 'CRÉDITOS DEL SUR — Resumen Cartera por Estado';
  ws2T.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  ws2T.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
  ws2T.alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(1).height = 28;
  ws2.addRow([]);

  const ws2H = ws2.getRow(3);
  ['Estado','Cantidad','Capital Orig.','Capital Actual','Recaudo','Mora','Total Adeudado']
    .forEach((h, i) => { const cell = ws2H.getCell(i + 1); cell.value = h; colHdr(cell); });
  ws2H.height = 20;

  const porEstado: Record<string, {
    cantidad: number; capital: number; pendiente: number;
    recaudo: number; mora: number; adeudado: number;
  }> = {};
  filas.forEach(f => {
    const e = f.estado || 'DESCONOCIDO';
    if (!porEstado[e]) porEstado[e] = { cantidad: 0, capital: 0, pendiente: 0, recaudo: 0, mora: 0, adeudado: 0 };
    porEstado[e].cantidad++;
    porEstado[e].capital   += f.montoTotal || 0;
    porEstado[e].pendiente += f.montoPendiente || 0;
    porEstado[e].recaudo   += f.recaudo || 0;
    porEstado[e].mora      += f.mora || 0;
    porEstado[e].adeudado  += f.totalAdeudado || 0;
  });

  Object.entries(porEstado).forEach(([estado, d], i) => {
    const row = ws2.addRow([estado.replace(/_/g, ' '), d.cantidad, d.capital, d.pendiente, d.recaudo, d.mora, d.adeudado]);
    row.height = 18;
    const bg = estadoFill[estado.toUpperCase()] || (i % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF');
    row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; });
    [3, 4, 5, 6, 7].forEach(c => {
      row.getCell(c).numFmt = '"$"#,##0';
      row.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
    });
  });

  ws2.addRow([]);
  const ws2Tot = ws2.addRow([
    'TOTAL', totales.totalRegistros, totales.montoTotal,
    totales.montoPendiente, totales.recaudo, totales.mora, totales.totalAdeudado,
  ]);
  ws2Tot.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_OSC } };
  });
  [3, 4, 5, 6, 7].forEach(c => { ws2Tot.getCell(c).numFmt = '"$"#,##0'; });

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer as ArrayBuffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `listado-creditos-${fecha}.xlsx`,
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

  const BLANCO     = '#FFFFFF';
  const GRIS_FONDO = '#F8FAFC';
  const GRIS_CLR   = '#E2E8F0';
  const GRIS_MED   = '#94A3B8';
  const GRIS_TXT   = '#475569';
  const AZUL_DARK  = '#1A5F8A';
  const AZUL_MED   = '#2676AC';
  const AZUL_PALE  = '#F0F9FF';
  const NAR_DARK   = '#D95C0F';
  const NAR_MED    = '#F07A28';
  const NAR_SOFT   = '#FDE8D5';

  const fmtCOP   = (v: number) => `$${(v || 0).toLocaleString('es-CO')}`;

  const fs = require('fs');
  const path = require('path');

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
    doc.fontSize(9).font('Helvetica').fillColor(NAR_MED)
       .text('LISTADO DE CRÉDITOS', 30, 52, { characterSpacing: 0.5 });

    doc.roundedRect(W - 180, 20, 148, 44, 5).fillAndStroke(BLANCO, GRIS_CLR);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(GRIS_MED)
       .text('PERÍODO', W - 180, 28, { width: 148, align: 'center' });
    doc.fontSize(11).font('Helvetica-Bold').fillColor(AZUL_DARK)
       .text(fecha, W - 180, 40, { width: 148, align: 'center' });

    const kW = (doc.page.width - 60) / 4;
    const kY = 98;
    [
      { label: 'CAPITAL ORIGINAL',  val: totales.montoTotal, bg: '#D6E9F5', color: AZUL_DARK },
      { label: 'CAPITAL ACTUAL',    val: totales.montoPendiente, bg: '#F0F4F8', color: GRIS_TXT },
      { label: 'INTERÉS RECOGIDO',  val: totales.interesRecogido, bg: '#FDE8D5', color: NAR_DARK },
      { label: 'TOTAL RECAUDO',     val: totales.recaudo, bg: '#F0F4F8', color: GRIS_TXT },
    ].forEach((m, i) => {
      const mx = 30 + i * (kW + 4);
      doc.roundedRect(mx, kY, kW, 44, 6).fillAndStroke(m.bg, GRIS_CLR);
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(GRIS_MED)
         .text(m.label, mx, kY + 10, { width: kW, align: 'center' });
      doc.fontSize(13).font('Helvetica-Bold').fillColor(m.color)
         .text(fmtCOP(m.val), mx, kY + 23, { width: kW, align: 'center' });
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
    { label: 'N° Préstamo',   width: 78 },
    { label: 'Cliente',        width: 135 },
    { label: 'Estado',         width: 58 },
    { label: 'Cap. Orig.',     width: 72 },
    { label: 'Cap. Actual',    width: 72 },
    { label: 'Int. Recog.',    width: 72 },
    { label: 'Mora',           width: 60 },
    { label: 'Recaudo',        width: 72 },
    { label: 'Total Adeudado', width: 80 },
    { label: 'Prog.',          width: 33 }, // reducido para extender nombre
  ];
  const tableLeft = 30;
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

  drawWatermark();
  let y = drawPageHeader();
  y = drawTableHeader(y);

  doc.font('Helvetica').fontSize(7.5);

  const estadoPdf: Record<string, string> = {
    ACTIVO: '#DCFCE7', EN_MORA: '#FECACA', VENCIDO: '#FFE4E6',
    CANCELADO: '#E0E7FF', CASTIGADO: '#ECEFF1',
  };

  filas.forEach((fila, i) => {
    let maxRowHeight = 17;
    const vals = [
      fila.numeroPrestamo || '',
      fila.cliente || '',
      fila.estado?.replace(/_/g, ' ') || '',
      fmtCOP(fila.montoTotal || 0),
      fmtCOP(fila.montoPendiente || 0),
      fmtCOP(fila.interesRecogido || 0),
      fmtCOP(fila.mora || 0),
      fmtCOP(fila.recaudo || 0),
      fmtCOP(fila.totalAdeudado || 0),
      `${fila.progreso || 0}%`,
    ];

    doc.font('Helvetica').fontSize(7.5);
    vals.forEach((val, ci) => {
      if (ci === 1 || ci === 3 || ci === 8) doc.font('Helvetica-Bold');
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

    const baseBg = i % 2 === 0 ? BLANCO : AZUL_PALE;
    const bg = estadoPdf[fila.estado?.toUpperCase() || ''] || baseBg;
    
    doc.rect(tableLeft, y, tableWidth, maxRowHeight).fill(bg);
    doc.moveTo(tableLeft, y + maxRowHeight)
       .lineTo(tableLeft + tableWidth, y + maxRowHeight)
       .strokeColor(GRIS_CLR).lineWidth(0.4).stroke();

    let x = tableLeft;
    vals.forEach((v, ci) => {
      const align = ci >= 3 && ci <= 8 ? 'right' : (ci === 9 || ci === 2 ? 'center' : 'left');

      if (ci === 8) {
         doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
      } else if (ci === 1) {
         doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
      } else if (ci >= 3 && ci <= 7) {
         doc.font('Helvetica').fillColor(GRIS_TXT);
      } else if (ci === 2) {
         doc.font('Helvetica-Bold').fillColor(GRIS_TXT);
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
  doc.rect(tableLeft, y, tableWidth, 2).fill(NAR_MED);

  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BLANCO);
  doc.text(
    `TOTAL GENERAL  /  ${totales.totalRegistros} créditos`,
    tableLeft + 6, y + 8,
    { width: cols.slice(0, 3).reduce((s, c) => s + c.width, 0) - 10 }
  );

  let tx = tableLeft + cols.slice(0, 3).reduce((s, c) => s + c.width, 0);
  [
    totales.montoTotal,
    totales.montoPendiente,
    totales.interesRecogido,
    totales.mora,
    totales.recaudo,
    totales.totalAdeudado,
  ].forEach((val, i) => {
    const ci = i + 3; // a partir de la columna 4
    if (ci < cols.length) {
      doc.fillColor(val > 0 && ci === 8 ? NAR_SOFT : BLANCO).font('Helvetica-Bold').fontSize(8);
      doc.text(fmtCOP(val), tx + 4, y + 9, { width: cols[ci].width - 8, align: 'right' });
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
  doc.end();

  const buffer = await new Promise<Buffer>(resolve => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });
  return {
    data: buffer,
    contentType: 'application/pdf',
    filename: `listado-creditos-${fecha}.pdf`,
  };
}
