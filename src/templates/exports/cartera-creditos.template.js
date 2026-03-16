"use strict";
/**
 * ============================================================================
 * TEMPLATE: CARTERA DE CRÉDITOS
 * ============================================================================
 * Usado en: loans.service.ts → exportLoans()
 * Endpoint: GET /loans/export?format=excel|pdf
 *
 * Por cada cuenta se reporta:
 *   Capital original, capital actual (pendiente), total adeudado,
 *   interés recogido, moras, recaudo, progreso — filtrable por fechas.
 * Fuente: Propuesta de Desarrollo §114
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.generarExcelCartera = generarExcelCartera;
exports.generarPDFCartera = generarPDFCartera;
var ExcelJS = require("exceljs");
var PDFDocument = require("pdfkit");
var fs = require("fs");
var path = require("path");
// ─── Colores corporativos ─────────────────────────────────────────────────────
var AZUL = 'FF004F7B';
var AZUL_CLARO = 'FFF0F9FF';
var NARANJA = 'FFF37920';
var NARANJA_CLARO = 'FFFFEDD5';
var GRIS_OSC = 'FF1E293B';
var BORDER_HAIR = { style: 'hair', color: { argb: 'FFE2E8F0' } };
var BORDER_MEDIUM = { style: 'medium', color: { argb: 'FF94A3B8' } };
var BASE_CELL_STYLE = {
    alignment: { vertical: 'middle' },
    border: { bottom: BORDER_HAIR, right: BORDER_HAIR },
};
function colHdr(cell, colNumber) {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
        bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
        right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
    };
    if (colNumber && [6, 9, 13, 16].includes(colNumber)) {
        cell.border.left = { style: 'medium', color: { argb: 'FFFFFFFF' } };
    }
}
function fmtF(f) {
    if (!f)
        return '';
    var d = f instanceof Date ? f : new Date(f);
    return isNaN(d.getTime()) ? String(f) : d.toLocaleDateString('es-CO');
}
// ─── Generador Excel ──────────────────────────────────────────────────────────
function generarExcelCartera(filas, totales, fecha) {
    return __awaiter(this, void 0, void 0, function () {
        var workbook, ws, numCols, lastColLetter, c1, c2, kpis, headers, hRow, riesgoFill, estadoFill, endRow, sumRow, stCell, totRow, ws2, ws2T, ws2H, porEstado, ws2Tot, buffer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    workbook = new ExcelJS.Workbook();
                    workbook.creator = 'Créditos del Sur';
                    workbook.created = new Date();
                    ws = workbook.addWorksheet('Cartera de Créditos', {
                        views: [{ state: 'frozen', ySplit: 6, xSplit: 2, showGridLines: false }],
                        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
                        properties: { tabColor: { argb: 'FF004F7B' } }
                    });
                    ws.columns = [
                        { key: 'num', width: 17 },
                        { key: 'cliente', width: 28 },
                        { key: 'dni', width: 13 },
                        { key: 'producto', width: 20 },
                        { key: 'estado', width: 14 },
                        { key: 'capitalOrig', width: 16, style: { numFmt: '"$"#,##0', alignment: { horizontal: 'right' } } },
                        { key: 'capitalActual', width: 16, style: { numFmt: '"$"#,##0', alignment: { horizontal: 'right' } } },
                        { key: 'capitalPagado', width: 16, style: { numFmt: '"$"#,##0', alignment: { horizontal: 'right' } } },
                        { key: 'interesRecog', width: 16, style: { numFmt: '"$"#,##0', alignment: { horizontal: 'right' } } },
                        { key: 'mora', width: 14, style: { numFmt: '"$"#,##0', alignment: { horizontal: 'right' } } },
                        { key: 'recaudo', width: 16, style: { numFmt: '"$"#,##0', alignment: { horizontal: 'right' } } },
                        { key: 'totalAdeudado', width: 18, style: { numFmt: '"$"#,##0', alignment: { horizontal: 'right' } } },
                        { key: 'cuotas', width: 12, style: { alignment: { horizontal: 'center' } } },
                        { key: 'progreso', width: 11, style: { numFmt: '0"%"', alignment: { horizontal: 'center' } } },
                        { key: 'riesgo', width: 12, style: { alignment: { horizontal: 'center' } } },
                        { key: 'ruta', width: 18 },
                        { key: 'cobrador', width: 20 },
                        { key: 'fechaInicio', width: 13 },
                        { key: 'fechaFin', width: 13 },
                        { key: 'diasVenc', width: 11, style: { numFmt: '#,##0', alignment: { horizontal: 'right' } } },
                    ];
                    numCols = ws.columns.length;
                    lastColLetter = 'T';
                    // F1 — Encabezado institucional
                    ws.mergeCells("A1:".concat(lastColLetter, "1"));
                    c1 = ws.getCell('A1');
                    c1.value = 'CRÉDITOS DEL SUR';
                    c1.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
                    c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
                    c1.alignment = { horizontal: 'center', vertical: 'middle' };
                    ws.getRow(1).height = 32;
                    // F2 — Nombre del reporte
                    ws.mergeCells("A2:".concat(lastColLetter, "2"));
                    c2 = ws.getCell('A2');
                    c2.value = 'LISTADO DE CRÉDITOS';
                    c2.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
                    c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NARANJA } };
                    c2.alignment = { horizontal: 'center', vertical: 'middle' };
                    ws.getRow(2).height = 22;
                    // F3 — Metadata
                    ws.mergeCells('A3:G3');
                    ws.getCell('A3').value = "Generado: ".concat(new Date().toLocaleString('es-CO'));
                    ws.getCell('A3').font = { size: 9, color: { argb: 'FF475569' } };
                    ws.mergeCells('H3:T3');
                    ws.getCell('H3').value = "Total registros: ".concat(totales.totalRegistros, "  |  Fecha: ").concat(fecha);
                    ws.getCell('H3').font = { size: 9, color: { argb: 'FF475569' } };
                    ws.getCell('H3').alignment = { horizontal: 'right' };
                    ws.getRow(3).height = 16;
                    // F4-5 — KPIs financieros
                    ws.getRow(4).height = 16;
                    ws.getRow(5).height = 26;
                    kpis = [
                        { label: 'CAPITAL ORIGINAL', val: totales.montoTotal, bg: 'FFD6E9F5', color: AZUL },
                        { label: 'CAPITAL ACTUAL', val: totales.montoPendiente, bg: 'FFF0F4F8', color: GRIS_OSC },
                        { label: 'CAPITAL PAGADO', val: totales.montoPagado, bg: 'FFF0F4F8', color: GRIS_OSC },
                        { label: 'INTERÉS RECOGIDO', val: totales.interesRecogido, bg: NARANJA_CLARO, color: NARANJA },
                        { label: 'MORA TOTAL', val: totales.mora, bg: 'FFFEF2F2', color: 'FFDC2626' },
                        { label: 'TOTAL RECAUDO', val: totales.recaudo, bg: 'FFD6E9F5', color: AZUL },
                        { label: 'TOTAL ADEUDADO', val: totales.totalAdeudado, bg: 'FFF0F4F8', color: GRIS_OSC },
                    ];
                    kpis.forEach(function (kpi, i) {
                        var sc = i * 2 + 1;
                        var ec = i * 2 + 2;
                        var scLet = String.fromCharCode(64 + sc);
                        var ecLet = String.fromCharCode(64 + ec);
                        ws.mergeCells("".concat(scLet, "4:").concat(ecLet, "4"));
                        var lc = ws.getCell("".concat(scLet, "4"));
                        lc.value = kpi.label;
                        lc.font = { bold: true, size: 8, color: { argb: 'FF64748B' } };
                        lc.alignment = { horizontal: 'center', vertical: 'middle' };
                        lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bg } };
                        ws.mergeCells("".concat(scLet, "5:").concat(ecLet, "5"));
                        var vc = ws.getCell("".concat(scLet, "5"));
                        vc.value = kpi.val;
                        vc.numFmt = '"$"#,##0';
                        vc.font = { bold: true, size: 14, color: { argb: kpi.color } };
                        vc.alignment = { horizontal: 'center', vertical: 'middle' };
                        vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bg } };
                    });
                    headers = [
                        'N° Préstamo', 'Cliente', 'Cédula', 'Producto', 'Estado',
                        'Capital Orig.', 'Capital Actual', 'Capital Pagado', 'Interés Recog.',
                        'Mora', 'Recaudo', 'Total Adeudado',
                        'Cuotas', 'Progreso %', 'Riesgo', 'Ruta', 'Cobrador',
                        'Fecha Inicio', 'Fecha Fin', 'Días Venc.',
                    ];
                    ws.getRow(6).height = 22;
                    hRow = ws.getRow(6);
                    headers.forEach(function (h, i) { var cell = hRow.getCell(i + 1); cell.value = h; colHdr(cell, i + 1); });
                    ws.autoFilter = { from: 'A6', to: "".concat(lastColLetter, "6") };
                    riesgoFill = {
                        ROJO: 'FFFECACA', AMARILLO: 'FFFEF9C3', VERDE: 'FFDCFCE7', LISTA_NEGRA: 'FFFFE4E6',
                    };
                    estadoFill = {
                        ACTIVO: 'FFDCFCE7', EN_MORA: 'FFFECACA', VENCIDO: 'FFFFE4E6',
                        CANCELADO: 'FFE0E7FF', CASTIGADO: 'FFF1F5F9',
                    };
                    filas.forEach(function (fila, idx) {
                        var _a, _b, _c;
                        var row = ws.addRow([
                            fila.numeroPrestamo,
                            fila.cliente,
                            fila.dni,
                            fila.producto,
                            (_a = fila.estado) === null || _a === void 0 ? void 0 : _a.replace(/_/g, ' '),
                            fila.montoTotal,
                            fila.montoPendiente,
                            fila.montoPagado,
                            fila.interesRecogido,
                            fila.mora,
                            fila.recaudo,
                            fila.totalAdeudado,
                            "".concat(fila.cuotasPagadas, "/").concat(fila.cuotasTotales),
                            fila.progreso,
                            fila.riesgo,
                            fila.ruta,
                            fila.cobrador || '',
                            fmtF(fila.fechaInicio),
                            fmtF(fila.fechaFin),
                            fila.diasVencidos || 0,
                        ]);
                        row.height = 18;
                        // Fondo alterno
                        if (idx % 2 === 0) {
                            row.eachCell(function (cell) {
                                var _a;
                                if (!cell.fill || ((_a = cell.fill.fgColor) === null || _a === void 0 ? void 0 : _a.argb) === 'FFFFFFFF') {
                                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                                }
                            });
                        }
                        // Bordes y Estilos base reutilizando objetos
                        row.eachCell(function (cell, colNumber) {
                            cell.border = {
                                bottom: BORDER_HAIR,
                                right: BORDER_HAIR,
                            };
                            if ([6, 9, 13, 16].includes(colNumber)) {
                                cell.border.left = BORDER_MEDIUM;
                            }
                            cell.alignment = __assign(__assign({}, cell.alignment), { vertical: 'middle' });
                        });
                        // Color estado (col 5)
                        var estadoBg = estadoFill[((_b = fila.estado) === null || _b === void 0 ? void 0 : _b.toUpperCase()) || ''];
                        if (estadoBg)
                            row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: estadoBg } };
                        // Color riesgo (col 15)
                        var riesgoBg = riesgoFill[((_c = fila.riesgo) === null || _c === void 0 ? void 0 : _c.toUpperCase()) || ''];
                        if (riesgoBg)
                            row.getCell(15).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: riesgoBg } };
                        // Días vencidos en rojo si > 0
                        if ((fila.diasVencidos || 0) > 0) {
                            row.getCell(20).font = { bold: true, color: { argb: 'FFDC2626' } };
                        }
                    });
                    endRow = 6 + filas.length;
                    sumRow = ws.addRow([
                        'TOTALES', '', '', '', '',
                        { formula: "SUM(F7:F".concat(endRow, ")") }, // Capital Orig
                        { formula: "SUM(G7:G".concat(endRow, ")") }, // Capital Actual
                        { formula: "SUM(H7:H".concat(endRow, ")") }, // Capital Pagado
                        { formula: "SUM(I7:I".concat(endRow, ")") }, // Interes Recogido
                        { formula: "SUM(J7:J".concat(endRow, ")") }, // Mora
                        { formula: "SUM(K7:K".concat(endRow, ")") }, // Recaudo
                        { formula: "SUM(L7:L".concat(endRow, ")") }, // Total adeudado
                    ]);
                    sumRow.height = 20;
                    ws.mergeCells("A".concat(sumRow.number, ":E").concat(sumRow.number));
                    stCell = sumRow.getCell(1);
                    stCell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
                    stCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NARANJA } };
                    stCell.alignment = { horizontal: 'right', vertical: 'middle' };
                    sumRow.height = 24;
                    sumRow.eachCell({ includeEmpty: true }, function (c) {
                        c.border = {
                            top: { style: 'medium', color: { argb: 'FFFFFFFF' } },
                            right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                        };
                    });
                    [6, 7, 8, 9, 10, 11, 12].forEach(function (c) {
                        sumRow.getCell(c).numFmt = '"$"#,##0';
                        sumRow.getCell(c).font = { bold: true, color: { argb: 'FF000000' } };
                        sumRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NARANJA_CLARO } };
                        sumRow.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
                    });
                    // Fila totales
                    ws.addRow([]);
                    totRow = ws.addRow([
                        "TOTALES \u2014 ".concat(totales.totalRegistros, " cr\u00E9ditos"),
                        '', '', '', '',
                        totales.montoTotal,
                        totales.montoPendiente,
                        totales.montoPagado,
                        totales.interesRecogido,
                        totales.mora,
                        totales.recaudo,
                        totales.totalAdeudado,
                        '', '', '', '', '', '', '', '',
                    ]);
                    totRow.height = 20;
                    ws.mergeCells("A".concat(totRow.number, ":E").concat(totRow.number));
                    totRow.eachCell(function (cell) {
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_OSC } };
                    });
                    [6, 7, 8, 9, 10, 11, 12].forEach(function (c) {
                        totRow.getCell(c).numFmt = '"$"#,##0';
                        totRow.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
                    });
                    ws2 = workbook.addWorksheet('Resumen por Estado', {
                        views: [{ showGridLines: false, state: 'frozen', ySplit: 3 }],
                        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
                        properties: { tabColor: { argb: 'FFF37920' } },
                    });
                    ws2.columns = [
                        { key: 'estado', width: 20 },
                        { key: 'cantidad', width: 12 },
                        { key: 'capital', width: 20 },
                        { key: 'pendiente', width: 20 },
                        { key: 'recaudo', width: 20 },
                        { key: 'mora', width: 20 },
                        { key: 'adeudado', width: 20 },
                    ];
                    ws2.mergeCells('A1:G1');
                    ws2T = ws2.getCell('A1');
                    ws2T.value = 'CRÉDITOS DEL SUR — Resumen Cartera por Estado';
                    ws2T.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
                    ws2T.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
                    ws2T.alignment = { horizontal: 'center', vertical: 'middle' };
                    ws2.getRow(1).height = 28;
                    ws2.addRow([]);
                    ws2H = ws2.getRow(3);
                    ['Estado', 'Cantidad', 'Capital Orig.', 'Capital Actual', 'Recaudo', 'Mora', 'Total Adeudado']
                        .forEach(function (h, i) { var cell = ws2H.getCell(i + 1); cell.value = h; colHdr(cell); });
                    ws2H.height = 20;
                    porEstado = {};
                    filas.forEach(function (f) {
                        var e = f.estado || 'DESCONOCIDO';
                        if (!porEstado[e])
                            porEstado[e] = { cantidad: 0, capital: 0, pendiente: 0, recaudo: 0, mora: 0, adeudado: 0 };
                        porEstado[e].cantidad++;
                        porEstado[e].capital += f.montoTotal || 0;
                        porEstado[e].pendiente += f.montoPendiente || 0;
                        porEstado[e].recaudo += f.recaudo || 0;
                        porEstado[e].mora += f.mora || 0;
                        porEstado[e].adeudado += f.totalAdeudado || 0;
                    });
                    Object.entries(porEstado).forEach(function (_a, i) {
                        var estado = _a[0], d = _a[1];
                        var row = ws2.addRow([estado.replace(/_/g, ' '), d.cantidad, d.capital, d.pendiente, d.recaudo, d.mora, d.adeudado]);
                        row.height = 18;
                        var bg = estadoFill[estado.toUpperCase()] || (i % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF');
                        row.eachCell(function (cell) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; });
                        [3, 4, 5, 6, 7].forEach(function (c) {
                            row.getCell(c).numFmt = '"$"#,##0';
                            row.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
                        });
                    });
                    ws2.addRow([]);
                    ws2Tot = ws2.addRow([
                        'TOTAL', totales.totalRegistros, totales.montoTotal,
                        totales.montoPendiente, totales.recaudo, totales.mora, totales.totalAdeudado,
                    ]);
                    ws2Tot.eachCell({ includeEmpty: true }, function (cell) {
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_OSC } };
                        cell.border = {
                            top: { style: 'medium', color: { argb: 'FFFFFFFF' } },
                            right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                        };
                    });
                    ws2Tot.height = 24;
                    ws2Tot.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
                    [3, 4, 5, 6, 7].forEach(function (c) { ws2Tot.getCell(c).numFmt = '"$"#,##0'; });
                    return [4 /*yield*/, workbook.xlsx.writeBuffer()];
                case 1:
                    buffer = _a.sent();
                    return [2 /*return*/, {
                            data: Buffer.from(buffer),
                            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            filename: "listado-creditos-".concat(fecha, ".xlsx"),
                        }];
            }
        });
    });
}
// ─── Generador PDF ────────────────────────────────────────────────────────────
function generarPDFCartera(filas, totales, fecha) {
    return __awaiter(this, void 0, void 0, function () {
        var doc, buffers, BLANCO, GRIS_CLR, GRIS_MED, GRIS_TXT, AZUL_DARK, AZUL_MED, AZUL_PALE, NAR_DARK, NAR_MED, NAR_SOFT, fmtCOP, getLogoPath, drawWatermark, pageNumber, drawPageHeader, drawFooter, cols, tableLeft, tableWidth, drawTableHeader, y, estadoPdf, tx, buffer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
                    buffers = [];
                    doc.on('data', function (chunk) { return buffers.push(chunk); });
                    BLANCO = '#FFFFFF';
                    GRIS_CLR = '#E2E8F0';
                    GRIS_MED = '#94A3B8';
                    GRIS_TXT = '#475569';
                    AZUL_DARK = '#1A5F8A';
                    AZUL_MED = '#2676AC';
                    AZUL_PALE = '#F0F9FF';
                    NAR_DARK = '#D95C0F';
                    NAR_MED = '#F07A28';
                    NAR_SOFT = '#FDE8D5';
                    fmtCOP = function (v) { return "$".concat((v || 0).toLocaleString('es-CO')); };
                    getLogoPath = function () {
                        var pProd = path.join(process.cwd(), 'dist/assets/logo.png');
                        var pDev = path.join(process.cwd(), 'src/assets/logo.png');
                        return fs.existsSync(pProd) ? pProd : (fs.existsSync(pDev) ? pDev : null);
                    };
                    drawWatermark = function () {
                        try {
                            var lp = getLogoPath();
                            if (lp) {
                                doc.save();
                                doc.opacity(0.08);
                                var W = doc.page.width;
                                var H = doc.page.height;
                                doc.image(lp, (W - 300) / 2, (H - 300) / 2, { width: 300 });
                                doc.restore();
                            }
                        }
                        catch (e) { }
                    };
                    pageNumber = 1;
                    drawPageHeader = function () {
                        var W = doc.page.width;
                        doc.fontSize(22).font('Helvetica-Bold').fillColor(AZUL_DARK)
                            .text('Créditos del Sur', 30, 25);
                        doc.fontSize(9).font('Helvetica').fillColor(NAR_MED)
                            .text('LISTADO DE CRÉDITOS', 30, 52, { characterSpacing: 0.5 });
                        doc.roundedRect(W - 180, 20, 148, 44, 5).fillAndStroke(BLANCO, GRIS_CLR);
                        doc.fontSize(8).font('Helvetica-Bold').fillColor(GRIS_MED)
                            .text('PERÍODO', W - 180, 28, { width: 148, align: 'center' });
                        doc.fontSize(11).font('Helvetica-Bold').fillColor(AZUL_DARK)
                            .text(fecha, W - 180, 40, { width: 148, align: 'center' });
                        var kW = (doc.page.width - 60) / 4;
                        var kY = 98;
                        [
                            { label: 'CAPITAL ORIGINAL', val: totales.montoTotal, bg: '#D6E9F5', color: AZUL_DARK },
                            { label: 'CAPITAL ACTUAL', val: totales.montoPendiente, bg: '#F0F4F8', color: GRIS_TXT },
                            { label: 'INTERÉS RECOGIDO', val: totales.interesRecogido, bg: '#FDE8D5', color: NAR_DARK },
                            { label: 'TOTAL RECAUDO', val: totales.recaudo, bg: '#F0F4F8', color: GRIS_TXT },
                        ].forEach(function (m, i) {
                            var mx = 30 + i * (kW + 4);
                            doc.roundedRect(mx, kY, kW, 44, 6).fillAndStroke(m.bg, GRIS_CLR);
                            doc.fontSize(7.5).font('Helvetica-Bold').fillColor(GRIS_MED)
                                .text(m.label, mx, kY + 10, { width: kW, align: 'center' });
                            doc.fontSize(13).font('Helvetica-Bold').fillColor(m.color)
                                .text(fmtCOP(m.val), mx, kY + 23, { width: kW, align: 'center' });
                        });
                        return kY + 58;
                    };
                    drawFooter = function () {
                        var W = doc.page.width;
                        var H = doc.page.height;
                        doc.fontSize(7).font('Helvetica').fillColor(GRIS_MED);
                        doc.text("P\u00E1g. ".concat(pageNumber, "  \u2022  Generado: ").concat(new Date().toLocaleString('es-CO')), 0, H - 25, { align: 'right', width: W - 30 });
                    };
                    cols = [
                        { label: 'N° Préstamo', width: 78 },
                        { label: 'Cliente', width: 135 },
                        { label: 'Estado', width: 58 },
                        { label: 'Cap. Orig.', width: 72 },
                        { label: 'Cap. Actual', width: 72 },
                        { label: 'Int. Recog.', width: 72 },
                        { label: 'Mora', width: 60 },
                        { label: 'Recaudo', width: 72 },
                        { label: 'Total Adeudado', width: 80 },
                        { label: 'Prog.', width: 33 }, // reducido para extender nombre
                    ];
                    tableLeft = 30;
                    tableWidth = cols.reduce(function (s, c) { return s + c.width; }, 0);
                    drawTableHeader = function (y) {
                        doc.rect(tableLeft, y, tableWidth, 24).fill(AZUL_MED);
                        doc.rect(tableLeft, y + 24, tableWidth, 2).fill(NAR_MED);
                        var x = tableLeft;
                        doc.fontSize(8).font('Helvetica-Bold').fillColor(BLANCO);
                        cols.forEach(function (col) {
                            doc.text(col.label, x + 4, y + 7, { width: col.width - 8, align: 'center' });
                            x += col.width;
                        });
                        return y + 30;
                    };
                    drawWatermark();
                    y = drawPageHeader();
                    y = drawTableHeader(y);
                    doc.font('Helvetica').fontSize(7.5);
                    estadoPdf = {
                        ACTIVO: '#DCFCE7', EN_MORA: '#FECACA', VENCIDO: '#FFE4E6',
                        CANCELADO: '#E0E7FF', CASTIGADO: '#ECEFF1',
                    };
                    filas.forEach(function (fila, i) {
                        var _a, _b;
                        var maxRowHeight = 17;
                        var vals = [
                            fila.numeroPrestamo || '',
                            fila.cliente || '',
                            ((_a = fila.estado) === null || _a === void 0 ? void 0 : _a.replace(/_/g, ' ')) || '',
                            fmtCOP(fila.montoTotal || 0),
                            fmtCOP(fila.montoPendiente || 0),
                            fmtCOP(fila.interesRecogido || 0),
                            fmtCOP(fila.mora || 0),
                            fmtCOP(fila.recaudo || 0),
                            fmtCOP(fila.totalAdeudado || 0),
                            "".concat(fila.progreso || 0, "%"),
                        ];
                        doc.font('Helvetica').fontSize(7.5);
                        vals.forEach(function (val, ci) {
                            if (ci === 1 || ci === 3 || ci === 8)
                                doc.font('Helvetica-Bold');
                            var h = doc.heightOfString(val, { width: cols[ci].width - 8, lineBreak: true });
                            if (h + 8 > maxRowHeight)
                                maxRowHeight = h + 8;
                            doc.font('Helvetica');
                        });
                        if (y + maxRowHeight > doc.page.height - 70) {
                            drawFooter();
                            pageNumber++;
                            doc.addPage();
                            drawWatermark();
                            y = drawPageHeader();
                            y = drawTableHeader(y);
                            doc.font('Helvetica').fontSize(7.5);
                        }
                        var baseBg = i % 2 === 0 ? BLANCO : AZUL_PALE;
                        var bg = estadoPdf[((_b = fila.estado) === null || _b === void 0 ? void 0 : _b.toUpperCase()) || ''] || baseBg;
                        doc.rect(tableLeft, y, tableWidth, maxRowHeight).fill(bg);
                        doc.moveTo(tableLeft, y + maxRowHeight)
                            .lineTo(tableLeft + tableWidth, y + maxRowHeight)
                            .strokeColor(GRIS_CLR).lineWidth(0.4).stroke();
                        var x = tableLeft;
                        vals.forEach(function (v, ci) {
                            var align = ci >= 3 && ci <= 8 ? 'right' : (ci === 9 || ci === 2 ? 'center' : 'left');
                            if (ci === 8) {
                                doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
                            }
                            else if (ci === 1) {
                                doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
                            }
                            else if (ci >= 3 && ci <= 7) {
                                doc.font('Helvetica').fillColor(GRIS_TXT);
                            }
                            else if (ci === 2) {
                                doc.font('Helvetica-Bold').fillColor(GRIS_TXT);
                            }
                            else {
                                doc.font('Helvetica').fillColor(GRIS_TXT);
                            }
                            doc.text(v, x + 4, y + 4, { width: cols[ci].width - 8, align: align, lineBreak: true });
                            x += cols[ci].width;
                        });
                        y += maxRowHeight;
                    });
                    // Totales
                    y += 8;
                    doc.rect(tableLeft, y, tableWidth, 26).fill(AZUL_DARK);
                    doc.rect(tableLeft, y, tableWidth, 2).fill(NAR_MED);
                    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BLANCO);
                    doc.text("TOTAL GENERAL  /  ".concat(totales.totalRegistros, " cr\u00E9ditos"), tableLeft + 6, y + 8, { width: cols.slice(0, 3).reduce(function (s, c) { return s + c.width; }, 0) - 10 });
                    tx = tableLeft + cols.slice(0, 3).reduce(function (s, c) { return s + c.width; }, 0);
                    [
                        totales.montoTotal,
                        totales.montoPendiente,
                        totales.interesRecogido,
                        totales.mora,
                        totales.recaudo,
                        totales.totalAdeudado,
                    ].forEach(function (val, i) {
                        var ci = i + 3; // a partir de la columna 4
                        if (ci < cols.length) {
                            doc.fillColor(val > 0 && ci === 8 ? NAR_SOFT : BLANCO).font('Helvetica-Bold').fontSize(8);
                            doc.text(fmtCOP(val), tx + 4, y + 9, { width: cols[ci].width - 8, align: 'right' });
                            tx += cols[ci].width;
                        }
                    });
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
                    buffer = _a.sent();
                    return [2 /*return*/, {
                            data: buffer,
                            contentType: 'application/pdf',
                            filename: "listado-creditos-".concat(fecha, ".pdf"),
                        }];
            }
        });
    });
}
