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
