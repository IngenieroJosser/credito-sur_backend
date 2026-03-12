/**
 * ============================================================================
 * TEMPLATE: REPORTE OPERATIVO
 * ============================================================================
 * Usado en: reports.service.ts → exportOperationalReport()
 * Endpoint: POST /reports/operational/export?format=excel|pdf
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface OperativoRow {
  ruta: string;
  cobrador: string;
  meta: number;
  recaudado: number;
  eficiencia: number;
  nuevosPrestamos: number;
  nuevosClientes: number;
  montoNuevosPrestamos?: number;
}

export interface OperativoResumen {
  totalRecaudo: number;
  totalMeta: number;
  porcentajeGlobal: number;
  totalPrestamosNuevos: number;
  totalAfiliaciones: number;
  efectividadPromedio: number;
  periodo: string;
  fechaInicio?: Date | string;
  fechaFin?: Date | string;
}

// ─── Generador Excel ──────────────────────────────────────────────────────────

export async function generarExcelOperativo(
  filas: OperativoRow[],
  resumen: OperativoResumen,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  workbook.created = new Date();

  // ── Hoja 1: Rendimiento por Ruta ──
  const ws = workbook.addWorksheet('Rendimiento por Ruta', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    properties: { tabColor: { argb: 'FFEA580C' } }
  });

  ws.columns = [
    { header: 'Ruta', key: 'ruta', width: 22 },
    { header: 'Cobrador', key: 'cobrador', width: 22 },
    { header: 'Meta', key: 'meta', width: 16 },
    { header: 'Recaudado', key: 'recaudado', width: 16 },
    { header: 'Eficiencia %', key: 'eficiencia', width: 14 },
    { header: 'Préstamos Nuevos', key: 'nuevosPrestamos', width: 17 },
    { header: 'Clientes Nuevos', key: 'nuevosClientes', width: 16 },
    { header: 'Monto Nuevos', key: 'montoNuevosPrestamos', width: 18 },
  ] as any;

  // Título
  const titleRow = ws.addRow(['CRÉDITOS DEL SUR — REPORTE OPERATIVO']);
  titleRow.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEA580C' } };
  ws.mergeCells('A1:H1');
  ws.getRow(1).height = 32;
  ws.getRow(2).height = 22;

  // Período
  const periodoStr = resumen.fechaInicio && resumen.fechaFin
    ? `Período: ${new Date(resumen.fechaInicio).toLocaleDateString('es-CO')} — ${new Date(resumen.fechaFin).toLocaleDateString('es-CO')}`
    : `Período: ${resumen.periodo?.toUpperCase() || 'N/A'}`;
  const subRow = ws.addRow([`${periodoStr}   |   Generado: ${new Date().toLocaleString('es-CO')}`]);
  subRow.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
  ws.mergeCells('A2:H2');

  ws.addRow([]);

  // Encabezados
  const headerRow = ws.getRow(4);
  ws.columns.forEach((col: any, i: number) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEA580C' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  headerRow.height = 22;
  ws.autoFilter = { from: 'A4', to: 'H4' };

  // Datos
  const colsMoneda = ['meta', 'recaudado', 'montoNuevosPrestamos'];
  filas.forEach((fila, idx) => {
    const row = ws.addRow({
      ruta: fila.ruta,
      cobrador: fila.cobrador,
      meta: fila.meta,
      recaudado: fila.recaudado,
      eficiencia: fila.eficiencia,
      nuevosPrestamos: fila.nuevosPrestamos,
      nuevosClientes: fila.nuevosClientes,
      montoNuevosPrestamos: fila.montoNuevosPrestamos || 0,
    });

    if (idx % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
      });
    }

    colsMoneda.forEach(key => {
      const colIdx = ws.columns.findIndex((c: any) => c.key === key) + 1;
      if (colIdx > 0) row.getCell(colIdx).numFmt = '#,##0';
    });

    // Color rojo si eficiencia < 70%
    const eficienciaIdx = ws.columns.findIndex((c: any) => c.key === 'eficiencia') + 1;
    if (eficienciaIdx > 0 && fila.eficiencia < 70) {
      row.getCell(eficienciaIdx).font = { color: { argb: 'FFDC2626' }, bold: true };
    }
  });

  ws.addRow([]);
  const totalRow = ws.addRow({
    ruta: 'TOTALES',
    meta: resumen.totalMeta,
    recaudado: resumen.totalRecaudo,
    eficiencia: resumen.porcentajeGlobal,
    nuevosPrestamos: resumen.totalPrestamosNuevos,
    nuevosClientes: resumen.totalAfiliaciones,
  });
  ws.mergeCells(`A${totalRow.number}:B${totalRow.number}`);
  totalRow.height = 24;
  totalRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FFFFFFFF' } },
      right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
    };
  });
  totalRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
  colsMoneda.forEach(key => {
    const colIdx = ws.columns.findIndex((c: any) => c.key === key) + 1;
    if (colIdx > 0) totalRow.getCell(colIdx).numFmt = '#,##0';
  });

  // ── Hoja 2: Resumen General ──
  const ws2 = workbook.addWorksheet('Resumen General', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    properties: { tabColor: { argb: 'FF0f172a' } },
  });
  ws2.columns = [
    { header: 'Indicador', key: 'indicador', width: 30 },
    { header: 'Valor', key: 'valor', width: 22 },
  ] as any;

  const h2 = ws2.getRow(1);
  ws2.columns.forEach((col: any, i: number) => {
    const cell = h2.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEA580C' } };
    cell.alignment = { horizontal: 'center' };
  });

  [
    { indicador: 'Total Recaudado', valor: resumen.totalRecaudo },
    { indicador: 'Meta Total', valor: resumen.totalMeta },
    { indicador: 'Eficiencia Global (%)', valor: resumen.porcentajeGlobal },
    { indicador: 'Préstamos Nuevos', valor: resumen.totalPrestamosNuevos },
    { indicador: 'Clientes Nuevos', valor: resumen.totalAfiliaciones },
    { indicador: 'Efectividad Promedio Rutas (%)', valor: resumen.efectividadPromedio },
  ].forEach(item => {
    const row = ws2.addRow({ indicador: item.indicador, valor: item.valor });
    if (item.indicador.includes('$') || item.indicador.toLowerCase().includes('recaudado') || item.indicador.toLowerCase().includes('meta')) {
      row.getCell(2).numFmt = '#,##0';
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer as ArrayBuffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `reporte-operativo-${resumen.periodo}-${fecha}.xlsx`,
  };
}

// ─── Generador PDF ────────────────────────────────────────────────────────────

export async function generarPDFOperativo(
  filas: OperativoRow[],
  resumen: OperativoResumen,
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
    doc.fontSize(9).font('Helvetica').fillColor(NAR_MED)
       .text('REPORTE OPERATIVO & RENDIMIENTO', 30, 52, { characterSpacing: 0.5 });

    doc.roundedRect(W - 180, 20, 148, 44, 5).fillAndStroke(BLANCO, GRIS_CLR);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(GRIS_MED)
       .text('PERÍODO', W - 180, 28, { width: 148, align: 'center' });
    const pStr = resumen.fechaInicio && resumen.fechaFin
      ? `${new Date(resumen.fechaInicio).toLocaleDateString('es-CO')} - ${new Date(resumen.fechaFin).toLocaleDateString('es-CO')}`
      : resumen.periodo?.toUpperCase() || 'N/A';
    doc.fontSize(10).font('Helvetica-Bold').fillColor(AZUL_DARK)
       .text(pStr, W - 180, 40, { width: 148, align: 'center' });

    const kW = (doc.page.width - 60) / 4;
    const kY = 98;
    [
      { label: 'META TOTAL',      val: fmtCOP(resumen.totalMeta), bg: '#D6E9F5', color: AZUL_DARK },
      { label: 'RECAUDO TOTAL',   val: fmtCOP(resumen.totalRecaudo), bg: NAR_SOFT, color: NAR_DARK },
      { label: 'EFICIENCIA',      val: `${resumen.porcentajeGlobal}%`, bg: '#F0F4F8', color: GRIS_TXT },
      { label: 'PRÉSTAMOS NUEVOS',val: String(resumen.totalPrestamosNuevos), bg: '#F0F4F8', color: GRIS_TXT },
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

  const cols = [
    { label: 'Ruta', width: 130 },
    { label: 'Cobrador', width: 156 },
    { label: 'Meta', width: 85 },
    { label: 'Recaudado', width: 85 },
    { label: 'Eficiencia', width: 66 },
    { label: 'Préstamos', width: 65 },
    { label: 'Clientes', width: 60 },
    { label: 'Monto Nuevos', width: 85 },
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

  filas.forEach((fila, i) => {
    let maxRowHeight = 17;
    const vals = [
      fila.ruta || '',
      fila.cobrador || '',
      fmtCOP(fila.meta || 0),
      fmtCOP(fila.recaudado || 0),
      `${fila.eficiencia || 0}%`,
      String(fila.nuevosPrestamos || 0),
      String(fila.nuevosClientes || 0),
      fmtCOP(fila.montoNuevosPrestamos || 0),
    ];

    doc.font('Helvetica').fontSize(7.5);
    vals.forEach((val, ci) => {
      if (ci === 0 || ci === 1 || ci === 3) doc.font('Helvetica-Bold');
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
    const bg = fila.eficiencia < 70 ? '#FEF2F2' : baseBg; // Rojo muy claro si eficiencia baja
    
    doc.rect(tableLeft, y, tableWidth, maxRowHeight).fill(bg);
    doc.moveTo(tableLeft, y + maxRowHeight)
       .lineTo(tableLeft + tableWidth, y + maxRowHeight)
       .strokeColor(GRIS_CLR).lineWidth(0.4).stroke();

    let x = tableLeft;
    vals.forEach((v, ci) => {
      const align = ci >= 2 && ci <= 7 && ci !== 4 && ci !== 5 && ci !== 6 ? 'right' : (ci >= 4 && ci <= 6 ? 'center' : 'left');

      if (ci === 3) {
         doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
      } else if (ci === 4 && fila.eficiencia < 70) {
         doc.font('Helvetica-Bold').fillColor('#DC2626');
      } else if (ci === 1) {
         doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
      } else if (ci === 0) {
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
    `TOTAL GENERAL`,
    tableLeft + 6, y + 8,
    { width: cols.slice(0, 2).reduce((s, c) => s + c.width, 0) - 10 }
  );

  let tx = tableLeft + cols.slice(0, 2).reduce((s, c) => s + c.width, 0);
  [
    `$${resumen.totalMeta.toLocaleString('es-CO')}`,
    `$${resumen.totalRecaudo.toLocaleString('es-CO')}`,
    `${resumen.porcentajeGlobal}%`,
    String(resumen.totalPrestamosNuevos),
    String(resumen.totalAfiliaciones),
    `$${(filas.reduce((acc, f) => acc + (f.montoNuevosPrestamos || 0), 0)).toLocaleString('es-CO')}`,
  ].forEach((val, i) => {
    const ci = i + 2; // a partir de la columna 2
    if (ci < cols.length) {
      doc.fillColor(i === 1 ? NAR_SOFT : BLANCO).font('Helvetica-Bold').fontSize(8);
      const align = ci === 4 || ci === 5 || ci === 6 ? 'center' : 'right';
      doc.text(val, tx + 4, y + 9, { width: cols[ci].width - 8, align });
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
    filename: `reporte-operativo-${resumen.periodo}-${fecha}.pdf`,
  };
}
