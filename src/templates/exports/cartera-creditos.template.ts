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
const AZUL       = 'FF08557F';
const AZUL_CLARO = 'FFF0F9FF';
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
  c2.font = { bold: true, size: 12, color: { argb: AZUL } };
  c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } };
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
    vc.font = { bold: true, size: 9, color: { argb: AZUL } };
    vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } };
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

  const BLUE = '#08557F';

  const drawPageHeader = (): number => {
    doc.rect(0, 0, doc.page.width, 50).fill(BLUE);
    doc.fontSize(16).font('Helvetica-Bold').fillColor('white').text('CRÉDITOS DEL SUR', 30, 10);
    doc.fontSize(10).font('Helvetica').fillColor('white').text('LISTADO DE CRÉDITOS', 30, 30);
    doc.fontSize(8).fillColor('white')
      .text(`Fecha: ${fecha}   |   Generado: ${new Date().toLocaleString('es-CO')}`,
        0, 36, { align: 'right', width: doc.page.width - 30 });

    const kW = (doc.page.width - 60) / 4;
    const kY = 58;
    [
      { label: 'CAPITAL ORIGINAL',  val: `$${totales.montoTotal.toLocaleString('es-CO')}` },
      { label: 'CAPITAL ACTUAL',    val: `$${totales.montoPendiente.toLocaleString('es-CO')}` },
      { label: 'INTERÉS RECOGIDO',  val: `$${totales.interesRecogido.toLocaleString('es-CO')}` },
      { label: 'TOTAL RECAUDO',     val: `$${totales.recaudo.toLocaleString('es-CO')}` },
    ].forEach((m, i) => {
      const mx = 30 + i * (kW + 4);
      doc.rect(mx, kY, kW, 26).fill('#05405F');
      doc.fontSize(7).font('Helvetica').fillColor('white').text(m.label, mx + 4, kY + 3, { width: kW - 8 });
      doc.fontSize(10).font('Helvetica-Bold').fillColor('white').text(m.val, mx + 4, kY + 13, { width: kW - 8 });
    });
    return kY + 34;
  };

  const cols = [
    { label: 'N° Préstamo',   width: 78 },
    { label: 'Cliente',        width: 110 },
    { label: 'Estado',         width: 58 },
    { label: 'Cap. Orig.',     width: 72 },
    { label: 'Cap. Actual',    width: 72 },
    { label: 'Int. Recog.',    width: 72 },
    { label: 'Mora',           width: 60 },
    { label: 'Recaudo',        width: 72 },
    { label: 'Total Adeudado', width: 80 },
    { label: 'Progreso',       width: 50 },
  ];
  const tableLeft = 30;
  const rowH = 16;
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);

  const drawTableH = (y: number): number => {
    doc.rect(tableLeft, y, tableWidth, 18).fill(BLUE);
    let x = tableLeft;
    doc.fontSize(7).font('Helvetica-Bold').fillColor('white');
    cols.forEach(col => {
      doc.text(col.label, x + 2, y + 5, { width: col.width - 4, align: 'center' });
      x += col.width;
    });
    return y + 18;
  };

  let y = drawPageHeader();
  y = drawTableH(y);
  doc.font('Helvetica').fontSize(7);

  const estadoPdf: Record<string, string> = {
    ACTIVO: '#F0FDF4', EN_MORA: '#FEF2F2', VENCIDO: '#FFF1F2',
    CANCELADO: '#EEF2FF', CASTIGADO: '#F8FAFC',
  };

  filas.forEach((fila, i) => {
    if (y > 520) {
      doc.addPage();
      y = drawPageHeader();
      y = drawTableH(y);
      doc.font('Helvetica').fontSize(7);
    }
    const bg = estadoPdf[fila.estado?.toUpperCase() || ''] || (i % 2 === 0 ? '#F8FAFC' : 'white');
    doc.rect(tableLeft, y, tableWidth, rowH).fill(bg);
    doc.fillColor('black');

    let x = tableLeft;
    [
      fila.numeroPrestamo || '',
      (fila.cliente || '').substring(0, 20),
      fila.estado?.replace(/_/g, ' ') || '',
      `$${(fila.montoTotal || 0).toLocaleString('es-CO')}`,
      `$${(fila.montoPendiente || 0).toLocaleString('es-CO')}`,
      `$${(fila.interesRecogido || 0).toLocaleString('es-CO')}`,
      `$${(fila.mora || 0).toLocaleString('es-CO')}`,
      `$${(fila.recaudo || 0).toLocaleString('es-CO')}`,
      `$${(fila.totalAdeudado || 0).toLocaleString('es-CO')}`,
      `${fila.progreso || 0}%`,
    ].forEach((val, ci) => {
      const align = ci >= 3 && ci <= 8 ? 'right' : 'left';
      doc.text(val, x + 2, y + 4, { width: cols[ci].width - 4, align });
      x += cols[ci].width;
    });
    y += rowH;
  });

  // Totales
  y += 4;
  doc.rect(tableLeft, y, tableWidth, 18).fill('#1E293B');
  doc.fontSize(7).font('Helvetica-Bold').fillColor('white');
  let x = tableLeft;
  [
    `TOTALES (${totales.totalRegistros})`, '',  '',
    `$${totales.montoTotal.toLocaleString('es-CO')}`,
    `$${totales.montoPendiente.toLocaleString('es-CO')}`,
    `$${totales.interesRecogido.toLocaleString('es-CO')}`,
    `$${totales.mora.toLocaleString('es-CO')}`,
    `$${totales.recaudo.toLocaleString('es-CO')}`,
    `$${totales.totalAdeudado.toLocaleString('es-CO')}`,
    '',
  ].forEach((v, ci) => {
    if (ci < cols.length) {
      const align = ci >= 3 && ci <= 8 ? 'right' : 'left';
      doc.text(v, x + 2, y + 5, { width: cols[ci].width - 4, align });
      x += cols[ci].width;
    }
  });

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
