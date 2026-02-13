/**
 * ============================================================================
 * ÍNDICE DE PLANTILLAS DE EXPORTACIÓN
 * ============================================================================
 * Cada archivo define el diseño exacto (columnas, estilos, colores) para
 * generar los reportes en Excel (.xlsm) y PDF.
 *
 * Estado de implementación:
 * ✅ cartera-creditos    → loans.service.ts → exportLoans()
 * ✅ cuentas-mora        → reports.service.ts → generarReporteMora()
 * ✅ cuentas-vencidas    → reports.service.ts → exportarCuentasVencidas()
 * ✅ reporte-operativo   → reports.service.ts → exportOperationalReport()
 * ✅ reporte-financiero  → reports.service.ts → exportFinancialReport()
 * ✅ historial-pagos     → payments.service.ts → exportPayments()
 * ✅ reporte-contable    → accounting.service.ts → exportAccountingReport()
 * ✅ auditoria           → audit.service.ts → exportAuditLog()
 * ✅ contrato-credito    → loans.service.ts → generarContrato() (solo ARTICULO)
 */

export * from './cartera-creditos.template';
export * from './cuentas-mora.template';
export * from './cuentas-vencidas.template';
export * from './reporte-operativo.template';
export * from './reporte-financiero.template';
export * from './historial-pagos.template';
export * from './reporte-contable.template';
export * from './auditoria.template';
export * from './contrato-credito-articulo.template';
