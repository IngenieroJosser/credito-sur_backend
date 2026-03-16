"use strict";
/**
 * ============================================================================
 * ÍNDICE DE PLANTILLAS DE EXPORTACIÓN
 * ============================================================================
 * Cada archivo define el diseño exacto (columnas, estilos, colores) para
 * generar los reportes en Excel (.xlsx) y PDF.
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
 * ✅ clientes            → clients.service.ts → exportarClientes()
 * ⬜ contrato-credito    → (solo exporta constantes)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./cartera-creditos.template"), exports);
__exportStar(require("./cuentas-mora.template"), exports);
__exportStar(require("./cuentas-vencidas.template"), exports);
__exportStar(require("./reporte-operativo.template"), exports);
__exportStar(require("./reporte-financiero.template"), exports);
__exportStar(require("./historial-pagos.template"), exports);
__exportStar(require("./reporte-contable.template"), exports);
__exportStar(require("./auditoria.template"), exports);
__exportStar(require("./contrato-credito-articulo.template"), exports);
__exportStar(require("./clientes.template"), exports);
__exportStar(require("./ruta-cobrador.template"), exports);
__exportStar(require("./inventario.template"), exports);
