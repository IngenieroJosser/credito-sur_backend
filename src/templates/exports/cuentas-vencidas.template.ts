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
