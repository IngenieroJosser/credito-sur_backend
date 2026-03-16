"use strict";
/**
 * ============================================================================
 * TEMPLATE: HISTORIAL DE PAGOS
 * ============================================================================
 * Usado en: payments.service.ts → exportPayments()
 * Genera reporte de pagos recibidos en el período con formato profesional.
 * Paleta corporativa: Azul #1A5F8A / Naranja #F07A28 / Blanco
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generarExcelPagos = generarExcelPagos;
exports.generarPDFPagos = generarPDFPagos;
var ExcelJS = require("exceljs");
var PDFDocument = require("pdfkit");
var fs = require("fs");
var path = require("path");
// ─── Paleta corporativa ───────────────────────────────────────────────────────
var C = {
    // Azul
    AZUL_DARK: 'FF1A5F8A',
    AZUL_MED: 'FF2B7BB5',
    AZUL_SOFT: 'FFD6E9F5',
    AZUL_PALE: 'FFEBF4FB',
    // Naranja
    NAR_DARK: 'FFD4600A',
    NAR_MED: 'FFF07A28',
    NAR_SOFT: 'FFFDE8D5',
    NAR_PALE: 'FFFEF3EC',
    // Neutros
    BLANCO: 'FFFFFFFF',
    GRIS_TEXTO: 'FF2D3748',
    GRIS_MED: 'FF718096',
    GRIS_CLARO: 'FFE2E8F0',
    GRIS_FONDO: 'FFF7FAFC',
    GRIS_ALT: 'FFF0F4F8',
};
// ─── Utilidades ───────────────────────────────────────────────────────────────
function fmtFecha(f) {
    if (!f)
        return '';
    var d = f instanceof Date ? f : new Date(f);
    return isNaN(d.getTime()) ? String(f) : d.toLocaleDateString('es-CO');
}
function fmtCOP(val) {
    return "$".concat((val || 0).toLocaleString('es-CO'));
}
function solidFill(argb) {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: argb } };
}
function cellBorder(bottomStyle, bottomColor) {
    if (bottomStyle === void 0) { bottomStyle = 'hair'; }
    if (bottomColor === void 0) { bottomColor = C.GRIS_CLARO; }
    return {
        bottom: { style: bottomStyle, color: { argb: bottomColor } },
        right: { style: 'hair', color: { argb: C.GRIS_CLARO } },
    };
}
function applyHeader(cell, bgArgb) {
    if (bgArgb === void 0) { bgArgb = C.AZUL_MED; }
    cell.font = { bold: true, size: 9, color: { argb: C.BLANCO }, name: 'Calibri' };
    cell.fill = solidFill(bgArgb);
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
        bottom: { style: 'medium', color: { argb: C.NAR_MED } },
        right: { style: 'thin', color: { argb: C.BLANCO } },
    };
}
function applyDataCell(cell, par, overrideBg) {
    cell.fill = solidFill(overrideBg !== null && overrideBg !== void 0 ? overrideBg : (par ? C.BLANCO : C.AZUL_PALE));
    cell.font = { size: 9, color: { argb: C.GRIS_TEXTO }, name: 'Calibri' };
    cell.alignment = { vertical: 'middle' };
    cell.border = cellBorder();
}
// ─── Logo helper ──────────────────────────────────────────────────────────────
function getLogoPath() {
    var prod = path.join(process.cwd(), 'dist/assets/logo.png');
    var dev = path.join(process.cwd(), 'src/assets/logo.png');
    return fs.existsSync(prod) ? prod : fs.existsSync(dev) ? dev : null;
}
// ═══════════════════════════════════════════════════════════════════════════════
// GENERADOR EXCEL
// ═══════════════════════════════════════════════════════════════════════════════
function generarExcelPagos(filas, totales, fecha) {
    return __awaiter(this, void 0, void 0, function () {
        var workbook, ws, LAST, NCOLS, c, logoPath, logoId, tituloCell, subCell, c, metaL, metaR, kpis, kpiRanges, c, headers, tr, totLabel, totVals, c, ws2, c, ws2T, c, porCobrador, tr2, t1, t2, t3, buffer;
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    workbook = new ExcelJS.Workbook();
                    workbook.creator = 'Créditos del Sur';
                    workbook.created = new Date();
                    ws = workbook.addWorksheet('Historial de Pagos', {
                        views: [{ state: 'frozen', ySplit: 9, showGridLines: false }],
                        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
                        properties: { tabColor: { argb: C.AZUL_DARK } },
                    });
                    // Anchos — generosos en Cliente y Cobrador para que quepan nombres completos
                    ws.columns = [
                        { key: 'fecha', width: 14 },
                        { key: 'numeroPago', width: 15 },
                        { key: 'numeroPrest', width: 18 },
                        { key: 'cliente', width: 36 }, // ← amplio
                        { key: 'documento', width: 14 },
                        { key: 'tipo', width: 12 },
                        { key: 'monto', width: 18 },
                        { key: 'capital', width: 17 },
                        { key: 'interes', width: 17 },
                        { key: 'mora', width: 14 },
                        { key: 'metodo', width: 14 },
                        { key: 'cobrador', width: 36 }, // ← amplio
                        { key: 'origenCaja', width: 15 },
                        { key: 'comentario', width: 32 },
                    ];
                    LAST = 'N';
                    NCOLS = 14;
                    // ── Fila 1: Banda azul decorativa ─────────────────────────────────────────
                    ws.getRow(1).height = 6;
                    for (c = 1; c <= NCOLS; c++)
                        ws.getCell(1, c).fill = solidFill(C.AZUL_DARK);
                    // ── Filas 2-3: Logo + Título ───────────────────────────────────────────────
                    ws.getRow(2).height = 45;
                    ws.getRow(3).height = 20;
                    ws.mergeCells('A2:C3');
                    logoPath = getLogoPath();
                    if (logoPath) {
                        logoId = workbook.addImage({ filename: logoPath, extension: 'png' });
                        ws.addImage(logoId, {
                            tl: { col: 0, row: 1 },
                            ext: { width: 110, height: 55 },
                        });
                    }
                    ws.mergeCells('D2:M2');
                    tituloCell = ws.getCell('D2');
                    tituloCell.value = 'CRÉDITOS DEL SUR';
                    tituloCell.font = { bold: true, size: 20, color: { argb: C.AZUL_DARK }, name: 'Calibri' };
                    tituloCell.alignment = { horizontal: 'left', vertical: 'middle' };
                    tituloCell.fill = solidFill(C.BLANCO);
                    ws.mergeCells('D3:M3');
                    subCell = ws.getCell('D3');
                    subCell.value = 'HISTORIAL DE PAGOS';
                    subCell.font = { size: 10, italic: true, color: { argb: C.NAR_MED }, name: 'Calibri' };
                    subCell.alignment = { horizontal: 'left', vertical: 'middle' };
                    subCell.fill = solidFill(C.BLANCO);
                    // ── Fila 4: Separador naranja ──────────────────────────────────────────────
                    ws.getRow(4).height = 3;
                    for (c = 1; c <= NCOLS; c++)
                        ws.getCell(4, c).fill = solidFill(C.NAR_MED);
                    // ── Fila 5: Meta ───────────────────────────────────────────────────────────
                    ws.getRow(5).height = 18;
                    ws.mergeCells('A5:F5');
                    metaL = ws.getCell('A5');
                    metaL.value = "Generado: ".concat(new Date().toLocaleString('es-CO'), "  |  Per\u00EDodo: ").concat(fecha);
                    metaL.font = { size: 9, color: { argb: C.GRIS_MED }, name: 'Calibri' };
                    metaL.alignment = { horizontal: 'left', vertical: 'middle' };
                    metaL.fill = solidFill(C.GRIS_FONDO);
                    ws.mergeCells('G5:M5');
                    metaR = ws.getCell('G5');
                    metaR.value = "Total: ".concat(totales.totalPagos, "  |  Abonos: ").concat((_a = totales.cantidadAbonos) !== null && _a !== void 0 ? _a : 0, "  |  Cuotas: ").concat((_b = totales.cantidadCuotasCompletas) !== null && _b !== void 0 ? _b : 0);
                    metaR.font = { size: 9, color: { argb: C.GRIS_MED }, name: 'Calibri' };
                    metaR.alignment = { horizontal: 'right', vertical: 'middle' };
                    metaR.fill = solidFill(C.GRIS_FONDO);
                    // ── Filas 6-7: KPIs ───────────────────────────────────────────────────────
                    ws.getRow(6).height = 16;
                    ws.getRow(7).height = 26;
                    kpis = [
                        ['TOTAL RECAUDADO', totales.totalRecaudado, C.AZUL_DARK, C.AZUL_SOFT],
                        ['CAPITAL', (_c = totales.totalCapital) !== null && _c !== void 0 ? _c : 0, C.GRIS_TEXTO, C.GRIS_ALT],
                        ['INTERESES', (_d = totales.totalIntereses) !== null && _d !== void 0 ? _d : 0, C.NAR_DARK, C.NAR_SOFT],
                        ['MORA', (_e = totales.totalMora) !== null && _e !== void 0 ? _e : 0, C.GRIS_TEXTO, C.GRIS_ALT],
                    ];
                    kpiRanges = [['A', 'C'], ['D', 'F'], ['G', 'J'], ['K', 'M']];
                    kpis.forEach(function (_a, i) {
                        var label = _a[0], val = _a[1], fg = _a[2], bg = _a[3];
                        var _b = kpiRanges[i], sc = _b[0], ec = _b[1];
                        ws.mergeCells("".concat(sc, "6:").concat(ec, "6"));
                        var lc = ws.getCell("".concat(sc, "6"));
                        lc.value = label;
                        lc.font = { bold: true, size: 8, color: { argb: C.GRIS_MED }, name: 'Calibri' };
                        lc.alignment = { horizontal: 'center', vertical: 'middle' };
                        lc.fill = solidFill(bg);
                        ws.mergeCells("".concat(sc, "7:").concat(ec, "7"));
                        var vc = ws.getCell("".concat(sc, "7"));
                        vc.value = val;
                        vc.numFmt = '"$"#,##0';
                        vc.font = { bold: true, size: 14, color: { argb: fg }, name: 'Calibri' };
                        vc.alignment = { horizontal: 'center', vertical: 'middle' };
                        vc.fill = solidFill(bg);
                    });
                    // ── Fila 8: Separador ─────────────────────────────────────────────────────
                    ws.getRow(8).height = 2;
                    for (c = 1; c <= NCOLS; c++)
                        ws.getCell(8, c).fill = solidFill(C.GRIS_CLARO);
                    // ── Fila 9: Encabezados tabla ─────────────────────────────────────────────
                    ws.getRow(9).height = 28;
                    headers = ['Fecha', 'N° Pago', 'N° Préstamo', 'Cliente', 'Documento',
                        'Tipo', 'Monto Total', 'Capital', 'Interés', 'Mora', 'Método', 'Cobrador', 'Caja/P.V.', 'Comentario'];
                    headers.forEach(function (h, i) { return applyHeader(ws.getCell(9, i + 1)); });
                    headers.forEach(function (h, i) { ws.getCell(9, i + 1).value = h; });
                    ws.autoFilter = { from: 'A9', to: "".concat(LAST, "9") };
                    // ── Filas de datos ────────────────────────────────────────────────────────
                    filas.forEach(function (fila, idx) {
                        var _a, _b, _c, _d;
                        var r = 10 + idx;
                        var par = idx % 2 === 0;
                        ws.getRow(r).height = 20;
                        var tipo = fila.esAbono ? 'ABONO' : 'CUOTA';
                        var vals = [
                            fmtFecha(fila.fecha),
                            fila.numeroPago,
                            fila.numeroPrestamo,
                            fila.cliente,
                            fila.documento,
                            tipo,
                            fila.montoTotal,
                            (_a = fila.capitalPagado) !== null && _a !== void 0 ? _a : 0,
                            (_b = fila.interesPagado) !== null && _b !== void 0 ? _b : 0,
                            (_c = fila.moraPagada) !== null && _c !== void 0 ? _c : 0,
                            fila.metodoPago,
                            fila.cobrador,
                            fila.origenCaja || '',
                            (_d = fila.comentario) !== null && _d !== void 0 ? _d : '',
                        ];
                        vals.forEach(function (val, ci) {
                            var cell = ws.getCell(r, ci + 1);
                            cell.value = val;
                            applyDataCell(cell, par);
                            // Moneda
                            if ([7, 8, 9, 10].includes(ci + 1)) {
                                cell.numFmt = '"$"#,##0';
                                cell.alignment = { horizontal: 'right', vertical: 'middle' };
                            }
                            // Wrap en nombre cliente / cobrador / comentario
                            if ([4, 12, 14].includes(ci + 1)) {
                                cell.alignment = { vertical: 'middle', wrapText: true };
                            }
                            // Caja/PV
                            if (ci + 1 === 13) {
                                cell.font = { size: 9, bold: true, color: { argb: C.NAR_DARK }, name: 'Calibri' };
                                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                            }
                            // Tipo pago destacado
                            if (ci + 1 === 6) {
                                if (fila.esAbono) {
                                    cell.fill = solidFill(C.NAR_PALE);
                                    cell.font = { bold: true, size: 9, color: { argb: C.NAR_DARK }, name: 'Calibri' };
                                }
                                else {
                                    cell.fill = solidFill(par ? C.AZUL_PALE : C.AZUL_SOFT);
                                    cell.font = { bold: true, size: 9, color: { argb: C.AZUL_DARK }, name: 'Calibri' };
                                }
                                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                            }
                            // Monto total en azul bold
                            if (ci + 1 === 7) {
                                cell.font = { bold: true, size: 9, color: { argb: C.AZUL_DARK }, name: 'Calibri' };
                            }
                        });
                    });
                    tr = 10 + filas.length + 1;
                    ws.getRow(tr).height = 26;
                    ws.mergeCells("A".concat(tr, ":F").concat(tr));
                    totLabel = ws.getCell("A".concat(tr));
                    totLabel.value = "TOTALES \u2014 ".concat(totales.totalPagos, " pagos registrados");
                    totLabel.font = { bold: true, size: 10, color: { argb: C.BLANCO }, name: 'Calibri' };
                    totLabel.fill = solidFill(C.AZUL_DARK);
                    totLabel.alignment = { horizontal: 'left', vertical: 'middle' };
                    totLabel.border = { top: { style: 'medium', color: { argb: C.NAR_MED } } };
                    totVals = [
                        ['G', totales.totalRecaudado],
                        ['H', (_f = totales.totalCapital) !== null && _f !== void 0 ? _f : 0],
                        ['I', (_g = totales.totalIntereses) !== null && _g !== void 0 ? _g : 0],
                        ['J', (_h = totales.totalMora) !== null && _h !== void 0 ? _h : 0],
                    ];
                    totVals.forEach(function (_a) {
                        var col = _a[0], val = _a[1];
                        var cell = ws.getCell("".concat(col).concat(tr));
                        cell.value = val;
                        cell.numFmt = '"$"#,##0';
                        cell.font = { bold: true, size: 10, color: { argb: C.NAR_SOFT }, name: 'Calibri' };
                        cell.fill = solidFill(C.AZUL_DARK);
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        cell.border = { top: { style: 'medium', color: { argb: C.NAR_MED } } };
                    });
                    for (c = 11; c <= NCOLS; c++) {
                        ws.getCell(tr, c).fill = solidFill(C.AZUL_DARK);
                        ws.getCell(tr, c).border = { top: { style: 'medium', color: { argb: C.NAR_MED } } };
                    }
                    ws2 = workbook.addWorksheet('Por Cobrador', {
                        views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
                        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
                        properties: { tabColor: { argb: C.NAR_MED } },
                    });
                    ws2.getColumn('A').width = 38;
                    ws2.getColumn('B').width = 16;
                    ws2.getColumn('C').width = 22;
                    ws2.getRow(1).height = 5;
                    for (c = 1; c <= 3; c++)
                        ws2.getCell(1, c).fill = solidFill(C.AZUL_DARK);
                    ws2.mergeCells('A2:C2');
                    ws2.getRow(2).height = 30;
                    ws2T = ws2.getCell('A2');
                    ws2T.value = 'RECAUDO POR COBRADOR';
                    ws2T.font = { bold: true, size: 14, color: { argb: C.AZUL_DARK }, name: 'Calibri' };
                    ws2T.fill = solidFill(C.AZUL_SOFT);
                    ws2T.alignment = { horizontal: 'center', vertical: 'middle' };
                    ws2.getRow(3).height = 3;
                    for (c = 1; c <= 3; c++)
                        ws2.getCell(3, c).fill = solidFill(C.NAR_MED);
                    ws2.getRow(4).height = 22;
                    ['Cobrador', 'Pagos', 'Monto Recaudado'].forEach(function (h, i) {
                        var cell = ws2.getCell(4, i + 1);
                        cell.value = h;
                        applyHeader(cell);
                    });
                    porCobrador = {};
                    filas.forEach(function (f) {
                        var k = f.cobrador || 'Sin asignar';
                        if (!porCobrador[k])
                            porCobrador[k] = { cantidad: 0, monto: 0 };
                        porCobrador[k].cantidad++;
                        porCobrador[k].monto += f.montoTotal || 0;
                    });
                    Object.entries(porCobrador)
                        .sort(function (a, b) { return b[1].monto - a[1].monto; })
                        .forEach(function (_a, idx) {
                        var cobrador = _a[0], datos = _a[1];
                        var r = 5 + idx;
                        var par = idx % 2 === 0;
                        ws2.getRow(r).height = 20;
                        var c1 = ws2.getCell(r, 1);
                        c1.value = cobrador;
                        c1.font = { size: 9, color: { argb: C.GRIS_TEXTO }, name: 'Calibri' };
                        c1.fill = solidFill(par ? C.BLANCO : C.AZUL_PALE);
                        c1.alignment = { vertical: 'middle' };
                        var c2 = ws2.getCell(r, 2);
                        c2.value = datos.cantidad;
                        c2.font = { bold: true, size: 9, color: { argb: C.AZUL_DARK }, name: 'Calibri' };
                        c2.fill = solidFill(par ? C.BLANCO : C.AZUL_PALE);
                        c2.alignment = { horizontal: 'center', vertical: 'middle' };
                        var c3 = ws2.getCell(r, 3);
                        c3.value = datos.monto;
                        c3.numFmt = '"$"#,##0';
                        c3.font = { bold: true, size: 9, color: { argb: C.NAR_DARK }, name: 'Calibri' };
                        c3.fill = solidFill(par ? C.BLANCO : C.AZUL_PALE);
                        c3.alignment = { horizontal: 'right', vertical: 'middle' };
                    });
                    tr2 = 5 + Object.keys(porCobrador).length + 1;
                    ws2.getRow(tr2).height = 22;
                    t1 = ws2.getCell(tr2, 1);
                    t1.value = 'TOTAL GENERAL';
                    t1.font = { bold: true, size: 10, color: { argb: C.BLANCO }, name: 'Calibri' };
                    t1.fill = solidFill(C.AZUL_DARK);
                    t1.alignment = { vertical: 'middle' };
                    t2 = ws2.getCell(tr2, 2);
                    t2.value = filas.length;
                    t2.font = { bold: true, size: 10, color: { argb: C.BLANCO }, name: 'Calibri' };
                    t2.fill = solidFill(C.AZUL_DARK);
                    t2.alignment = { horizontal: 'center', vertical: 'middle' };
                    t3 = ws2.getCell(tr2, 3);
                    t3.value = totales.totalRecaudado;
                    t3.numFmt = '"$"#,##0';
                    t3.font = { bold: true, size: 10, color: { argb: C.NAR_SOFT }, name: 'Calibri' };
                    t3.fill = solidFill(C.AZUL_DARK);
                    t3.alignment = { horizontal: 'right', vertical: 'middle' };
                    return [4 /*yield*/, workbook.xlsx.writeBuffer()];
                case 1:
                    buffer = _j.sent();
                    return [2 /*return*/, {
                            data: Buffer.from(buffer),
                            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            filename: "historial-pagos-".concat(fecha, ".xlsx"),
                        }];
            }
        });
    });
}
// ═══════════════════════════════════════════════════════════════════════════════
// GENERADOR PDF
// ═══════════════════════════════════════════════════════════════════════════════
function generarPDFPagos(filas, totales, fecha) {
    return __awaiter(this, void 0, void 0, function () {
        var doc, buffers, AZUL_DARK, AZUL_MED, AZUL_PALE, NAR_MED, NAR_DARK, NAR_SOFT, BLANCO, GRIS_TXT, GRIS_MED, GRIS_CLR, drawWatermark, pageNumber, drawPageHeader, cols, tableLeft, tableWidth, drawTableHeader, drawFooter, y, tx, buffer;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
                    buffers = [];
                    doc.on('data', function (chunk) { return buffers.push(chunk); });
                    AZUL_DARK = '#1A5F8A';
                    AZUL_MED = '#2B7BB5';
                    AZUL_PALE = '#EBF4FB';
                    NAR_MED = '#F07A28';
                    NAR_DARK = '#D4600A';
                    NAR_SOFT = '#FDE8D5';
                    BLANCO = '#FFFFFF';
                    GRIS_TXT = '#2D3748';
                    GRIS_MED = '#718096';
                    GRIS_CLR = '#E2E8F0';
                    drawWatermark = function () {
                        var logoPath = getLogoPath();
                        if (!logoPath)
                            return;
                        try {
                            doc.save();
                            doc.opacity(0.08); // Igual que en otros pdfs
                            var W = doc.page.width;
                            var H = doc.page.height;
                            doc.image(logoPath, (W - 300) / 2, (H - 300) / 2, { width: 300 });
                            doc.restore();
                        }
                        catch (_) { }
                    };
                    pageNumber = 1;
                    drawPageHeader = function () {
                        var _a, _b, _c;
                        var W = doc.page.width;
                        // Quitamos los colores de la cabecera superior y el fondo gris.
                        // Título alineado a la izquierda (donde iría el logo)
                        doc.fontSize(22).font('Helvetica-Bold').fillColor('#1A5F8A') // Volvemos a Bold pero mantenemos mayúsculas/minúsculas
                            .text('Créditos del Sur', 30, 25);
                        doc.fontSize(9).font('Helvetica').fillColor('#F07A28')
                            .text('HISTORIAL DE PAGOS', 30, 52, { characterSpacing: 0.5 });
                        // Bloque fecha (derecha)
                        doc.roundedRect(W - 180, 20, 148, 44, 5)
                            .fillAndStroke(BLANCO, GRIS_CLR);
                        doc.fontSize(8).font('Helvetica-Bold').fillColor(GRIS_MED)
                            .text('PERÍODO', W - 180, 28, { width: 148, align: 'center' });
                        doc.fontSize(11).font('Helvetica-Bold').fillColor(AZUL_DARK)
                            .text(fecha, W - 180, 40, { width: 148, align: 'center' });
                        // ── KPIs ──────────────────────────────────────────────────────────────
                        var metY = 98;
                        var metW = 148;
                        var gap = 18;
                        var totalW = (metW * 4) + (gap * 3);
                        var startX = (W - totalW) / 2;
                        [
                            { label: 'TOTAL RECAUDADO', val: totales.totalRecaudado, color: AZUL_DARK, bg: '#D6E9F5' },
                            { label: 'TOTAL CAPITAL', val: (_a = totales.totalCapital) !== null && _a !== void 0 ? _a : 0, color: GRIS_TXT, bg: '#F0F4F8' },
                            { label: 'TOTAL INTERESES', val: (_b = totales.totalIntereses) !== null && _b !== void 0 ? _b : 0, color: NAR_DARK, bg: '#FDE8D5' },
                            { label: 'TOTAL MORA', val: (_c = totales.totalMora) !== null && _c !== void 0 ? _c : 0, color: GRIS_TXT, bg: '#F0F4F8' },
                        ].forEach(function (m, i) {
                            var mx = startX + i * (metW + gap);
                            doc.roundedRect(mx, metY, metW, 44, 6).fillAndStroke(m.bg, GRIS_CLR);
                            doc.fontSize(7.5).font('Helvetica-Bold').fillColor(GRIS_MED)
                                .text(m.label, mx, metY + 10, { width: metW, align: 'center' });
                            doc.fontSize(13).font('Helvetica-Bold').fillColor(m.color)
                                .text(fmtCOP(m.val), mx, metY + 23, { width: metW, align: 'center' });
                        });
                        return metY + 58;
                    };
                    cols = [
                        { label: 'Fecha', width: 53 },
                        { label: 'N° Pago', width: 53 },
                        { label: 'N° Préstamo', width: 63 },
                        { label: 'Cliente', width: 125 }, // Ya no truncamos
                        { label: 'Tipo', width: 48 }, // Nueva columna para ABONO / CUOTA
                        { label: 'Monto Total', width: 68 },
                        { label: 'Capital', width: 60 },
                        { label: 'Interés', width: 60 },
                        { label: 'Método', width: 55 },
                        { label: 'Cobrador', width: 90 },
                        { label: 'Caja/P.V.', width: 45 },
                    ];
                    tableLeft = 28;
                    tableWidth = cols.reduce(function (s, c) { return s + c.width; }, 0);
                    drawTableHeader = function (y) {
                        // Fondo cabecera
                        doc.rect(tableLeft, y, tableWidth, 24).fill(AZUL_MED);
                        // Línea naranja inferior
                        doc.rect(tableLeft, y + 24, tableWidth, 2).fill(NAR_MED);
                        var x = tableLeft;
                        doc.fontSize(8).font('Helvetica-Bold').fillColor(BLANCO);
                        cols.forEach(function (col) {
                            doc.text(col.label, x + 4, y + 7, { width: col.width - 8, align: 'center' });
                            x += col.width;
                        });
                        return y + 30;
                    };
                    drawFooter = function () {
                        var W = doc.page.width;
                        var H = doc.page.height;
                        doc.fontSize(7).font('Helvetica').fillColor(GRIS_MED);
                        doc.text("P\u00E1g. ".concat(pageNumber, "  \u2022  Generado: ").concat(new Date().toLocaleString('es-CO')), 0, H - 25, { align: 'right', width: W - 30 });
                    };
                    // ── Primera página ────────────────────────────────────────────────────────
                    drawWatermark();
                    y = drawPageHeader();
                    y = drawTableHeader(y);
                    doc.font('Helvetica').fontSize(7.5);
                    // ── Filas de datos ────────────────────────────────────────────────────────
                    filas.forEach(function (fila, i) {
                        var _a, _b;
                        // Primero, pre-calcular la altura que tomará esta fila
                        var maxRowHeight = 17; // Altura mínima base
                        var rowVals = [
                            fmtFecha(fila.fecha),
                            fila.numeroPago || '',
                            fila.numeroPrestamo || '',
                            fila.cliente || '',
                            fila.esAbono ? 'ABONO' : 'CUOTA',
                            fmtCOP(fila.montoTotal),
                            fmtCOP((_a = fila.capitalPagado) !== null && _a !== void 0 ? _a : 0),
                            fmtCOP((_b = fila.interesPagado) !== null && _b !== void 0 ? _b : 0),
                            fila.metodoPago || '',
                            fila.cobrador || '',
                            fila.origenCaja || '',
                        ];
                        doc.font('Helvetica').fontSize(7.5); // Asegurar fuente para medir
                        rowVals.forEach(function (val, ci) {
                            var isBold = ci === 3 || ci === 5 || ci === 4;
                            if (isBold)
                                doc.font('Helvetica-Bold');
                            var h = doc.heightOfString(val, { width: cols[ci].width - 8, lineBreak: true });
                            if (h + 8 > maxRowHeight)
                                maxRowHeight = h + 8; // + 8 de padding (Arriba y abajo)
                            doc.font('Helvetica'); // Restaurar
                        });
                        // Nueva página si no hay espacio para la fila entera
                        if (y + maxRowHeight > doc.page.height - 70) {
                            drawFooter();
                            pageNumber++;
                            doc.addPage();
                            drawWatermark();
                            y = drawPageHeader();
                            y = drawTableHeader(y);
                            doc.font('Helvetica').fontSize(7.5);
                        }
                        // Fondo de fila alterno
                        var par = i % 2 === 0;
                        doc.rect(tableLeft, y, tableWidth, maxRowHeight).fill(par ? BLANCO : AZUL_PALE);
                        // Línea separadora
                        doc.moveTo(tableLeft, y + maxRowHeight)
                            .lineTo(tableLeft + tableWidth, y + maxRowHeight)
                            .strokeColor(GRIS_CLR).lineWidth(0.4).stroke();
                        var x = tableLeft;
                        rowVals.forEach(function (val, ci) {
                            var isMoneyCol = ci >= 5 && ci <= 7;
                            var align = isMoneyCol ? 'right' : (ci === 4 || ci === 10 ? 'center' : 'left');
                            if (ci === 5) {
                                // Monto total: amarillo si abono o azul si cuota
                                doc.font('Helvetica-Bold').fillColor(fila.esAbono ? NAR_DARK : AZUL_DARK);
                            }
                            else if (ci === 4) {
                                // BADGE Tipo de pago
                                doc.font('Helvetica-Bold').fillColor(fila.esAbono ? NAR_DARK : AZUL_DARK);
                            }
                            else if (ci === 6 || ci === 7) {
                                doc.font('Helvetica').fillColor(GRIS_TXT);
                            }
                            else if (ci === 8) {
                                doc.font('Helvetica').fillColor(GRIS_MED); // Metodo Pago
                            }
                            else if (ci === 9) {
                                doc.font('Helvetica').fillColor(GRIS_TXT); // Cobrador
                            }
                            else if (ci === 10) {
                                doc.font('Helvetica-Bold').fillColor(NAR_MED); // Caja/PV
                            }
                            else {
                                doc.font('Helvetica').fillColor(ci === 3 ? AZUL_DARK : GRIS_TXT);
                                if (ci === 3)
                                    doc.font('Helvetica-Bold');
                            }
                            doc.text(val, x + 4, y + 4, { width: cols[ci].width - 8, align: align, lineBreak: true });
                            x += cols[ci].width;
                        });
                        y += maxRowHeight;
                    });
                    // ── Fila totales ──────────────────────────────────────────────────────────
                    y += 8;
                    doc.rect(tableLeft, y, tableWidth, 26).fill(AZUL_DARK);
                    // Línea naranja superior totales
                    doc.rect(tableLeft, y, tableWidth, 2).fill(NAR_MED);
                    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BLANCO);
                    doc.text("TOTAL GENERAL  /  ".concat(totales.totalPagos, " pagos"), tableLeft + 6, y + 8, { width: cols.slice(0, 5).reduce(function (s, c) { return s + c.width; }, 0) - 10 });
                    tx = tableLeft + cols.slice(0, 5).reduce(function (s, c) { return s + c.width; }, 0);
                    [
                        { val: totales.totalRecaudado, color: NAR_MED },
                        { val: (_a = totales.totalCapital) !== null && _a !== void 0 ? _a : 0, color: NAR_SOFT },
                        { val: (_b = totales.totalIntereses) !== null && _b !== void 0 ? _b : 0, color: NAR_SOFT },
                    ].forEach(function (_a, ci) {
                        var val = _a.val, color = _a.color;
                        doc.fillColor(color).font('Helvetica-Bold').fontSize(ci === 0 ? 9 : 8);
                        doc.text(fmtCOP(val), tx + 4, y + (ci === 0 ? 7 : 9), { width: cols[5 + ci].width - 8, align: 'right', lineBreak: false });
                        tx += cols[5 + ci].width;
                    });
                    // ── Nota al pie ───────────────────────────────────────────────────────────
                    y += 38;
                    doc.fontSize(7.5).font('Helvetica-Oblique').fillColor(GRIS_MED)
                        .text('Documento expedido por Créditos del Sur. Las cifras presentadas son definitivas y sujetas a revisión de auditoría.', tableLeft, y, { align: 'center', width: tableWidth });
                    drawFooter();
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            doc.on('end', function () { return resolve(Buffer.concat(buffers)); });
                            doc.on('error', reject);
                            doc.end();
                        })];
                case 1:
                    buffer = _c.sent();
                    return [2 /*return*/, {
                            data: buffer,
                            contentType: 'application/pdf',
                            filename: "historial-pagos-".concat(fecha, ".pdf"),
                        }];
            }
        });
    });
}
