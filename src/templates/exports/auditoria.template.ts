/**
 * ============================================================================
 * TEMPLATE: LOG DE AUDITORÍA
 * ============================================================================
 * Usado en: audit.service.ts → exportAuditLog()
 * Endpoint: GET /audit/export?format=excel|pdf
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AuditoriaRow {
  fecha: Date | string;
  usuario: string;
  accion: string;
  entidad: string;
  entidadId: string;
  datosAnteriores?: any;
  datosNuevos?: any;
}

// ─── Generador Excel ──────────────────────────────────────────────────────────

export async function generarExcelAuditoria(
  filas: AuditoriaRow[],
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Log de Auditoría', {
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  ws.columns = [
    { header: 'Fecha', key: 'fecha', width: 22 },
    { header: 'Usuario', key: 'usuario', width: 28 },
    { header: 'Acción', key: 'accion', width: 24 },
    { header: 'Entidad', key: 'entidad', width: 18 },
    { header: 'ID Entidad', key: 'entidadId', width: 20 },
    { header: 'Datos Anteriores', key: 'datosAnteriores', width: 40 },
    { header: 'Datos Nuevos', key: 'datosNuevos', width: 40 },
  ] as any;

  // Título
  const titleRow = ws.addRow(['CRÉDITOS DEL SUR — LOG DE AUDITORÍA']);
  titleRow.font = { bold: true, size: 16, color: { argb: 'FF475569' } };
  ws.mergeCells('A1:G1');

  // Subtítulo
  const subRow = ws.addRow([`Generado: ${new Date().toLocaleString('es-CO')}   |   Total registros: ${filas.length}`]);
  subRow.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
  ws.mergeCells('A2:G2');

  ws.addRow([]);

  // Encabezados
  const headerRow = ws.getRow(4);
  ws.columns.forEach((col: any, i: number) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  headerRow.height = 22;
  ws.autoFilter = { from: 'A4', to: 'G4' };

  // Datos
  filas.forEach((fila, idx) => {
    const row = ws.addRow({
      fecha: fila.fecha ? new Date(fila.fecha).toLocaleString('es-CO') : '',
      usuario: fila.usuario || '',
      accion: fila.accion?.replace(/_/g, ' ') || '',
      entidad: fila.entidad || '',
      entidadId: fila.entidadId || '',
      datosAnteriores: fila.datosAnteriores
        ? JSON.stringify(fila.datosAnteriores).substring(0, 150)
        : '',
      datosNuevos: fila.datosNuevos
        ? JSON.stringify(fila.datosNuevos).substring(0, 150)
        : '',
    });

    if (idx % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });

  ws.addRow([]);
  const totalRow = ws.addRow({ fecha: `Total registros: ${filas.length}` });
  totalRow.font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer as ArrayBuffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `auditoria-${fecha}.xlsx`,
  };
}

// ─── Generador PDF ────────────────────────────────────────────────────────────

export async function generarPDFAuditoria(
  filas: AuditoriaRow[],
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
  const SLATE_DARK = '#1E293B';
  const SLATE_MED  = '#475569';
  const SLATE_PALE = '#F1F5F9';
  const AZUL_DARK  = '#1A5F8A';

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

    doc.fontSize(22).font('Helvetica-Bold').fillColor(SLATE_DARK)
       .text('Créditos del Sur', 30, 25);
    doc.fontSize(9).font('Helvetica').fillColor(SLATE_MED)
       .text('REPORTE DE AUDITORÍA DE SISTEMA', 30, 52, { characterSpacing: 0.5 });

    doc.roundedRect(W - 180, 20, 148, 44, 5).fillAndStroke(BLANCO, GRIS_CLR);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(GRIS_MED)
       .text('FECHA GENERACIÓN', W - 180, 28, { width: 148, align: 'center' });
    doc.fontSize(10).font('Helvetica-Bold').fillColor(SLATE_DARK)
       .text(new Date().toLocaleDateString('es-CO'), W - 180, 40, { width: 148, align: 'center' });

    const kW = (doc.page.width - 60) / 3;
    const kY = 98;
    [
      { label: 'TOTAL DE REGISTROS', val: String(filas.length), bg: SLATE_PALE, color: SLATE_DARK },
      { label: 'SISTEMA BASE', val: 'Créditos del Sur V1.0', bg: '#F0F4F8', color: GRIS_TXT },
      { label: 'NIVEL DE ACCESO', val: 'Administrador / Sistema', bg: '#F0F4F8', color: GRIS_TXT },
    ].forEach((m, i) => {
      const mx = 30 + i * (kW + 4);
      doc.roundedRect(mx, kY, kW, 44, 6).fillAndStroke(m.bg, GRIS_CLR);
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(GRIS_MED)
         .text(m.label, mx, kY + 10, { width: kW, align: 'center' });
      doc.fontSize(11).font('Helvetica-Bold').fillColor(m.color)
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
    { label: 'Fecha', width: 90 },
    { label: 'Usuario', width: 110 },
    { label: 'Acción', width: 120 },
    { label: 'Entidad', width: 80 },
    { label: 'ID Entidad', width: 100 },
    { label: 'Detalle (Nuevos / Cambio)', width: 232 },
  ];

  const tableLeft = 30;
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);

  const drawTableHeader = (y: number): number => {
    doc.rect(tableLeft, y, tableWidth, 24).fill(SLATE_MED);
    doc.rect(tableLeft, y + 24, tableWidth, 2).fill(SLATE_DARK);
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

    const limitStr = (str: string, maxLen: number) => {
      if (!str) return '';
      if (str.length <= maxLen) return str;
      return str.substring(0, maxLen - 3) + '...';
    };

    // Audit logs can have HUGE JSON blobs. We need to limit them to avoid multi-page single rows, but we give them a generous 500 chars instead of hard 50.
    const detalle = fila.datosNuevos
      ? limitStr(JSON.stringify(fila.datosNuevos), 500)
      : (fila.datosAnteriores ? limitStr(JSON.stringify(fila.datosAnteriores), 500) : '');

    const vals = [
      fila.fecha ? new Date(fila.fecha).toLocaleString('es-CO') : '',
      fila.usuario || '',
      fila.accion?.replace(/_/g, ' ') || '',
      fila.entidad || '',
      fila.entidadId || '',
      detalle,
    ];

    doc.font('Helvetica').fontSize(7.5);
    vals.forEach((val, ci) => {
      if (ci === 0 || ci === 1) doc.font('Helvetica-Bold');
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

    const baseBg = i % 2 === 0 ? BLANCO : SLATE_PALE;
    doc.rect(tableLeft, y, tableWidth, maxRowHeight).fill(baseBg);
    doc.moveTo(tableLeft, y + maxRowHeight)
       .lineTo(tableLeft + tableWidth, y + maxRowHeight)
       .strokeColor(GRIS_CLR).lineWidth(0.4).stroke();

    let x = tableLeft;
    vals.forEach((v, ci) => {
      const align = 'left';

      if (ci === 1) {
         doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
      } else if (ci === 0) {
         doc.font('Helvetica-Bold').fillColor(SLATE_DARK);
      } else if (ci === 2) {
         doc.font('Helvetica-Bold').fillColor(SLATE_MED);
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
  doc.rect(tableLeft, y, tableWidth, 26).fill(SLATE_DARK);

  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BLANCO);
  doc.text(
    `TOTAL REGISTROS DE AUDITORÍA: ${filas.length}`,
    tableLeft + 6, y + 9,
    { width: tableWidth - 10, align: 'center' }
  );

  y += 38;
  doc.fontSize(7.5).font('Helvetica-Oblique').fillColor(GRIS_MED)
     .text(
       'Documento expedido por Créditos del Sur. Información de trazabilidad del sistema. Confidencial.',
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
    filename: `auditoria-${fecha}.pdf`,
  };
}
