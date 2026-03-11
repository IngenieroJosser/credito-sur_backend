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
