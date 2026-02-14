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
