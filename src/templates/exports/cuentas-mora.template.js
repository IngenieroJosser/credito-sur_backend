"use strict";
/**
 * ============================================================================
 * TEMPLATE: CUENTAS EN MORA
 * ============================================================================
 * Usado en: reports.service.ts → generarReporteMora()
 * Genera reportes Excel y PDF de préstamos en estado de mora.
 * Formato Excel inspirado en el modelo de Estado de Cuentas Diarias.
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
exports.generarExcelMora = generarExcelMora;
exports.generarPDFMora = generarPDFMora;
var ExcelJS = require("exceljs");
var PDFDocument = require("pdfkit");
var fs = require("fs");
var path = require("path");
// ─── Paleta corporativa ────────────────────────────────────────────────────────
var COLOR = {
    rojo: 'FFDC2626',
    rojoClaro: 'FFFEF2F2',
    rojoBorde: 'FFEF4444',
    gris: 'FF1E293B',
    grisClaro: 'FFF8FAFC',
    grisTexto: 'FF475569',
    blanco: 'FFFFFFFF',
    amarillo: 'FFFEF08A',
    naranjaClaro: 'FFFFF7ED',
};
// ─── Utilidades Excel ─────────────────────────────────────────────────────────
function estiloEncabezado(cell, bgArgb) {
    cell.font = { bold: true, color: { argb: COLOR.blanco }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
    cell.border = {
        top: { style: 'thin', color: { argb: bgArgb } },
        bottom: { style: 'medium', color: { argb: COLOR.blanco } },
        left: { style: 'thin', color: { argb: COLOR.blanco } },
        right: { style: 'thin', color: { argb: COLOR.blanco } },
    };
}
function estiloFila(cell, par) {
    if (par) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.grisClaro } };
    }
    cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
        right: { style: 'hair', color: { argb: 'FFE2E8F0' } },
    };
    cell.alignment = { vertical: 'middle' };
}
// ─── Generador Excel ──────────────────────────────────────────────────────────
function generarExcelMora(filas, totales, fecha) {
    return __awaiter(this, void 0, void 0, function () {
        var workbook, ws, moraLastCol, tituloCell, subCell, moraKpis, headers, hRow, totRow, wsResumen, rT, rhRow, porNivel, nivelColors, buffer;
        var _a, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    workbook = new ExcelJS.Workbook();
                    workbook.creator = 'Créditos del Sur';
                    workbook.created = new Date();
                    workbook.properties.date1904 = false;
                    ws = workbook.addWorksheet('Cuentas en Mora', {
                        views: [{ state: 'frozen', ySplit: 5, showGridLines: false }],
                        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
                        properties: { tabColor: { argb: 'FFDC2626' } },
                    });
                    ws.columns = [
                        { key: 'num', width: 18 },
                        { key: 'cliente', width: 30 },
                        { key: 'documento', width: 14 },
                        { key: 'diasMora', width: 11 },
                        { key: 'capitalPend', width: 16 },
                        { key: 'interesesPend', width: 16 },
                        { key: 'montoMora', width: 16 },
                        { key: 'deudaTotal', width: 18 },
                        { key: 'cuotas', width: 13 },
                        { key: 'tasaMora', width: 13 },
                        { key: 'intEspecial', width: 16 },
                        { key: 'ruta', width: 20 },
                        { key: 'cobrador', width: 24 },
                        { key: 'riesgo', width: 13 },
                        { key: 'ultimoPago', width: 14 },
                        { key: 'comentario', width: 28 },
                    ];
                    moraLastCol = 'P';
                    // Fila 1: Encabezado institucional
                    ws.mergeCells("A1:".concat(moraLastCol, "1"));
                    tituloCell = ws.getCell('A1');
                    tituloCell.value = 'CRÉDITOS DEL SUR';
                    tituloCell.font = { bold: true, size: 18, color: { argb: COLOR.blanco } };
                    tituloCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.rojo } };
                    tituloCell.alignment = { horizontal: 'center', vertical: 'middle' };
                    ws.getRow(1).height = 32;
                    // Fila 2: Subtítulo del reporte
                    ws.mergeCells("A2:".concat(moraLastCol, "2"));
                    subCell = ws.getCell('A2');
                    subCell.value = 'REPORTE DE CARTERA EN MORA';
                    subCell.font = { bold: true, size: 12, color: { argb: COLOR.rojo } };
                    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0F0' } };
                    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
                    ws.getRow(2).height = 22;
                    // Fila 3: Metadatos
                    ws.mergeCells('A3:D3');
                    ws.getCell('A3').value = "Fecha de Generaci\u00F3n: ".concat(new Date().toLocaleString('es-CO'));
                    ws.getCell('A3').font = { size: 9, color: { argb: COLOR.grisTexto } };
                    ws.mergeCells('E3:H3');
                    ws.getCell('E3').value = "Casos Cr\u00EDticos: ".concat(totales.totalCasosCriticos, "  |  Int. Especial: ").concat((_a = totales.totalCasosInteresEspecial) !== null && _a !== void 0 ? _a : 0, " casos");
                    ws.getCell('E3').font = { bold: true, size: 9, color: { argb: COLOR.rojo } };
                    ws.getCell('E3').alignment = { horizontal: 'center' };
                    ws.mergeCells('I3:P3');
                    ws.getCell('I3').value = "Total Registros: ".concat(totales.totalRegistros);
                    ws.getCell('I3').font = { size: 9, color: { argb: COLOR.grisTexto } };
                    ws.getCell('I3').alignment = { horizontal: 'right' };
                    ws.getRow(3).height = 16;
                    // Fila 4-5: Resumen financiero en celdas (KPIs)
                    ws.getRow(4).height = 16;
                    ws.getRow(5).height = 26;
                    moraKpis = [
                        { label: 'Mora Acumulada', val: totales.totalMora, bg: COLOR.rojoClaro, color: COLOR.rojo },
                        { label: 'Deuda Total', val: totales.totalDeuda, bg: COLOR.grisClaro, color: COLOR.grisTexto },
                        { label: 'Capital Pendiente', val: (_b = totales.totalCapitalPendiente) !== null && _b !== void 0 ? _b : 0, bg: COLOR.grisClaro, color: COLOR.grisTexto },
                        { label: 'Interés Pendiente', val: (_c = totales.totalInteresesPendientes) !== null && _c !== void 0 ? _c : 0, bg: COLOR.naranjaClaro, color: 'FFB45309' },
                        { label: 'Casos Críticos', val: totales.totalCasosCriticos, bg: COLOR.rojoClaro, color: COLOR.rojo },
                        { label: 'Int. Especial', val: (_d = totales.totalCasosInteresEspecial) !== null && _d !== void 0 ? _d : 0, bg: COLOR.amarillo, color: 'FFB45309' },
                    ];
                    moraKpis.forEach(function (kpi, i) {
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
                        vc.numFmt = i < 4 ? '"$"#,##0' : '0';
                        vc.font = { bold: true, size: 14, color: { argb: kpi.color } };
                        vc.alignment = { horizontal: 'center', vertical: 'middle' };
                        vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bg } };
                    });
                    headers = [
                        'N° Préstamo', 'Cliente', 'Documento', 'Días Mora',
                        'Capital Pend.', 'Interés Pend.', 'Monto Mora', 'Deuda Total',
                        'Cuotas Venc.', 'Tasa Mora %', 'Int. Especial',
                        'Ruta', 'Cobrador', 'Nivel Riesgo', 'Ultimo Pago', 'Comentario',
                    ];
                    hRow = ws.getRow(5);
                    headers.forEach(function (h, i) {
                        var cell = hRow.getCell(i + 1);
                        cell.value = h;
                        estiloEncabezado(cell, COLOR.rojo);
                    });
                    hRow.height = 22;
                    ws.autoFilter = { from: 'A5', to: "".concat(moraLastCol, "5") };
                    // Datos
                    filas.forEach(function (fila, idx) {
                        var _a, _b, _c, _d;
                        var row = ws.addRow([
                            fila.numeroPrestamo,
                            fila.cliente,
                            fila.documento,
                            fila.diasMora,
                            (_a = fila.capitalPendiente) !== null && _a !== void 0 ? _a : 0,
                            (_b = fila.interesesPendientes) !== null && _b !== void 0 ? _b : 0,
                            fila.montoMora,
                            fila.montoTotalDeuda,
                            fila.cuotasVencidas,
                            fila.tasaMoraAplicada != null ? "".concat(fila.tasaMoraAplicada, "%") : '-',
                            (_c = fila.interesEspecial) !== null && _c !== void 0 ? _c : 0,
                            fila.ruta,
                            fila.cobrador,
                            fila.nivelRiesgo,
                            fila.ultimoPago || 'Sin pagos',
                            fila.comentario || '',
                        ]);
                        row.height = 18;
                        var esPar = idx % 2 === 0;
                        row.eachCell(function (cell) { return estiloFila(cell, esPar); });
                        // Formato moneda
                        [5, 6, 7, 8, 11].forEach(function (c) {
                            row.getCell(c).numFmt = '"$"#,##0';
                            row.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
                        });
                        // Centrar números
                        [4, 9].forEach(function (c) { return row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }; });
                        // Resaltar interés especial aprobado en naranja
                        if (fila.interesEspecialAprobado) {
                            row.getCell(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                            row.getCell(11).font = { bold: true, color: { argb: 'FFB45309' } };
                        }
                        // Resaltar casos críticos
                        var riesgo = ((_d = fila.nivelRiesgo) === null || _d === void 0 ? void 0 : _d.toUpperCase()) || '';
                        if (riesgo === 'ROJO' || riesgo === 'LISTA_NEGRA') {
                            row.getCell(2).font = { bold: true, color: { argb: COLOR.rojo }, size: 10 };
                            row.getCell(14).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
                        }
                    });
                    // Fila de totales
                    ws.addRow([]);
                    totRow = ws.addRow([
                        "TOTALES \u2014 ".concat(totales.totalRegistros, " pr\u00E9stamos en mora"),
                        '', '', '',
                        (_e = totales.totalCapitalPendiente) !== null && _e !== void 0 ? _e : 0,
                        (_f = totales.totalInteresesPendientes) !== null && _f !== void 0 ? _f : 0,
                        totales.totalMora,
                        totales.totalDeuda,
                        '', '', '', '', '', '', '', '',
                    ]);
                    totRow.height = 24;
                    ws.mergeCells("A".concat(totRow.number, ":D").concat(totRow.number));
                    totRow.eachCell(function (cell, colNumber) {
                        cell.font = { bold: true, color: { argb: COLOR.blanco }, size: 10 };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.gris } };
                        cell.border = {
                            top: { style: 'medium', color: { argb: COLOR.blanco } },
                            right: { style: 'thin', color: { argb: COLOR.blanco } },
                        };
                        if (colNumber === 1)
                            cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    });
                    [5, 6, 7, 8].forEach(function (c) {
                        totRow.getCell(c).numFmt = '"$"#,##0';
                        totRow.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
                    });
                    wsResumen = workbook.addWorksheet('Resumen por Riesgo', {
                        views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
                        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
                        properties: { tabColor: { argb: 'FFEF4444' } },
                    });
                    wsResumen.columns = [
                        { key: 'nivel', width: 22 },
                        { key: 'casos', width: 12 },
                        { key: 'mora', width: 20 },
                        { key: 'deuda', width: 20 },
                    ];
                    wsResumen.mergeCells('A1:D1');
                    rT = wsResumen.getCell('A1');
                    rT.value = 'CRÉDITOS DEL SUR — Resumen por Nivel de Riesgo';
                    rT.font = { bold: true, size: 14, color: { argb: COLOR.blanco } };
                    rT.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.rojo } };
                    rT.alignment = { horizontal: 'center', vertical: 'middle' };
                    wsResumen.getRow(1).height = 28;
                    wsResumen.addRow([]);
                    rhRow = wsResumen.getRow(3);
                    ['Nivel de Riesgo', 'Casos', 'Mora Acumulada', 'Deuda Total'].forEach(function (h, i) {
                        var cell = rhRow.getCell(i + 1);
                        cell.value = h;
                        estiloEncabezado(cell, COLOR.rojo);
                    });
                    rhRow.height = 20;
                    porNivel = {};
                    filas.forEach(function (f) {
                        var n = f.nivelRiesgo || 'Sin clasificar';
                        if (!porNivel[n])
                            porNivel[n] = { casos: 0, mora: 0, deuda: 0 };
                        porNivel[n].casos++;
                        porNivel[n].mora += f.montoMora || 0;
                        porNivel[n].deuda += f.montoTotalDeuda || 0;
                    });
                    nivelColors = {
                        ROJO: 'FFFECACA', AMARILLO: 'FFFEF9C3', VERDE: 'FFDCFCE7', LISTA_NEGRA: 'FFFFE4E6',
                    };
                    Object.entries(porNivel).forEach(function (_a, idx) {
                        var nivel = _a[0], datos = _a[1];
                        var row = wsResumen.addRow([nivel, datos.casos, datos.mora, datos.deuda]);
                        row.height = 18;
                        var bg = nivelColors[nivel.toUpperCase()] || (idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF');
                        row.eachCell(function (cell) {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                            cell.alignment = { vertical: 'middle' };
                        });
                        row.getCell(3).numFmt = '"$"#,##0';
                        row.getCell(4).numFmt = '"$"#,##0';
                    });
                    return [4 /*yield*/, workbook.xlsx.writeBuffer()];
                case 1:
                    buffer = _g.sent();
                    return [2 /*return*/, {
                            data: Buffer.from(buffer),
                            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            filename: "cuentas-mora-".concat(fecha, ".xlsx"),
                        }];
            }
        });
    });
}
// ─── Generador PDF ────────────────────────────────────────────────────────────
function generarPDFMora(filas, totales, fecha) {
    return __awaiter(this, void 0, void 0, function () {
        var doc, buffers, BLANCO, GRIS_CLR, GRIS_MED, GRIS_TXT, AZUL_DARK, AZUL_MED, AZUL_PALE, NAR_DARK, NAR_MED, NAR_SOFT, ROJO_DARK, ROJO_PALE, fmtCOP, getLogoPath, drawWatermark, pageNumber, drawPageHeader, drawFooter, cols, tableLeft, tableWidth, drawTableHeader, y, tx, buffer;
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
                    ROJO_DARK = '#B91C1C';
                    ROJO_PALE = '#FEF2F2';
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
                        var _a;
                        var W = doc.page.width;
                        doc.fontSize(22).font('Helvetica-Bold').fillColor(AZUL_DARK)
                            .text('Créditos del Sur', 30, 25);
                        doc.fontSize(9).font('Helvetica').fillColor(ROJO_DARK) // Mora uses red subtitle
                            .text('REPORTE DE CARTERA EN MORA', 30, 52, { characterSpacing: 0.5 });
                        doc.roundedRect(W - 180, 20, 148, 44, 5).fillAndStroke(BLANCO, GRIS_CLR);
                        doc.fontSize(8).font('Helvetica-Bold').fillColor(GRIS_MED)
                            .text('FECHA', W - 180, 28, { width: 148, align: 'center' });
                        doc.fontSize(11).font('Helvetica-Bold').fillColor(AZUL_DARK)
                            .text(fecha, W - 180, 40, { width: 148, align: 'center' });
                        var kW = (doc.page.width - 60) / 4;
                        var kY = 98;
                        [
                            { label: 'MORA ACUMULADA', val: totales.totalMora, bg: ROJO_PALE, color: ROJO_DARK, isNum: true },
                            { label: 'DEUDA TOTAL', val: totales.totalDeuda, bg: '#F0F4F8', color: GRIS_TXT, isNum: true },
                            { label: 'CASOS CRÍTICOS', val: totales.totalCasosCriticos, bg: ROJO_PALE, color: ROJO_DARK, isNum: false },
                            { label: 'INT. ESPECIAL', val: ((_a = totales.totalCasosInteresEspecial) !== null && _a !== void 0 ? _a : 0) + ' casos', bg: NAR_SOFT, color: NAR_DARK, isNum: false },
                        ].forEach(function (m, i) {
                            var mx = 30 + i * (kW + 4);
                            doc.roundedRect(mx, kY, kW, 44, 6).fillAndStroke(m.bg, GRIS_CLR);
                            doc.fontSize(7.5).font('Helvetica-Bold').fillColor(GRIS_MED)
                                .text(m.label, mx, kY + 10, { width: kW, align: 'center' });
                            doc.fontSize(13).font('Helvetica-Bold').fillColor(m.color)
                                .text(m.isNum ? fmtCOP(m.val) : String(m.val), mx, kY + 23, { width: kW, align: 'center' });
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
                        { label: 'Cliente', width: 140 },
                        { label: 'Días Mora', width: 55 },
                        { label: 'Monto Mora', width: 78 },
                        { label: 'Deuda Total', width: 78 },
                        { label: 'Cuotas', width: 48 },
                        { label: 'Ruta', width: 80 },
                        { label: 'Cobrador', width: 110 },
                        { label: 'Riesgo', width: 65 },
                    ];
                    tableLeft = 30;
                    tableWidth = cols.reduce(function (s, c) { return s + c.width; }, 0);
                    drawTableHeader = function (y) {
                        doc.rect(tableLeft, y, tableWidth, 24).fill(AZUL_MED);
                        doc.rect(tableLeft, y + 24, tableWidth, 2).fill(ROJO_DARK); // Red line instead of orange
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
                    filas.forEach(function (fila, i) {
                        var _a;
                        var maxRowHeight = 17;
                        var vals = [
                            fila.numeroPrestamo || '',
                            fila.cliente || '',
                            String(fila.diasMora || 0),
                            fmtCOP(fila.montoMora || 0),
                            fmtCOP(fila.montoTotalDeuda || 0),
                            String(fila.cuotasVencidas || 0),
                            fila.ruta || '',
                            fila.cobrador || '',
                            fila.nivelRiesgo || '',
                        ];
                        doc.font('Helvetica').fontSize(7.5);
                        vals.forEach(function (val, ci) {
                            if (ci === 1 || ci === 3 || ci === 4)
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
                        var riesgo = ((_a = fila.nivelRiesgo) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || '';
                        var baseBg = i % 2 === 0 ? BLANCO : AZUL_PALE;
                        var bg = (riesgo === 'ROJO' || riesgo === 'LISTA_NEGRA') ? ROJO_PALE : baseBg;
                        doc.rect(tableLeft, y, tableWidth, maxRowHeight).fill(bg);
                        doc.moveTo(tableLeft, y + maxRowHeight)
                            .lineTo(tableLeft + tableWidth, y + maxRowHeight)
                            .strokeColor(GRIS_CLR).lineWidth(0.4).stroke();
                        var x = tableLeft;
                        vals.forEach(function (v, ci) {
                            var align = ci >= 2 && ci <= 5 ? 'right' : (ci === 8 ? 'center' : 'left');
                            if (ci === 3) {
                                doc.font('Helvetica-Bold').fillColor(ROJO_DARK);
                            }
                            else if (ci === 4) {
                                doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
                            }
                            else if (ci === 1) {
                                doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
                            }
                            else if (ci === 8) {
                                doc.font('Helvetica-Bold').fillColor((riesgo === 'ROJO' || riesgo === 'LISTA_NEGRA') ? ROJO_DARK : GRIS_TXT);
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
                    doc.rect(tableLeft, y, tableWidth, 2).fill(ROJO_DARK); // Red bottom line on headers
                    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BLANCO);
                    doc.text("TOTAL GENERAL  /  ".concat(totales.totalRegistros, " pr\u00E9stamos en mora"), tableLeft + 6, y + 8, { width: cols.slice(0, 3).reduce(function (s, c) { return s + c.width; }, 0) - 10 });
                    tx = tableLeft + cols.slice(0, 3).reduce(function (s, c) { return s + c.width; }, 0);
                    [
                        "$".concat(totales.totalMora.toLocaleString('es-CO')),
                        "$".concat(totales.totalDeuda.toLocaleString('es-CO')),
                    ].forEach(function (val, i) {
                        var ci = i + 3; // a partir de la columna 4
                        if (ci < cols.length) {
                            doc.fillColor(i === 0 ? '#FECACA' : BLANCO).font('Helvetica-Bold').fontSize(8);
                            doc.text(val, tx + 4, y + 9, { width: cols[ci].width - 8, align: 'right' });
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
                            filename: "cuentas-mora-".concat(fecha, ".pdf"),
                        }];
            }
        });
    });
}
