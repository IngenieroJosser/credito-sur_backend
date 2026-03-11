/**
 * ============================================================================
 * PLANTILLA: CUENTAS VENCIDAS
 * ============================================================================
 * Vista: /cuentas-vencidas
 * Endpoint: POST /reports/cuentas-vencidas/exportar
 * Estado: ✅ IMPLEMENTADO en reports.service.ts → exportarCuentasVencidas()
 *
 * DISEÑO EXCEL (.xlsm):
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  CRÉDITOS DEL SUR — CUENTAS VENCIDAS                                  │
 * │  Generado: 13/02/2026 14:30                                           │
 * ├──────────┬──────────┬────────┬────────┬─────────┬─────────┬───────────┤
 * │ N° Prést │ Cliente  │  Doc   │D. Venc │Mnt Venc │Saldo Pen│Int. Mora  │
 * │ PRE-003  │ Ana G    │1087654 │   90   │1,200,000│2,500,000│   85,000  │
 * ├──────────┴──────────┴────────┴────────┴─────────┴─────────┴───────────┤
 * │ (continúa: Nivel Riesgo, Ruta)                                        │
 * ├───────────────────────────────────────────────────────────────────────┤
 * │ TOTALES: Total Vencido: $XX | Días Promedio: XX                       │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Estilos Excel:
 * - Header row: fondo #D97706 (ámbar), texto blanco, bold, centrado
 * - Columnas moneda: formato #,##0 (montoVencido, saldoPendiente, interesesMora)
 * - Fila resumen: bold
 *
 * DISEÑO PDF:
 * - Layout: Landscape, Letter, margin 30
 * - Título: 16pt "Créditos del Sur — Cuentas Vencidas"
 * - Barra stats: Total Registros | Total Vencido | Días Promedio
 * - Tabla: header fondo #D97706, filas alternas #FFFBEB
 * - 9 columnas visibles
 */

import * as ExcelJS from 'exceljs';

export const VENCIDAS_COLUMNS: ExcelJS.Column[] = [
  { header: 'N° Préstamo', key: 'numero', width: 18 },
  { header: 'Cliente', key: 'cliente', width: 28 },
  { header: 'Documento', key: 'documento', width: 15 },
  { header: 'Días Vencido', key: 'diasVencido', width: 14 },
  { header: 'Monto Vencido', key: 'montoVencido', width: 16 },
  { header: 'Saldo Pendiente', key: 'saldoPendiente', width: 16 },
  { header: 'Intereses Mora', key: 'interesesMora', width: 16 },
  { header: 'Nivel Riesgo', key: 'riesgo', width: 14 },
  { header: 'Ruta', key: 'ruta', width: 18 },
] as any;

export const VENCIDAS_HEADER_STYLE = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD97706' } },
  alignment: { horizontal: 'center' as const },
};

export const VENCIDAS_CURRENCY_COLUMNS = ['montoVencido', 'saldoPendiente', 'interesesMora'];

export const VENCIDAS_PDF_COLUMNS = [
  { label: 'N° Préstamo', width: 85 },
  { label: 'Cliente', width: 130 },
  { label: 'Documento', width: 80 },
  { label: 'Días Venc.', width: 60 },
  { label: 'Monto Vencido', width: 85 },
  { label: 'Saldo Pend.', width: 85 },
  { label: 'Int. Mora', width: 75 },
  { label: 'Riesgo', width: 60 },
  { label: 'Ruta', width: 80 },
];

export const VENCIDAS_PDF_HEADER_COLOR = '#D97706';
export const VENCIDAS_PDF_ROW_ALT_COLOR = '#FFFBEB';
<<<<<<< HEAD

/**
 * codigo de exportación de  cuentas vencidas
 */

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import {
  VENCIDAS_COLUMNS,
  VENCIDAS_HEADER_STYLE,
  VENCIDAS_CURRENCY_COLUMNS
} from "@/lib/templates/vencidas";

function formatoFechaHora() {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date());
}

export async function POST(req: NextRequest) {
  try {

    const prestamos = await prisma.prestamo.findMany({
      where: {
        diasVencido: { gt: 0 }
      },
      include: {
        cliente: true,
        ruta: true
      },
      orderBy: {
        diasVencido: "desc"
      }
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Cuentas Vencidas", {
      views: [{ state: "frozen", ySplit: 4 }]
    });

    sheet.columns = VENCIDAS_COLUMNS;

    const titulo = sheet.addRow([
      "CRÉDITOS DEL SUR — CUENTAS VENCIDAS"
    ]);
    titulo.font = { size: 16, bold: true };
    sheet.mergeCells("A1:I1");

    const generado = sheet.addRow([
      `Generado: ${formatoFechaHora()}`
    ]);
    sheet.mergeCells("A2:I2");

    sheet.addRow([]);

    const header = sheet.addRow(
      VENCIDAS_COLUMNS.map(c => c.header)
    );

    header.eachCell(cell => {
      cell.font = VENCIDAS_HEADER_STYLE.font;
      cell.fill = VENCIDAS_HEADER_STYLE.fill;
      cell.alignment = VENCIDAS_HEADER_STYLE.alignment;
    });

    sheet.autoFilter = {
      from: "A4",
      to: "I4"
    };

    let totalVencido = 0;
    let sumaDias = 0;

    prestamos.forEach((item, index) => {

      const row = sheet.addRow([
        item.numero,
        item.cliente?.nombre,
        item.cliente?.documento,
        item.diasVencido,
        item.montoVencido,
        item.saldoPendiente,
        item.interesesMora,
        item.riesgo,
        item.ruta?.nombre
      ]);

      totalVencido += Number(item.montoVencido || 0);
      sumaDias += Number(item.diasVencido || 0);

      if (index % 2 === 1) {
        row.eachCell(cell => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFFBEB" }
          };
        });
      }

      VENCIDAS_CURRENCY_COLUMNS.forEach(colKey => {
        const colIndex =
          VENCIDAS_COLUMNS.findIndex(c => c.key === colKey) + 1;

        row.getCell(colIndex).numFmt = "#,##0";
      });

    });

    sheet.addRow([]);

    const promedioDias =
      prestamos.length > 0
        ? Math.round(sumaDias / prestamos.length)
        : 0;

    const resumen = sheet.addRow([
      "",
      "",
      "",
      "",
      `Total Vencido: ${totalVencido}`,
      "",
      "",
      "",
      `Días Promedio: ${promedioDias}`
    ]);

    resumen.font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="cuentas_vencidas.xlsx"'
      }
    });

  } catch (error) {

    console.error(error);

    return NextResponse.json(
      { error: "Error exportando cuentas vencidas" },
      { status: 500 }
    );

  }
}
=======
>>>>>>> main
