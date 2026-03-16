"use strict";
/**
 * ============================================================================
 * TEMPLATE: REPORTE OPERATIVO
 * ============================================================================
 * Usado en: reports.service.ts → exportOperationalReport()
 * Endpoint: POST /reports/operational/export?format=excel|pdf
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
exports.generarExcelOperativo = generarExcelOperativo;
exports.generarPDFOperativo = generarPDFOperativo;
var ExcelJS = require("exceljs");
var PDFDocument = require("pdfkit");
var fs = require("fs");
var path = require("path");
// ─── Generador Excel ──────────────────────────────────────────────────────────
function generarExcelOperativo(filas, resumen, fecha) {
    return __awaiter(this, void 0, void 0, function () {
        var workbook, ws, titleRow, periodoStr, subRow, headerRow, colsMoneda, totalRow, ws2, h2, buffer;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    workbook = new ExcelJS.Workbook();
                    workbook.creator = 'Créditos del Sur';
                    workbook.created = new Date();
                    ws = workbook.addWorksheet('Rendimiento por Ruta', {
                        views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
                        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
                        properties: { tabColor: { argb: 'FFEA580C' } }
                    });
                    ws.columns = [
                        { header: 'Ruta', key: 'ruta', width: 22 },
                        { header: 'Cobrador', key: 'cobrador', width: 22 },
                        { header: 'Meta', key: 'meta', width: 16 },
                        { header: 'Recaudado', key: 'recaudado', width: 16 },
                        { header: 'Eficiencia %', key: 'eficiencia', width: 14 },
                        { header: 'Préstamos Nuevos', key: 'nuevosPrestamos', width: 17 },
                        { header: 'Clientes Nuevos', key: 'nuevosClientes', width: 16 },
                        { header: 'Monto Nuevos', key: 'montoNuevosPrestamos', width: 18 },
                    ];
                    titleRow = ws.addRow(['CRÉDITOS DEL SUR — REPORTE OPERATIVO']);
                    titleRow.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
                    titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEA580C' } };
                    ws.mergeCells('A1:H1');
                    ws.getRow(1).height = 32;
                    ws.getRow(2).height = 22;
                    periodoStr = resumen.fechaInicio && resumen.fechaFin
                        ? "Per\u00EDodo: ".concat(new Date(resumen.fechaInicio).toLocaleDateString('es-CO'), " \u2014 ").concat(new Date(resumen.fechaFin).toLocaleDateString('es-CO'))
                        : "Per\u00EDodo: ".concat(((_a = resumen.periodo) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'N/A');
                    subRow = ws.addRow(["".concat(periodoStr, "   |   Generado: ").concat(new Date().toLocaleString('es-CO'))]);
                    subRow.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
                    ws.mergeCells('A2:H2');
                    ws.addRow([]);
                    headerRow = ws.getRow(4);
                    ws.columns.forEach(function (col, i) {
                        var cell = headerRow.getCell(i + 1);
                        cell.value = col.header;
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEA580C' } };
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    });
                    headerRow.height = 22;
                    ws.autoFilter = { from: 'A4', to: 'H4' };
                    colsMoneda = ['meta', 'recaudado', 'montoNuevosPrestamos'];
                    filas.forEach(function (fila, idx) {
                        var row = ws.addRow({
                            ruta: fila.ruta,
                            cobrador: fila.cobrador,
                            meta: fila.meta,
                            recaudado: fila.recaudado,
                            eficiencia: fila.eficiencia,
                            nuevosPrestamos: fila.nuevosPrestamos,
                            nuevosClientes: fila.nuevosClientes,
                            montoNuevosPrestamos: fila.montoNuevosPrestamos || 0,
                        });
                        if (idx % 2 === 1) {
                            row.eachCell(function (cell) {
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
                            });
                        }
                        colsMoneda.forEach(function (key) {
                            var colIdx = ws.columns.findIndex(function (c) { return c.key === key; }) + 1;
                            if (colIdx > 0)
                                row.getCell(colIdx).numFmt = '#,##0';
                        });
                        // Color rojo si eficiencia < 70%
                        var eficienciaIdx = ws.columns.findIndex(function (c) { return c.key === 'eficiencia'; }) + 1;
                        if (eficienciaIdx > 0 && fila.eficiencia < 70) {
                            row.getCell(eficienciaIdx).font = { color: { argb: 'FFDC2626' }, bold: true };
                        }
                    });
                    ws.addRow([]);
                    totalRow = ws.addRow({
                        ruta: 'TOTALES',
                        meta: resumen.totalMeta,
                        recaudado: resumen.totalRecaudo,
                        eficiencia: resumen.porcentajeGlobal,
                        nuevosPrestamos: resumen.totalPrestamosNuevos,
                        nuevosClientes: resumen.totalAfiliaciones,
                    });
                    ws.mergeCells("A".concat(totalRow.number, ":B").concat(totalRow.number));
                    totalRow.height = 24;
                    totalRow.eachCell({ includeEmpty: true }, function (cell) {
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                        cell.border = {
                            top: { style: 'medium', color: { argb: 'FFFFFFFF' } },
                            right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                        };
                    });
                    totalRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
                    colsMoneda.forEach(function (key) {
                        var colIdx = ws.columns.findIndex(function (c) { return c.key === key; }) + 1;
                        if (colIdx > 0)
                            totalRow.getCell(colIdx).numFmt = '#,##0';
                    });
                    ws2 = workbook.addWorksheet('Resumen General', {
                        views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
                        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
                        properties: { tabColor: { argb: 'FF0f172a' } },
                    });
                    ws2.columns = [
                        { header: 'Indicador', key: 'indicador', width: 30 },
                        { header: 'Valor', key: 'valor', width: 22 },
                    ];
                    h2 = ws2.getRow(1);
                    ws2.columns.forEach(function (col, i) {
                        var cell = h2.getCell(i + 1);
                        cell.value = col.header;
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEA580C' } };
                        cell.alignment = { horizontal: 'center' };
                    });
                    [
                        { indicador: 'Total Recaudado', valor: resumen.totalRecaudo },
                        { indicador: 'Meta Total', valor: resumen.totalMeta },
                        { indicador: 'Eficiencia Global (%)', valor: resumen.porcentajeGlobal },
                        { indicador: 'Préstamos Nuevos', valor: resumen.totalPrestamosNuevos },
                        { indicador: 'Clientes Nuevos', valor: resumen.totalAfiliaciones },
                        { indicador: 'Efectividad Promedio Rutas (%)', valor: resumen.efectividadPromedio },
                    ].forEach(function (item) {
                        var row = ws2.addRow({ indicador: item.indicador, valor: item.valor });
                        if (item.indicador.includes('$') || item.indicador.toLowerCase().includes('recaudado') || item.indicador.toLowerCase().includes('meta')) {
                            row.getCell(2).numFmt = '#,##0';
                        }
                    });
                    return [4 /*yield*/, workbook.xlsx.writeBuffer()];
                case 1:
                    buffer = _b.sent();
                    return [2 /*return*/, {
                            data: Buffer.from(buffer),
                            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            filename: "reporte-operativo-".concat(resumen.periodo, "-").concat(fecha, ".xlsx"),
                        }];
            }
        });
    });
}
// ─── Generador PDF ────────────────────────────────────────────────────────────
function generarPDFOperativo(filas, resumen, fecha) {
    return __awaiter(this, void 0, void 0, function () {
        var doc, buffers, BLANCO, GRIS_CLR, GRIS_MED, GRIS_TXT, AZUL_DARK, AZUL_MED, AZUL_PALE, NAR_DARK, NAR_MED, NAR_SOFT, fmtCOP, getLogoPath, drawWatermark, pageNumber, drawPageHeader, drawFooter, cols, tableLeft, tableWidth, drawTableHeader, y, tx, buffer;
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
                        var _a;
                        var W = doc.page.width;
                        doc.fontSize(22).font('Helvetica-Bold').fillColor(AZUL_DARK)
                            .text('Créditos del Sur', 30, 25);
                        doc.fontSize(9).font('Helvetica').fillColor(NAR_MED)
                            .text('REPORTE OPERATIVO & RENDIMIENTO', 30, 52, { characterSpacing: 0.5 });
                        doc.roundedRect(W - 180, 20, 148, 44, 5).fillAndStroke(BLANCO, GRIS_CLR);
                        doc.fontSize(8).font('Helvetica-Bold').fillColor(GRIS_MED)
                            .text('PERÍODO', W - 180, 28, { width: 148, align: 'center' });
                        var pStr = resumen.fechaInicio && resumen.fechaFin
                            ? "".concat(new Date(resumen.fechaInicio).toLocaleDateString('es-CO'), " - ").concat(new Date(resumen.fechaFin).toLocaleDateString('es-CO'))
                            : ((_a = resumen.periodo) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'N/A';
                        doc.fontSize(10).font('Helvetica-Bold').fillColor(AZUL_DARK)
                            .text(pStr, W - 180, 40, { width: 148, align: 'center' });
                        var kW = (doc.page.width - 60) / 4;
                        var kY = 98;
                        [
                            { label: 'META TOTAL', val: fmtCOP(resumen.totalMeta), bg: '#D6E9F5', color: AZUL_DARK },
                            { label: 'RECAUDO TOTAL', val: fmtCOP(resumen.totalRecaudo), bg: NAR_SOFT, color: NAR_DARK },
                            { label: 'EFICIENCIA', val: "".concat(resumen.porcentajeGlobal, "%"), bg: '#F0F4F8', color: GRIS_TXT },
                            { label: 'PRÉSTAMOS NUEVOS', val: String(resumen.totalPrestamosNuevos), bg: '#F0F4F8', color: GRIS_TXT },
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
                    cols = [
                        { label: 'Ruta', width: 130 },
                        { label: 'Cobrador', width: 156 },
                        { label: 'Meta', width: 85 },
                        { label: 'Recaudado', width: 85 },
                        { label: 'Eficiencia', width: 66 },
                        { label: 'Préstamos', width: 65 },
                        { label: 'Clientes', width: 60 },
                        { label: 'Monto Nuevos', width: 85 },
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
                    filas.forEach(function (fila, i) {
                        var maxRowHeight = 17;
                        var vals = [
                            fila.ruta || '',
                            fila.cobrador || '',
                            fmtCOP(fila.meta || 0),
                            fmtCOP(fila.recaudado || 0),
                            "".concat(fila.eficiencia || 0, "%"),
                            String(fila.nuevosPrestamos || 0),
                            String(fila.nuevosClientes || 0),
                            fmtCOP(fila.montoNuevosPrestamos || 0),
                        ];
                        doc.font('Helvetica').fontSize(7.5);
                        vals.forEach(function (val, ci) {
                            if (ci === 0 || ci === 1 || ci === 3)
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
                        var bg = fila.eficiencia < 70 ? '#FEF2F2' : baseBg; // Rojo muy claro si eficiencia baja
                        doc.rect(tableLeft, y, tableWidth, maxRowHeight).fill(bg);
                        doc.moveTo(tableLeft, y + maxRowHeight)
                            .lineTo(tableLeft + tableWidth, y + maxRowHeight)
                            .strokeColor(GRIS_CLR).lineWidth(0.4).stroke();
                        var x = tableLeft;
                        vals.forEach(function (v, ci) {
                            var align = ci >= 2 && ci <= 7 && ci !== 4 && ci !== 5 && ci !== 6 ? 'right' : (ci >= 4 && ci <= 6 ? 'center' : 'left');
                            if (ci === 3) {
                                doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
                            }
                            else if (ci === 4 && fila.eficiencia < 70) {
                                doc.font('Helvetica-Bold').fillColor('#DC2626');
                            }
                            else if (ci === 1) {
                                doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
                            }
                            else if (ci === 0) {
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
                    doc.text("TOTAL GENERAL", tableLeft + 6, y + 8, { width: cols.slice(0, 2).reduce(function (s, c) { return s + c.width; }, 0) - 10 });
                    tx = tableLeft + cols.slice(0, 2).reduce(function (s, c) { return s + c.width; }, 0);
                    [
                        "$".concat(resumen.totalMeta.toLocaleString('es-CO')),
                        "$".concat(resumen.totalRecaudo.toLocaleString('es-CO')),
                        "".concat(resumen.porcentajeGlobal, "%"),
                        String(resumen.totalPrestamosNuevos),
                        String(resumen.totalAfiliaciones),
                        "$".concat((filas.reduce(function (acc, f) { return acc + (f.montoNuevosPrestamos || 0); }, 0)).toLocaleString('es-CO')),
                    ].forEach(function (val, i) {
                        var ci = i + 2; // a partir de la columna 2
                        if (ci < cols.length) {
                            doc.fillColor(i === 1 ? NAR_SOFT : BLANCO).font('Helvetica-Bold').fontSize(8);
                            var align = ci === 4 || ci === 5 || ci === 6 ? 'center' : 'right';
                            doc.text(val, tx + 4, y + 9, { width: cols[ci].width - 8, align: align });
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
                            filename: "reporte-operativo-".concat(resumen.periodo, "-").concat(fecha, ".pdf"),
                        }];
            }
        });
    });
}
