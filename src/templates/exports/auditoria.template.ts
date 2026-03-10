/**
 * ============================================================================
 * PLANTILLA: LOG DE AUDITORÍA
 * ============================================================================
 * Vista: /admin/auditoria
 * Endpoint: GET /audit/export?format=excel|pdf&startDate=&endDate=
 * Estado: ⬜ PENDIENTE — crear endpoint y método en audit.service.ts
 *
 * DISEÑO EXCEL (.xlsm):
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  CRÉDITOS DEL SUR — LOG DE AUDITORÍA                                  │
 * │  Período: 01/01/2026 - 13/02/2026                                     │
 * ├──────────┬──────────┬────────────┬────────┬──────────┬────────────────┤
 * │  Fecha   │ Usuario  │   Acción   │Entidad │ID Entidad│   Detalle      │
 * │ 13/02/26 │ admin    │CREAR_PRÉST │Prestamo│ cl67qg5  │ Monto: 5M      │
 * │ 13/02/26 │ coord01  │APROBAR_CLI │Cliente │ ab12cd3  │ Aprobado       │
 * │ 12/02/26 │ admin    │ELIMINAR_ART│Producto│ xy89wz1  │ Archivado      │
 * ├──────────┴──────────┴────────────┴────────┴──────────┴────────────────┤
 * │ (continúa: Datos Anteriores, Datos Nuevos, IP, Nivel)                 │
 * ├───────────────────────────────────────────────────────────────────────┤
 * │ TOTAL REGISTROS: XX                                                   │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Estilos Excel:
 * - Header row: fondo #475569 (slate-600), texto blanco, bold
 * - Columna Datos Anteriores/Nuevos: formato JSON compacto
 * - Fila resumen: bold
 *
 * DISEÑO PDF:
 * - Layout: Landscape, Letter, margin 30
 * - Título: 16pt "Créditos del Sur — Log de Auditoría"
 * - Subtítulo: Período de fechas
 * - Tabla: header fondo #475569, filas alternas #F8FAFC
 * - Columnas reducidas (sin datos JSON completos, solo resumen)
 *
 * IMPLEMENTACIÓN:
 * 1. Backend: audit.controller.ts → GET /audit/export
 * 2. Backend: audit.service.ts → exportAuditLog()
 *    - Reutilizar findAll() sin paginación
 * 3. Frontend: exportService.downloadFile('audit/export', params)
 */

import ExcelJS from 'exceljs';


export const AUDITORIA_COLUMNS: ExcelJS.Column[] = [
  { header: 'Fecha', key: 'fecha', width: 20 },
  { header: 'Usuario', key: 'usuario', width: 22 },
  { header: 'Acción', key: 'accion', width: 22 },
  { header: 'Entidad', key: 'entidad', width: 16 },
  { header: 'ID Entidad', key: 'entidadId', width: 18 },
  { header: 'Detalle', key: 'detalle', width: 40 },
  { header: 'Datos Anteriores', key: 'datosAnteriores', width: 35 },
  { header: 'Datos Nuevos', key: 'datosNuevos', width: 35 },
] as any;

export const AUDITORIA_HEADER_STYLE = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF475569' } },
  alignment: { horizontal: 'center' as const },
};

export const AUDITORIA_PDF_COLUMNS = [
  { label: 'Fecha', width: 90 },
  { label: 'Usuario', width: 100 },
  { label: 'Acción', width: 110 },
  { label: 'Entidad', width: 80 },
  { label: 'ID Entidad', width: 90 },
  { label: 'Detalle', width: 180 },
];

export const AUDITORIA_PDF_HEADER_COLOR = '#475569';
export const AUDITORIA_PDF_ROW_ALT_COLOR = '#F8FAFC';

/**
 * codigo de exportación de auditoría
 */


import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import {
  AUDITORIA_COLUMNS,
  AUDITORIA_HEADER_STYLE
} from "@/lib/templates/auditoria";

function formatearFecha(fecha: Date) {
  return new Intl.DateTimeFormat("es-CO").format(fecha);
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
        lte: new Date(endDate),
      };
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: {
        fecha: "desc",
      },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Log Auditoría", {
      views: [{ state: "frozen", ySplit: 4 }]
    });

    sheet.columns = AUDITORIA_COLUMNS;

    const tituloRow = sheet.addRow([
      "CRÉDITOS DEL SUR — LOG DE AUDITORÍA"
    ]);

    tituloRow.font = { size: 16, bold: true };
    sheet.mergeCells(`A1:H1`);

    const periodoTexto =
      startDate && endDate
        ? `Período: ${formatearFecha(new Date(startDate))} - ${formatearFecha(
            new Date(endDate)
          )}`
        : "Período: Todos los registros";

    const periodoRow = sheet.addRow([periodoTexto]);

    sheet.mergeCells(`A2:H2`);

    sheet.addRow([]);

    const headerRow = sheet.addRow(
      AUDITORIA_COLUMNS.map((c) => c.header)
    );

    headerRow.eachCell((cell) => {
      cell.font = AUDITORIA_HEADER_STYLE.font;
      cell.fill = AUDITORIA_HEADER_STYLE.fill;
      cell.alignment = AUDITORIA_HEADER_STYLE.alignment;
    });

    sheet.autoFilter = {
      from: "A4",
      to: "H4",
    };

    logs.forEach((log, index) => {
      const row = sheet.addRow([
        log.fecha,
        log.usuario,
        log.accion,
        log.entidad,
        log.entidadId,
        log.detalle,
        log.datosAnteriores
          ? JSON.stringify(log.datosAnteriores)
          : "",
        log.datosNuevos
          ? JSON.stringify(log.datosNuevos)
          : "",
      ]);

      if (index % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FAFC" },
          };
        });
      }
    });

    sheet.addRow([]);

    const totalRow = sheet.addRow([
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      `TOTAL REGISTROS: ${logs.length}`,
    ]);

    totalRow.font = { bold: true };

    sheet.columns.forEach((col) => {
      if (!col.width) {
        col.width = 20;
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="log_auditoria.xlsx"',
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Error al exportar auditoría" },
      { status: 500 }
    );
  }
}