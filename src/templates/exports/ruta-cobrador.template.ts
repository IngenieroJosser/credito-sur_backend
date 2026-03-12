/**
 * ============================================================================
 * TEMPLATE: RUTA DEL COBRADOR
 * ============================================================================
 * Usado en: routes.service.ts → exportarRuta()
 * Endpoint:
 * - GET /routes/:id/export/excel
 * - GET /routes/:id/export/pdf
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

export interface RutaCobradorRow {
  nro: number;
  cliente: string;
  cc: string;
  telefono: string;
  direccion: string;
  numeroPrestamo: string;
  cuota: number;
  fechaCuota: string;
  saldo: number;
  estadoPrestamo: string;
  diasMora: number;
  semaforo: 'VERDE' | 'AMARILLO' | 'ROJO';
}

export interface RutaCobradorMeta {
  rutaNombre: string;
  rutaCodigo?: string;
  cobradorNombre: string;
  fechaExport: string;
  totalClientes: number;
  enMora: number;
  totalCuota: number;
  totalSaldo: number;
}

const C = {
  BLANCO: '#FFFFFF',
  GRIS_LINEA: '#E2E8F0',
  GRIS_TXT: '#475569',
  GRIS_MED: '#94A3B8',
  AZUL_DARK: '#1A5F8A',
  AZUL_MED: '#2676AC',
  AZUL_PALE: '#F0F9FF',
  NAR_MED: '#F07A28',
  ROJO_PALE: '#FEF2F2',
  ROJO_DARK: '#DC2626',
  AMARILLO_PALE: '#FFFBEB',
  AMARILLO_DARK: '#D97706',
  VERDE_PALE: '#ECFDF5',
  VERDE_DARK: '#059669',
} as const;

const fmtCOP = (v: number) => `$${(v || 0).toLocaleString('es-CO')}`;

function getLogoPath(): string | null {
  const prod = path.join(process.cwd(), 'dist/assets/logo.png');
  const dev = path.join(process.cwd(), 'src/assets/logo.png');
  return fs.existsSync(prod) ? prod : fs.existsSync(dev) ? dev : null;
}

export async function generarExcelRutaCobrador(
  filas: RutaCobradorRow[],
  meta: RutaCobradorMeta,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  workbook.created = new Date();

  const ws = workbook.addWorksheet(`Ruta ${meta.rutaNombre}`, {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    properties: { tabColor: { argb: 'FF1A5F8A' } },
  });

  ws.columns = [
    { header: 'N°', key: 'nro', width: 5 },
    { header: 'Cliente', key: 'cliente', width: 28 },
    { header: 'CC / DNI', key: 'cc', width: 14 },
    { header: 'Teléfono', key: 'telefono', width: 14 },
    { header: 'Dirección', key: 'direccion', width: 30 },
    { header: 'N° Préstamo', key: 'numeroPrestamo', width: 14 },
    { header: 'Cuota', key: 'cuota', width: 14 },
    { header: 'Fecha Cuota', key: 'fechaCuota', width: 14 },
    { header: 'Saldo', key: 'saldo', width: 16 },
    { header: 'Estado', key: 'estadoPrestamo', width: 12 },
    { header: 'Días Mora', key: 'diasMora', width: 10 },
    { header: 'Cobrado ✔', key: 'cobrado', width: 14 },
    { header: 'Notas', key: 'notas', width: 22 },
  ] as any;

  const title = ws.addRow([`CRÉDITOS DEL SUR — RUTA ${meta.rutaNombre.toUpperCase()}${meta.rutaCodigo ? ` (${meta.rutaCodigo})` : ''}`]);
  title.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  ws.mergeCells('A1:M1');
  ws.getRow(1).height = 26;

  const subtitle = ws.addRow([
    `Cobrador: ${meta.cobradorNombre}   |   Fecha: ${meta.fechaExport}   |   Clientes: ${meta.totalClientes}   |   En mora: ${meta.enMora}`,
  ]);
  subtitle.font = { size: 10, color: { argb: 'FFFFFFFF' } };
  subtitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
  ws.mergeCells('A2:M2');
  ws.getRow(2).height = 18;

  ws.addRow([]);

  const headerRow = ws.getRow(4);
  (ws.columns as any[]).forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2676AC' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFF07A28' } },
      right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
    };
  });
  headerRow.height = 22;

  filas.forEach((f, idx) => {
    const row = ws.addRow({
      ...f,
      cuota: f.cuota,
      saldo: f.saldo,
      cobrado: '',
      notas: '',
    } as any);

    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }

    const cuotaCell = row.getCell(7);
    const saldoCell = row.getCell(9);
    cuotaCell.numFmt = '#,##0';
    saldoCell.numFmt = '#,##0';

    const sem = f.semaforo;
    const semCell = row.getCell(11);
    if (sem === 'ROJO') semCell.font = { bold: true, color: { argb: 'FFDC2626' } };
    if (sem === 'AMARILLO') semCell.font = { bold: true, color: { argb: 'FFD97706' } };
    if (sem === 'VERDE') semCell.font = { bold: true, color: { argb: 'FF059669' } };
  });

  ws.addRow([]);
  const totalRow = ws.addRow([
    '',
    'TOTALES',
    '',
    '',
    '',
    `${filas.length} filas`,
    meta.totalCuota,
    '',
    meta.totalSaldo,
    '',
    `${meta.enMora} en mora`,
    '',
    '',
  ]);
  ws.mergeCells(`A${totalRow.number}:B${totalRow.number}`);
  totalRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  });
  totalRow.getCell(7).numFmt = '#,##0';
  totalRow.getCell(9).numFmt = '#,##0';

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer as ArrayBuffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `ruta-${meta.rutaNombre}-${fecha}.xlsx`,
  };
}

export async function generarPDFRutaCobrador(
  filas: RutaCobradorRow[],
  meta: RutaCobradorMeta,
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

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
    } catch {}
  };

  let pageNumber = 1;

  const drawFooter = () => {
    const W = doc.page.width;
    const H = doc.page.height;
    doc.fontSize(7).font('Helvetica').fillColor(C.GRIS_MED);
    doc.text(`Pág. ${pageNumber}  •  Generado: ${new Date().toLocaleString('es-CO')}`, 0, H - 25, {
      align: 'right',
      width: W - 30,
    });
  };

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
      .text(`Ruta: ${meta.rutaNombre}${meta.rutaCodigo ? ` (${meta.rutaCodigo})` : ''}`, 40, 85, { width: W - 80 });
    doc.fontSize(9).font('Helvetica').fillColor(C.GRIS_TXT)
      .text(`Cobrador: ${meta.cobradorNombre}   |   Clientes: ${meta.totalClientes}   |   En mora: ${meta.enMora}`, 40, 103, { width: W - 80 });

    const kW = (W - 60) / 4;
    const kY = 132;
    const cards = [
      { label: 'TOTAL FILAS', val: String(filas.length), bg: '#D6E9F5', color: C.AZUL_DARK, isNum: false },
      { label: 'TOTAL CUOTA', val: meta.totalCuota, bg: '#FDE8D5', color: '#D95C0F', isNum: true },
      { label: 'TOTAL SALDO', val: meta.totalSaldo, bg: '#F0F4F8', color: C.GRIS_TXT, isNum: true },
      { label: 'EN MORA', val: String(meta.enMora), bg: C.ROJO_PALE, color: C.ROJO_DARK, isNum: false },
    ];

    cards.forEach((m, i) => {
      const mx = 30 + i * (kW + 4);
      doc.roundedRect(mx, kY, kW, 44, 6).fillAndStroke(m.bg, C.GRIS_LINEA);
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.GRIS_MED)
        .text(m.label, mx, kY + 10, { width: kW, align: 'center' });
      doc.fontSize(13).font('Helvetica-Bold').fillColor(m.color)
        .text(m.isNum ? fmtCOP(m.val as number) : String(m.val), mx, kY + 23, { width: kW, align: 'center' });
    });

    return kY + 58;
  };

  const cols = [
    { label: 'N°', w: 26 },
    { label: 'Cliente', w: 140 },
    { label: 'CC', w: 70 },
    { label: 'Teléfono', w: 75 },
    { label: 'Dirección', w: 150 },
    { label: 'Préstamo', w: 70 },
    { label: 'Cuota', w: 70 },
    { label: 'Fecha', w: 62 },
    { label: 'Saldo', w: 78 },
    { label: 'Mora', w: 45 },
    { label: 'Cobrado', w: 60 },
  ];

  const tableLeft = 30;
  const tableWidth = cols.reduce((s, c) => s + c.w, 0);

  const drawTableHeader = (y: number): number => {
    doc.rect(tableLeft, y, tableWidth, 24).fill(C.AZUL_MED);
    doc.rect(tableLeft, y + 24, tableWidth, 2).fill(C.NAR_MED);
    let x = tableLeft;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(C.BLANCO);
    cols.forEach(col => {
      doc.text(col.label, x + 4, y + 7, { width: col.w - 8, align: 'center' });
      x += col.w;
    });
    return y + 30;
  };

  drawWatermark();
  let y = drawHeader();
  y = drawTableHeader(y);

  doc.font('Helvetica').fontSize(7.2);

  filas.forEach((fila, i) => {
    let rowH = 18;

    const vals = [
      String(fila.nro),
      fila.cliente,
      fila.cc,
      fila.telefono,
      fila.direccion,
      fila.numeroPrestamo,
      fila.cuota > 0 ? fmtCOP(fila.cuota) : '—',
      fila.fechaCuota,
      fila.saldo > 0 ? fmtCOP(fila.saldo) : '—',
      fila.diasMora > 0 ? String(fila.diasMora) : '',
      '',
    ];

    vals.forEach((val, ci) => {
      const h = doc.heightOfString(val, { width: cols[ci].w - 8, lineBreak: true });
      if (h + 8 > rowH) rowH = h + 8;
    });

    if (y + rowH > doc.page.height - 70) {
      drawFooter();
      pageNumber++;
      doc.addPage();
      drawWatermark();
      y = drawHeader();
      y = drawTableHeader(y);
      doc.font('Helvetica').fontSize(7.2);
    }

    const bgBase = i % 2 === 0 ? C.BLANCO : C.AZUL_PALE;
    const bg = fila.semaforo === 'ROJO' ? C.ROJO_PALE : fila.semaforo === 'AMARILLO' ? C.AMARILLO_PALE : bgBase;
    doc.rect(tableLeft, y, tableWidth, rowH).fill(bg);
    doc.moveTo(tableLeft, y + rowH).lineTo(tableLeft + tableWidth, y + rowH).strokeColor(C.GRIS_LINEA).lineWidth(0.4).stroke();

    let x = tableLeft;
    vals.forEach((v, ci) => {
      const align = ci === 0 || ci >= 6 ? 'center' : 'left';
      if (ci === 8) {
        doc.font('Helvetica-Bold').fillColor(C.AZUL_DARK);
      } else if (ci === 9 && fila.semaforo === 'ROJO') {
        doc.font('Helvetica-Bold').fillColor(C.ROJO_DARK);
      } else if (ci === 9 && fila.semaforo === 'AMARILLO') {
        doc.font('Helvetica-Bold').fillColor(C.AMARILLO_DARK);
      } else {
        doc.font(ci === 1 ? 'Helvetica-Bold' : 'Helvetica').fillColor(C.GRIS_TXT);
      }
      doc.text(v, x + 4, y + 4, { width: cols[ci].w - 8, align, lineBreak: true });
      x += cols[ci].w;
    });

    y += rowH;
  });

  y += 10;
  doc.rect(tableLeft, y, tableWidth, 26).fill(C.AZUL_DARK);
  doc.rect(tableLeft, y, tableWidth, 2).fill(C.NAR_MED);
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.BLANCO);
  doc.text(`TOTAL CUOTA: ${fmtCOP(meta.totalCuota)}   |   TOTAL SALDO: ${fmtCOP(meta.totalSaldo)}`, tableLeft + 8, y + 9, {
    width: tableWidth - 16,
    align: 'center',
  });

  y += 38;
  doc.fontSize(7.5).font('Helvetica-Oblique').fillColor(C.GRIS_MED)
    .text(
      'Documento expedido por Créditos del Sur. Las cifras presentadas son definitivas y sujetas a revisión de auditoría.',
      tableLeft,
      y,
      { align: 'center', width: tableWidth },
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
    filename: `ruta-${meta.rutaNombre}-${fecha}.pdf`,
  };
}
