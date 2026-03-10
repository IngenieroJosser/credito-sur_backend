/**
 * ============================================================================
 * PLANTILLA: CONTRATO DE CRÉDITO DE ARTÍCULO
 * ============================================================================
 * Contexto: Se genera cuando un cliente saca un artículo a crédito o de contado.
 * Roles que lo usan:
 *   - PUNTO_DE_VENTA (rol principal)
 *   - ADMIN, SUPER_ADMINISTRADOR, SUPERVISOR (quienes crean créditos de artículo)
 *
 * Vista: /creditos-articulos/nuevo (al confirmar crédito)
 * Endpoint: GET /loans/:id/contrato?format=pdf
 * Estado: ⬜ PENDIENTE — crear endpoint en loans.controller.ts
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DISEÑO PDF — CONTRATO DE CRÉDITO / COMPRA DE ARTÍCULO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                    [LOGO CRÉDITOS DEL SUR]                             │
 * │                  CRÉDITOS DEL SUR S.A.S                                │
 * │              NIT: XXX.XXX.XXX-X | Neiva, Huila                        │
 * │           Tel: (608) XXX XXXX | creditos@delsur.co                    │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │                                                                        │
 * │              CONTRATO DE VENTA A CRÉDITO N° PRE-2026-XXX              │
 * │                    (o FACTURA DE VENTA DE CONTADO)                     │
 * │                                                                        │
 * │  Fecha: 13 de febrero de 2026                                         │
 * │  Vendedor: [Nombre del usuario que creó el crédito]                   │
 * │  Punto de venta: [Ruta / Sucursal]                                    │
 * │                                                                        │
 * ├─── DATOS DEL CLIENTE ──────────────────────────────────────────────────┤
 * │                                                                        │
 * │  Nombre:    Carlos Andrés Martínez López                              │
 * │  Cédula:    1.098.765.432                                             │
 * │  Dirección: Calle 45 #12-30, Barrio Centro, Neiva                    │
 * │  Teléfono:  310 456 7890                                              │
 * │                                                                        │
 * ├─── ARTÍCULO ───────────────────────────────────────────────────────────┤
 * │                                                                        │
 * │  Artículo:     Nevera Samsung RT38K5930S8                             │
 * │  Código:       INV-0045                                                │
 * │  Marca/Modelo: Samsung / RT38K5930S8                                  │
 * │  Estado:       Nuevo                                                   │
 * │  Garantía:     12 meses del fabricante                                │
 * │                                                                        │
 * ├─── CONDICIONES FINANCIERAS ────────────────────────────────────────────┤
 * │                                                                        │
 * │  Precio de contado:     $2,800,000                                    │
 * │  Cuota inicial:         $     0                                        │
 * │  Monto financiado:      $2,800,000                                    │
 * │  Tasa de interés:       20% (sobre el monto)                          │
 * │  Interés total:         $  560,000                                    │
 * │  ─────────────────────────────────────                                │
 * │  TOTAL A PAGAR:         $3,360,000                                    │
 * │                                                                        │
 * │  Plazo:                 24 meses                                       │
 * │  Frecuencia de pago:    Mensual                                       │
 * │  Valor cuota:           $  140,000                                    │
 * │  Fecha primer pago:     13/03/2026                                    │
 * │  Fecha último pago:     13/02/2028                                    │
 * │                                                                        │
 * ├─── TABLA DE AMORTIZACIÓN (primeras 6 cuotas + ... + última) ──────────┤
 * │                                                                        │
 * │  N°  │ Fecha Venc.  │  Capital  │  Interés  │  Cuota   │  Saldo      │
 * │   1  │ 13/03/2026   │  116,667  │   23,333  │ 140,000  │ 3,220,000   │
 * │   2  │ 13/04/2026   │  116,667  │   23,333  │ 140,000  │ 3,080,000   │
 * │   3  │ 13/05/2026   │  116,667  │   23,333  │ 140,000  │ 2,940,000   │
 * │  ... │     ...      │    ...    │    ...    │   ...    │    ...       │
 * │  24  │ 13/02/2028   │  116,667  │   23,333  │ 140,000  │       0     │
 * │                                                                        │
 * ├─── CLÁUSULAS ──────────────────────────────────────────────────────────┤
 * │                                                                        │
 * │  1. El comprador se compromete a pagar las cuotas en las fechas       │
 * │     establecidas. El incumplimiento generará intereses de mora        │
 * │     según la tasa máxima legal vigente.                               │
 * │                                                                        │
 * │  2. El artículo será entregado al momento de la firma del presente    │
 * │     contrato. La propiedad se transfiere al completar el pago total.  │
 * │                                                                        │
 * │  3. En caso de incumplimiento de 3 o más cuotas consecutivas,        │
 * │     CRÉDITOS DEL SUR se reserva el derecho de recuperar el artículo.  │
 * │                                                                        │
 * │  4. El comprador declara haber recibido el artículo en perfecto      │
 * │     estado y acepta las condiciones aquí estipuladas.                 │
 * │                                                                        │
 * │  5. Para compras de contado, el artículo se entrega con factura       │
 * │     y garantía del fabricante. No aplican cláusulas de financiación.  │
 * │                                                                        │
 * ├─── FIRMAS ─────────────────────────────────────────────────────────────┤
 * │                                                                        │
 * │                                                                        │
 * │  ________________________          ________________________            │
 * │  COMPRADOR                         VENDEDOR                            │
 * │  Carlos Andrés Martínez            Juan Pérez García                  │
 * │  C.C. 1.098.765.432               Créditos del Sur                    │
 * │                                                                        │
 * │                                                                        │
 * │  ________________________                                              │
 * │  TESTIGO / CODEUDOR (si aplica)                                       │
 * │  Nombre: _______________                                               │
 * │  C.C.: _________________                                              │
 * │                                                                        │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * NOTAS DE IMPLEMENTACIÓN:
 * - El PDF se genera con PDFKit en layout Portrait, tamaño Letter
 * - Si es compra de CONTADO: omitir tabla de amortización, cláusulas 1-3,
 *   y cambiar título a "FACTURA DE VENTA DE CONTADO"
 * - Si es CRÉDITO: incluir todo, título "CONTRATO DE VENTA A CRÉDITO"
 * - Los datos financieros (interés, cuotas, amortización) SIEMPRE vienen
 *   del backend — el frontend NO calcula nada
 * - El contrato se descarga como PDF al hacer clic en "Descargar Contrato"
 *   desde la vista de detalle del crédito de artículo
 *
 * IMPLEMENTACIÓN:
 * 1. Backend: loans.controller.ts → GET /loans/:id/contrato?format=pdf
 * 2. Backend: loans.service.ts → generarContrato(id)
 *    - Cargar préstamo con cliente, producto, cuotas
 *    - Generar PDF con PDFKit siguiendo este diseño
 * 3. Frontend: Botón "Descargar Contrato" en:
 *    - /creditos-articulos/[id] (detalle del crédito)
 *    - /creditos-articulos/nuevo (después de crear, ofrecer descarga)
 *    - Usar exportService.downloadFile(`loans/${id}/contrato`, { format: 'pdf' })
 */

// Constantes del contrato
export const CONTRATO_EMPRESA = {
  nombre: 'CRÉDITOS DEL SUR S.A.S',
  nit: 'XXX.XXX.XXX-X', // TODO: Reemplazar con NIT real
  direccion: 'Neiva, Huila',
  telefono: '(608) XXX XXXX', // TODO: Reemplazar con teléfono real
  email: 'creditos@delsur.co', // TODO: Reemplazar con email real
};

export const CONTRATO_CLAUSULAS_CREDITO = [
  'El comprador se compromete a pagar las cuotas en las fechas establecidas. El incumplimiento generará intereses de mora según la tasa máxima legal vigente.',
  'El artículo será entregado al momento de la firma del presente contrato. La propiedad se transfiere al completar el pago total.',
  'En caso de incumplimiento de 3 o más cuotas consecutivas, CRÉDITOS DEL SUR se reserva el derecho de recuperar el artículo.',
  'El comprador declara haber recibido el artículo en perfecto estado y acepta las condiciones aquí estipuladas.',
];

export const CONTRATO_CLAUSULAS_CONTADO = [
  'El comprador declara haber recibido el artículo en perfecto estado.',
  'El artículo incluye garantía del fabricante según las condiciones indicadas.',
  'Esta factura sirve como comprobante de compra para efectos de garantía.',
];

export const CONTRATO_PDF_CONFIG = {
  layout: 'portrait' as const,
  size: 'LETTER' as const,
  margin: 50,
  fonts: {
    title: { size: 18, font: 'Helvetica-Bold' },
    subtitle: { size: 14, font: 'Helvetica-Bold' },
    sectionHeader: { size: 11, font: 'Helvetica-Bold' },
    body: { size: 10, font: 'Helvetica' },
    small: { size: 8, font: 'Helvetica' },
    tableHeader: { size: 8, font: 'Helvetica-Bold' },
    tableBody: { size: 8, font: 'Helvetica' },
  },
  colors: {
    primary: '#08557F',
    headerBg: '#08557F',
    headerText: '#FFFFFF',
    sectionBg: '#F0F9FF',
    border: '#CBD5E1',
    text: '#1E293B',
    muted: '#64748B',
  },
};

// Columnas para la tabla de amortización dentro del contrato
export const AMORTIZACION_COLUMNS = [
  { label: 'N°', width: 30 },
  { label: 'Fecha Venc.', width: 80 },
  { label: 'Capital', width: 75 },
  { label: 'Interés', width: 75 },
  { label: 'Cuota', width: 75 },
  { label: 'Saldo', width: 80 },
];
