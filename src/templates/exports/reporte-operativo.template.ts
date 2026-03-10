/**
 * ============================================================================
 * PLANTILLA: REPORTE OPERATIVO
 * ============================================================================
 * Vista: /reportes/operativos, /coordinador/reportes, /supervisor/reportes/operativos
 * Endpoint: GET /reports/operational/export?format=excel|pdf
 * Estado: ✅ IMPLEMENTADO en reports.service.ts → exportOperationalReport()
 *
 * DISEÑO EXCEL (.xlsm):
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  CRÉDITOS DEL SUR — REPORTE OPERATIVO                                 │
 * │  Período: Hoy / Semana / Mes / Año                                    │
 * ├──────────┬──────────┬────────┬─────────┬────────┬─────────┬───────────┤
 * │   Ruta   │ Cobrador │  Meta  │Recaudado│Efic. % │Prést Nu │Client Nu  │
 * │ Centro   │ Juan P   │500,000 │ 450,000 │  90%   │    3    │    2      │
 * │ Norte    │ María L  │400,000 │ 380,000 │  95%   │    2    │    1      │
 * ├──────────┴──────────┴────────┴─────────┴────────┴─────────┴───────────┤
 * │ TOTALES: Meta: $XX | Recaudado: $XX | Eficiencia: XX%                 │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Estilos Excel:
 * - Header row: fondo estándar NestJS, texto blanco, bold, centrado
 * - Columnas moneda: Meta, Recaudado
 * - Fila totales: bold
 *
 * DISEÑO PDF:
 * - Layout: Landscape, Letter, margin 30
 * - Título: 16pt "Reporte Operativo"
 * - Subtítulo: Período + Fecha
 * - Tabla: 7 columnas, headers centrados
 * - Datos por ruta con totales al final
 */

import * as ExcelJS from 'exceljs';

export const OPERATIVO_COLUMNS: ExcelJS.Column[] = [
  { header: 'Ruta', key: 'ruta', width: 20 },
  { header: 'Cobrador', key: 'cobrador', width: 20 },
  { header: 'Meta', key: 'meta', width: 15 },
  { header: 'Recaudado', key: 'recaudado', width: 15 },
  { header: 'Eficiencia %', key: 'eficiencia', width: 15 },
  { header: 'Préstamos Nuevos', key: 'nuevosPrestamos', width: 15 },
  { header: 'Clientes Nuevos', key: 'nuevosClientes', width: 15 },
] as any;

export const OPERATIVO_CURRENCY_COLUMNS = ['meta', 'recaudado'];

export const OPERATIVO_PDF_COLUMNS = [
  { label: 'Ruta', width: 100 },
  { label: 'Cobrador', width: 100 },
  { label: 'Meta', width: 100 },
  { label: 'Recaudado', width: 100 },
  { label: 'Eficiencia', width: 100 },
  { label: 'Préstamos', width: 100 },
  { label: 'Clientes', width: 100 },
];


/**
 * codigo de exportación de reporte financiero
 */

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";

import {
  OPERATIVO_COLUMNS,
  OPERATIVO_CURRENCY_COLUMNS
} from "@/lib/templates/operativo";

export async function GET(req: NextRequest) {

  try {

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "hoy";

    let startDate = new Date();

    if (period === "semana") {
      startDate.setDate(startDate.getDate() - 7);
    }

    if (period === "mes") {
      startDate.setMonth(startDate.getMonth() - 1);
    }

    if (period === "anio") {
      startDate.setFullYear(startDate.getFullYear() - 1);
    }

    /* =========================
       CONSULTAS PRISMA
    ========================= */

    const rutas = await prisma.ruta.findMany({
      include: {
        cobrador: true,
        prestamos: {
          where: { createdAt: { gte: startDate } }
        },
        pagos: {
          where: { fecha: { gte: startDate } }
        }
      }
    });

    const clientesNuevos = await prisma.cliente.findMany({
      where: { createdAt: { gte: startDate } },
      include: { ruta: true }
    });

    const data: any[] = [];

    rutas.forEach(ruta => {

      const meta = ruta.metaDiaria || 0;

      const recaudado = ruta.pagos.reduce(
        (sum, p) => sum + p.monto,
        0
      );

      const nuevosPrestamos = ruta.prestamos.length;

      const nuevosClientes = clientesNuevos.filter(
        c => c.rutaId === ruta.id
      ).length;

      const eficiencia =
        meta > 0 ? recaudado / meta : 0;

      data.push({
        ruta: ruta.nombre,
        cobrador: ruta.cobrador?.nombre,
        meta,
        recaudado,
        eficiencia,
        nuevosPrestamos,
        nuevosClientes
      });

    });

    /* =========================
       TOTALES
    ========================= */

    const totalMeta = data.reduce(
      (sum, r) => sum + r.meta,
      0
    );

    const totalRecaudado = data.reduce(
      (sum, r) => sum + r.recaudado,
      0
    );

    const totalPrestamos = data.reduce(
      (sum, r) => sum + r.nuevosPrestamos,
      0
    );

    const totalClientes = data.reduce(
      (sum, r) => sum + r.nuevosClientes,
      0
    );

    const totalEficiencia =
      totalMeta > 0 ? totalRecaudado / totalMeta : 0;

    /* =========================
       CREAR EXCEL
    ========================= */

    const workbook = new ExcelJS.Workbook();

    const sheet = workbook.addWorksheet("Reporte Operativo");

    sheet.addRow([
      "CRÉDITOS DEL SUR — REPORTE OPERATIVO"
    ]).font = { size: 16, bold: true };

    sheet.addRow([`Período: ${period.toUpperCase()}`]);

    sheet.addRow([]);

    sheet.columns = OPERATIVO_COLUMNS;

    const header = sheet.addRow(
      OPERATIVO_COLUMNS.map(c => c.header)
    );

    header.eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEA580C" }
      };
      cell.alignment = { horizontal: "center" };
    });

    data.forEach(r => {

      const row = sheet.addRow([
        r.ruta,
        r.cobrador,
        r.meta,
        r.recaudado,
        r.eficiencia,
        r.nuevosPrestamos,
        r.nuevosClientes
      ]);

      OPERATIVO_CURRENCY_COLUMNS.forEach(col => {

        const index =
          OPERATIVO_COLUMNS.findIndex(
            c => c.key === col
          ) + 1;

        row.getCell(index).numFmt = "$#,##0";

      });

      row.getCell(5).numFmt = "0%";

    });

    sheet.addRow([]);

    const totalRow = sheet.addRow([
      "TOTALES",
      "",
      totalMeta,
      totalRecaudado,
      totalEficiencia,
      totalPrestamos,
      totalClientes
    ]);

    totalRow.font = { bold: true };

    totalRow.getCell(3).numFmt = "$#,##0";
    totalRow.getCell(4).numFmt = "$#,##0";
    totalRow.getCell(5).numFmt = "0%";

    /* =========================
       RESPUESTA
    ========================= */

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="reporte_operativo.xlsx"'
      }
    });

  } catch (error) {

    console.error(error);

    return NextResponse.json(
      { error: "Error generando reporte operativo" },
      { status: 500 }
    );

  }

}
