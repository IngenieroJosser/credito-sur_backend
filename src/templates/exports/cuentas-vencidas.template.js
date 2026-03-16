"use strict";
/**
 * ============================================================================
 * TEMPLATE: CUENTAS VENCIDAS
 * ============================================================================
 * Usado en: reports.service.ts → exportarCuentasVencidas()
 * Genera reporte de préstamos con fecha de vencimiento superada.
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
exports.generarExcelVencidas = generarExcelVencidas;
exports.generarPDFVencidas = generarPDFVencidas;
var ExcelJS = require("exceljs");
var PDFDocument = require("pdfkit");
var fs = require("fs");
var path = require("path");
// ─── Utilidad: estilo de celda de encabezado ──────────────────────────────────
function appHeader(cell, bg) {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
        bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
        right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
    };
}
function appRow(cell, par) {
    if (par)
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
        right: { style: 'hair', color: { argb: 'FFE2E8F0' } },
    };
    cell.alignment = { vertical: 'middle' };
}
// ─── Generador Excel ──────────────────────────────────────────────────────────
function generarExcelVencidas(filas, totales, fecha) {
    return __awaiter(this, void 0, void 0, function () {
        var workbook, ws, t1, t2, kpis, headers, hRow, riesgoColor, totRow, buffer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    workbook = new ExcelJS.Workbook();
                    workbook.creator = 'Créditos del Sur';
                    workbook.created = new Date();
                    ws = workbook.addWorksheet('Cuentas Vencidas', {
                        views: [{ state: 'frozen', ySplit: 5, showGridLines: false }],
                        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
                        properties: { tabColor: { argb: 'FF7C3AED' } },
                    });
                    ws.columns = [
                        { key: 'num', width: 18 },
                        { key: 'cliente', width: 30 },
                        { key: 'documento', width: 13 },
                        { key: 'fechaVenc', width: 14 },
                        { key: 'dias', width: 11 },
                        { key: 'saldo', width: 16 },
                        { key: 'original', width: 16 },
                        { key: 'intereses', width: 16 },
                        { key: 'riesgo', width: 13 },
                        { key: 'ruta', width: 20 },
                        { key: 'estado', width: 14 },
                    ];
                    // Fila 1: Encabezado institucional
                    ws.mergeCells('A1:K1');
                    t1 = ws.getCell('A1');
                    t1.value = 'CRÉDITOS DEL SUR';
                    t1.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
                    t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
                    t1.alignment = { horizontal: 'center', vertical: 'middle' };
                    ws.getRow(1).height = 32;
                    // Fila 2: Nombre del reporte
                    ws.mergeCells('A2:K2');
                    t2 = ws.getCell('A2');
                    t2.value = 'REPORTE DE CUENTAS VENCIDAS';
                    t2.font = { bold: true, size: 12, color: { argb: 'FF7C3AED' } };
                    t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
                    t2.alignment = { horizontal: 'center', vertical: 'middle' };
                    ws.getRow(2).height = 22;
                    // Fila 3: Fecha y metadata
                    ws.mergeCells('A3:E3');
                    ws.getCell('A3').value = "Generado: ".concat(new Date().toLocaleString('es-CO'));
                    ws.getCell('A3').font = { size: 9, color: { argb: 'FF475569' } };
                    ws.mergeCells('F3:K3');
                    ws.getCell('F3').value = "Total registros: ".concat(totales.totalRegistros, "  |  Fecha: ").concat(fecha);
                    ws.getCell('F3').font = { size: 9, color: { argb: 'FF475569' } };
                    ws.getCell('F3').alignment = { horizontal: 'right' };
                    ws.getRow(3).height = 16;
                    // Fila 4-5: Indicadores financieros en celdas (KPIs)
                    ws.getRow(4).height = 16;
                    ws.getRow(5).height = 26;
                    kpis = [
                        { label: 'Saldo Vencido Total', val: totales.totalVencido, bg: 'FFF5F3FF', color: 'FF7C3AED' },
                        { label: 'Monto Original', val: totales.totalMontoOriginal, bg: 'FFF8FAFC', color: 'FF475569' },
                        { label: 'Intereses de Mora', val: totales.totalInteresesMora, bg: 'FFF8FAFC', color: 'FF475569' },
                        { label: 'Promedio Días Venc.', val: totales.diasPromedioVencimiento, bg: 'FFF5F3FF', color: 'FF7C3AED' },
                    ];
                    kpis.forEach(function (kpi, i) {
                        var sc = i * 2 + 1;
                        var ec = i * 2 + 2;
                        var scL = String.fromCharCode(64 + sc);
                        var ecL = String.fromCharCode(64 + ec);
                        // Label Row (Row 4)
                        ws.mergeCells("".concat(scL, "4:").concat(ecL, "4"));
                        var lc = ws.getCell("".concat(scL, "4"));
                        lc.value = kpi.label;
                        lc.font = { bold: true, size: 8, color: { argb: 'FF64748B' } };
                        lc.alignment = { horizontal: 'center', vertical: 'middle' };
                        lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bg } };
                        // Value Row (Row 5)
                        ws.mergeCells("".concat(scL, "5:").concat(ecL, "5"));
                        var vc = ws.getCell("".concat(scL, "5"));
                        vc.value = kpi.val;
                        vc.numFmt = i < 3 ? '"$"#,##0' : '0';
                        vc.font = { bold: true, size: 14, color: { argb: kpi.color } };
                        vc.alignment = { horizontal: 'center', vertical: 'middle' };
                        vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bg } };
                    });
                    headers = ['N° Préstamo', 'Cliente', 'Documento', 'Fecha Vencim.', 'Días Vencidos',
                        'Saldo Pendiente', 'Monto Original', 'Intereses Mora', 'Nivel Riesgo', 'Ruta', 'Estado'];
                    hRow = ws.getRow(5);
                    headers.forEach(function (h, i) {
                        var cell = hRow.getCell(i + 1);
                        cell.value = h;
                        appHeader(cell, 'FF7C3AED');
                    });
                    hRow.height = 22;
                    ws.autoFilter = { from: 'A5', to: 'K5' };
                    riesgoColor = {
                        ROJO: 'FFFECACA', AMARILLO: 'FFFEF9C3',
                        LISTA_NEGRA: 'FFFFE4E6', VERDE: 'FFDCFCE7',
                    };
                    filas.forEach(function (fila, idx) {
                        var _a, _b;
                        var row = ws.addRow([
                            fila.numeroPrestamo,
                            fila.cliente,
                            fila.documento,
                            fila.fechaVencimiento,
                            fila.diasVencidos,
                            fila.saldoPendiente,
                            fila.montoOriginal,
                            fila.interesesMora,
                            fila.nivelRiesgo,
                            fila.ruta,
                            ((_a = fila.estado) === null || _a === void 0 ? void 0 : _a.replace(/_/g, ' ')) || '',
                        ]);
                        row.height = 18;
                        var esPar = idx % 2 === 0;
                        row.eachCell(function (cell) { return appRow(cell, esPar); });
                        // Formatos moneda
                        row.getCell(6).numFmt = '"$"#,##0';
                        row.getCell(7).numFmt = '"$"#,##0';
                        row.getCell(8).numFmt = '"$"#,##0';
                        // Alineación centrada para números
                        [5, 9].forEach(function (c) { return row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }; });
                        [4].forEach(function (c) { return row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }; });
                        // Color por nivel de riesgo
                        var bg = riesgoColor[((_b = fila.nivelRiesgo) === null || _b === void 0 ? void 0 : _b.toUpperCase()) || ''];
                        if (bg) {
                            row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                        }
                        // Resaltar días vencidos altos
                        if (fila.diasVencidos > 90) {
                            row.getCell(5).font = { bold: true, color: { argb: 'FFDC2626' } };
                        }
                    });
                    // Fila total
                    ws.addRow([]);
                    totRow = ws.addRow([
                        "TOTALES \u2014 ".concat(totales.totalRegistros, " cuentas vencidas"),
                        '', '', '',
                        "".concat(totales.diasPromedioVencimiento, " d\u00EDas prom."),
                        totales.totalVencido,
                        totales.totalMontoOriginal,
                        totales.totalInteresesMora,
                        '', '', '',
                    ]);
                    totRow.height = 24;
                    ws.mergeCells("A".concat(totRow.number, ":D").concat(totRow.number));
                    totRow.eachCell(function (cell, colNumber) {
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1B4B' } };
                        cell.border = {
                            top: { style: 'medium', color: { argb: 'FFFFFFFF' } },
                            right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                        };
                        if (colNumber === 1)
                            cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    });
                    totRow.getCell(6).numFmt = '"$"#,##0';
                    totRow.getCell(7).numFmt = '"$"#,##0';
                    totRow.getCell(8).numFmt = '"$"#,##0';
                    return [4 /*yield*/, workbook.xlsx.writeBuffer()];
                case 1:
                    buffer = _a.sent();
                    return [2 /*return*/, {
                            data: Buffer.from(buffer),
                            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            filename: "cuentas-vencidas-".concat(fecha, ".xlsx"),
                        }];
            }
        });
    });
}
// ─── Generador PDF ────────────────────────────────────────────────────────────
function generarPDFVencidas(filas, totales, fecha) {
    return __awaiter(this, void 0, void 0, function () {
        var doc, buffers, BLANCO, GRIS_CLR, GRIS_MED, GRIS_TXT, PURPLE, PURPLE_MED, PURPLE_DARK, PURPLE_PALE, ROJO_DARK, fmtCOP, getLogoPath, drawWatermark, pageNumber, drawPageHeader, drawFooter, realCols, tableLeft, tableWidth, drawTableHeader, y, tx, buffer;
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
                    PURPLE = '#7C3AED';
                    PURPLE_MED = '#8B5CF6';
                    PURPLE_DARK = '#5B21B6';
                    PURPLE_PALE = '#F5F3FF';
                    ROJO_DARK = '#DC2626';
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
                        doc.fontSize(22).font('Helvetica-Bold').fillColor(PURPLE_DARK)
                            .text('Créditos del Sur', 30, 25);
                        doc.fontSize(9).font('Helvetica').fillColor(PURPLE)
                            .text('REPORTE DE CUENTAS VENCIDAS', 30, 52, { characterSpacing: 0.5 });
                        doc.roundedRect(W - 180, 20, 148, 44, 5).fillAndStroke(BLANCO, GRIS_CLR);
                        doc.fontSize(8).font('Helvetica-Bold').fillColor(GRIS_MED)
                            .text('FECHA GENERACIÓN', W - 180, 28, { width: 148, align: 'center' });
                        doc.fontSize(10).font('Helvetica-Bold').fillColor(PURPLE_DARK)
                            .text(new Date().toLocaleDateString('es-CO'), W - 180, 40, { width: 148, align: 'center' });
                        var kW = (doc.page.width - 60) / 4;
                        var kY = 98;
                        [
                            { label: 'SALDO VENCIDO TOTAL', val: fmtCOP(totales.totalVencido), bg: PURPLE_PALE, color: PURPLE_DARK, isNum: true },
                            { label: 'MONTO ORIGINAL', val: fmtCOP(totales.totalMontoOriginal), bg: '#F0F4F8', color: GRIS_TXT, isNum: true },
                            { label: 'INTERESES MORA', val: fmtCOP(totales.totalInteresesMora), bg: '#FEF2F2', color: ROJO_DARK, isNum: true },
                            { label: 'PROMEDIO DÍAS VENC.', val: String(totales.diasPromedioVencimiento), bg: '#F0F4F8', color: GRIS_TXT, isNum: false },
                        ].forEach(function (m, i) {
                            var mx = 30 + i * (kW + 4);
                            doc.roundedRect(mx, kY, kW, 44, 6).fillAndStroke(m.bg, GRIS_CLR);
                            doc.fontSize(7.5).font('Helvetica-Bold').fillColor(GRIS_MED)
                                .text(m.label, mx, kY + 10, { width: kW, align: 'center' });
                            doc.fontSize(13).font('Helvetica-Bold').fillColor(m.color)
                                .text(m.val, mx, kY + 23, { width: kW, align: 'center' });
                        });
                        return kY + 58;
                    };
                    drawFooter = function () {
                        var W = doc.page.width;
                        var H = doc.page.height;
                        doc.fontSize(7).font('Helvetica').fillColor(GRIS_MED);
                        doc.text("P\u00E1g. ".concat(pageNumber, "  \u2022  Generado: ").concat(new Date().toLocaleString('es-CO')), 0, H - 25, { align: 'right', width: W - 30 });
                    };
                    realCols = [
                        { label: 'N° Préstamo', width: 78 },
                        { label: 'Cliente', width: 140 }, // Expanded width
                        { label: 'Fecha Venc.', width: 62 },
                        { label: 'Días Venc.', width: 55 },
                        { label: 'Saldo Pend.', width: 76 },
                        { label: 'Mto. Orig.', width: 76 },
                        { label: 'Int. Mora', width: 70 },
                        { label: 'Riesgo', width: 55 },
                        { label: 'Ruta', width: 80 },
                    ];
                    tableLeft = 30;
                    tableWidth = realCols.reduce(function (s, c) { return s + c.width; }, 0);
                    drawTableHeader = function (y) {
                        doc.rect(tableLeft, y, tableWidth, 24).fill(PURPLE_MED);
                        doc.rect(tableLeft, y + 24, tableWidth, 2).fill(PURPLE_DARK);
                        var x = tableLeft;
                        doc.fontSize(8).font('Helvetica-Bold').fillColor(BLANCO);
                        realCols.forEach(function (col) {
                            doc.text(col.label, x + 4, y + 7, { width: col.width - 8, align: 'center' });
                            x += col.width;
                        });
                        return y + 30;
                    };
                    drawWatermark();
                    y = drawPageHeader();
                    y = drawTableHeader(y);
                    doc.font('Helvetica').fontSize(7.5);
                    filas.forEach(function (fila, i) {
                        var _a;
                        var maxRowHeight = 17;
                        var vals = [
                            fila.numeroPrestamo || '',
                            fila.cliente || '',
                            fila.fechaVencimiento || '',
                            String(fila.diasVencidos || 0),
                            fmtCOP(fila.saldoPendiente || 0),
                            fmtCOP(fila.montoOriginal || 0),
                            fmtCOP(fila.interesesMora || 0),
                            fila.nivelRiesgo || '',
                            fila.ruta || '',
                        ];
                        doc.font('Helvetica').fontSize(7.5);
                        vals.forEach(function (val, ci) {
                            if (ci === 0 || ci === 1 || ci === 4 || ci === 6)
                                doc.font('Helvetica-Bold');
                            var h = doc.heightOfString(val, { width: realCols[ci].width - 8, lineBreak: true });
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
                        var riesgo = ((_a = fila.nivelRiesgo) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || '';
                        var baseBg = i % 2 === 0 ? BLANCO : PURPLE_PALE;
                        var bg = fila.diasVencidos > 90 ? '#FEF2F2' : baseBg; // Rojo claro si > 90 días
                        doc.rect(tableLeft, y, tableWidth, maxRowHeight).fill(bg);
                        doc.moveTo(tableLeft, y + maxRowHeight)
                            .lineTo(tableLeft + tableWidth, y + maxRowHeight)
                            .strokeColor(GRIS_CLR).lineWidth(0.4).stroke();
                        var x = tableLeft;
                        vals.forEach(function (v, ci) {
                            var align = (ci >= 4 && ci <= 6) ? 'right' : (ci === 3 || ci === 7 ? 'center' : 'left');
                            if (ci === 4) {
                                doc.font('Helvetica-Bold').fillColor(PURPLE_DARK);
                            }
                            else if (ci === 6) {
                                doc.font('Helvetica-Bold').fillColor(ROJO_DARK);
                            }
                            else if (ci === 3 && fila.diasVencidos > 90) {
                                doc.font('Helvetica-Bold').fillColor(ROJO_DARK);
                            }
                            else if (ci === 1) {
                                doc.font('Helvetica-Bold').fillColor(PURPLE_DARK);
                            }
                            else if (ci === 7) {
                                if (riesgo === 'ROJO' || riesgo === 'LISTA_NEGRA')
                                    doc.font('Helvetica-Bold').fillColor(ROJO_DARK);
                                else
                                    doc.font('Helvetica-Bold').fillColor(GRIS_TXT);
                            }
                            else {
                                doc.font('Helvetica').fillColor(GRIS_TXT);
                            }
                            doc.text(v, x + 4, y + 4, { width: realCols[ci].width - 8, align: align, lineBreak: true });
                            x += realCols[ci].width;
                        });
                        y += maxRowHeight;
                    });
                    // Totales
                    y += 8;
                    doc.rect(tableLeft, y, tableWidth, 26).fill('#1E1B4B');
                    doc.rect(tableLeft, y, tableWidth, 2).fill(PURPLE_MED);
                    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BLANCO);
                    doc.text("TOTAL GENERAL  /  ".concat(totales.totalRegistros, " vencidas"), tableLeft + 6, y + 8, { width: realCols.slice(0, 4).reduce(function (s, c) { return s + c.width; }, 0) - 10 });
                    tx = tableLeft + realCols.slice(0, 4).reduce(function (s, c) { return s + c.width; }, 0);
                    [
                        "$".concat(totales.totalVencido.toLocaleString('es-CO')),
                        "$".concat(totales.totalMontoOriginal.toLocaleString('es-CO')),
                        "$".concat(totales.totalInteresesMora.toLocaleString('es-CO')),
                    ].forEach(function (val, i) {
                        var ci = i + 4; // a partir de la columna 4
                        if (ci < realCols.length) {
                            doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(8);
                            doc.text(val, tx + 4, y + 9, { width: realCols[ci].width - 8, align: 'right' });
                            tx += realCols[ci].width;
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
                            filename: "cuentas-vencidas-".concat(fecha, ".pdf"),
                        }];
            }
        });
    });
}
