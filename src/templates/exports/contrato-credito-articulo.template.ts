/**
 * ============================================================================
 * TEMPLATE: CONTRATO DE CRÉDITO A PLAZO – CRÉDITOS DEL SUR
 * ============================================================================
 * Transcripción fiel al contrato físico firmado por las partes.
 *
 * Usado en: loans.service.ts → generarContrato(id)
 * Endpoint: GET /loans/:id/contrato?format=pdf
 *
 * Roles que lo usan:
 *   - PUNTO_DE_VENTA (rol principal)
 *   - ADMIN, SUPER_ADMINISTRADOR, SUPERVISOR
 *
 * Dos modos según el tipo de préstamo:
 *   - CREDITO  → Título "CONTRATO DE CRÉDITO A PLAZO", incluye tabla de cuotas
 *   - CONTADO  → Título "FACTURA DE VENTA DE CONTADO", sin tabla de cuotas
 */

import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

// ─── Constantes de empresa ────────────────────────────────────────────────────

export const CONTRATO_EMPRESA = {
  nombre: 'CRÉDITOS DEL SUR',
  nit:    '1077475327-2',
  ciudad: 'Quibdó, Chocó',
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface CuotaContrato {
  numero:       number;
  fechaVenc:    string;   // 'DD/MM/YYYY'
  capital:      number;
  interes:      number;
  valorCuota:   number;
  saldo:        number;
}

export interface ContratoData {
  // Identificación
  numeroPrestamo:   string;             // 'PRE-2026-001'
  tipo:             'CREDITO' | 'CONTADO';
  fechaContrato:    string;             // 'DD/MM/YYYY'

  // Datos del cliente
  clienteNombre:    string;
  clienteCedula:    string;
  clienteTelefono?: string;
  clienteDireccion?: string;
  referencia1?:     string;             // 'Nombre – Teléfono'
  referencia2?:     string;

  // Artículo
  articulo:         string;             // nombre del producto
  marca?:           string;
  modelo?:          string;

  // Condiciones financieras
  precioContado:    number;             // precio base / valor total
  abonoInicial:     number;             // 0 si no hay
  montoFinanciado:  number;             // precioContado – abonoInicial
  tasaInteres?:     number;             // % sobre el monto (ej: 20)
  interesTotal?:    number;
  totalAPagar?:     number;             // montoFinanciado + interesTotal

  // Cuotas
  numeroCuotas?:    number;
  frecuencia?:      'SEMANAL' | 'QUINCENAL' | 'MENSUAL';
  valorCuota?:      number;
  fechaPrimerPago?: string;
  fechaUltimoPago?: string;

  // Tabla de amortización (viene del backend)
  cuotas?:          CuotaContrato[];

  // Firmante acreedor
  vendedorNombre?:  string;
}

// ─── Paleta ───────────────────────────────────────────────────────────────────

const C = {
  AZUL_DARK:  '#1A5F8A',
  AZUL_MED:   '#2B7BB5',
  GRIS_TXT:   '#2D3748',
  GRIS_MED:   '#718096',
  GRIS_CLR:   '#E2E8F0',
  GRIS_FONDO: '#F7FAFC',
  NEGRO:      '#000000',
  BLANCO:     '#FFFFFF',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtCOP = (v: number): string =>
  `$${(v || 0).toLocaleString('es-CO')}`;

const LINE  = '_'.repeat(38);
const LINEL = '_'.repeat(54);

function getLogoPath(): string | null {
  const pProd = path.join(process.cwd(), 'dist/assets/logo.png');
  const pDev  = path.join(process.cwd(), 'src/assets/logo.png');
  return fs.existsSync(pProd) ? pProd : (fs.existsSync(pDev) ? pDev : null);
}

// ─── Generador PDF ────────────────────────────────────────────────────────────

export async function generarContratoPDF(
  data: ContratoData,
): Promise<{ data: Buffer; contentType: string; filename: string }> {

  const doc = new PDFDocument({
    layout: 'portrait',
    size:   'LETTER',
    margin: 0,
    info: {
      Title:   `Contrato ${data.numeroPrestamo}`,
      Author:  'Créditos del Sur',
      Subject: 'Contrato de Crédito a Plazo',
    },
  });

  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  const ML = 56;  // margen izquierdo
  const MR = 56;  // margen derecho
  const MT = 50;  // margen superior
  const PW = doc.page.width;   // 612 pt
  const PH = doc.page.height;  // 792 pt
  const TW = PW - ML - MR;     // ancho útil = 500 pt

  let y = MT;

  // ── Watermark ───────────────────────────────────────────────────────────────
  const drawWatermark = () => {
    try {
      const lp = getLogoPath();
      if (lp) {
        doc.save();
        doc.opacity(0.05);
        doc.image(lp, (PW - 280) / 2, (PH - 280) / 2, { width: 280 });
        doc.restore();
      }
    } catch (_) {}
  };

  // ── Helpers de dibujo ───────────────────────────────────────────────────────

  /** Escribe un par LABEL + valor en la misma línea */
  const fieldLine = (label: string, value: string, indent = ML): number => {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.GRIS_TXT)
       .text(label, indent, y, { continued: true });
    doc.font('Helvetica').fillColor(C.NEGRO)
       .text(`  ${value}`);
    y = doc.y + 4;
    return y;
  };

  /** Línea en blanco para rellenar a mano */
  const blankLine = (label: string, indent = ML, lineLen = LINE): number => {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.GRIS_TXT)
       .text(label, indent, y, { continued: true });
    doc.font('Helvetica').fillColor(C.NEGRO)
       .text(`  ${lineLen}`);
    y = doc.y + 5;
    return y;
  };

  /** Encabezado de sección */
  const sectionHeader = (title: string): void => {
    y += 10;
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.NEGRO)
       .text(title, ML, y);
    y = doc.y + 3;
  };

  /** Salto de página si no queda espacio */
  const checkPage = (needed = 60): void => {
    if (y + needed > PH - 50) {
      doc.addPage();
      drawWatermark();
      y = MT;
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PÁGINA 1
  // ════════════════════════════════════════════════════════════════════════════
  drawWatermark();

  // ── Checkbox + Título ────────────────────────────────────────────────────────
  const titulo = data.tipo === 'CONTADO'
    ? 'FACTURA DE VENTA DE CONTADO – CRÉDITOS DEL SUR'
    : 'CONTRATO DE CRÉDITO A PLAZO – CRÉDITOS DEL SUR';

  // Cuadro checkbox
  doc.rect(ML, y + 1, 9, 9).stroke(C.NEGRO);

  doc.font('Helvetica-Bold').fontSize(12).fillColor(C.NEGRO)
     .text(titulo, ML + 16, y, { width: TW - 16, align: 'center' });
  y = doc.y + 14;

  // ── Párrafo introductorio ────────────────────────────────────────────────────
  const esCredito = data.tipo !== 'CONTADO';
  const introText = esCredito
    ? `CRÉDITOS DEL SUR, identificada con NIT No. 1077475327-2, en adelante EL ACREEDOR, ` +
      `y el/la señor(a) ${data.clienteNombre || LINE}, mayor de edad, ` +
      `identificado(a) con cédula de ciudadanía No. ${data.clienteCedula || LINE}, en adelante ` +
      `EL CLIENTE, celebran el presente contrato de crédito a plazo, el cual se regirá por las ` +
      `siguientes cláusulas:`
    : `CRÉDITOS DEL SUR, identificada con NIT No. 1077475327-2, vende de contado a ` +
      `${data.clienteNombre || LINE}, identificado(a) con cédula No. ${data.clienteCedula || LINE}, ` +
      `el artículo descrito a continuación.`;

  doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
     .text(introText, ML, y, { width: TW, align: 'justify' });
  y = doc.y + 12;

  // ── PRIMERA: OBJETO ──────────────────────────────────────────────────────────
  sectionHeader('PRIMERA – OBJETO DEL CONTRATO:');
  if (esCredito) {
    doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
       .text('El ACREEDOR otorga a EL CLIENTE un crédito para la adquisición del siguiente artículo:', ML, y, { width: TW });
    y = doc.y + 8;
  }

  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.GRIS_TXT).text('Artículo o producto:', ML, y);
  y = doc.y + 2;
  doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
     .text(data.articulo || LINEL, ML, y, { width: TW });
  y = doc.y + 8;

  if (data.marca || data.modelo) {
    fieldLine('Marca / Modelo:', `${data.marca || '—'} / ${data.modelo || '—'}`);
  }

  blankLine('Valor total del artículo:', ML,
    data.precioContado ? `${fmtCOP(data.precioContado)}` : LINE);
  blankLine('Abono inicial:', ML,
    data.abonoInicial != null ? `${fmtCOP(data.abonoInicial)}` : LINE);
  blankLine('Saldo a financiar:', ML,
    data.montoFinanciado ? `${fmtCOP(data.montoFinanciado)}` : LINE);

  // ── SEGUNDA: FORMA DE PAGO ──────────────────────────────────────────────────
  sectionHeader('SEGUNDA – FORMA DE PAGO:');
  doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
     .text(
       'EL CLIENTE se compromete a pagar el saldo restante en cuotas acordadas de forma ' +
       '(semanal / quincenal / mensual), según se haya pactado entre las partes, a través de ' +
       'efectivo o transferencia bancaria.',
       ML, y, { width: TW, align: 'justify' }
     );
  y = doc.y + 10;

  // Fila: Número de cuotas + checkboxes frecuencia
  const freqMap = { SEMANAL: 0, QUINCENAL: 1, MENSUAL: 2 };
  const freqIdx = data.frecuencia ? freqMap[data.frecuencia] : -1;
  const freqs   = ['Semanal', 'Quincenal', 'Mensual'];

  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.GRIS_TXT)
     .text('Número de cuotas:', ML, y, { continued: true });
  doc.font('Helvetica').fillColor(C.NEGRO)
     .text(`  ${data.numeroCuotas ?? '______'}`, { continued: true });

  let fx = ML + 200;
  freqs.forEach((f, i) => {
    doc.rect(fx, y + 1, 9, 9).stroke(C.NEGRO);
    if (i === freqIdx) {
      // Marcar el checkbox seleccionado
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C.NEGRO)
         .text('X', fx + 1.5, y + 1);
    }
    doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
       .text(`  ${f}`, fx + 12, y);
    fx += 95;
  });
  y = doc.y + 8;

  blankLine('Valor de cada cuota:', ML,
    data.valorCuota ? `${fmtCOP(data.valorCuota)}` : LINE);
  blankLine('Fecha de inicio de pago:', ML,
    data.fechaPrimerPago || '_'.repeat(28));

  // ── TERCERA: INTERESES POR MORA ──────────────────────────────────────────────
  checkPage(80);
  sectionHeader('TERCERA – INTERESES POR MORA:');
  doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
     .text(
       'En caso de retraso en el pago de una o más cuotas, se aplicará un interés por mora ' +
       'sobre el saldo pendiente. El valor del interés será definido por EL ACREEDOR en el ' +
       'momento del incumplimiento, de acuerdo con las condiciones vigentes.',
       ML, y, { width: TW, align: 'justify' }
     );
  y = doc.y + 4;

  // ── CUARTA: INCUMPLIMIENTO Y DECOMISO ────────────────────────────────────────
  checkPage(80);
  sectionHeader('CUARTA – INCUMPLIMIENTO Y DECOMISO:');
  doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
     .text(
       'Si EL CLIENTE incurre en un retraso superior a 30 días, EL ACREEDOR podrá proceder ' +
       'al decomiso inmediato del artículo financiado, sin necesidad de autorización judicial.',
       ML, y, { width: TW, align: 'justify' }
     );
  y = doc.y + 6;
  doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
     .text(
       'Para recuperar el artículo, EL CLIENTE deberá pagar la totalidad del valor del mismo, ' +
       'sin excepción.',
       ML, y, { width: TW, align: 'justify' }
     );
  y = doc.y + 4;

  // ── QUINTA: ENTREGA Y DOMICILIO ──────────────────────────────────────────────
  checkPage(80);
  sectionHeader('QUINTA – ENTREGA Y DOMICILIO:');
  doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
     .text(
       'La entrega del artículo objeto de este contrato se hará únicamente sí el producto ' +
       'estará ubicado en la ciudad de Quibdó.',
       ML, y, { width: TW, align: 'justify' }
     );
  y = doc.y + 6;
  doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
     .text(
       'Previamente a la aprobación del crédito, EL ACREEDOR verificará la información ' +
       'suministrada mediante visita domiciliaria.',
       ML, y, { width: TW, align: 'justify' }
     );
  y = doc.y + 4;

  // ── SEXTA: DATOS DEL CLIENTE ─────────────────────────────────────────────────
  checkPage(120);
  sectionHeader('SEXTA – DATOS DEL CLIENTE:');

  const bullets: Array<[string, string]> = [
    ['Nombre completo:',                      data.clienteNombre    || LINE],
    ['Número de cédula:',                     data.clienteCedula    || LINE],
    ['Teléfono:',                             data.clienteTelefono  || LINE],
    ['Dirección de residencia:',              data.clienteDireccion || LINE],
    ['Referencia personal 1 (nombre y teléfono):', data.referencia1 || '_'.repeat(26)],
    ['Referencia personal 2 (nombre y teléfono):', data.referencia2 || '_'.repeat(26)],
  ];

  bullets.forEach(([label, val]) => {
    checkPage(20);
    const bullet = '•';
    doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
       .text(bullet, ML, y, { continued: true });
    doc.font('Helvetica-Bold').fillColor(C.GRIS_TXT)
       .text(`  ${label}`, { continued: true });
    doc.font('Helvetica').fillColor(C.NEGRO)
       .text(`  ${val}`);
    y = doc.y + 2;
  });
  y += 4;

  // ── SÉPTIMA: COBRANZA ────────────────────────────────────────────────────────
  checkPage(70);
  sectionHeader('SÉPTIMA – COBRANZA:');
  doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
     .text(
       'EL CLIENTE será asignado a un cobrador encargado, quien se comunicará periódicamente ' +
       'para hacer seguimiento y recaudo de los pagos. El nombre del cobrador será informado ' +
       'al momento de aprobación del crédito.',
       ML, y, { width: TW, align: 'justify' }
     );
  y = doc.y + 4;

  // ── OCTAVA: ACEPTACIÓN ───────────────────────────────────────────────────────
  checkPage(60);
  sectionHeader('OCTAVA – ACEPTACIÓN:');
  doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
     .text(
       'Ambas partes declaran haber leído, entendido y aceptado cada una de las cláusulas ' +
       'de este contrato, firmando en constancia.',
       ML, y, { width: TW, align: 'justify' }
     );
  y = doc.y + 4;

  // ── TABLA DE CUOTAS (solo si es crédito y vienen cuotas) ────────────────────
  if (esCredito && data.cuotas && data.cuotas.length > 0) {
    checkPage(100);
    y += 10;
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.NEGRO)
       .text('TABLA DE CUOTAS:', ML, y);
    y = doc.y + 6;

    const colW = [38, 88, 82, 82, 82, 88];  // N° | Fecha | Capital | Interés | Cuota | Saldo
    const colLabels = ['N°', 'Fecha Venc.', 'Capital', 'Interés', 'Cuota', 'Saldo'];
    const ROW_H = 16;

    // Encabezado tabla
    doc.rect(ML, y, TW, ROW_H).fill(C.AZUL_MED);
    let cx = ML;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.BLANCO);
    colLabels.forEach((lbl, i) => {
      doc.text(lbl, cx + 2, y + 4, { width: colW[i] - 4, align: 'center' });
      cx += colW[i];
    });
    y += ROW_H;

    // Filas de cuotas
    // Mostrar todas si ≤12, si no: primeras 6 + '...' + última
    const cuotas = data.cuotas;
    const toShow: Array<CuotaContrato | null> = cuotas.length <= 12
      ? cuotas
      : [...cuotas.slice(0, 6), null, cuotas[cuotas.length - 1]];

    toShow.forEach((c, i) => {
      checkPage(ROW_H + 10);
      if (i % 2 === 0) {
        doc.rect(ML, y, TW, ROW_H).fill(C.GRIS_FONDO);
      } else {
        doc.rect(ML, y, TW, ROW_H).fill(C.BLANCO);
      }

      doc.font('Helvetica').fontSize(8).fillColor(C.GRIS_TXT);
      cx = ML;

      if (c === null) {
        // Fila de puntos suspensivos
        doc.text('...', ML + TW / 2 - 10, y + 4);
      } else {
        const vals = [
          String(c.numero),
          c.fechaVenc,
          fmtCOP(c.capital),
          fmtCOP(c.interes),
          fmtCOP(c.valorCuota),
          fmtCOP(c.saldo),
        ];
        vals.forEach((v, vi) => {
          const align = vi === 0 || vi === 1 ? 'center' : 'right';
          doc.text(v, cx + 2, y + 4, { width: colW[vi] - 4, align });
          cx += colW[vi];
        });
      }

      // Borde inferior fila
      doc.moveTo(ML, y + ROW_H)
         .lineTo(ML + TW, y + ROW_H)
         .strokeColor(C.GRIS_CLR).lineWidth(0.4).stroke();
      y += ROW_H;
    });

    // Fila total
    doc.rect(ML, y, TW, ROW_H + 2).fill(C.AZUL_DARK);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.BLANCO);
    doc.text('TOTAL A PAGAR', ML + 2, y + 4,
      { width: colW[0] + colW[1] + colW[2] + colW[3] - 4 });
    const totalCuota = cuotas.reduce((a, c) => a + c.valorCuota, 0);
    doc.text(fmtCOP(totalCuota), ML + colW[0] + colW[1] + colW[2] + colW[3],
      y + 4, { width: colW[4] - 4, align: 'right' });
    y += ROW_H + 2;
    y += 10;
  }

  // ── LUGAR Y FECHA DE FIRMA ───────────────────────────────────────────────────
  checkPage(160);
  y += 18;
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.GRIS_TXT)
     .text('LUGAR Y FECHA DE FIRMA:', ML, y, { continued: true });
  doc.font('Helvetica').fillColor(C.NEGRO)
     .text(`  ${'_'.repeat(44)}`);
  y = doc.y + 24;

  // ── FIRMAS ───────────────────────────────────────────────────────────────────
  const COL1 = ML;
  const COL2 = ML + TW / 2 + 10;
  const CW   = TW / 2 - 16;

  // FIRMA DEL CLIENTE
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.NEGRO)
     .text('FIRMA DEL CLIENTE', COL1, y);
  doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO);
  let yF = doc.y + 4;
  doc.text(`Nombre:  ${'_'.repeat(30)}`, COL1, yF);
  yF = doc.y + 4;
  doc.text(`C.C. No.:  ${'_'.repeat(28)}`, COL1, yF);
  yF = doc.y + 4;
  doc.text(`Firma:  ${'_'.repeat(30)}`, COL1, yF);

  // FIRMA DEL ACREEDOR
  const yFirmas = y;
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.NEGRO)
     .text('FIRMA DEL ACREEDOR (CRÉDITOS DEL SUR)', COL2, yFirmas, { width: CW });
  doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO);
  let yF2 = doc.y + 4;
  doc.text(
    `Representante:  ${data.vendedorNombre || '_'.repeat(22)}`,
    COL2, yF2, { width: CW }
  );
  yF2 = doc.y + 4;
  doc.text(`Firma:  ${'_'.repeat(30)}`, COL2, yF2, { width: CW });

  // ── Footer ───────────────────────────────────────────────────────────────────
  const drawFooter = () => {
    doc.fontSize(7).font('Helvetica').fillColor(C.GRIS_MED)
       .text(
         `Créditos del Sur  •  NIT 1077475327-2  •  ${CONTRATO_EMPRESA.ciudad}  •  ` +
         `Contrato N° ${data.numeroPrestamo}  •  Generado: ${new Date().toLocaleString('es-CO')}`,
         0, PH - 28, { align: 'center', width: PW }
       );
  };

  drawFooter();
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
    doc.end();
  });

  return {
    data:        buffer,
    contentType: 'application/pdf',
    filename:    `contrato-${data.numeroPrestamo}-${data.clienteCedula || 'sin-cedula'}.pdf`,
  };
}

// ─── Constantes exportadas (para el servicio) ─────────────────────────────────

export const CONTRATO_PDF_CONFIG = {
  layout:  'portrait'  as const,
  size:    'LETTER'    as const,
  margin:  56,
};

export const AMORTIZACION_COLUMNS = [
  { label: 'N°',          width: 38 },
  { label: 'Fecha Venc.', width: 88 },
  { label: 'Capital',     width: 82 },
  { label: 'Interés',     width: 82 },
  { label: 'Cuota',       width: 82 },
  { label: 'Saldo',       width: 88 },
];