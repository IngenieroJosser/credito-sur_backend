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
