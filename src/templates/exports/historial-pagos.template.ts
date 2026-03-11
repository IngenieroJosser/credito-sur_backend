/**
 * ============================================================================
 * PLANTILLA: HISTORIAL DE PAGOS
 * ============================================================================
 * Vista: /admin/pagos/historial
 * Endpoint: GET /payments/export?format=excel|pdf&startDate=&endDate=&rutaId=
 * Estado: ⬜ PENDIENTE — crear endpoint y método en payments.service.ts
 *
 * DISEÑO EXCEL (.xlsm):
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  CRÉDITOS DEL SUR — HISTORIAL DE PAGOS                                │
 * │  Período: 01/01/2026 - 13/02/2026                                     │
 * ├──────────┬──────────┬────────┬─────────┬────────┬─────────┬───────────┤
 * │  Fecha   │ Cliente  │N° Prést│  Monto  │Tipo Pag│Cobrador │   Ruta    │
 * │ 13/02/26 │ Carlos M │PRE-001 │ 216,667 │EFECTIVO│ Juan P  │  Centro   │
 * │ 12/02/26 │ María R  │PRE-002 │ 100,000 │TRANSF  │ María L │  Norte    │
 * ├──────────┴──────────┴────────┴─────────┴────────┴─────────┴───────────┤
 * │ (continúa: N° Cuota, Estado, Observaciones)                           │
 * ├───────────────────────────────────────────────────────────────────────┤
 * │ TOTALES: Total Recaudado: $XX | N° Pagos: XX                         │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Estilos Excel:
 * - Header row: fondo #7C3AED (violeta), texto blanco, bold, centrado
 * - Columnas moneda: formato #,##0 (monto)
 * - Fila resumen: bold
 *
 * DISEÑO PDF:
 * - Layout: Landscape, Letter, margin 30
 * - Título: 16pt "Créditos del Sur — Historial de Pagos"
 * - Subtítulo: Período de fechas
 * - Barra stats: Total Recaudado | N° Pagos | Promedio por pago
 * - Tabla: header fondo #7C3AED, filas alternas #F5F3FF
 * - Paginación automática
 *
 * IMPLEMENTACIÓN:
 * 1. Backend: payments.controller.ts → GET /payments/export
 * 2. Backend: payments.service.ts → exportPayments()
 *    - Reutilizar la query de obtenerPagos() sin paginación
 * 3. Frontend: exportService.downloadFile('payments/export', params)
 */

import * as ExcelJS from 'exceljs';

export const PAGOS_COLUMNS: ExcelJS.Column[] = [
  { header: 'Fecha', key: 'fecha', width: 14 },
  { header: 'Cliente', key: 'cliente', width: 28 },
  { header: 'N° Préstamo', key: 'numeroPrestamo', width: 18 },
  { header: 'Monto', key: 'monto', width: 16 },
  { header: 'Tipo Pago', key: 'tipoPago', width: 14 },
  { header: 'N° Cuota', key: 'numeroCuota', width: 12 },
  { header: 'Cobrador', key: 'cobrador', width: 22 },
  { header: 'Ruta', key: 'ruta', width: 18 },
  { header: 'Estado', key: 'estado', width: 14 },
  { header: 'Observaciones', key: 'observaciones', width: 30 },
] as any;

export const PAGOS_HEADER_STYLE = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF7C3AED' } },
  alignment: { horizontal: 'center' as const },
};

export const PAGOS_CURRENCY_COLUMNS = ['monto'];

export const PAGOS_PDF_COLUMNS = [
  { label: 'Fecha', width: 70 },
  { label: 'Cliente', width: 120 },
  { label: 'N° Préstamo', width: 80 },
  { label: 'Monto', width: 80 },
  { label: 'Tipo Pago', width: 70 },
  { label: 'N° Cuota', width: 55 },
  { label: 'Cobrador', width: 100 },
  { label: 'Ruta', width: 80 },
];

export const PAGOS_PDF_HEADER_COLOR = '#7C3AED';
export const PAGOS_PDF_ROW_ALT_COLOR = '#F5F3FF';
<<<<<<< HEAD

/**
 * codigo de exportación de historial de pago
 */

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import {
  PAGOS_COLUMNS,
  PAGOS_HEADER_STYLE,
  PAGOS_CURRENCY_COLUMNS
} from "@/lib/templates/pagos";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-CO").format(date);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const rutaId = searchParams.get("rutaId");

    const where: any = {};

    if (startDate && endDate) {
      where.fecha = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    if (rutaId) {
      where.rutaId = rutaId;
    }

    const pagos = await prisma.pago.findMany({
      where,
      include: {
        cliente: true,
        prestamo: true,
        cobrador: true,
        ruta: true
      },
      orderBy: {
        fecha: "desc"
      }
    });

    const workbook = new ExcelJS.Workbook();

    const sheet = workbook.addWorksheet("Historial Pagos", {
      views: [{ state: "frozen", ySplit: 4 }]
    });

    sheet.columns = PAGOS_COLUMNS;

    const title = sheet.addRow([
      "CRÉDITOS DEL SUR — HISTORIAL DE PAGOS"
    ]);

    title.font = { size: 16, bold: true };
    sheet.mergeCells("A1:J1");

    const period =
      startDate && endDate
        ? `Período: ${formatDate(new Date(startDate))} - ${formatDate(
            new Date(endDate)
          )}`
        : "Período: Todos los registros";

    const periodRow = sheet.addRow([period]);
    sheet.mergeCells("A2:J2");

    sheet.addRow([]);

    const header = sheet.addRow(
      PAGOS_COLUMNS.map(c => c.header)
    );

    header.eachCell(cell => {
      cell.font = PAGOS_HEADER_STYLE.font;
      cell.fill = PAGOS_HEADER_STYLE.fill;
      cell.alignment = PAGOS_HEADER_STYLE.alignment;
    });

    sheet.autoFilter = {
      from: "A4",
      to: "J4"
    };

    let totalRecaudado = 0;

    pagos.forEach((pago, index) => {

      const row = sheet.addRow([
        pago.fecha,
        pago.cliente?.nombre,
        pago.prestamo?.numero,
        pago.monto,
        pago.tipoPago,
        pago.numeroCuota,
        pago.cobrador?.nombre,
        pago.ruta?.nombre,
        pago.estado,
        pago.observaciones
      ]);

      totalRecaudado += Number(pago.monto || 0);

      if (index % 2 === 1) {
        row.eachCell(cell => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF5F3FF" }
          };
        });
      }

      PAGOS_CURRENCY_COLUMNS.forEach(colKey => {
        const colIndex =
          PAGOS_COLUMNS.findIndex(c => c.key === colKey) + 1;

        row.getCell(colIndex).numFmt = "#,##0";
      });
    });

    sheet.addRow([]);

    const resumen = sheet.addRow([
      "",
      "",
      "",
      `Total Recaudado: ${totalRecaudado}`,
      "",
      "",
      "",
      "",
      "",
      `N° Pagos: ${pagos.length}`
    ]);

    resumen.font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="historial_pagos.xlsx"'
      }
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Error exportando historial de pagos" },
      { status: 500 }
    );
  }
}
=======
>>>>>>> main
