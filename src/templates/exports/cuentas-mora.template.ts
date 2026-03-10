/**
 * ============================================================================
 * PLANTILLA: CUENTAS EN MORA
 * ============================================================================
 * Vista: /cuentas-mora
 * Endpoint: POST /reports/exportar-mora
 * Estado: ✅ IMPLEMENTADO en reports.service.ts → generarReporteMora()
 *
 * DISEÑO EXCEL (.xlsm):
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  CRÉDITOS DEL SUR — CUENTAS EN MORA                                   │
 * │  Generado: 13/02/2026 14:30                                           │
 * ├──────────┬──────────┬────────┬────────┬─────────┬─────────┬───────────┤
 * │ N° Prést │ Cliente  │  Doc   │D. Mora │Mnt Mora │Deuda Tot│Cuotas Ven │
 * │ PRE-001  │ Jorge H  │1023456 │   45   │ 150,000 │4,200,000│     3     │
 * ├──────────┴──────────┴────────┴────────┴─────────┴─────────┴───────────┤
 * │ (continúa: Ruta, Cobrador, Nivel Riesgo, Último Pago)                 │
 * ├───────────────────────────────────────────────────────────────────────┤
 * │ TOTALES: Mora: $XX | Deuda: $XX | Registros: XX                      │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Estilos Excel:
 * - Header row: fondo #DC2626 (rojo), texto blanco, bold, centrado
 * - Columnas moneda: formato #,##0 (montoMora, deudaTotal)
 * - Fila resumen: bold
 *
 * DISEÑO PDF:
 * - Layout: Landscape, Letter, margin 30
 * - Título: 16pt "Créditos del Sur — Cuentas en Mora"
 * - Barra stats: Total Registros | Mora Acumulada | Deuda Total | Casos Críticos
 * - Tabla: header fondo #DC2626, filas alternas #FEF2F2
 * - 9 columnas visibles
 */

import * as ExcelJS from 'exceljs';


export const MORA_COLUMNS: ExcelJS.Column[] = [
  { header: 'N° Préstamo', key: 'numero', width: 18 },
  { header: 'Cliente', key: 'cliente', width: 28 },
  { header: 'Documento', key: 'documento', width: 15 },
  { header: 'Días Mora', key: 'diasMora', width: 12 },
  { header: 'Monto Mora', key: 'montoMora', width: 16 },
  { header: 'Deuda Total', key: 'deudaTotal', width: 16 },
  { header: 'Cuotas Vencidas', key: 'cuotasVencidas', width: 15 },
  { header: 'Ruta', key: 'ruta', width: 18 },
  { header: 'Cobrador', key: 'cobrador', width: 22 },
  { header: 'Nivel Riesgo', key: 'riesgo', width: 14 },
  { header: 'Último Pago', key: 'ultimoPago', width: 14 },
] as any;

export const MORA_HEADER_STYLE = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFDC2626' } },
  alignment: { horizontal: 'center' as const },
};

export const MORA_CURRENCY_COLUMNS = ['montoMora', 'deudaTotal'];

export const MORA_PDF_COLUMNS = [
  { label: 'N° Préstamo', width: 80 },
  { label: 'Cliente', width: 120 },
  { label: 'Días Mora', width: 60 },
  { label: 'Monto Mora', width: 80 },
  { label: 'Deuda Total', width: 80 },
  { label: 'Cuotas Venc.', width: 60 },
  { label: 'Ruta', width: 80 },
  { label: 'Cobrador', width: 100 },
  { label: 'Riesgo', width: 60 },
];

export const MORA_PDF_HEADER_COLOR = '#DC2626';
export const MORA_PDF_ROW_ALT_COLOR = '#FEF2F2';

/**
 * codigo de exportación de cuentas en mora
 */

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import {
  CARTERA_CREDITOS_COLUMNS,
  CARTERA_CREDITOS_HEADER_STYLE,
  CARTERA_CREDITOS_CURRENCY_COLUMNS
} from "@/lib/templates/cartera-creditos";

function formatoFechaHora() {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date());
}

export async function GET(req: NextRequest) {
  try {

    const loans = await prisma.prestamo.findMany({
      include: {
        cliente: true,
        producto: true,
        ruta: true
      },
      orderBy: {
        fechaInicio: "desc"
      }
    });

    const workbook = new ExcelJS.Workbook();

    const sheet = workbook.addWorksheet("Cartera Créditos", {
      views: [{ state: "frozen", ySplit: 4 }]
    });

    sheet.columns = CARTERA_CREDITOS_COLUMNS;

    const titulo = sheet.addRow([
      "CRÉDITOS DEL SUR — CARTERA DE CRÉDITOS"
    ]);

    titulo.font = { size: 16, bold: true };
    sheet.mergeCells("A1:P1");

    const generado = sheet.addRow([
      `Generado: ${formatoFechaHora()}`
    ]);

    sheet.mergeCells("A2:P2");

    sheet.addRow([]);

    const header = sheet.addRow(
      CARTERA_CREDITOS_COLUMNS.map(c => c.header)
    );

    header.eachCell(cell => {
      cell.font = CARTERA_CREDITOS_HEADER_STYLE.font;
      cell.fill = CARTERA_CREDITOS_HEADER_STYLE.fill;
      cell.alignment = CARTERA_CREDITOS_HEADER_STYLE.alignment;
    });

    sheet.autoFilter = {
      from: "A4",
      to: "P4"
    };

    let totalMonto = 0;
    let totalPendiente = 0;
    let totalMora = 0;

    loans.forEach((loan, index) => {

      const progreso =
        loan.cuotasTotales > 0
          ? Math.round((loan.cuotasPagadas / loan.cuotasTotales) * 100)
          : 0;

      const row = sheet.addRow([
        loan.numero,
        loan.cliente?.nombre,
        loan.cliente?.dni,
        loan.producto?.nombre,
        loan.estado,
        loan.montoTotal,
        loan.montoPendiente,
        loan.montoPagado,
        loan.mora,
        loan.cuotasPagadas,
        loan.cuotasTotales,
        progreso,
        loan.riesgo,
        loan.ruta?.nombre,
        loan.fechaInicio,
        loan.fechaFin
      ]);

      totalMonto += Number(loan.montoTotal || 0);
      totalPendiente += Number(loan.montoPendiente || 0);
      totalMora += Number(loan.mora || 0);

      if (index % 2 === 1) {
        row.eachCell(cell => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FAFC" }
          };
        });
      }

      CARTERA_CREDITOS_CURRENCY_COLUMNS.forEach(colKey => {
        const colIndex =
          CARTERA_CREDITOS_COLUMNS.findIndex(c => c.key === colKey) + 1;

        row.getCell(colIndex).numFmt = "#,##0";
      });

    });

    sheet.addRow([]);

    const resumen = sheet.addRow([
      "",
      "",
      "",
      "",
      "",
      `Monto Total: ${totalMonto}`,
      `Pendiente: ${totalPendiente}`,
      "",
      `Mora: ${totalMora}`
    ]);

    resumen.font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="cartera_creditos.xlsx"'
      }
    });

  } catch (error) {

    console.error(error);

    return NextResponse.json(
      { error: "Error exportando cartera de créditos" },
      { status: 500 }
    );

  }
}