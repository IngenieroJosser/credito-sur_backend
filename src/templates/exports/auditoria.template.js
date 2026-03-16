"use strict";
/**
 * ============================================================================
 * TEMPLATE: LOG DE AUDITORÍA
 * ============================================================================
 * Usado en: audit.service.ts → exportAuditLog()
 * Endpoint: GET /audit/export?format=excel|pdf
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
exports.generarExcelAuditoria = generarExcelAuditoria;
exports.generarPDFAuditoria = generarPDFAuditoria;
var ExcelJS = require("exceljs");
var PDFDocument = require("pdfkit");
var fs = require("fs");
var path = require("path");
// ─── Generador Excel ──────────────────────────────────────────────────────────
function generarExcelAuditoria(filas, fecha) {
    return __awaiter(this, void 0, void 0, function () {
        var workbook, ws, titleRow, subRow, headerRow, totalRow, buffer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    workbook = new ExcelJS.Workbook();
                    workbook.creator = 'Créditos del Sur';
                    workbook.created = new Date();
                    ws = workbook.addWorksheet('Log de Auditoría', {
                        views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
                        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
                        properties: { tabColor: { argb: 'FF475569' } }
                    });
                    ws.columns = [
                        { header: 'Fecha', key: 'fecha', width: 22 },
                        { header: 'Usuario', key: 'usuario', width: 28 },
                        { header: 'Acción', key: 'accion', width: 24 },
                        { header: 'Entidad', key: 'entidad', width: 18 },
                        { header: 'ID Entidad', key: 'entidadId', width: 20 },
                        { header: 'Datos Anteriores', key: 'datosAnteriores', width: 40 },
                        { header: 'Datos Nuevos', key: 'datosNuevos', width: 40 },
                    ];
                    titleRow = ws.addRow(['CRÉDITOS DEL SUR — LOG DE AUDITORÍA']);
                    titleRow.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
                    titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
                    ws.mergeCells('A1:G1');
                    ws.getRow(1).height = 32;
                    ws.getRow(2).height = 22;
                    subRow = ws.addRow(["Generado: ".concat(new Date().toLocaleString('es-CO'), "   |   Total registros: ").concat(filas.length)]);
                    subRow.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
                    ws.mergeCells('A2:G2');
                    ws.addRow([]);
                    headerRow = ws.getRow(4);
                    ws.columns.forEach(function (col, i) {
                        var cell = headerRow.getCell(i + 1);
                        cell.value = col.header;
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    });
                    headerRow.height = 22;
                    ws.autoFilter = { from: 'A4', to: 'G4' };
                    // Datos
                    filas.forEach(function (fila, idx) {
                        var _a;
                        var row = ws.addRow({
                            fecha: fila.fecha ? new Date(fila.fecha).toLocaleString('es-CO') : '',
                            usuario: fila.usuario || '',
                            accion: ((_a = fila.accion) === null || _a === void 0 ? void 0 : _a.replace(/_/g, ' ')) || '',
                            entidad: fila.entidad || '',
                            entidadId: fila.entidadId || '',
                            datosAnteriores: fila.datosAnteriores
                                ? JSON.stringify(fila.datosAnteriores).substring(0, 150)
                                : '',
                            datosNuevos: fila.datosNuevos
                                ? JSON.stringify(fila.datosNuevos).substring(0, 150)
                                : '',
                        });
                        if (idx % 2 === 1) {
                            row.eachCell(function (cell) {
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                            });
                        }
                    });
                    ws.addRow([]);
                    totalRow = ws.addRow({ fecha: "Total registros: ".concat(filas.length) });
                    ws.mergeCells("A".concat(totalRow.number, ":G").concat(totalRow.number));
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
                    return [4 /*yield*/, workbook.xlsx.writeBuffer()];
                case 1:
                    buffer = _a.sent();
                    return [2 /*return*/, {
                            data: Buffer.from(buffer),
                            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            filename: "auditoria-".concat(fecha, ".xlsx"),
                        }];
            }
        });
    });
}
// ─── Generador PDF ────────────────────────────────────────────────────────────
function generarPDFAuditoria(filas, fecha) {
    return __awaiter(this, void 0, void 0, function () {
        var doc, buffers, BLANCO, GRIS_CLR, GRIS_MED, GRIS_TXT, SLATE_DARK, SLATE_MED, SLATE_PALE, AZUL_DARK, getLogoPath, drawWatermark, pageNumber, drawPageHeader, drawFooter, cols, tableLeft, tableWidth, drawTableHeader, y, buffer;
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
                    SLATE_DARK = '#1E293B';
                    SLATE_MED = '#475569';
                    SLATE_PALE = '#F1F5F9';
                    AZUL_DARK = '#1A5F8A';
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
                        doc.fontSize(22).font('Helvetica-Bold').fillColor(SLATE_DARK)
                            .text('Créditos del Sur', 30, 25);
                        doc.fontSize(9).font('Helvetica').fillColor(SLATE_MED)
                            .text('REPORTE DE AUDITORÍA DE SISTEMA', 30, 52, { characterSpacing: 0.5 });
                        doc.roundedRect(W - 180, 20, 148, 44, 5).fillAndStroke(BLANCO, GRIS_CLR);
                        doc.fontSize(8).font('Helvetica-Bold').fillColor(GRIS_MED)
                            .text('FECHA GENERACIÓN', W - 180, 28, { width: 148, align: 'center' });
                        doc.fontSize(10).font('Helvetica-Bold').fillColor(SLATE_DARK)
                            .text(new Date().toLocaleDateString('es-CO'), W - 180, 40, { width: 148, align: 'center' });
                        var kW = (doc.page.width - 60) / 3;
                        var kY = 98;
                        [
                            { label: 'TOTAL DE REGISTROS', val: String(filas.length), bg: SLATE_PALE, color: SLATE_DARK },
                            { label: 'SISTEMA BASE', val: 'Créditos del Sur V1.0', bg: '#F0F4F8', color: GRIS_TXT },
                            { label: 'NIVEL DE ACCESO', val: 'Administrador / Sistema', bg: '#F0F4F8', color: GRIS_TXT },
                        ].forEach(function (m, i) {
                            var mx = 30 + i * (kW + 4);
                            doc.roundedRect(mx, kY, kW, 44, 6).fillAndStroke(m.bg, GRIS_CLR);
                            doc.fontSize(7.5).font('Helvetica-Bold').fillColor(GRIS_MED)
                                .text(m.label, mx, kY + 10, { width: kW, align: 'center' });
                            doc.fontSize(11).font('Helvetica-Bold').fillColor(m.color)
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
                        { label: 'Fecha', width: 90 },
                        { label: 'Usuario', width: 110 },
                        { label: 'Acción', width: 120 },
                        { label: 'Entidad', width: 80 },
                        { label: 'ID Entidad', width: 100 },
                        { label: 'Detalle (Nuevos / Cambio)', width: 232 },
                    ];
                    tableLeft = 30;
                    tableWidth = cols.reduce(function (s, c) { return s + c.width; }, 0);
                    drawTableHeader = function (y) {
                        doc.rect(tableLeft, y, tableWidth, 24).fill(SLATE_MED);
                        doc.rect(tableLeft, y + 24, tableWidth, 2).fill(SLATE_DARK);
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
                        var limitStr = function (str, maxLen) {
                            if (!str)
                                return '';
                            if (str.length <= maxLen)
                                return str;
                            return str.substring(0, maxLen - 3) + '...';
                        };
                        // Audit logs can have HUGE JSON blobs. We need to limit them to avoid multi-page single rows, but we give them a generous 500 chars instead of hard 50.
                        var detalle = fila.datosNuevos
                            ? limitStr(JSON.stringify(fila.datosNuevos), 500)
                            : (fila.datosAnteriores ? limitStr(JSON.stringify(fila.datosAnteriores), 500) : '');
                        var vals = [
                            fila.fecha ? new Date(fila.fecha).toLocaleString('es-CO') : '',
                            fila.usuario || '',
                            ((_a = fila.accion) === null || _a === void 0 ? void 0 : _a.replace(/_/g, ' ')) || '',
                            fila.entidad || '',
                            fila.entidadId || '',
                            detalle,
                        ];
                        doc.font('Helvetica').fontSize(7.5);
                        vals.forEach(function (val, ci) {
                            if (ci === 0 || ci === 1)
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
                        var baseBg = i % 2 === 0 ? BLANCO : SLATE_PALE;
                        doc.rect(tableLeft, y, tableWidth, maxRowHeight).fill(baseBg);
                        doc.moveTo(tableLeft, y + maxRowHeight)
                            .lineTo(tableLeft + tableWidth, y + maxRowHeight)
                            .strokeColor(GRIS_CLR).lineWidth(0.4).stroke();
                        var x = tableLeft;
                        vals.forEach(function (v, ci) {
                            var align = 'left';
                            if (ci === 1) {
                                doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
                            }
                            else if (ci === 0) {
                                doc.font('Helvetica-Bold').fillColor(SLATE_DARK);
                            }
                            else if (ci === 2) {
                                doc.font('Helvetica-Bold').fillColor(SLATE_MED);
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
                    doc.rect(tableLeft, y, tableWidth, 26).fill(SLATE_DARK);
                    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BLANCO);
                    doc.text("TOTAL REGISTROS DE AUDITOR\u00CDA: ".concat(filas.length), tableLeft + 6, y + 9, { width: tableWidth - 10, align: 'center' });
                    y += 38;
                    doc.fontSize(7.5).font('Helvetica-Oblique').fillColor(GRIS_MED)
                        .text('Documento expedido por Créditos del Sur. Información de trazabilidad del sistema. Confidencial.', tableLeft, y, { align: 'center', width: tableWidth });
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
                            filename: "auditoria-".concat(fecha, ".pdf"),
                        }];
            }
        });
    });
}
