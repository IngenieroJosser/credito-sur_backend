"use strict";
/**
 * ============================================================================
 * TEMPLATE: REPORTE FINANCIERO
 * ============================================================================
 * Usado en: reports.service.ts → exportFinancialReport()
 * Endpoint: GET /reports/financial/export?format=excel|pdf
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
exports.generarExcelFinanciero = generarExcelFinanciero;
exports.generarPDFFinanciero = generarPDFFinanciero;
var ExcelJS = require("exceljs");
var PDFDocument = require("pdfkit");
var fs = require("fs");
var path = require("path");
// ─── Generador Excel ──────────────────────────────────────────────────────────
function generarExcelFinanciero(resumen, evolucionMensual, distribucionGastos, fecha, startDate, endDate) {
    return __awaiter(this, void 0, void 0, function () {
        var workbook, totalGastos, periodoStr, ws1, t1, s1, h1, items, ws2, t2, h2, ws3, t3, h3, buffer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    workbook = new ExcelJS.Workbook();
                    workbook.creator = 'Créditos del Sur';
                    workbook.created = new Date();
                    totalGastos = distribucionGastos.reduce(function (s, g) { return s + g.monto; }, 0);
                    periodoStr = startDate && endDate
                        ? "".concat(startDate.toLocaleDateString('es-CO'), " \u2014 ").concat(endDate.toLocaleDateString('es-CO'))
                        : 'Período no definido';
                    ws1 = workbook.addWorksheet('Resumen Financiero', {
                        views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
                        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
                        properties: { tabColor: { argb: 'FF059669' } }
                    });
                    ws1.columns = [
                        { header: 'Concepto', key: 'concepto', width: 28 },
                        { header: 'Monto', key: 'monto', width: 22 },
                        { header: 'Detalle', key: 'detalle', width: 25 },
                    ];
                    t1 = ws1.addRow(['CRÉDITOS DEL SUR — REPORTE FINANCIERO']);
                    t1.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
                    t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
                    ws1.mergeCells('A1:C1');
                    ws1.getRow(1).height = 32;
                    ws1.getRow(2).height = 22;
                    s1 = ws1.addRow(["Per\u00EDodo: ".concat(periodoStr)]);
                    s1.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
                    ws1.mergeCells('A2:C2');
                    ws1.addRow([]);
                    h1 = ws1.getRow(4);
                    ws1.autoFilter = { from: 'A4', to: 'C4' };
                    ws1.columns.forEach(function (col, i) {
                        var cell = h1.getCell(i + 1);
                        cell.value = col.header;
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    });
                    h1.height = 22;
                    items = [
                        { concepto: 'Ingresos Totales', monto: resumen.ingresos, detalle: 'Pagos recibidos en el período' },
                        { concepto: 'Egresos Totales', monto: resumen.egresos, detalle: 'Gastos aprobados en el período' },
                        { concepto: 'Utilidad Neta', monto: resumen.utilidad, detalle: 'Ingresos − Egresos' },
                        { concepto: 'Margen de Ganancia (%)', monto: resumen.margen, detalle: '(Utilidad / Ingresos) × 100' },
                    ];
                    items.forEach(function (item, idx) {
                        var row = ws1.addRow({ concepto: item.concepto, monto: item.monto, detalle: item.detalle });
                        if (idx % 2 === 1) {
                            row.eachCell(function (cell) {
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
                            });
                        }
                        var montoCell = row.getCell(2);
                        if (item.concepto.includes('%')) {
                            montoCell.numFmt = '0.00"%"';
                        }
                        else {
                            montoCell.numFmt = '#,##0';
                        }
                        // Utilidad negativa en rojo
                        if (item.concepto === 'Utilidad Neta' && resumen.utilidad < 0) {
                            montoCell.font = { bold: true, color: { argb: 'FFDC2626' } };
                        }
                    });
                    ws2 = workbook.addWorksheet('Evolución Mensual', {
                        views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
                        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
                        properties: { tabColor: { argb: 'FF047857' } }
                    });
                    ws2.columns = [
                        { header: 'Mes', key: 'mes', width: 18 },
                        { header: 'Ingresos', key: 'ingresos', width: 18 },
                        { header: 'Egresos', key: 'egresos', width: 18 },
                        { header: 'Utilidad', key: 'utilidad', width: 18 },
                    ];
                    t2 = ws2.addRow(['Evolución Mensual']);
                    t2.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
                    t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
                    ws2.mergeCells('A1:D1');
                    ws2.getRow(1).height = 28;
                    ws2.addRow([]);
                    h2 = ws2.getRow(3);
                    ws2.autoFilter = { from: 'A3', to: 'D3' };
                    ws2.columns.forEach(function (col, i) {
                        var cell = h2.getCell(i + 1);
                        cell.value = col.header;
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
                        cell.alignment = { horizontal: 'center' };
                    });
                    h2.height = 20;
                    evolucionMensual.forEach(function (m, idx) {
                        var row = ws2.addRow({ mes: m.mes, ingresos: m.ingresos, egresos: m.egresos, utilidad: m.utilidad });
                        if (idx % 2 === 1) {
                            row.eachCell(function (cell) {
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
                            });
                        }
                        ['ingresos', 'egresos', 'utilidad'].forEach(function (key) {
                            var colIdx = ws2.columns.findIndex(function (c) { return c.key === key; }) + 1;
                            if (colIdx > 0)
                                row.getCell(colIdx).numFmt = '#,##0';
                        });
                    });
                    ws3 = workbook.addWorksheet('Distribución Gastos', {
                        views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
                        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
                        properties: { tabColor: { argb: 'FF10b981' } }
                    });
                    ws3.columns = [
                        { header: 'Categoría', key: 'categoria', width: 28 },
                        { header: 'Monto', key: 'monto', width: 18 },
                        { header: 'Porcentaje', key: 'porcentaje', width: 16 },
                    ];
                    t3 = ws3.addRow(['Distribución de Gastos']);
                    t3.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
                    t3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
                    ws3.mergeCells('A1:C1');
                    ws3.getRow(1).height = 28;
                    ws3.addRow([]);
                    h3 = ws3.getRow(3);
                    ws3.autoFilter = { from: 'A3', to: 'C3' };
                    ws3.columns.forEach(function (col, i) {
                        var cell = h3.getCell(i + 1);
                        cell.value = col.header;
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
                        cell.alignment = { horizontal: 'center' };
                    });
                    distribucionGastos.forEach(function (g, idx) {
                        var pct = totalGastos > 0 ? ((g.monto / totalGastos) * 100).toFixed(1) : '0.0';
                        var row = ws3.addRow({ categoria: g.categoria, monto: g.monto, porcentaje: "".concat(pct, "%") });
                        if (idx % 2 === 1) {
                            row.eachCell(function (cell) {
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
                            });
                        }
                        row.getCell(2).numFmt = '#,##0';
                    });
                    return [4 /*yield*/, workbook.xlsx.writeBuffer()];
                case 1:
                    buffer = _a.sent();
                    return [2 /*return*/, {
                            data: Buffer.from(buffer),
                            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            filename: "reporte-financiero-".concat(fecha, ".xlsx"),
                        }];
            }
        });
    });
}
// ─── Generador PDF ────────────────────────────────────────────────────────────
function generarPDFFinanciero(resumen, evolucionMensual, distribucionGastos, fecha) {
    return __awaiter(this, void 0, void 0, function () {
        var doc, buffers, BLANCO, GRIS_CLR, GRIS_MED, GRIS_TXT, AZUL_DARK, AZUL_MED, AZUL_PALE, NAR_DARK, NAR_MED, NAR_SOFT, VERDE_DARK, VERDE_PALE, ROJO_DARK, fmtCOP, getLogoPath, drawWatermark, pageNumber, drawPageHeader, drawFooter, y, mCols, tableLeft, tableWidth, drawMTableHeader, gCols_1, drawGTableHeader_1, totalGastos_1, buffer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    doc = new PDFDocument({ layout: 'portrait', size: 'LETTER', margin: 40 });
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
                    VERDE_DARK = '#059669';
                    VERDE_PALE = '#F0FDF4';
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
                        doc.fontSize(22).font('Helvetica-Bold').fillColor(AZUL_DARK)
                            .text('Créditos del Sur', 40, 30);
                        doc.fontSize(9).font('Helvetica').fillColor(VERDE_DARK)
                            .text('REPORTE FINANCIERO', 40, 57, { characterSpacing: 0.5 });
                        doc.roundedRect(W - 180, 25, 140, 44, 5).fillAndStroke(BLANCO, GRIS_CLR);
                        doc.fontSize(8).font('Helvetica-Bold').fillColor(GRIS_MED)
                            .text('FECHA GENERACIÓN', W - 180, 33, { width: 140, align: 'center' });
                        doc.fontSize(10).font('Helvetica-Bold').fillColor(AZUL_DARK)
                            .text(new Date().toLocaleDateString('es-CO'), W - 180, 45, { width: 140, align: 'center' });
                        var kW = (W - 80 - 12) / 4;
                        var kY = 100;
                        [
                            { label: 'INGRESOS TOTALES', val: fmtCOP(resumen.ingresos), bg: VERDE_PALE, color: VERDE_DARK },
                            { label: 'EGRESOS TOTALES', val: fmtCOP(resumen.egresos), bg: '#FEF2F2', color: ROJO_DARK },
                            { label: 'UTILIDAD NETA', val: fmtCOP(resumen.utilidad), bg: resumen.utilidad >= 0 ? VERDE_PALE : '#FEF2F2', color: resumen.utilidad >= 0 ? VERDE_DARK : ROJO_DARK },
                            { label: 'MARGEN DE GANANCIA', val: "".concat(resumen.margen, "%"), bg: '#F0F4F8', color: AZUL_DARK },
                        ].forEach(function (m, i) {
                            var mx = 40 + i * (kW + 4);
                            doc.roundedRect(mx, kY, kW, 44, 6).fillAndStroke(m.bg, GRIS_CLR);
                            doc.fontSize(6.5).font('Helvetica-Bold').fillColor(GRIS_MED)
                                .text(m.label, mx, kY + 10, { width: kW, align: 'center' });
                            doc.fontSize(10).font('Helvetica-Bold').fillColor(m.color)
                                .text(m.val, mx, kY + 23, { width: kW, align: 'center' });
                        });
                        return kY + 65;
                    };
                    drawFooter = function () {
                        var W = doc.page.width;
                        var H = doc.page.height;
                        doc.fontSize(7).font('Helvetica').fillColor(GRIS_MED);
                        doc.text("P\u00E1g. ".concat(pageNumber, "  \u2022  Generado: ").concat(new Date().toLocaleString('es-CO')), 0, H - 25, { align: 'right', width: W - 40 });
                    };
                    drawWatermark();
                    y = drawPageHeader();
                    // ── Sección: Evolución Mensual ──
                    doc.fontSize(12).font('Helvetica-Bold').fillColor(AZUL_DARK).text('Evolución Mensual', 40, y);
                    y += 18;
                    mCols = [
                        { label: 'Mes', width: 140 },
                        { label: 'Ingresos', width: 130 },
                        { label: 'Egresos', width: 130 },
                        { label: 'Utilidad', width: 132 },
                    ];
                    tableLeft = 40;
                    tableWidth = mCols.reduce(function (s, c) { return s + c.width; }, 0);
                    drawMTableHeader = function (cy) {
                        doc.rect(tableLeft, cy, tableWidth, 24).fill(AZUL_MED);
                        doc.rect(tableLeft, cy + 24, tableWidth, 2).fill(VERDE_DARK);
                        var x = tableLeft;
                        doc.fontSize(8).font('Helvetica-Bold').fillColor(BLANCO);
                        mCols.forEach(function (col) {
                            doc.text(col.label, x + 4, cy + 7, { width: col.width - 8, align: 'center' });
                            x += col.width;
                        });
                        return cy + 30;
                    };
                    y = drawMTableHeader(y);
                    evolucionMensual.forEach(function (m, i) {
                        var maxRowHeight = 17;
                        var vals = [
                            m.mes || '',
                            fmtCOP(m.ingresos || 0),
                            fmtCOP(m.egresos || 0),
                            fmtCOP(m.utilidad || 0),
                        ];
                        doc.font('Helvetica').fontSize(8);
                        vals.forEach(function (val, ci) {
                            if (ci === 0 || ci === 3)
                                doc.font('Helvetica-Bold');
                            var h = doc.heightOfString(val, { width: mCols[ci].width - 8, lineBreak: true });
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
                            y = drawMTableHeader(y);
                        }
                        var baseBg = i % 2 === 0 ? BLANCO : AZUL_PALE;
                        doc.rect(tableLeft, y, tableWidth, maxRowHeight).fill(baseBg);
                        doc.moveTo(tableLeft, y + maxRowHeight)
                            .lineTo(tableLeft + tableWidth, y + maxRowHeight)
                            .strokeColor(GRIS_CLR).lineWidth(0.4).stroke();
                        var x = tableLeft;
                        vals.forEach(function (v, ci) {
                            var align = ci >= 1 ? 'right' : 'center';
                            if (ci === 3) {
                                doc.font('Helvetica-Bold').fillColor(m.utilidad >= 0 ? VERDE_DARK : ROJO_DARK);
                            }
                            else if (ci === 0) {
                                doc.font('Helvetica-Bold').fillColor(GRIS_TXT);
                            }
                            else {
                                doc.font('Helvetica').fillColor(GRIS_TXT);
                            }
                            doc.text(v, x + 4, y + 4, { width: mCols[ci].width - 8, align: align, lineBreak: true });
                            x += mCols[ci].width;
                        });
                        y += maxRowHeight;
                    });
                    // ── Sección: Distribución de Gastos ──
                    if (distribucionGastos.length > 0) {
                        y += 20;
                        if (y > doc.page.height - 100) {
                            drawFooter();
                            pageNumber++;
                            doc.addPage();
                            drawWatermark();
                            y = drawPageHeader();
                        }
                        doc.fontSize(12).font('Helvetica-Bold').fillColor(AZUL_DARK).text('Distribución de Gastos', 40, y);
                        y += 18;
                        gCols_1 = [
                            { label: 'Categoría', width: 260 },
                            { label: 'Monto', width: 140 },
                            { label: 'Porcentaje', width: 132 },
                        ];
                        tableWidth = gCols_1.reduce(function (s, c) { return s + c.width; }, 0);
                        drawGTableHeader_1 = function (cy) {
                            doc.rect(tableLeft, cy, tableWidth, 24).fill(AZUL_MED);
                            doc.rect(tableLeft, cy + 24, tableWidth, 2).fill(NAR_MED);
                            var x = tableLeft;
                            doc.fontSize(8).font('Helvetica-Bold').fillColor(BLANCO);
                            gCols_1.forEach(function (col) {
                                doc.text(col.label, x + 4, cy + 7, { width: col.width - 8, align: 'center' });
                                x += col.width;
                            });
                            return cy + 30;
                        };
                        y = drawGTableHeader_1(y);
                        totalGastos_1 = distribucionGastos.reduce(function (s, g) { return s + g.monto; }, 0);
                        distribucionGastos.forEach(function (g, i) {
                            var pctStr = totalGastos_1 > 0 ? ((g.monto / totalGastos_1) * 100).toFixed(1) + '%' : '0.0%';
                            var maxRowHeight = 17;
                            var vals = [
                                g.categoria || '',
                                fmtCOP(g.monto || 0),
                                pctStr,
                            ];
                            doc.font('Helvetica').fontSize(8);
                            vals.forEach(function (val, ci) {
                                if (ci === 0 || ci === 1)
                                    doc.font('Helvetica-Bold');
                                var h = doc.heightOfString(val, { width: gCols_1[ci].width - 8, lineBreak: true });
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
                                y = drawGTableHeader_1(y);
                            }
                            var baseBg = i % 2 === 0 ? BLANCO : AZUL_PALE;
                            doc.rect(tableLeft, y, tableWidth, maxRowHeight).fill(baseBg);
                            doc.moveTo(tableLeft, y + maxRowHeight)
                                .lineTo(tableLeft + tableWidth, y + maxRowHeight)
                                .strokeColor(GRIS_CLR).lineWidth(0.4).stroke();
                            var x = tableLeft;
                            vals.forEach(function (v, ci) {
                                var align = ci === 0 ? 'left' : (ci === 1 ? 'right' : 'center');
                                if (ci === 0) {
                                    doc.font('Helvetica-Bold').fillColor(GRIS_TXT);
                                }
                                else if (ci === 1) {
                                    doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
                                }
                                else {
                                    doc.font('Helvetica').fillColor(GRIS_TXT);
                                }
                                doc.text(v, x + 4, y + 4, { width: gCols_1[ci].width - 8, align: align, lineBreak: true });
                                x += gCols_1[ci].width;
                            });
                            y += maxRowHeight;
                        });
                        // Fila total gastos
                        y += 8;
                        doc.rect(tableLeft, y, tableWidth, 26).fill(AZUL_DARK);
                        doc.rect(tableLeft, y, tableWidth, 2).fill(NAR_MED);
                        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BLANCO);
                        doc.text("TOTAL GASTOS", tableLeft + 6, y + 8, { width: gCols_1[0].width - 10 });
                        doc.fillColor(NAR_SOFT).font('Helvetica-Bold').fontSize(8);
                        doc.text(fmtCOP(totalGastos_1), tableLeft + gCols_1[0].width + 4, y + 9, { width: gCols_1[1].width - 8, align: 'right' });
                        doc.fillColor(BLANCO).text('100.0%', tableLeft + gCols_1[0].width + gCols_1[1].width + 4, y + 9, { width: gCols_1[2].width - 8, align: 'center' });
                        y += 38;
                    }
                    if (y > doc.page.height - 60) {
                        drawFooter();
                        pageNumber++;
                        doc.addPage();
                        drawWatermark();
                        y = drawPageHeader();
                    }
                    doc.fontSize(7.5).font('Helvetica-Oblique').fillColor(GRIS_MED)
                        .text('Documento expedido por Créditos del Sur. Las cifras presentadas son definitivas y sujetas a revisión de auditoría.', 40, y, { align: 'center', width: doc.page.width - 80 });
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
                            filename: "reporte-financiero-".concat(fecha, ".pdf"),
                        }];
            }
        });
    });
}
