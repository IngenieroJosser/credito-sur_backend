/**
 * ============================================================================
 * TEMPLATE: REPORTE CONTABLE
 * ============================================================================
 * Usado en: accounting.service.ts → exportAccountingReport()
 * Endpoint: GET /accounting/export?format=excel|pdf
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface CajaRow {
  nombre: string;
  codigo: string;
  tipo: string;
  responsable: string;
  ruta: string;
  saldo: number;
  // Separación por origen de caja (§4.5, §108 propuesta)
  tipoCaja: 'COBRADOR' | 'EMPRESA' | 'PRINCIPAL' | string;
  ingresosPeriodo?: number;   // Ingresos recibidos en el período
  egresosPeriodo?: number;    // Egresos aprobados en el período
  egresosPendientes?: number; // Gastos del cobrador pendientes de aprobación (§111)
  baseAsignada?: number;      // Base de dinero para prestar asignada por coordinador (§117)
}

export interface TransaccionRow {
  fecha: Date | string;
  tipo: string;
  monto: number;
  descripcion: string;
  caja: string;
  usuario: string;
  // Campos adicionales de flujo
  tipoCaja?: 'COBRADOR' | 'EMPRESA' | 'PRINCIPAL' | string;
  estadoAprobacion?: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | string; // §111 propuesta
  aprobadoPor?: string;       // Supervisor o coordinador que aprobó
  metodoPago?: 'EFECTIVO' | 'TRANSFERENCIA' | string;  // §116 propuesta
}

// ─── Generador Excel ──────────────────────────────────────────────────────────

export async function generarExcelContable(
  cajas: CajaRow[],
  transacciones: TransaccionRow[],
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  workbook.created = new Date();

  const totalSaldo = cajas.reduce((s, c) => s + c.saldo, 0);

  // ── Hoja 1: Estado de Cajas ──
  const ws1 = workbook.addWorksheet('Estado de Cajas', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    properties: { tabColor: { argb: 'FF004F7B' } }
  });
  ws1.columns = [
    { header: 'Caja',            key: 'nombre',           width: 20 },
    { header: 'Código',          key: 'codigo',           width: 14 },
    { header: 'Tipo Caja',       key: 'tipoCaja',         width: 16 },
    { header: 'Tipo',            key: 'tipo',             width: 14 },
    { header: 'Responsable',     key: 'responsable',      width: 26 },
    { header: 'Ruta',            key: 'ruta',             width: 18 },
    { header: 'Saldo Actual',    key: 'saldo',            width: 16 },
    { header: 'Ingresos',        key: 'ingresos',         width: 16 },
    { header: 'Egresos',         key: 'egresos',          width: 16 },
    { header: 'Gastos Pend.',    key: 'egresosPend',      width: 16 },
    { header: 'Base Asignada',   key: 'baseAsignada',     width: 16 },
  ] as any;

  const t1 = ws1.addRow(['CRÉDITOS DEL SUR — ESTADO DE CAJAS']);
  t1.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004F7B' } };
  ws1.mergeCells('A1:K1');

  const s1 = ws1.addRow([`Generado: ${new Date().toLocaleString('es-CO')}   |   Total cajas: ${cajas.length}`]);
  s1.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
  ws1.mergeCells('A2:K2');

  ws1.addRow([]);

  ws1.getRow(1).height = 32;
  ws1.getRow(2).height = 22;

  const h1 = ws1.getRow(4);
  ws1.columns.forEach((col: any, i: number) => {
    const cell = h1.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004F7B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  h1.height = 22;
  ws1.autoFilter = { from: 'A4', to: 'K4' };

  cajas.forEach((caja, idx) => {
    const row = ws1.addRow({
      nombre:      caja.nombre,
      codigo:      caja.codigo,
      tipoCaja:    caja.tipoCaja || '-',
      tipo:        caja.tipo,
      responsable: caja.responsable,
      ruta:        caja.ruta,
      saldo:       caja.saldo,
      ingresos:    caja.ingresosPeriodo ?? 0,
      egresos:     caja.egresosPeriodo ?? 0,
      egresosPend: caja.egresosPendientes ?? 0,
      baseAsignada: caja.baseAsignada ?? 0,
    });

    if (idx % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
      });
    }

    [7, 8, 9, 10, 11].forEach(c => {
      row.getCell(c).numFmt = '"$"#,##0';
      row.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    // Resaltar caja cobrador vs empresa
    const tc = caja.tipoCaja?.toUpperCase() || '';
    if (tc === 'COBRADOR') row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
    else if (tc === 'PRINCIPAL') row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };

    // Gastos pendientes en amarillo
    if ((caja.egresosPendientes ?? 0) > 0) {
      row.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
      row.getCell(10).font = { bold: true, color: { argb: 'FF854D0E' } };
    }
  });

  ws1.addRow([]);
  const totalRow = ws1.addRow({ nombre: 'TOTAL SALDOS', saldo: totalSaldo });
  ws1.mergeCells(`A${totalRow.number}:F${totalRow.number}`);
  totalRow.font = { bold: true };
  totalRow.getCell(7).numFmt = '"$"#,##0';

  // ── Hoja 2: Últimos Movimientos ──
  const ws2 = workbook.addWorksheet('Movimientos', {
    views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    properties: { tabColor: { argb: 'FF0ea5e9' } }
  });
  ws2.columns = [
    { header: 'Fecha',         key: 'fecha',         width: 20 },
    { header: 'Tipo',          key: 'tipo',          width: 14 },
    { header: 'Tipo Caja',     key: 'tipoCaja',      width: 14 },
    { header: 'Monto',         key: 'monto',         width: 16 },
    { header: 'Método Pago',   key: 'metodoPago',    width: 16 },
    { header: 'Estado',        key: 'estado',        width: 14 },
    { header: 'Descripción',   key: 'descripcion',   width: 36 },
    { header: 'Caja',          key: 'caja',          width: 18 },
    { header: 'Usuario',       key: 'usuario',       width: 22 },
    { header: 'Aprobado Por',  key: 'aprobadoPor',   width: 20 },
  ] as any;

  const t2 = ws2.addRow(['Últimos Movimientos']);
  t2.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004F7B' } };
  ws2.mergeCells('A1:J1');
  ws2.getRow(1).height = 28;

  ws2.addRow([]);

  const h2 = ws2.getRow(3);
  ws2.columns.forEach((col: any, i: number) => {
    const cell = h2.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004F7B' } };
    cell.alignment = { horizontal: 'center' };
  });
  h2.height = 20;
  ws2.autoFilter = { from: 'A3', to: 'J3' };

  transacciones.forEach((t, idx) => {
    const row = ws2.addRow({
      fecha:       t.fecha ? new Date(t.fecha).toLocaleString('es-CO') : '',
      tipo:        t.tipo,
      tipoCaja:    t.tipoCaja || '-',
      monto:       t.monto,
      metodoPago:  t.metodoPago || 'EFECTIVO',
      estado:      t.estadoAprobacion?.replace(/_/g, ' ') || 'APROBADO',
      descripcion: t.descripcion || '',
      caja:        t.caja,
      usuario:     t.usuario,
      aprobadoPor: t.aprobadoPor || '',
    });

    if (idx % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
      });
    }

    row.getCell(4).numFmt = '"$"#,##0';
    row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };

    // Estado de aprobación con colores
    const estado = (t.estadoAprobacion || '').toUpperCase();
    if (estado === 'PENDIENTE') {
      row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
      row.getCell(6).font = { bold: true, color: { argb: 'FF854D0E' } };
    } else if (estado === 'RECHAZADO') {
      row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
      row.getCell(6).font = { bold: true, color: { argb: 'FFDC2626' } };
    }

    // Ingresos en verde, egresos en rojo
    const tipoCell = row.getCell(2);
    if (t.tipo === 'INGRESO') tipoCell.font = { color: { argb: 'FF059669' }, bold: true };
    else if (t.tipo === 'EGRESO') tipoCell.font = { color: { argb: 'FFDC2626' }, bold: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer as ArrayBuffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `reporte-contable-${fecha}.xlsx`,
  };
}

// ─── Generador PDF ────────────────────────────────────────────────────────────

export async function generarPDFContable(
  cajas: CajaRow[],
  transacciones: TransaccionRow[],
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

  const totalSaldo = cajas.reduce((s, c) => s + c.saldo, 0);

  const drawPageHeader = (): number => {
    const W = doc.page.width;

    doc.fontSize(22).font('Helvetica-Bold').fillColor(AZUL_DARK)
       .text('Créditos del Sur', 30, 25);
    doc.fontSize(9).font('Helvetica').fillColor(NAR_MED)
       .text('REPORTE CONTABLE', 30, 52, { characterSpacing: 0.5 });

    doc.roundedRect(W - 180, 20, 148, 44, 5).fillAndStroke(BLANCO, GRIS_CLR);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(GRIS_MED)
       .text('FECHA GENERACIÓN', W - 180, 28, { width: 148, align: 'center' });
    doc.fontSize(10).font('Helvetica-Bold').fillColor(AZUL_DARK)
       .text(new Date().toLocaleDateString('es-CO'), W - 180, 40, { width: 148, align: 'center' });

    const kW = (doc.page.width - 60) / 3;
    const kY = 98;
    [
      { label: 'TOTAL CAJAS',       val: String(cajas.length), bg: '#D6E9F5', color: AZUL_DARK, isNum: false },
      { label: 'SALDO GLOBAL',      val: fmtCOP(totalSaldo), bg: NAR_SOFT, color: NAR_DARK, isNum: true },
      { label: 'TRANSACCIONES',     val: String(transacciones.length), bg: '#F0F4F8', color: GRIS_TXT, isNum: false },
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

  drawWatermark();
  let y = drawPageHeader();

  // ── Tabla: Estado de Cajas ──
  doc.fontSize(12).font('Helvetica-Bold').fillColor(AZUL_DARK).text('Estado de Cajas', 30, y);
  y += 18;

  const cajaCols = [
    { label: 'Caja', width: 110 },
    { label: 'Código', width: 70 },
    { label: 'Tipo', width: 80 },
    { label: 'Responsable', width: 156 },
    { label: 'Ruta', width: 110 },
    { label: 'Saldo actual', width: 80 },
    { label: 'Ingresos', width: 80 },
    { label: 'Egresos', width: 80 },
  ];

  const tableLeft = 30;
  const cajaTableWidth = cajaCols.reduce((s, c) => s + c.width, 0);

  const drawCajaHeader = (cy: number): number => {
    doc.rect(tableLeft, cy, cajaTableWidth, 24).fill(AZUL_MED);
    doc.rect(tableLeft, cy + 24, cajaTableWidth, 2).fill(NAR_MED);
    let x = tableLeft;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(BLANCO);
    cajaCols.forEach(col => {
      doc.text(col.label, x + 4, cy + 7, { width: col.width - 8, align: 'center' });
      x += col.width;
    });
    return cy + 30;
  };

  y = drawCajaHeader(y);

  cajas.forEach((caja, i) => {
    let maxRowHeight = 17;
    const vals = [
      caja.nombre || '',
      caja.codigo || '',
      caja.tipo || '',
      caja.responsable || 'Sin asignar',
      caja.ruta || 'N/A',
      fmtCOP(caja.saldo || 0),
      fmtCOP(caja.ingresosPeriodo || 0),
      fmtCOP(caja.egresosPeriodo || 0),
    ];

    doc.font('Helvetica').fontSize(7.5);
    vals.forEach((val, ci) => {
      if (ci === 0 || ci === 3 || ci === 5) doc.font('Helvetica-Bold');
      const h = doc.heightOfString(val, { width: cajaCols[ci].width - 8, lineBreak: true });
      if (h + 8 > maxRowHeight) maxRowHeight = h + 8;
      doc.font('Helvetica');
    });

    if (y + maxRowHeight > doc.page.height - 70) {
      drawFooter();
      pageNumber++;
      doc.addPage();
      drawWatermark();
      y = drawPageHeader();
      y = drawCajaHeader(y);
      doc.font('Helvetica').fontSize(7.5);
    }

    const baseBg = i % 2 === 0 ? BLANCO : AZUL_PALE;
    
    doc.rect(tableLeft, y, cajaTableWidth, maxRowHeight).fill(baseBg);
    doc.moveTo(tableLeft, y + maxRowHeight)
       .lineTo(tableLeft + cajaTableWidth, y + maxRowHeight)
       .strokeColor(GRIS_CLR).lineWidth(0.4).stroke();

    let x = tableLeft;
    vals.forEach((v, ci) => {
      const align = ci >= 5 ? 'right' : (ci === 1 || ci === 2 ? 'center' : 'left');

      if (ci === 5) {
         doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
      } else if (ci === 0 || ci === 3) {
         doc.font('Helvetica-Bold').fillColor(GRIS_TXT);
      } else {
         doc.font('Helvetica').fillColor(GRIS_TXT);
      }

      doc.text(v, x + 4, y + 4, { width: cajaCols[ci].width - 8, align, lineBreak: true });
      x += cajaCols[ci].width;
    });
    y += maxRowHeight;
  });

  // ── Tabla: Últimos Movimientos ──
  y += 20;

  if (y > doc.page.height - 120) {
    drawFooter();
    pageNumber++;
    doc.addPage();
    drawWatermark();
    y = drawPageHeader();
  }

  doc.fontSize(12).font('Helvetica-Bold').fillColor(AZUL_DARK).text('Últimos Movimientos', 30, y);
  y += 18;

  const movCols = [
    { label: 'Fecha', width: 110 },
    { label: 'Tipo', width: 70 },
    { label: 'Monto', width: 90 },
    { label: 'Descripción', width: 236 },
    { label: 'Caja', width: 120 },
    { label: 'Usuario', width: 140 },
  ];
  const movTableWidth = movCols.reduce((s, c) => s + c.width, 0);

  const drawMovHeader = (cy: number): number => {
    doc.rect(tableLeft, cy, movTableWidth, 24).fill(AZUL_MED);
    doc.rect(tableLeft, cy + 24, movTableWidth, 2).fill(NAR_MED);
    let x = tableLeft;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(BLANCO);
    movCols.forEach(col => {
      doc.text(col.label, x + 4, cy + 7, { width: col.width - 8, align: 'center' });
      x += col.width;
    });
    return cy + 30;
  };

  y = drawMovHeader(y);

  transacciones.forEach((t, i) => {
    let maxRowHeight = 17;
    const vals = [
      t.fecha ? new Date(t.fecha).toLocaleString('es-CO') : '',
      t.tipo || '',
      fmtCOP(t.monto || 0),
      t.descripcion || '',
      t.caja || '',
      t.usuario || '',
    ];

    doc.font('Helvetica').fontSize(7.5);
    vals.forEach((val, ci) => {
      if (ci === 1 || ci === 2 || ci === 3) doc.font('Helvetica-Bold');
      const h = doc.heightOfString(val, { width: movCols[ci].width - 8, lineBreak: true });
      if (h + 8 > maxRowHeight) maxRowHeight = h + 8;
      doc.font('Helvetica');
    });

    if (y + maxRowHeight > doc.page.height - 70) {
      drawFooter();
      pageNumber++;
      doc.addPage();
      drawWatermark();
      y = drawPageHeader();
      y = drawMovHeader(y);
      doc.font('Helvetica').fontSize(7.5);
    }

    const baseBg = i % 2 === 0 ? BLANCO : AZUL_PALE;
    
    doc.rect(tableLeft, y, movTableWidth, maxRowHeight).fill(baseBg);
    doc.moveTo(tableLeft, y + maxRowHeight)
       .lineTo(tableLeft + movTableWidth, y + maxRowHeight)
       .strokeColor(GRIS_CLR).lineWidth(0.4).stroke();

    let x = tableLeft;
    vals.forEach((v, ci) => {
      const align = ci === 2 ? 'right' : (ci === 1 ? 'center' : 'left');

      if (ci === 1) {
         doc.font('Helvetica-Bold').fillColor(t.tipo === 'INGRESO' ? '#059669' : '#DC2626');
      } else if (ci === 2) {
         doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
      } else if (ci === 3) {
         doc.font('Helvetica-Bold').fillColor(GRIS_TXT);
      } else {
         doc.font('Helvetica').fillColor(GRIS_TXT);
      }

      doc.text(v, x + 4, y + 4, { width: movCols[ci].width - 8, align, lineBreak: true });
      x += movCols[ci].width;
    });
    y += maxRowHeight;
  });

  y += 38;
  if (y > doc.page.height - 80) {
    drawFooter();
    pageNumber++;
    doc.addPage();
    drawWatermark();
    y = drawPageHeader();
  }

  doc.fontSize(7.5).font('Helvetica-Oblique').fillColor(GRIS_MED)
     .text(
       'Documento expedido por Créditos del Sur. Las cifras presentadas son definitivas y sujetas a revisión de auditoría.',
       tableLeft, y, { align: 'center', width: movTableWidth }
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
    filename: `reporte-contable-${fecha}.pdf`,
  };
}
