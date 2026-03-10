/**
 * ============================================================================
 * PLANTILLA: REPORTE FINANCIERO
 * ============================================================================
 * Vista: /reportes/financieros
 * Endpoint: GET /reports/financial/export?format=excel|pdf&startDate=&endDate=
 * Estado: ⬜ PENDIENTE — crear endpoint y método en reports.service.ts
 *
 * DISEÑO EXCEL (.xlsm):
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  CRÉDITOS DEL SUR — REPORTE FINANCIERO                                │
 * │  Período: Enero 2026 - Febrero 2026                                   │
 * ├═══════════════════════════════════════════════════════════════════════╡
 * │  HOJA 1: RESUMEN FINANCIERO                                          │
 * ├──────────────┬──────────────┬──────────────┬──────────────────────────┤
 * │   Ingresos   │   Egresos    │   Utilidad   │   Margen (%)             │
 * │ $45,000,000  │ $28,000,000  │ $17,000,000  │     37.8%               │
 * ├══════════════════════════════════════════════════════════════════════╡
 * │  HOJA 2: EVOLUCIÓN MENSUAL                                           │
 * ├──────────┬──────────┬──────────┬──────────────────────────────────────┤
 * │   Mes    │ Ingresos │ Egresos  │ Utilidad                             │
 * │ Enero    │5,200,000 │3,100,000 │ 2,100,000                            │
 * │ Febrero  │5,800,000 │3,400,000 │ 2,400,000                            │
 * ├══════════════════════════════════════════════════════════════════════╡
 * │  HOJA 3: DISTRIBUCIÓN DE GASTOS                                      │
 * ├──────────────────┬──────────┬─────────────────────────────────────────┤
 * │    Categoría     │  Monto   │ Porcentaje                              │
 * │ Nómina           │8,000,000 │   28.6%                                 │
 * │ Operaciones      │5,500,000 │   19.6%                                 │
 * └──────────────────┴──────────┴─────────────────────────────────────────┘
 *
 * Estilos Excel:
 * - Header row: fondo #059669 (verde esmeralda), texto blanco, bold
 * - 3 hojas separadas: Resumen, Evolución Mensual, Distribución Gastos
 * - Columnas moneda: formato $#,##0
 * - Columnas porcentaje: formato 0.0%
 *
 * DISEÑO PDF:
 * - Layout: Portrait, Letter, margin 40
 * - Título: 18pt "Reporte Financiero"
 * - Sección 1: Tarjetas de resumen (Ingresos, Egresos, Utilidad, Margen)
 * - Sección 2: Tabla evolución mensual
 * - Sección 3: Tabla distribución de gastos
 * - Color tema: #059669
 *
 * IMPLEMENTACIÓN:
 * 1. Backend: reports.controller.ts → GET /reports/financial/export
 * 2. Backend: reports.service.ts → exportFinancialReport()
 *    - Reutilizar getFinancialSummary() + getMonthlyEvolution() + getExpenseDistribution()
 * 3. Frontend: exportService.downloadFile('reports/financial/export', params)
 */

import * as ExcelJS from 'exceljs';

export const FINANCIERO_RESUMEN_COLUMNS: ExcelJS.Column[] = [
  { header: 'Concepto', key: 'concepto', width: 25 },
  { header: 'Monto', key: 'monto', width: 20 },
  { header: 'Variación', key: 'variacion', width: 15 },
] as any;

export const FINANCIERO_MENSUAL_COLUMNS: ExcelJS.Column[] = [
  { header: 'Mes', key: 'mes', width: 15 },
  { header: 'Ingresos', key: 'ingresos', width: 18 },
  { header: 'Egresos', key: 'egresos', width: 18 },
  { header: 'Utilidad', key: 'utilidad', width: 18 },
] as any;

export const FINANCIERO_GASTOS_COLUMNS: ExcelJS.Column[] = [
  { header: 'Categoría', key: 'categoria', width: 25 },
  { header: 'Monto', key: 'monto', width: 18 },
  { header: 'Porcentaje', key: 'porcentaje', width: 15 },
] as any;

export const FINANCIERO_HEADER_STYLE = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF059669' } },
  alignment: { horizontal: 'center' as const },
};

export const FINANCIERO_PDF_HEADER_COLOR = '#059669';

/**
 * codigo de exportación de reporte financiero
 */

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";

import {
  FINANCIERO_RESUMEN_COLUMNS,
  FINANCIERO_MENSUAL_COLUMNS,
  FINANCIERO_GASTOS_COLUMNS,
  FINANCIERO_HEADER_STYLE
} from "@/lib/templates/financiero";

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("es-CO", { month: "long" }).format(date);
}

export async function GET(req: NextRequest) {
  try {

    const { searchParams } = new URL(req.url);

    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: any = {};

    if (startDate && endDate) {
      where.fecha = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    /* =========================
       CONSULTAS PRISMA
    ========================= */

    const ingresos = await prisma.transaccion.aggregate({
      _sum: { monto: true },
      where: { ...where, tipo: "INGRESO" }
    });

    const egresos = await prisma.transaccion.aggregate({
      _sum: { monto: true },
      where: { ...where, tipo: "EGRESO" }
    });

    const totalIngresos = ingresos._sum.monto || 0;
    const totalEgresos = egresos._sum.monto || 0;
    const utilidad = totalIngresos - totalEgresos;

    const margen =
      totalIngresos > 0 ? utilidad / totalIngresos : 0;

    const movimientos = await prisma.transaccion.findMany({
      where,
      orderBy: { fecha: "asc" }
    });

    const mensual: any = {};

    movimientos.forEach(m => {

      const mes = formatMonth(m.fecha);

      if (!mensual[mes]) {
        mensual[mes] = {
          ingresos: 0,
          egresos: 0
        };
      }

      if (m.tipo === "INGRESO") {
        mensual[mes].ingresos += m.monto;
      } else {
        mensual[mes].egresos += m.monto;
      }

    });

    const evolucionMensual = Object.keys(mensual).map(mes => {

      const ingresos = mensual[mes].ingresos;
      const egresos = mensual[mes].egresos;

      return {
        mes,
        ingresos,
        egresos,
        utilidad: ingresos - egresos
      };

    });

    const gastos = await prisma.transaccion.groupBy({
      by: ["categoria"],
      _sum: { monto: true },
      where: { ...where, tipo: "EGRESO" }
    });

    const totalGastos = gastos.reduce(
      (sum, g) => sum + (g._sum.monto || 0),
      0
    );

    const distribucion = gastos.map(g => ({
      categoria: g.categoria || "Otros",
      monto: g._sum.monto || 0,
      porcentaje:
        totalGastos > 0 ? (g._sum.monto || 0) / totalGastos : 0
    }));

    /* =========================
       CREAR EXCEL
    ========================= */

    const workbook = new ExcelJS.Workbook();

    /* =========================
       HOJA 1 RESUMEN
    ========================= */

    const resumenSheet = workbook.addWorksheet(
      "Resumen Financiero"
    );

    resumenSheet.addRow([
      "CRÉDITOS DEL SUR — REPORTE FINANCIERO"
    ]).font = { bold: true, size: 16 };

    resumenSheet.addRow([
      `Período: ${startDate || ""} - ${endDate || ""}`
    ]);

    resumenSheet.addRow([]);

    resumenSheet.columns = FINANCIERO_RESUMEN_COLUMNS;

    const header1 = resumenSheet.addRow(
      FINANCIERO_RESUMEN_COLUMNS.map(c => c.header)
    );

    header1.eachCell(cell => {
      cell.font = FINANCIERO_HEADER_STYLE.font;
      cell.fill = FINANCIERO_HEADER_STYLE.fill;
      cell.alignment = FINANCIERO_HEADER_STYLE.alignment;
    });

    const rowsResumen = [
      { concepto: "Ingresos", monto: totalIngresos },
      { concepto: "Egresos", monto: totalEgresos },
      { concepto: "Utilidad", monto: utilidad },
      { concepto: "Margen (%)", monto: margen }
    ];

    rowsResumen.forEach(r => {

      const row = resumenSheet.addRow([
        r.concepto,
        r.monto,
        ""
      ]);

      if (r.concepto === "Margen (%)") {
        row.getCell(2).numFmt = "0.0%";
      } else {
        row.getCell(2).numFmt = "$#,##0";
      }

    });

    /* =========================
       HOJA 2 EVOLUCIÓN
    ========================= */

    const mensualSheet = workbook.addWorksheet(
      "Evolución Mensual"
    );

    mensualSheet.columns = FINANCIERO_MENSUAL_COLUMNS;

    const header2 = mensualSheet.addRow(
      FINANCIERO_MENSUAL_COLUMNS.map(c => c.header)
    );

    header2.eachCell(cell => {
      cell.font = FINANCIERO_HEADER_STYLE.font;
      cell.fill = FINANCIERO_HEADER_STYLE.fill;
      cell.alignment = FINANCIERO_HEADER_STYLE.alignment;
    });

    evolucionMensual.forEach(m => {

      const row = mensualSheet.addRow([
        m.mes,
        m.ingresos,
        m.egresos,
        m.utilidad
      ]);

      row.getCell(2).numFmt = "$#,##0";
      row.getCell(3).numFmt = "$#,##0";
      row.getCell(4).numFmt = "$#,##0";

    });

    /* =========================
       HOJA 3 DISTRIBUCIÓN
    ========================= */

    const gastosSheet = workbook.addWorksheet(
      "Distribución Gastos"
    );

    gastosSheet.columns = FINANCIERO_GASTOS_COLUMNS;

    const header3 = gastosSheet.addRow(
      FINANCIERO_GASTOS_COLUMNS.map(c => c.header)
    );

    header3.eachCell(cell => {
      cell.font = FINANCIERO_HEADER_STYLE.font;
      cell.fill = FINANCIERO_HEADER_STYLE.fill;
      cell.alignment = FINANCIERO_HEADER_STYLE.alignment;
    });

    distribucion.forEach(g => {

      const row = gastosSheet.addRow([
        g.categoria,
        g.monto,
        g.porcentaje
      ]);

      row.getCell(2).numFmt = "$#,##0";
      row.getCell(3).numFmt = "0.0%";

    });

    /* =========================
       RESPUESTA
    ========================= */

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="reporte_financiero.xlsx"'
      }
    });

  } catch (error) {

    console.error(error);

    return NextResponse.json(
      { error: "Error generando reporte financiero" },
      { status: 500 }
    );

  }
}