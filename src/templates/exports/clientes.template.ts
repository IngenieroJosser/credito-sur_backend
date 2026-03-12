/**
 * ============================================================================
 * TEMPLATE: LISTADO DE CLIENTES
 * ============================================================================
 * Usado en: clients.service.ts → exportarClientes()
 * Endpoint: GET /clients/export?format=excel|pdf
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ClienteExportRow {
  codigo: string;
  nombres: string;
  apellidos: string;
  dni: string;
  telefono: string;
  correo: string | null;
  direccion: string | null;
  nivelRiesgo: string;
  estadoAprobacion: string;
  prestamosActivos: number;
  montoTotal: number;
  montoMora: number;
  rutaNombre: string;
  creadoEn: string | Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

const RIESGO_COLOR: Record<string, string> = {
  ROJO: 'FFdc2626',
  AMARILLO: 'FFeab308',
  VERDE: 'FF22c55e',
  LISTA_NEGRA: 'FF1e293b',
};

const AZUL_OSCURO = 'FF004F7B';
const NARANJA = 'FFF37920';

// ─── Generador Excel ──────────────────────────────────────────────────────────

export async function generarExcelClientes(
  filas: ClienteExportRow[],
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Clientes', {
    views: [{ state: 'frozen', ySplit: 5, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    properties: { tabColor: { argb: 'FF0ea5e9' } },
  });

  ws.columns = [
    { header: 'Código', key: 'codigo', width: 12 },
    { header: 'Nombres', key: 'nombres', width: 22 },
    { header: 'Apellidos', key: 'apellidos', width: 22 },
    { header: 'Documento', key: 'dni', width: 14 },
    { header: 'Teléfono', key: 'telefono', width: 14 },
    { header: 'Correo', key: 'correo', width: 28 },
    { header: 'Dirección', key: 'direccion', width: 30 },
    { header: 'Nivel Riesgo', key: 'nivelRiesgo', width: 14 },
    { header: 'Estado', key: 'estadoAprobacion', width: 14 },
    { header: 'Créditos Activos', key: 'prestamosActivos', width: 16 },
    { header: 'Saldo Total', key: 'montoTotal', width: 18 },
    { header: 'Saldo en Mora', key: 'montoMora', width: 18 },
    { header: 'Ruta', key: 'rutaNombre', width: 20 },
    { header: 'Registrado', key: 'creadoEn', width: 18 },
  ] as any;

  // Título
  const titleRow = ws.addRow(['CRÉDITOS DEL SUR — LISTADO DE CLIENTES']);
  titleRow.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_OSCURO } };
  ws.mergeCells('A1:N1');

  // Subtítulo
  ws.addRow(['LISTADO DE CLIENTES']);
  const c2 = ws.getCell('A2');
  c2.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NARANJA } };
  c2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells('A2:N2');

  // Metadata
  const metaRow = ws.addRow([
    `Generado: ${new Date().toLocaleString('es-CO')}   |   Total clientes: ${filas.length}`,
  ]);
  metaRow.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
  ws.mergeCells('A3:N3');

  ws.getRow(1).height = 32;
  ws.getRow(2).height = 22;
  ws.getRow(3).height = 16;

  ws.addRow([]);

  // Encabezados
  const headerRow = ws.getRow(5);
  ws.columns.forEach((col: any, i: number) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_OSCURO } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF0369a1' } },
    };
  });
  headerRow.height = 24;
  ws.autoFilter = { from: 'A5', to: 'N5' };

  // Datos
  filas.forEach((fila, idx) => {
    const row = ws.addRow({
      codigo: fila.codigo,
      nombres: fila.nombres,
      apellidos: fila.apellidos,
      dni: fila.dni,
      telefono: fila.telefono,
      correo: fila.correo || '',
      direccion: fila.direccion || '',
      nivelRiesgo: fila.nivelRiesgo,
      estadoAprobacion: fila.estadoAprobacion?.replace(/_/g, ' '),
      prestamosActivos: fila.prestamosActivos,
      montoTotal: fila.montoTotal, // Keep as number for formula
      montoMora: fila.montoMora, // Keep as number for formula
      rutaNombre: fila.rutaNombre || 'Sin ruta',
      creadoEn: fila.creadoEn ? new Date(fila.creadoEn).toLocaleDateString('es-CO') : '',
    });

    // Format currency columns
    row.getCell(11).numFmt = '"$"#,##0';
    row.getCell(12).numFmt = '"$"#,##0';

    // Fila cebra
    if (idx % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
      });
    }

    // Color en celda de nivel de riesgo
    const riesgoCell = row.getCell(8);
    const color = RIESGO_COLOR[fila.nivelRiesgo] || 'FF64748B';
    riesgoCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    riesgoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    riesgoCell.alignment = { horizontal: 'center' };

    // Mora en rojo si tiene
    if (fila.montoMora > 0) {
      row.getCell(12).font = { color: { argb: 'FFdc2626' }, bold: true };
    }
  });

  // Fila total
  ws.addRow([]);
  const sumRow = ws.addRow([
    'TOTALES', '', '', '', '', '', '', '', '', '',
    { formula: `SUM(K6:K${5 + filas.length})` }, // K column for montoTotal
    { formula: `SUM(L6:L${5 + filas.length})` }, // L column for montoMora
  ]);
  sumRow.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
  const mergeCell = sumRow.getCell(1);
  sumRow.eachCell({ includeEmpty: true }, (c, cn) => {
    if (cn <= 10) {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NARANJA } };
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    }
  });
  ws.mergeCells(`A${sumRow.number}:J${sumRow.number}`);
  mergeCell.alignment = { horizontal: 'right', vertical: 'middle' };
  sumRow.height = 24;
  sumRow.eachCell({ includeEmpty: true }, (c, cn) => {
    c.border = {
      top: { style: 'medium', color: { argb: 'FFFFFFFF' } },
      right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
    };
  });

  [11, 12].forEach(c => { // These indices correspond to the formula columns (K and L)
    const sc = sumRow.getCell(c);
    sc.numFmt = '"$"#,##0';
    sc.font = { bold: true, size: 10, color: { argb: 'FF000000' } };
    sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
    sc.alignment = { horizontal: 'right', vertical: 'middle' };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer as ArrayBuffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `clientes-${fecha}.xlsx`,
  };
}

// ─── Generador PDF ────────────────────────────────────────────────────────────

export async function generarPDFClientes(
  filas: ClienteExportRow[],
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
  
  const ROJO_DARK = '#DC2626';
  const ROJO_PALE = '#FEF2F2';
  const VERDE_DARK = '#059669';
  const AMARILLO_DARK = '#D97706';
  
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

  const mTotal = filas.reduce((s, f) => s + (f.montoTotal || 0), 0);
  const mTotalMora = filas.reduce((s, f) => s + (f.montoMora || 0), 0);

  const drawPageHeader = (): number => {
    const W = doc.page.width;

    doc.fontSize(22).font('Helvetica-Bold').fillColor(AZUL_DARK)
       .text('Créditos del Sur', 30, 25);
    doc.fontSize(9).font('Helvetica').fillColor(NAR_MED)
       .text('DIRECTORIO DE CLIENTES', 30, 52, { characterSpacing: 0.5 });

    doc.roundedRect(W - 180, 20, 148, 44, 5).fillAndStroke(BLANCO, GRIS_CLR);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(GRIS_MED)
       .text('FECHA GENERACIÓN', W - 180, 28, { width: 148, align: 'center' });
    doc.fontSize(10).font('Helvetica-Bold').fillColor(AZUL_DARK)
       .text(new Date().toLocaleDateString('es-CO'), W - 180, 40, { width: 148, align: 'center' });

    const kW = (doc.page.width - 60) / 4;
    const kY = 98;
    [
      { label: 'CLIENTES REGISTRADOS', val: String(filas.length), bg: '#D6E9F5', color: AZUL_DARK, isNum: false },
      { label: 'SALDO TOTAL',          val: mTotal, bg: NAR_SOFT, color: NAR_DARK, isNum: true },
      { label: 'EN MORA',              val: mTotalMora, bg: ROJO_PALE, color: ROJO_DARK, isNum: true },
      { label: 'CLIENTES ACTIVOS',     val: String(filas.filter(f => f.prestamosActivos > 0).length), bg: '#F0F4F8', color: GRIS_TXT, isNum: false },
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
    { label: 'Cód.', width: 45 },
    { label: 'Nombre Completo', width: 150 },
    { label: 'Documento', width: 80 },
    { label: 'Teléfono', width: 80 },
    { label: 'Riesgo', width: 60 },
    { label: 'Estado', width: 80 },
    { label: 'Créditos', width: 50 },
    { label: 'Saldo Total', width: 80 },
    { label: 'En Mora', width: 80 },
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
    const riesgoMora = fila.montoMora > 0;
    
    // Simplificamos el nombre para que quepa bien
    const nomCompleto = `${fila.nombres || ''} ${fila.apellidos || ''}`.trim();
    
    const vals = [
      fila.codigo || '',
      nomCompleto,
      fila.dni || '',
      fila.telefono || '',
      fila.nivelRiesgo || '',
      fila.estadoAprobacion?.replace(/_/g, ' ') || '',
      String(fila.prestamosActivos || 0),
      fmtCOP(fila.montoTotal || 0),
      fmtCOP(fila.montoMora || 0),
    ];

    doc.font('Helvetica').fontSize(7.5);
    vals.forEach((val, ci) => {
      if (ci === 0 || ci === 1 || ci === 7 || (ci === 8 && riesgoMora)) doc.font('Helvetica-Bold');
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
    const bg = riesgoMora ? ROJO_PALE : baseBg;
    
    doc.rect(tableLeft, y, tableWidth, maxRowHeight).fill(bg);
    doc.moveTo(tableLeft, y + maxRowHeight)
       .lineTo(tableLeft + tableWidth, y + maxRowHeight)
       .strokeColor(GRIS_CLR).lineWidth(0.4).stroke();

    let x = tableLeft;
    vals.forEach((v, ci) => {
      const align = ci >= 7 ? 'right' : (ci === 4 || ci === 6 ? 'center' : 'left');

      if (ci === 1) {
         doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
      } else if (ci === 8 && riesgoMora) {
         doc.font('Helvetica-Bold').fillColor(ROJO_DARK);
      } else if (ci === 7) {
         doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
      } else if (ci === 0) {
         doc.font('Helvetica-Bold').fillColor(GRIS_TXT);
      } else if (ci === 4) {
         const rr = fila.nivelRiesgo?.toUpperCase() || '';
         if (rr === 'ROJO' || rr === 'LISTA_NEGRA') doc.font('Helvetica-Bold').fillColor(ROJO_DARK);
         else if (rr === 'VERDE') doc.font('Helvetica-Bold').fillColor(VERDE_DARK);
         else if (rr === 'AMARILLO') doc.font('Helvetica-Bold').fillColor(AMARILLO_DARK);
         else doc.font('Helvetica-Bold').fillColor(GRIS_TXT);
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
    `TOTAL GENERAL  /  ${filas.length} clientes`,
    tableLeft + 6, y + 8,
    { width: cols.slice(0, 7).reduce((s, c) => s + c.width, 0) - 10 }
  );

  let tx = tableLeft + cols.slice(0, 7).reduce((s, c) => s + c.width, 0);
  [
    fmtCOP(mTotal),
    fmtCOP(mTotalMora),
  ].forEach((val, i) => {
    const ci = i + 7; // a partir de la columna 7
    if (ci < cols.length) {
      doc.fillColor(i === 1 ? '#FECACA' : BLANCO).font('Helvetica-Bold').fontSize(8);
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
    filename: `clientes-${fecha}.pdf`,
  };
}
