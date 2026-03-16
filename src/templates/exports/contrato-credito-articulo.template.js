"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AMORTIZACION_COLUMNS = exports.CONTRATO_PDF_CONFIG = exports.CONTRATO_EMPRESA = void 0;
exports.generarContratoPDF = generarContratoPDF;
var PDFDocument = require("pdfkit");
var fs = require("fs");
var path = require("path");
// ─── Constantes de empresa ────────────────────────────────────────────────────
exports.CONTRATO_EMPRESA = {
    nombre: 'CRÉDITOS DEL SUR',
    nit: '1077475327-2',
    ciudad: 'Quibdó, Chocó',
};
// ─── Paleta ───────────────────────────────────────────────────────────────────
var C = {
    AZUL_DARK: '#1A5F8A',
    AZUL_MED: '#2B7BB5',
    GRIS_TXT: '#2D3748',
    GRIS_MED: '#718096',
    GRIS_CLR: '#E2E8F0',
    GRIS_FONDO: '#F7FAFC',
    NEGRO: '#000000',
    BLANCO: '#FFFFFF',
};
// ─── Helpers ──────────────────────────────────────────────────────────────────
var fmtCOP = function (v) {
    return "$".concat((v || 0).toLocaleString('es-CO'));
};
var LINE = '_'.repeat(38);
var LINEL = '_'.repeat(54);
function getLogoPath() {
    var pProd = path.join(process.cwd(), 'dist/assets/logo.png');
    var pDev = path.join(process.cwd(), 'src/assets/logo.png');
    return fs.existsSync(pProd) ? pProd : (fs.existsSync(pDev) ? pDev : null);
}
// ─── Generador PDF ────────────────────────────────────────────────────────────
function generarContratoPDF(data) {
    return __awaiter(this, void 0, void 0, function () {
        var doc, buffers, ML, MR, MT, PW, PH, TW, y, drawWatermark, fieldLine, blankLine, sectionHeader, checkPage, titulo, esCredito, introText, freqMap, freqIdx, freqs, fx, bullets, colW_1, colLabels, ROW_H_1, cx_1, cuotas, toShow, totalCuota, COL1, COL2, CW, yF, yFirmas, yF2, drawFooter, buffer;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    doc = new PDFDocument({
                        layout: 'portrait',
                        size: 'LETTER',
                        margin: 0,
                        info: {
                            Title: "Contrato ".concat(data.numeroPrestamo),
                            Author: 'Créditos del Sur',
                            Subject: 'Contrato de Crédito a Plazo',
                        },
                    });
                    buffers = [];
                    doc.on('data', function (chunk) { return buffers.push(chunk); });
                    ML = 56;
                    MR = 56;
                    MT = 50;
                    PW = doc.page.width;
                    PH = doc.page.height;
                    TW = PW - ML - MR;
                    y = MT;
                    drawWatermark = function () {
                        try {
                            var lp = getLogoPath();
                            if (lp) {
                                doc.save();
                                doc.opacity(0.05);
                                doc.image(lp, (PW - 280) / 2, (PH - 280) / 2, { width: 280 });
                                doc.restore();
                            }
                        }
                        catch (_) { }
                    };
                    fieldLine = function (label, value, indent) {
                        if (indent === void 0) { indent = ML; }
                        doc.font('Helvetica-Bold').fontSize(10).fillColor(C.GRIS_TXT)
                            .text(label, indent, y, { continued: true });
                        doc.font('Helvetica').fillColor(C.NEGRO)
                            .text("  ".concat(value));
                        y = doc.y + 4;
                        return y;
                    };
                    blankLine = function (label, indent, lineLen) {
                        if (indent === void 0) { indent = ML; }
                        if (lineLen === void 0) { lineLen = LINE; }
                        doc.font('Helvetica-Bold').fontSize(10).fillColor(C.GRIS_TXT)
                            .text(label, indent, y, { continued: true });
                        doc.font('Helvetica').fillColor(C.NEGRO)
                            .text("  ".concat(lineLen));
                        y = doc.y + 5;
                        return y;
                    };
                    sectionHeader = function (title) {
                        y += 10;
                        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.NEGRO)
                            .text(title, ML, y);
                        y = doc.y + 3;
                    };
                    checkPage = function (needed) {
                        if (needed === void 0) { needed = 60; }
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
                    titulo = data.tipo === 'CONTADO'
                        ? 'FACTURA DE VENTA DE CONTADO – CRÉDITOS DEL SUR'
                        : 'CONTRATO DE CRÉDITO A PLAZO – CRÉDITOS DEL SUR';
                    // Cuadro checkbox
                    doc.rect(ML, y + 1, 9, 9).stroke(C.NEGRO);
                    doc.font('Helvetica-Bold').fontSize(12).fillColor(C.NEGRO)
                        .text(titulo, ML + 16, y, { width: TW - 16, align: 'center' });
                    y = doc.y + 14;
                    esCredito = data.tipo !== 'CONTADO';
                    introText = esCredito
                        ? "CR\u00C9DITOS DEL SUR, identificada con NIT No. 1077475327-2, en adelante EL ACREEDOR, " +
                            "y el/la se\u00F1or(a) ".concat(data.clienteNombre || LINE, ", mayor de edad, ") +
                            "identificado(a) con c\u00E9dula de ciudadan\u00EDa No. ".concat(data.clienteCedula || LINE, ", en adelante ") +
                            "EL CLIENTE, celebran el presente contrato de cr\u00E9dito a plazo, el cual se regir\u00E1 por las " +
                            "siguientes cl\u00E1usulas:"
                        : "CR\u00C9DITOS DEL SUR, identificada con NIT No. 1077475327-2, vende de contado a " +
                            "".concat(data.clienteNombre || LINE, ", identificado(a) con c\u00E9dula No. ").concat(data.clienteCedula || LINE, ", ") +
                            "el art\u00EDculo descrito a continuaci\u00F3n.";
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
                        fieldLine('Marca / Modelo:', "".concat(data.marca || '—', " / ").concat(data.modelo || '—'));
                    }
                    blankLine('Valor total del artículo:', ML, data.precioContado ? "".concat(fmtCOP(data.precioContado)) : LINE);
                    blankLine('Abono inicial:', ML, data.abonoInicial != null ? "".concat(fmtCOP(data.abonoInicial)) : LINE);
                    blankLine('Saldo a financiar:', ML, data.montoFinanciado ? "".concat(fmtCOP(data.montoFinanciado)) : LINE);
                    // ── SEGUNDA: FORMA DE PAGO ──────────────────────────────────────────────────
                    sectionHeader('SEGUNDA – FORMA DE PAGO:');
                    doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
                        .text('EL CLIENTE se compromete a pagar el saldo restante en cuotas acordadas de forma ' +
                        '(semanal / quincenal / mensual), según se haya pactado entre las partes, a través de ' +
                        'efectivo o transferencia bancaria.', ML, y, { width: TW, align: 'justify' });
                    y = doc.y + 10;
                    freqMap = { SEMANAL: 0, QUINCENAL: 1, MENSUAL: 2 };
                    freqIdx = data.frecuencia ? freqMap[data.frecuencia] : -1;
                    freqs = ['Semanal', 'Quincenal', 'Mensual'];
                    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.GRIS_TXT)
                        .text('Número de cuotas:', ML, y, { continued: true });
                    doc.font('Helvetica').fillColor(C.NEGRO)
                        .text("  ".concat((_a = data.numeroCuotas) !== null && _a !== void 0 ? _a : '______'), { continued: true });
                    fx = ML + 200;
                    freqs.forEach(function (f, i) {
                        doc.rect(fx, y + 1, 9, 9).stroke(C.NEGRO);
                        if (i === freqIdx) {
                            // Marcar el checkbox seleccionado
                            doc.font('Helvetica-Bold').fontSize(9).fillColor(C.NEGRO)
                                .text('X', fx + 1.5, y + 1);
                        }
                        doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
                            .text("  ".concat(f), fx + 12, y);
                        fx += 95;
                    });
                    y = doc.y + 8;
                    blankLine('Valor de cada cuota:', ML, data.valorCuota ? "".concat(fmtCOP(data.valorCuota)) : LINE);
                    blankLine('Fecha de inicio de pago:', ML, data.fechaPrimerPago || '_'.repeat(28));
                    // ── TERCERA: INTERESES POR MORA ──────────────────────────────────────────────
                    checkPage(80);
                    sectionHeader('TERCERA – INTERESES POR MORA:');
                    doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
                        .text('En caso de retraso en el pago de una o más cuotas, se aplicará un interés por mora ' +
                        'sobre el saldo pendiente. El valor del interés será definido por EL ACREEDOR en el ' +
                        'momento del incumplimiento, de acuerdo con las condiciones vigentes.', ML, y, { width: TW, align: 'justify' });
                    y = doc.y + 4;
                    // ── CUARTA: INCUMPLIMIENTO Y DECOMISO ────────────────────────────────────────
                    checkPage(80);
                    sectionHeader('CUARTA – INCUMPLIMIENTO Y DECOMISO:');
                    doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
                        .text('Si EL CLIENTE incurre en un retraso superior a 30 días, EL ACREEDOR podrá proceder ' +
                        'al decomiso inmediato del artículo financiado, sin necesidad de autorización judicial.', ML, y, { width: TW, align: 'justify' });
                    y = doc.y + 6;
                    doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
                        .text('Para recuperar el artículo, EL CLIENTE deberá pagar la totalidad del valor del mismo, ' +
                        'sin excepción.', ML, y, { width: TW, align: 'justify' });
                    y = doc.y + 4;
                    // ── QUINTA: ENTREGA Y DOMICILIO ──────────────────────────────────────────────
                    checkPage(80);
                    sectionHeader('QUINTA – ENTREGA Y DOMICILIO:');
                    doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
                        .text('La entrega del artículo objeto de este contrato se hará únicamente sí el producto ' +
                        'estará ubicado en la ciudad de Quibdó.', ML, y, { width: TW, align: 'justify' });
                    y = doc.y + 6;
                    doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
                        .text('Previamente a la aprobación del crédito, EL ACREEDOR verificará la información ' +
                        'suministrada mediante visita domiciliaria.', ML, y, { width: TW, align: 'justify' });
                    y = doc.y + 4;
                    // ── SEXTA: DATOS DEL CLIENTE ─────────────────────────────────────────────────
                    checkPage(120);
                    sectionHeader('SEXTA – DATOS DEL CLIENTE:');
                    bullets = [
                        ['Nombre completo:', data.clienteNombre || LINE],
                        ['Número de cédula:', data.clienteCedula || LINE],
                        ['Teléfono:', data.clienteTelefono || LINE],
                        ['Dirección de residencia:', data.clienteDireccion || LINE],
                        ['Referencia personal 1 (nombre y teléfono):', data.referencia1 || '_'.repeat(26)],
                        ['Referencia personal 2 (nombre y teléfono):', data.referencia2 || '_'.repeat(26)],
                    ];
                    bullets.forEach(function (_a) {
                        var label = _a[0], val = _a[1];
                        checkPage(20);
                        var bullet = '•';
                        doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
                            .text(bullet, ML, y, { continued: true });
                        doc.font('Helvetica-Bold').fillColor(C.GRIS_TXT)
                            .text("  ".concat(label), { continued: true });
                        doc.font('Helvetica').fillColor(C.NEGRO)
                            .text("  ".concat(val));
                        y = doc.y + 2;
                    });
                    y += 4;
                    // ── SÉPTIMA: COBRANZA ────────────────────────────────────────────────────────
                    checkPage(70);
                    sectionHeader('SÉPTIMA – COBRANZA:');
                    doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
                        .text('EL CLIENTE será asignado a un cobrador encargado, quien se comunicará periódicamente ' +
                        'para hacer seguimiento y recaudo de los pagos. El nombre del cobrador será informado ' +
                        'al momento de aprobación del crédito.', ML, y, { width: TW, align: 'justify' });
                    y = doc.y + 4;
                    // ── OCTAVA: ACEPTACIÓN ───────────────────────────────────────────────────────
                    checkPage(60);
                    sectionHeader('OCTAVA – ACEPTACIÓN:');
                    doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO)
                        .text('Ambas partes declaran haber leído, entendido y aceptado cada una de las cláusulas ' +
                        'de este contrato, firmando en constancia.', ML, y, { width: TW, align: 'justify' });
                    y = doc.y + 4;
                    // ── TABLA DE CUOTAS (solo si es crédito y vienen cuotas) ────────────────────
                    if (esCredito && data.cuotas && data.cuotas.length > 0) {
                        checkPage(100);
                        y += 10;
                        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.NEGRO)
                            .text('TABLA DE CUOTAS:', ML, y);
                        y = doc.y + 6;
                        colW_1 = [38, 88, 82, 82, 82, 88];
                        colLabels = ['N°', 'Fecha Venc.', 'Capital', 'Interés', 'Cuota', 'Saldo'];
                        ROW_H_1 = 16;
                        // Encabezado tabla
                        doc.rect(ML, y, TW, ROW_H_1).fill(C.AZUL_MED);
                        cx_1 = ML;
                        doc.font('Helvetica-Bold').fontSize(8).fillColor(C.BLANCO);
                        colLabels.forEach(function (lbl, i) {
                            doc.text(lbl, cx_1 + 2, y + 4, { width: colW_1[i] - 4, align: 'center' });
                            cx_1 += colW_1[i];
                        });
                        y += ROW_H_1;
                        cuotas = data.cuotas;
                        toShow = cuotas.length <= 12
                            ? cuotas
                            : __spreadArray(__spreadArray([], cuotas.slice(0, 6), true), [null, cuotas[cuotas.length - 1]], false);
                        toShow.forEach(function (c, i) {
                            checkPage(ROW_H_1 + 10);
                            if (i % 2 === 0) {
                                doc.rect(ML, y, TW, ROW_H_1).fill(C.GRIS_FONDO);
                            }
                            else {
                                doc.rect(ML, y, TW, ROW_H_1).fill(C.BLANCO);
                            }
                            doc.font('Helvetica').fontSize(8).fillColor(C.GRIS_TXT);
                            cx_1 = ML;
                            if (c === null) {
                                // Fila de puntos suspensivos
                                doc.text('...', ML + TW / 2 - 10, y + 4);
                            }
                            else {
                                var vals = [
                                    String(c.numero),
                                    c.fechaVenc,
                                    fmtCOP(c.capital),
                                    fmtCOP(c.interes),
                                    fmtCOP(c.valorCuota),
                                    fmtCOP(c.saldo),
                                ];
                                vals.forEach(function (v, vi) {
                                    var align = vi === 0 || vi === 1 ? 'center' : 'right';
                                    doc.text(v, cx_1 + 2, y + 4, { width: colW_1[vi] - 4, align: align });
                                    cx_1 += colW_1[vi];
                                });
                            }
                            // Borde inferior fila
                            doc.moveTo(ML, y + ROW_H_1)
                                .lineTo(ML + TW, y + ROW_H_1)
                                .strokeColor(C.GRIS_CLR).lineWidth(0.4).stroke();
                            y += ROW_H_1;
                        });
                        // Fila total
                        doc.rect(ML, y, TW, ROW_H_1 + 2).fill(C.AZUL_DARK);
                        doc.font('Helvetica-Bold').fontSize(8).fillColor(C.BLANCO);
                        doc.text('TOTAL A PAGAR', ML + 2, y + 4, { width: colW_1[0] + colW_1[1] + colW_1[2] + colW_1[3] - 4 });
                        totalCuota = cuotas.reduce(function (a, c) { return a + c.valorCuota; }, 0);
                        doc.text(fmtCOP(totalCuota), ML + colW_1[0] + colW_1[1] + colW_1[2] + colW_1[3], y + 4, { width: colW_1[4] - 4, align: 'right' });
                        y += ROW_H_1 + 2;
                        y += 10;
                    }
                    // ── LUGAR Y FECHA DE FIRMA ───────────────────────────────────────────────────
                    checkPage(160);
                    y += 18;
                    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.GRIS_TXT)
                        .text('LUGAR Y FECHA DE FIRMA:', ML, y, { continued: true });
                    doc.font('Helvetica').fillColor(C.NEGRO)
                        .text("  ".concat('_'.repeat(44)));
                    y = doc.y + 24;
                    COL1 = ML;
                    COL2 = ML + TW / 2 + 10;
                    CW = TW / 2 - 16;
                    // FIRMA DEL CLIENTE
                    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.NEGRO)
                        .text('FIRMA DEL CLIENTE', COL1, y);
                    doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO);
                    yF = doc.y + 4;
                    doc.text("Nombre:  ".concat('_'.repeat(30)), COL1, yF);
                    yF = doc.y + 4;
                    doc.text("C.C. No.:  ".concat('_'.repeat(28)), COL1, yF);
                    yF = doc.y + 4;
                    doc.text("Firma:  ".concat('_'.repeat(30)), COL1, yF);
                    yFirmas = y;
                    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.NEGRO)
                        .text('FIRMA DEL ACREEDOR (CRÉDITOS DEL SUR)', COL2, yFirmas, { width: CW });
                    doc.font('Helvetica').fontSize(10.5).fillColor(C.NEGRO);
                    yF2 = doc.y + 4;
                    doc.text("Representante:  ".concat(data.vendedorNombre || '_'.repeat(22)), COL2, yF2, { width: CW });
                    yF2 = doc.y + 4;
                    doc.text("Firma:  ".concat('_'.repeat(30)), COL2, yF2, { width: CW });
                    drawFooter = function () {
                        doc.fontSize(7).font('Helvetica').fillColor(C.GRIS_MED)
                            .text("Cr\u00E9ditos del Sur  \u2022  NIT 1077475327-2  \u2022  ".concat(exports.CONTRATO_EMPRESA.ciudad, "  \u2022  ") +
                            "Contrato N\u00B0 ".concat(data.numeroPrestamo, "  \u2022  Generado: ").concat(new Date().toLocaleString('es-CO')), 0, PH - 28, { align: 'center', width: PW });
                    };
                    drawFooter();
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            doc.on('end', function () { return resolve(Buffer.concat(buffers)); });
                            doc.on('error', reject);
                            doc.end();
                        })];
                case 1:
                    buffer = _b.sent();
                    return [2 /*return*/, {
                            data: buffer,
                            contentType: 'application/pdf',
                            filename: "contrato-".concat(data.numeroPrestamo, "-").concat(data.clienteCedula || 'sin-cedula', ".pdf"),
                        }];
            }
        });
    });
}
// ─── Constantes exportadas (para el servicio) ─────────────────────────────────
exports.CONTRATO_PDF_CONFIG = {
    layout: 'portrait',
    size: 'LETTER',
    margin: 56,
};
exports.AMORTIZACION_COLUMNS = [
    { label: 'N°', width: 38 },
    { label: 'Fecha Venc.', width: 88 },
    { label: 'Capital', width: 82 },
    { label: 'Interés', width: 82 },
    { label: 'Cuota', width: 82 },
    { label: 'Saldo', width: 88 },
];
