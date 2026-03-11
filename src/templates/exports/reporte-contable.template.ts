/**
 * ============================================================================
 * PLANTILLA: REPORTE CONTABLE
 * ============================================================================
 * Vista: /admin/contable
 * Endpoint: GET /accounting/export?format=excel|pdf
 * Estado: ⬜ PENDIENTE — crear endpoint y método en accounting.service.ts
 *
 * DISEÑO EXCEL (.xlsm):
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  CRÉDITOS DEL SUR — REPORTE CONTABLE                                  │
 * │  Generado: 13/02/2026 14:30                                           │
 * ├═══════════════════════════════════════════════════════════════════════╡
 * │  HOJA 1: ESTADO DE CAJAS                                             │
 * ├──────────┬──────────────┬──────────┬──────────┬───────────────────────┤
 * │   Caja   │ Responsable  │  Saldo   │  Estado  │ Última Transacción    │
 * │ Caja 001 │ Juan Pérez   │2,500,000 │  ABIERTA │ 13/02/2026 10:30      │
 * │ Caja 002 │ María López  │1,800,000 │  CERRADA │ 12/02/2026 18:00      │
 * ├══════════════════════════════════════════════════════════════════════╡
 * │  HOJA 2: MOVIMIENTOS DEL PERÍODO                                     │
 * ├──────────┬──────────┬──────────┬──────────────┬───────────────────────┤
 * │  Fecha   │   Tipo   │  Monto   │ Descripción  │ Caja                  │
 * │ 13/02/26 │ INGRESO  │ 500,000  │ Pago cuota   │ Caja 001              │
 * │ 13/02/26 │ EGRESO   │  50,000  │ Papelería    │ Caja 001              │
 * ├══════════════════════════════════════════════════════════════════════╡
 * │  HOJA 3: RESUMEN FINANCIERO                                          │
 * ├──────────────┬──────────────┬──────────────┬──────────────────────────┤
 * │ Ingresos Hoy │ Egresos Hoy  │ Utilidad Neta│ Capital en Calle        │
 * │  $1,200,000  │   $350,000   │   $850,000   │   $45,000,000           │
 * └──────────────┴──────────────┴──────────────┴──────────────────────────┘
 *
 * Estilos Excel:
 * - Header row: fondo #0369A1 (azul sky), texto blanco, bold
 * - 3 hojas: Estado de Cajas, Movimientos, Resumen
 * - Columnas moneda: formato $#,##0
 *
 * DISEÑO PDF:
 * - Layout: Portrait, Letter, margin 40
 * - Título: 18pt "Reporte Contable"
 * - Sección 1: Resumen financiero (tarjetas)
 * - Sección 2: Tabla estado de cajas
 * - Sección 3: Tabla movimientos recientes
 * - Color tema: #0369A1
 *
 * IMPLEMENTACIÓN:
 * 1. Backend: accounting.controller.ts → GET /accounting/export
 * 2. Backend: accounting.service.ts → exportAccountingReport()
 *    - Reutilizar getCajas() + getTransacciones() + getResumenFinanciero()
 * 3. Frontend: exportService.downloadFile('accounting/export', params)
 */

import * as ExcelJS from 'exceljs';

export const CAJAS_COLUMNS: ExcelJS.Column[] = [
  { header: 'Caja', key: 'nombre', width: 18 },
  { header: 'Responsable', key: 'responsable', width: 25 },
  { header: 'Saldo', key: 'saldo', width: 16 },
  { header: 'Estado', key: 'estado', width: 14 },
  { header: 'Última Transacción', key: 'ultimaTransaccion', width: 20 },
] as any;

export const MOVIMIENTOS_COLUMNS: ExcelJS.Column[] = [
  { header: 'Fecha', key: 'fecha', width: 18 },
  { header: 'Tipo', key: 'tipo', width: 14 },
  { header: 'Monto', key: 'monto', width: 16 },
  { header: 'Descripción', key: 'descripcion', width: 35 },
  { header: 'Caja', key: 'caja', width: 18 },
  { header: 'Usuario', key: 'usuario', width: 22 },
] as any;

export const CONTABLE_HEADER_STYLE = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF0369A1' } },
  alignment: { horizontal: 'center' as const },
};

export const CONTABLE_PDF_HEADER_COLOR = '#0369A1';
<<<<<<< HEAD


/**
 * codigo de exportación de reporte contable
 */

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";

import {
  CAJAS_COLUMNS,
  MOVIMIENTOS_COLUMNS,
  CONTABLE_HEADER_STYLE
} from "@/lib/templates/contable";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

export async function GET(req: NextRequest) {
  try {

    /* =========================
       CONSULTAS PRISMA
    ========================= */

    const cajas = await prisma.caja.findMany({
      include: {
        responsable: true,
        transacciones: {
          orderBy: { fecha: "desc" },
          take: 1
        }
      }
    });

    const movimientos = await prisma.transaccion.findMany({
      include: {
        caja: true,
        usuario: true
      },
      orderBy: {
        fecha: "desc"
      }
    });

    const ingresosHoy = await prisma.transaccion.aggregate({
      _sum: { monto: true },
      where: {
        tipo: "INGRESO",
        fecha: {
          gte: new Date(new Date().setHours(0,0,0,0))
        }
      }
    });

    const egresosHoy = await prisma.transaccion.aggregate({
      _sum: { monto: true },
      where: {
        tipo: "EGRESO",
        fecha: {
          gte: new Date(new Date().setHours(0,0,0,0))
        }
      }
    });

    const capitalCalle = await prisma.prestamo.aggregate({
      _sum: { saldoPendiente: true }
    });

    const ingresos = ingresosHoy._sum.monto || 0;
    const egresos = egresosHoy._sum.monto || 0;
    const utilidad = ingresos - egresos;

    /* =========================
       CREAR EXCEL
    ========================= */

    const workbook = new ExcelJS.Workbook();

    /* =========================
       HOJA 1: ESTADO DE CAJAS
    ========================= */

    const cajasSheet = workbook.addWorksheet("Estado de Cajas");

    cajasSheet.columns = CAJAS_COLUMNS;

    const cajasHeader = cajasSheet.addRow(
      CAJAS_COLUMNS.map(c => c.header)
    );

    cajasHeader.eachCell(cell => {
      cell.font = CONTABLE_HEADER_STYLE.font;
      cell.fill = CONTABLE_HEADER_STYLE.fill;
      cell.alignment = CONTABLE_HEADER_STYLE.alignment;
    });

    cajas.forEach(caja => {

      const ultima =
        caja.transacciones.length > 0
          ? formatDate(caja.transacciones[0].fecha)
          : "";

      const row = cajasSheet.addRow([
        caja.nombre,
        caja.responsable?.nombre,
        caja.saldo,
        caja.estado,
        ultima
      ]);

      row.getCell(3).numFmt = "$#,##0";

    });

    /* =========================
       HOJA 2: MOVIMIENTOS
    ========================= */

    const movimientosSheet = workbook.addWorksheet("Movimientos");

    movimientosSheet.columns = MOVIMIENTOS_COLUMNS;

    const movHeader = movimientosSheet.addRow(
      MOVIMIENTOS_COLUMNS.map(c => c.header)
    );

    movHeader.eachCell(cell => {
      cell.font = CONTABLE_HEADER_STYLE.font;
      cell.fill = CONTABLE_HEADER_STYLE.fill;
      cell.alignment = CONTABLE_HEADER_STYLE.alignment;
    });

    movimientos.forEach(m => {

      const row = movimientosSheet.addRow([
        formatDate(m.fecha),
        m.tipo,
        m.monto,
        m.descripcion,
        m.caja?.nombre,
        m.usuario?.nombre
      ]);

      row.getCell(3).numFmt = "$#,##0";

    });

    /* =========================
       HOJA 3: RESUMEN
    ========================= */

    const resumenSheet = workbook.addWorksheet("Resumen Financiero");

    const title = resumenSheet.addRow([
      "CRÉDITOS DEL SUR — REPORTE CONTABLE"
    ]);

    title.font = { size: 16, bold: true };
    resumenSheet.mergeCells("A1:D1");

    const generated = resumenSheet.addRow([
      `Generado: ${formatDate(new Date())}`
    ]);

    resumenSheet.mergeCells("A2:D2");

    resumenSheet.addRow([]);

    const header = resumenSheet.addRow([
      "Ingresos Hoy",
      "Egresos Hoy",
      "Utilidad Neta",
      "Capital en Calle"
    ]);

    header.eachCell(cell => {
      cell.font = CONTABLE_HEADER_STYLE.font;
      cell.fill = CONTABLE_HEADER_STYLE.fill;
      cell.alignment = CONTABLE_HEADER_STYLE.alignment;
    });

    const dataRow = resumenSheet.addRow([
      ingresos,
      egresos,
      utilidad,
      capitalCalle._sum.saldoPendiente || 0
    ]);

    dataRow.eachCell(cell => {
      cell.numFmt = "$#,##0";
      cell.font = { bold: true };
    });

    resumenSheet.columns = [
      { width: 20 },
      { width: 20 },
      { width: 20 },
      { width: 25 }
    ];

    /* =========================
       RESPUESTA
    ========================= */

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="reporte_contable.xlsx"'
      }
    });

  } catch (error) {

    console.error(error);

    return NextResponse.json(
      { error: "Error generando reporte contable" },
      { status: 500 }
    );

  }
}
=======
>>>>>>> main
