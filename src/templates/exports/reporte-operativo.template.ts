/**
 * ============================================================================
 * TEMPLATE: REPORTE OPERATIVO
 * ============================================================================
 * Usado en: reports.service.ts → exportOperationalReport()
 * Endpoint: POST /reports/operational/export?format=excel|pdf
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

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
    views: [{ state: 'frozen', ySplit: 4 }],
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
  titleRow.font = { bold: true, size: 16, color: { argb: 'FFEA580C' } };
  ws.mergeCells('A1:H1');

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
  totalRow.font = { bold: true };
  colsMoneda.forEach(key => {
    const colIdx = ws.columns.findIndex((c: any) => c.key === key) + 1;
    if (colIdx > 0) totalRow.getCell(colIdx).numFmt = '#,##0';
  });

  // ── Hoja 2: Resumen General ──
  const ws2 = workbook.addWorksheet('Resumen General');
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

  // Encabezado
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#EA580C')
    .text('Créditos del Sur — Reporte Operativo', { align: 'center' });
  doc.fontSize(9).font('Helvetica').fillColor('#475569')
    .text(`Período: ${resumen.periodo?.toUpperCase() || 'N/A'}   |   Generado: ${new Date().toLocaleString('es-CO')}`, { align: 'center' });
  doc.moveDown(0.4);

  // Fila de métricas clave
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#1E293B');
  doc.text(
    `Recaudo Total: $${resumen.totalRecaudo.toLocaleString('es-CO')}  |  Meta: $${resumen.totalMeta.toLocaleString('es-CO')}  |  Eficiencia: ${resumen.porcentajeGlobal}%  |  Préstamos: ${resumen.totalPrestamosNuevos}  |  Clientes: ${resumen.totalAfiliaciones}`,
    { align: 'center' },
  );
  doc.moveDown(0.5);

  // Tabla principal: rendimiento por ruta
  const cols = [
    { label: 'Ruta', width: 100 },
    { label: 'Cobrador', width: 110 },
    { label: 'Meta', width: 80 },
    { label: 'Recaudado', width: 80 },
    { label: 'Eficiencia %', width: 70 },
    { label: 'Préstamos', width: 65 },
    { label: 'Clientes', width: 60 },
    { label: 'Monto Nuevos', width: 90 },
  ];

  const tableLeft = 30;
  const rowH = 16;
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);
  let y = doc.y + 5;

  const drawHeader = () => {
    doc.fontSize(7).font('Helvetica-Bold');
    doc.rect(tableLeft, y, tableWidth, rowH).fill('#EA580C');
    let x = tableLeft;
    cols.forEach(col => {
      doc.fillColor('white').text(col.label, x + 2, y + 4, { width: col.width - 4 });
      x += col.width;
    });
    return y + rowH;
  };

  y = drawHeader();
  doc.font('Helvetica').fontSize(7).fillColor('black');

  filas.forEach((fila, i) => {
    if (y > 540) {
      doc.addPage();
      y = 30;
      y = drawHeader();
      doc.font('Helvetica').fontSize(7).fillColor('black');
    }

    if (i % 2 === 0) {
      doc.rect(tableLeft, y, tableWidth, rowH).fill('#FFF7ED');
      doc.fillColor('black');
    }

    let x = tableLeft;
    [
      (fila.ruta || '').substring(0, 16),
      (fila.cobrador || '').substring(0, 18),
      `$${(fila.meta || 0).toLocaleString('es-CO')}`,
      `$${(fila.recaudado || 0).toLocaleString('es-CO')}`,
      `${fila.eficiencia || 0}%`,
      String(fila.nuevosPrestamos || 0),
      String(fila.nuevosClientes || 0),
      `$${(fila.montoNuevosPrestamos || 0).toLocaleString('es-CO')}`,
    ].forEach((val, ci) => {
      // Eficiencia baja en rojo
      const color = ci === 4 && fila.eficiencia < 70 ? '#DC2626' : 'black';
      doc.fillColor(color).text(val, x + 2, y + 4, { width: cols[ci].width - 4 });
      doc.fillColor('black');
      x += cols[ci].width;
    });
    y += rowH;
  });

  // Fila de totales
  y += 4;
  doc.rect(tableLeft, y, tableWidth, rowH).fill('#FED7AA');
  doc.fillColor('black');
  let x = tableLeft;
  const totalesData = [
    'TOTALES',
    '',
    `$${resumen.totalMeta.toLocaleString('es-CO')}`,
    `$${resumen.totalRecaudo.toLocaleString('es-CO')}`,
    `${resumen.porcentajeGlobal}%`,
    String(resumen.totalPrestamosNuevos),
    String(resumen.totalAfiliaciones),
    '',
  ];
  doc.fontSize(7).font('Helvetica-Bold');
  totalesData.forEach((val, ci) => {
    doc.text(val, x + 2, y + 4, { width: cols[ci].width - 4 });
    x += cols[ci].width;
  });

  doc.end();
  const buffer = await new Promise<Buffer>(resolve => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });

  return {
    data: buffer,
    contentType: 'application/pdf',
    filename: `reporte-operativo-${resumen.periodo}-${fecha}.pdf`,
  };
}
