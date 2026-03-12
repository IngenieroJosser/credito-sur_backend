/**
 * ============================================================================
 * TEMPLATE: REPORTE FINANCIERO
 * ============================================================================
 * Usado en: reports.service.ts → exportFinancialReport()
 * Endpoint: GET /reports/financial/export?format=excel|pdf
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface FinancieroResumen {
  ingresos: number;
  egresos: number;
  utilidad: number;
  margen: number;
}

export interface FinancieroMensual {
  mes: string;
  ingresos: number;
  egresos: number;
  utilidad: number;
}

export interface FinancieroGasto {
  categoria: string;
  monto: number;
}

// ─── Generador Excel ──────────────────────────────────────────────────────────

export async function generarExcelFinanciero(
  resumen: FinancieroResumen,
  evolucionMensual: FinancieroMensual[],
  distribucionGastos: FinancieroGasto[],
  fecha: string,
  startDate?: Date,
  endDate?: Date,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  workbook.created = new Date();

  const totalGastos = distribucionGastos.reduce((s, g) => s + g.monto, 0);
  const periodoStr = startDate && endDate
    ? `${startDate.toLocaleDateString('es-CO')} — ${endDate.toLocaleDateString('es-CO')}`
    : 'Período no definido';

  // ── Hoja 1: Resumen Financiero ──
  const ws1 = workbook.addWorksheet('Resumen Financiero');
  ws1.columns = [
    { header: 'Concepto', key: 'concepto', width: 28 },
    { header: 'Monto', key: 'monto', width: 22 },
    { header: 'Detalle', key: 'detalle', width: 25 },
  ] as any;

  const t1 = ws1.addRow(['CRÉDITOS DEL SUR — REPORTE FINANCIERO']);
  t1.font = { bold: true, size: 16, color: { argb: 'FF059669' } };
  ws1.mergeCells('A1:C1');

  const s1 = ws1.addRow([`Período: ${periodoStr}`]);
  s1.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
  ws1.mergeCells('A2:C2');

  ws1.addRow([]);

  const h1 = ws1.getRow(4);
  ws1.columns.forEach((col: any, i: number) => {
    const cell = h1.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  h1.height = 22;

  const items = [
    { concepto: 'Ingresos Totales', monto: resumen.ingresos, detalle: 'Pagos recibidos en el período' },
    { concepto: 'Egresos Totales', monto: resumen.egresos, detalle: 'Gastos aprobados en el período' },
    { concepto: 'Utilidad Neta', monto: resumen.utilidad, detalle: 'Ingresos − Egresos' },
    { concepto: 'Margen de Ganancia (%)', monto: resumen.margen, detalle: '(Utilidad / Ingresos) × 100' },
  ];

  items.forEach((item, idx) => {
    const row = ws1.addRow({ concepto: item.concepto, monto: item.monto, detalle: item.detalle });
    if (idx % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
      });
    }
    const montoCell = row.getCell(2);
    if (item.concepto.includes('%')) {
      montoCell.numFmt = '0.00"%"';
    } else {
      montoCell.numFmt = '#,##0';
    }
    // Utilidad negativa en rojo
    if (item.concepto === 'Utilidad Neta' && resumen.utilidad < 0) {
      montoCell.font = { bold: true, color: { argb: 'FFDC2626' } };
    }
  });

  // ── Hoja 2: Evolución Mensual ──
  const ws2 = workbook.addWorksheet('Evolución Mensual');
  ws2.columns = [
    { header: 'Mes', key: 'mes', width: 18 },
    { header: 'Ingresos', key: 'ingresos', width: 18 },
    { header: 'Egresos', key: 'egresos', width: 18 },
    { header: 'Utilidad', key: 'utilidad', width: 18 },
  ] as any;

  const t2 = ws2.addRow(['Evolución Mensual']);
  t2.font = { bold: true, size: 14, color: { argb: 'FF059669' } };
  ws2.mergeCells('A1:D1');

  ws2.addRow([]);

  const h2 = ws2.getRow(3);
  ws2.columns.forEach((col: any, i: number) => {
    const cell = h2.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    cell.alignment = { horizontal: 'center' };
  });
  h2.height = 20;

  evolucionMensual.forEach((m, idx) => {
    const row = ws2.addRow({ mes: m.mes, ingresos: m.ingresos, egresos: m.egresos, utilidad: m.utilidad });
    if (idx % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
      });
    }
    ['ingresos', 'egresos', 'utilidad'].forEach(key => {
      const colIdx = ws2.columns.findIndex((c: any) => c.key === key) + 1;
      if (colIdx > 0) row.getCell(colIdx).numFmt = '#,##0';
    });
  });

  // ── Hoja 3: Distribución de Gastos ──
  const ws3 = workbook.addWorksheet('Distribución Gastos');
  ws3.columns = [
    { header: 'Categoría', key: 'categoria', width: 28 },
    { header: 'Monto', key: 'monto', width: 18 },
    { header: 'Porcentaje', key: 'porcentaje', width: 16 },
  ] as any;

  const t3 = ws3.addRow(['Distribución de Gastos']);
  t3.font = { bold: true, size: 14, color: { argb: 'FF059669' } };
  ws3.mergeCells('A1:C1');

  ws3.addRow([]);

  const h3 = ws3.getRow(3);
  ws3.columns.forEach((col: any, i: number) => {
    const cell = h3.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    cell.alignment = { horizontal: 'center' };
  });

  distribucionGastos.forEach((g, idx) => {
    const pct = totalGastos > 0 ? ((g.monto / totalGastos) * 100).toFixed(1) : '0.0';
    const row = ws3.addRow({ categoria: g.categoria, monto: g.monto, porcentaje: `${pct}%` });
    if (idx % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
      });
    }
    row.getCell(2).numFmt = '#,##0';
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer as ArrayBuffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `reporte-financiero-${fecha}.xlsx`,
  };
}

// ─── Generador PDF ────────────────────────────────────────────────────────────

export async function generarPDFFinanciero(
  resumen: FinancieroResumen,
  evolucionMensual: FinancieroMensual[],
  distribucionGastos: FinancieroGasto[],
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  // Reporte Financiero in portrait mode by default, let's keep it Portrait or switch to Landscape?
  // Let's keep it Portrait
  const doc = new PDFDocument({ layout: 'portrait', size: 'LETTER', margin: 40 });
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
  const VERDE_DARK = '#059669';
  const VERDE_PALE = '#F0FDF4';
  const ROJO_DARK  = '#DC2626';

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
       .text('Créditos del Sur', 40, 30);
    doc.fontSize(9).font('Helvetica').fillColor(VERDE_DARK)
       .text('REPORTE FINANCIERO', 40, 57, { characterSpacing: 0.5 });

    doc.roundedRect(W - 180, 25, 140, 44, 5).fillAndStroke(BLANCO, GRIS_CLR);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(GRIS_MED)
       .text('FECHA GENERACIÓN', W - 180, 33, { width: 140, align: 'center' });
    doc.fontSize(10).font('Helvetica-Bold').fillColor(AZUL_DARK)
       .text(new Date().toLocaleDateString('es-CO'), W - 180, 45, { width: 140, align: 'center' });

    const kW = (W - 80 - 12) / 4;
    const kY = 100;
    [
      { label: 'INGRESOS TOTALES', val: fmtCOP(resumen.ingresos), bg: VERDE_PALE, color: VERDE_DARK },
      { label: 'EGRESOS TOTALES',  val: fmtCOP(resumen.egresos), bg: '#FEF2F2', color: ROJO_DARK },
      { label: 'UTILIDAD NETA',    val: fmtCOP(resumen.utilidad), bg: resumen.utilidad >= 0 ? VERDE_PALE : '#FEF2F2', color: resumen.utilidad >= 0 ? VERDE_DARK : ROJO_DARK },
      { label: 'MARGEN DE GANANCIA',val: `${resumen.margen}%`, bg: '#F0F4F8', color: AZUL_DARK },
    ].forEach((m, i) => {
      const mx = 40 + i * (kW + 4);
      doc.roundedRect(mx, kY, kW, 44, 6).fillAndStroke(m.bg, GRIS_CLR);
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor(GRIS_MED)
         .text(m.label, mx, kY + 10, { width: kW, align: 'center' });
      doc.fontSize(10).font('Helvetica-Bold').fillColor(m.color)
         .text(m.val, mx, kY + 23, { width: kW, align: 'center' });
    });
    return kY + 65;
  };

  const drawFooter = () => {
    const W = doc.page.width;
    const H = doc.page.height;
    doc.fontSize(7).font('Helvetica').fillColor(GRIS_MED);
    doc.text(`Pág. ${pageNumber}  •  Generado: ${new Date().toLocaleString('es-CO')}`, 0, H - 25, { align: 'right', width: W - 40 });
  };

  drawWatermark();
  let y = drawPageHeader();

  // ── Sección: Evolución Mensual ──
  doc.fontSize(12).font('Helvetica-Bold').fillColor(AZUL_DARK).text('Evolución Mensual', 40, y);
  y += 18;

  const mCols = [
    { label: 'Mes', width: 140 },
    { label: 'Ingresos', width: 130 },
    { label: 'Egresos', width: 130 },
    { label: 'Utilidad', width: 132 },
  ];
  const tableLeft = 40;
  let tableWidth = mCols.reduce((s, c) => s + c.width, 0);

  const drawMTableHeader = (cy: number): number => {
    doc.rect(tableLeft, cy, tableWidth, 24).fill(AZUL_MED);
    doc.rect(tableLeft, cy + 24, tableWidth, 2).fill(VERDE_DARK);
    let x = tableLeft;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(BLANCO);
    mCols.forEach(col => {
      doc.text(col.label, x + 4, cy + 7, { width: col.width - 8, align: 'center' });
      x += col.width;
    });
    return cy + 30;
  };

  y = drawMTableHeader(y);

  evolucionMensual.forEach((m, i) => {
    let maxRowHeight = 17;
    const vals = [
      m.mes || '',
      fmtCOP(m.ingresos || 0),
      fmtCOP(m.egresos || 0),
      fmtCOP(m.utilidad || 0),
    ];

    doc.font('Helvetica').fontSize(8);
    vals.forEach((val, ci) => {
      if (ci === 0 || ci === 3) doc.font('Helvetica-Bold');
      const h = doc.heightOfString(val, { width: mCols[ci].width - 8, lineBreak: true });
      if (h + 8 > maxRowHeight) maxRowHeight = h + 8;
      doc.font('Helvetica');
    });

    if (y + maxRowHeight > doc.page.height - 70) {
      drawFooter();
      pageNumber++;
      doc.addPage();
      drawWatermark();
      y = drawPageHeader();
      y = drawMTableHeader(y);
    }

    const baseBg = i % 2 === 0 ? BLANCO : AZUL_PALE;
    doc.rect(tableLeft, y, tableWidth, maxRowHeight).fill(baseBg);
    doc.moveTo(tableLeft, y + maxRowHeight)
       .lineTo(tableLeft + tableWidth, y + maxRowHeight)
       .strokeColor(GRIS_CLR).lineWidth(0.4).stroke();

    let x = tableLeft;
    vals.forEach((v, ci) => {
      const align = ci >= 1 ? 'right' : 'center';

      if (ci === 3) {
         doc.font('Helvetica-Bold').fillColor(m.utilidad >= 0 ? VERDE_DARK : ROJO_DARK);
      } else if (ci === 0) {
         doc.font('Helvetica-Bold').fillColor(GRIS_TXT);
      } else {
         doc.font('Helvetica').fillColor(GRIS_TXT);
      }

      doc.text(v, x + 4, y + 4, { width: mCols[ci].width - 8, align, lineBreak: true });
      x += mCols[ci].width;
    });
    y += maxRowHeight;
  });

  // ── Sección: Distribución de Gastos ──
  if (distribucionGastos.length > 0) {
    y += 20;
    if (y > doc.page.height - 100) {
      drawFooter();
      pageNumber++;
      doc.addPage();
      drawWatermark();
      y = drawPageHeader();
    }

    doc.fontSize(12).font('Helvetica-Bold').fillColor(AZUL_DARK).text('Distribución de Gastos', 40, y);
    y += 18;

    const gCols = [
      { label: 'Categoría', width: 260 },
      { label: 'Monto', width: 140 },
      { label: 'Porcentaje', width: 132 },
    ];
    tableWidth = gCols.reduce((s, c) => s + c.width, 0);

    const drawGTableHeader = (cy: number): number => {
      doc.rect(tableLeft, cy, tableWidth, 24).fill(AZUL_MED);
      doc.rect(tableLeft, cy + 24, tableWidth, 2).fill(NAR_MED);
      let x = tableLeft;
      doc.fontSize(8).font('Helvetica-Bold').fillColor(BLANCO);
      gCols.forEach(col => {
        doc.text(col.label, x + 4, cy + 7, { width: col.width - 8, align: 'center' });
        x += col.width;
      });
      return cy + 30;
    };

    y = drawGTableHeader(y);
    const totalGastos = distribucionGastos.reduce((s, g) => s + g.monto, 0);

    distribucionGastos.forEach((g, i) => {
      const pctStr = totalGastos > 0 ? ((g.monto / totalGastos) * 100).toFixed(1) + '%' : '0.0%';
      let maxRowHeight = 17;
      const vals = [
        g.categoria || '',
        fmtCOP(g.monto || 0),
        pctStr,
      ];

      doc.font('Helvetica').fontSize(8);
      vals.forEach((val, ci) => {
        if (ci === 0 || ci === 1) doc.font('Helvetica-Bold');
        const h = doc.heightOfString(val, { width: gCols[ci].width - 8, lineBreak: true });
        if (h + 8 > maxRowHeight) maxRowHeight = h + 8;
        doc.font('Helvetica');
      });

      if (y + maxRowHeight > doc.page.height - 70) {
        drawFooter();
        pageNumber++;
        doc.addPage();
        drawWatermark();
        y = drawPageHeader();
        y = drawGTableHeader(y);
      }

      const baseBg = i % 2 === 0 ? BLANCO : AZUL_PALE;
      doc.rect(tableLeft, y, tableWidth, maxRowHeight).fill(baseBg);
      doc.moveTo(tableLeft, y + maxRowHeight)
         .lineTo(tableLeft + tableWidth, y + maxRowHeight)
         .strokeColor(GRIS_CLR).lineWidth(0.4).stroke();

      let x = tableLeft;
      vals.forEach((v, ci) => {
        const align = ci === 0 ? 'left' : (ci === 1 ? 'right' : 'center');

        if (ci === 0) {
           doc.font('Helvetica-Bold').fillColor(GRIS_TXT);
        } else if (ci === 1) {
           doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
        } else {
           doc.font('Helvetica').fillColor(GRIS_TXT);
        }

        doc.text(v, x + 4, y + 4, { width: gCols[ci].width - 8, align, lineBreak: true });
        x += gCols[ci].width;
      });
      y += maxRowHeight;
    });

    // Fila total gastos
    y += 8;
    doc.rect(tableLeft, y, tableWidth, 26).fill(AZUL_DARK);
    doc.rect(tableLeft, y, tableWidth, 2).fill(NAR_MED);

    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BLANCO);
    doc.text(`TOTAL GASTOS`, tableLeft + 6, y + 8, { width: gCols[0].width - 10 });

    doc.fillColor(NAR_SOFT).font('Helvetica-Bold').fontSize(8);
    doc.text(fmtCOP(totalGastos), tableLeft + gCols[0].width + 4, y + 9, { width: gCols[1].width - 8, align: 'right' });
    doc.fillColor(BLANCO).text('100.0%', tableLeft + gCols[0].width + gCols[1].width + 4, y + 9, { width: gCols[2].width - 8, align: 'center' });

    y += 38;
  }

  if (y > doc.page.height - 60) {
    drawFooter();
    pageNumber++;
    doc.addPage();
    drawWatermark();
    y = drawPageHeader();
  }

  doc.fontSize(7.5).font('Helvetica-Oblique').fillColor(GRIS_MED)
     .text(
       'Documento expedido por Créditos del Sur. Las cifras presentadas son definitivas y sujetas a revisión de auditoría.',
       40, y, { align: 'center', width: doc.page.width - 80 }
     );

  drawFooter();
  doc.end();

  const buffer = await new Promise<Buffer>(resolve => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });

  return {
    data: buffer,
    contentType: 'application/pdf',
    filename: `reporte-financiero-${fecha}.pdf`,
  };
}
