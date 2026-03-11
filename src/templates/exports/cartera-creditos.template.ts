/**
 * ============================================================================
 * PLANTILLA: CARTERA DE CRÉDITOS (Listado de Préstamos)
 * ============================================================================
 * Vista: /creditos (ListadoPrestamos)
 * Endpoint: GET /loans/export?format=excel|pdf
 * Estado: ✅ IMPLEMENTADO en loans.service.ts → exportLoans()
 *
 * DISEÑO EXCEL (.xlsm):
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  CRÉDITOS DEL SUR — CARTERA DE CRÉDITOS                               │
 * │  Generado: 13/02/2026 14:30                                           │
 * ├──────────┬──────────┬────────┬─────────┬────────┬─────────┬───────────┤
 * │ N° Prést │ Cliente  │ Cédula │Producto │ Estado │Monto Tot│ Pendiente │
 * │ PRE-001  │ Carlos M │ 109876 │Personal │ ACTIVO │6,500,000│ 3,250,000 │
 * │ PRE-002  │ María R  │ 104567 │ Rápido  │ ACTIVO │3,000,000│   900,000 │
 * ├──────────┴──────────┴────────┴─────────┴────────┴─────────┴───────────┤
 * │ (continúa: Pagado, Mora, Cuotas Pag, Cuotas Tot, Progreso%,          │
 * │  Riesgo, Ruta, Fecha Inicio, Fecha Fin)                               │
 * ├───────────────────────────────────────────────────────────────────────┤
 * │ RESUMEN: Monto Total: $XX | Pendiente: $XX | Mora: $XX               │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Estilos Excel:
 * - Header row: fondo #08557F (azul oscuro), texto blanco, bold, centrado
 * - Columnas moneda: formato #,##0
 * - Fila resumen: bold
 * - Ancho columnas: auto-ajustado (18-30 chars)
 *
 * DISEÑO PDF:
 * - Layout: Landscape, Letter, margin 30
 * - Título: 16pt Helvetica-Bold centrado "Créditos del Sur — Cartera de Créditos"
 * - Subtítulo: 9pt fecha generación
 * - Barra stats: 8pt bold con totales separados por |
 * - Tabla: 7pt, header fondo #08557F texto blanco
 * - Filas alternas: #F8FAFC
 * - Paginación automática al superar y > 560
 * - 10 columnas visibles (las más importantes)
 */

import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

export const CARTERA_CREDITOS_COLUMNS: ExcelJS.Column[] = [
  { header: 'N° Préstamo', key: 'numero', width: 18 },
  { header: 'Cliente', key: 'cliente', width: 30 },
  { header: 'Cédula', key: 'dni', width: 15 },
  { header: 'Producto', key: 'producto', width: 22 },
  { header: 'Estado', key: 'estado', width: 15 },
  { header: 'Monto Total', key: 'montoTotal', width: 18 },
  { header: 'Monto Pendiente', key: 'montoPendiente', width: 18 },
  { header: 'Monto Pagado', key: 'montoPagado', width: 18 },
  { header: 'Mora', key: 'mora', width: 15 },
  { header: 'Cuotas Pagadas', key: 'cuotasPagadas', width: 15 },
  { header: 'Cuotas Totales', key: 'cuotasTotales', width: 15 },
  { header: 'Progreso %', key: 'progreso', width: 12 },
  { header: 'Riesgo', key: 'riesgo', width: 12 },
  { header: 'Ruta', key: 'ruta', width: 18 },
  { header: 'Fecha Inicio', key: 'fechaInicio', width: 14 },
  { header: 'Fecha Fin', key: 'fechaFin', width: 14 },
] as any;

export const CARTERA_CREDITOS_HEADER_STYLE = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF08557F' } },
  alignment: { horizontal: 'center' as const },
};

export const CARTERA_CREDITOS_CURRENCY_COLUMNS = ['montoTotal', 'montoPendiente', 'montoPagado', 'mora'];

export const CARTERA_CREDITOS_PDF_COLUMNS = [
  { label: 'N° Préstamo', width: 80 },
  { label: 'Cliente', width: 130 },
  { label: 'Estado', width: 65 },
  { label: 'Monto Total', width: 80 },
  { label: 'Pendiente', width: 80 },
  { label: 'Mora', width: 65 },
  { label: 'Cuotas', width: 55 },
  { label: 'Progreso', width: 55 },
  { label: 'Ruta', width: 80 },
  { label: 'Fecha Inicio', width: 70 },
];

export const CARTERA_CREDITOS_PDF_HEADER_COLOR = '#08557F';
export const CARTERA_CREDITOS_PDF_ROW_ALT_COLOR = '#F8FAFC';
