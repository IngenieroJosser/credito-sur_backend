/**
 * ============================================================================
 * TEMPLATE: REPORTE DE GASTOS
 * ============================================================================
 * Usado en: accounting.service.ts → exportGastos()
 * Endpoint: GET /accounting/gastos/export?format=excel|pdf
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface GastoRow {
  numero: string;
  fecha: string;
  cobrador: string;
  ruta: string;
  tipo: string;
  categoria: string | null;
  descripcion: string;
  monto: number;
  estado: string;
}

// ─── Generador Excel ──────────────────────────────────────────────────────────

export async function generarExcelGastos(
  gastos: GastoRow[],
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Gastos');

  // Headers
  worksheet.columns = [
    { header: 'Número', key: 'numero', width: 20 },
    { header: 'Fecha', key: 'fecha', width: 20 },
    { header: 'Cobrador', key: 'cobrador', width: 25 },
    { header: 'Ruta', key: 'ruta', width: 25 },
    { header: 'Tipo', key: 'tipo', width: 15 },
    { header: 'Categoría', key: 'categoria', width: 20 },
    { header: 'Descripción', key: 'descripcion', width: 40 },
    { header: 'Monto', key: 'monto', width: 15 },
    { header: 'Estado', key: 'estado', width: 15 },
  ];

  // Header style
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF08557F' } };

  // Data
  gastos.forEach((g) => {
    worksheet.addRow({
      numero: g.numero,
      fecha: g.fecha,
      cobrador: g.cobrador,
      ruta: g.ruta,
      tipo: g.tipo,
      categoria: g.categoria || 'Sin categoría',
      descripcion: g.descripcion,
      monto: g.monto,
      estado: g.estado,
    });
  });

  // Number format for monto
  worksheet.getColumn('monto').numFmt = '$#,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    data: Buffer.from(buffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `gastos_${fecha}.xlsx`,
  };
}

// ─── Generador PDF ────────────────────────────────────────────────────────────

export async function generarPDFGastos(
  gastos: GastoRow[],
  fecha: string,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
  const chunks: Buffer[] = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  // Title
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#08557F').text('Historial de Gastos', 30, 30);
  doc.fontSize(10).font('Helvetica').fillColor('#666666').text(`Generado: ${new Date().toLocaleString('es-CO')}`, 30, 50);

  // Table
  const tableTop = 70;
  const rowHeight = 20;
  const colWidths = [80, 100, 120, 100, 80, 100, 150, 80, 80];
  const headers = ['#', 'Número', 'Fecha', 'Cobrador', 'Ruta', 'Tipo', 'Categoría', 'Monto', 'Estado'];
  const startX = 30;

  // Header row
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
  headers.forEach((header, i) => {
    doc.rect(startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0), tableTop, colWidths[i], rowHeight).fill('#08557F');
    doc.text(header, startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + 5, tableTop + 12);
  });

  // Data rows
  doc.fontSize(8).font('Helvetica').fillColor('#333333');
  gastos.forEach((g, i) => {
    const y = tableTop + rowHeight * (i + 1);
    const bgColor = i % 2 === 0 ? '#F8F9FA' : '#FFFFFF';
    doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill(bgColor);
    
    doc.text(String(i + 1), startX + 5, y + 12);
    doc.text(g.numero, startX + colWidths[0] + 5, y + 12);
    doc.text(g.fecha.slice(0, 10), startX + colWidths.slice(0, 1).reduce((a, b) => a + b, 0) + 5, y + 12);
    doc.text(g.cobrador.slice(0, 15), startX + colWidths.slice(0, 2).reduce((a, b) => a + b, 0) + 5, y + 12);
    doc.text(g.ruta.slice(0, 12), startX + colWidths.slice(0, 3).reduce((a, b) => a + b, 0) + 5, y + 12);
    doc.text(g.tipo.slice(0, 10), startX + colWidths.slice(0, 4).reduce((a, b) => a + b, 0) + 5, y + 12);
    doc.text((g.categoria || '-').slice(0, 12), startX + colWidths.slice(0, 5).reduce((a, b) => a + b, 0) + 5, y + 12);
    doc.text(`$${g.monto.toLocaleString('es-CO')}`, startX + colWidths.slice(0, 6).reduce((a, b) => a + b, 0) + 5, y + 12);
    doc.text(g.estado, startX + colWidths.slice(0, 7).reduce((a, b) => a + b, 0) + 5, y + 12);
  });

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => {
      resolve({
        data: Buffer.concat(chunks),
        contentType: 'application/pdf',
        filename: `gastos_${fecha}.pdf`,
      });
    });
  });
}
