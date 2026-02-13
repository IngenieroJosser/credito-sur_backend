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

import * as ExcelJS from 'exceljs';

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
