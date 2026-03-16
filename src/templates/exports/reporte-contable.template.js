"use strict";
/**
 * ============================================================================
 * TEMPLATE: REPORTE CONTABLE
 * ============================================================================
 * Usado en: accounting.service.ts → exportAccountingReport()
 * Endpoint: GET /accounting/export?format=excel|pdf
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
exports.generarExcelContable = generarExcelContable;
exports.generarPDFContable = generarPDFContable;
var ExcelJS = require("exceljs");
var PDFDocument = require("pdfkit");
var fs = require("fs");
var path = require("path");
// ─── Generador Excel ──────────────────────────────────────────────────────────
function generarExcelContable(cajas, transacciones, fecha) {
    return __awaiter(this, void 0, void 0, function () {
        var workbook, totalSaldo, ws1, t1, s1, h1, totalRow, ws2, t2, h2, buffer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    workbook = new ExcelJS.Workbook();
                    workbook.creator = 'Créditos del Sur';
                    workbook.created = new Date();
                    totalSaldo = cajas.reduce(function (s, c) { return s + c.saldo; }, 0);
                    ws1 = workbook.addWorksheet('Estado de Cajas', {
                        views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
                        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
                        properties: { tabColor: { argb: 'FF004F7B' } }
                    });
                    ws1.columns = [
                        { header: 'Caja', key: 'nombre', width: 20 },
                        { header: 'Código', key: 'codigo', width: 14 },
                        { header: 'Tipo Caja', key: 'tipoCaja', width: 16 },
                        { header: 'Tipo', key: 'tipo', width: 14 },
                        { header: 'Responsable', key: 'responsable', width: 26 },
                        { header: 'Ruta', key: 'ruta', width: 18 },
                        { header: 'Saldo Actual', key: 'saldo', width: 16 },
                        { header: 'Ingresos', key: 'ingresos', width: 16 },
                        { header: 'Egresos', key: 'egresos', width: 16 },
                        { header: 'Gastos Pend.', key: 'egresosPend', width: 16 },
                        { header: 'Base Asignada', key: 'baseAsignada', width: 16 },
                    ];
                    t1 = ws1.addRow(['CRÉDITOS DEL SUR — ESTADO DE CAJAS']);
                    t1.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
                    t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004F7B' } };
                    ws1.mergeCells('A1:K1');
                    s1 = ws1.addRow(["Generado: ".concat(new Date().toLocaleString('es-CO'), "   |   Total cajas: ").concat(cajas.length)]);
                    s1.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
                    ws1.mergeCells('A2:K2');
                    ws1.addRow([]);
                    ws1.getRow(1).height = 32;
                    ws1.getRow(2).height = 22;
                    h1 = ws1.getRow(4);
                    ws1.columns.forEach(function (col, i) {
                        var cell = h1.getCell(i + 1);
                        cell.value = col.header;
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004F7B' } };
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    });
                    h1.height = 22;
                    ws1.autoFilter = { from: 'A4', to: 'K4' };
                    cajas.forEach(function (caja, idx) {
                        var _a, _b, _c, _d, _e, _f;
                        var row = ws1.addRow({
                            nombre: caja.nombre,
                            codigo: caja.codigo,
                            tipoCaja: caja.tipoCaja || '-',
                            tipo: caja.tipo,
                            responsable: caja.responsable,
                            ruta: caja.ruta,
                            saldo: caja.saldo,
                            ingresos: (_a = caja.ingresosPeriodo) !== null && _a !== void 0 ? _a : 0,
                            egresos: (_b = caja.egresosPeriodo) !== null && _b !== void 0 ? _b : 0,
                            egresosPend: (_c = caja.egresosPendientes) !== null && _c !== void 0 ? _c : 0,
                            baseAsignada: (_d = caja.baseAsignada) !== null && _d !== void 0 ? _d : 0,
                        });
                        if (idx % 2 === 1) {
                            row.eachCell(function (cell) {
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
                            });
                        }
                        [7, 8, 9, 10, 11].forEach(function (c) {
                            row.getCell(c).numFmt = '"$"#,##0';
                            row.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
                        });
                        // Resaltar caja cobrador vs empresa
                        var tc = ((_e = caja.tipoCaja) === null || _e === void 0 ? void 0 : _e.toUpperCase()) || '';
                        if (tc === 'COBRADOR')
                            row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
                        else if (tc === 'PRINCIPAL')
                            row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
                        // Gastos pendientes en amarillo
                        if (((_f = caja.egresosPendientes) !== null && _f !== void 0 ? _f : 0) > 0) {
                            row.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
                            row.getCell(10).font = { bold: true, color: { argb: 'FF854D0E' } };
                        }
                    });
                    ws1.addRow([]);
                    totalRow = ws1.addRow({ nombre: 'TOTAL SALDOS', saldo: totalSaldo });
                    ws1.mergeCells("A".concat(totalRow.number, ":F").concat(totalRow.number));
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
                    totalRow.getCell(7).numFmt = '"$"#,##0';
                    ws2 = workbook.addWorksheet('Movimientos', {
                        views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
                        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
                        properties: { tabColor: { argb: 'FF0ea5e9' } }
                    });
                    ws2.columns = [
                        { header: 'Fecha', key: 'fecha', width: 20 },
                        { header: 'Tipo', key: 'tipo', width: 14 },
                        { header: 'Tipo Caja', key: 'tipoCaja', width: 14 },
                        { header: 'Monto', key: 'monto', width: 16 },
                        { header: 'Método Pago', key: 'metodoPago', width: 16 },
                        { header: 'Estado', key: 'estado', width: 14 },
                        { header: 'Descripción', key: 'descripcion', width: 36 },
                        { header: 'Caja', key: 'caja', width: 18 },
                        { header: 'Usuario', key: 'usuario', width: 22 },
                        { header: 'Aprobado Por', key: 'aprobadoPor', width: 20 },
                    ];
                    t2 = ws2.addRow(['Últimos Movimientos']);
                    t2.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
                    t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004F7B' } };
                    ws2.mergeCells('A1:J1');
                    ws2.getRow(1).height = 28;
                    ws2.addRow([]);
                    h2 = ws2.getRow(3);
                    ws2.columns.forEach(function (col, i) {
                        var cell = h2.getCell(i + 1);
                        cell.value = col.header;
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004F7B' } };
                        cell.alignment = { horizontal: 'center' };
                    });
                    h2.height = 20;
                    ws2.autoFilter = { from: 'A3', to: 'J3' };
                    transacciones.forEach(function (t, idx) {
                        var _a;
                        var row = ws2.addRow({
                            fecha: t.fecha ? new Date(t.fecha).toLocaleString('es-CO') : '',
                            tipo: t.tipo,
                            tipoCaja: t.tipoCaja || '-',
                            monto: t.monto,
                            metodoPago: t.metodoPago || 'EFECTIVO',
                            estado: ((_a = t.estadoAprobacion) === null || _a === void 0 ? void 0 : _a.replace(/_/g, ' ')) || 'APROBADO',
                            descripcion: t.descripcion || '',
                            caja: t.caja,
                            usuario: t.usuario,
                            aprobadoPor: t.aprobadoPor || '',
                        });
                        if (idx % 2 === 1) {
                            row.eachCell(function (cell) {
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
                            });
                        }
                        row.getCell(4).numFmt = '"$"#,##0';
                        row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
                        // Estado de aprobación con colores
                        var estado = (t.estadoAprobacion || '').toUpperCase();
                        if (estado === 'PENDIENTE') {
                            row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
                            row.getCell(6).font = { bold: true, color: { argb: 'FF854D0E' } };
                        }
                        else if (estado === 'RECHAZADO') {
                            row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
                            row.getCell(6).font = { bold: true, color: { argb: 'FFDC2626' } };
                        }
                        // Ingresos en verde, egresos en rojo
                        var tipoCell = row.getCell(2);
                        if (t.tipo === 'INGRESO')
                            tipoCell.font = { color: { argb: 'FF059669' }, bold: true };
                        else if (t.tipo === 'EGRESO')
                            tipoCell.font = { color: { argb: 'FFDC2626' }, bold: true };
                    });
                    return [4 /*yield*/, workbook.xlsx.writeBuffer()];
                case 1:
                    buffer = _a.sent();
                    return [2 /*return*/, {
                            data: Buffer.from(buffer),
                            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            filename: "reporte-contable-".concat(fecha, ".xlsx"),
                        }];
            }
        });
    });
}
// ─── Generador PDF ────────────────────────────────────────────────────────────
function generarPDFContable(cajas, transacciones, fecha) {
    return __awaiter(this, void 0, void 0, function () {
        var doc, buffers, BLANCO, GRIS_CLR, GRIS_MED, GRIS_TXT, AZUL_DARK, AZUL_MED, AZUL_PALE, NAR_DARK, NAR_MED, NAR_SOFT, fmtCOP, getLogoPath, drawWatermark, pageNumber, totalSaldo, drawPageHeader, drawFooter, y, cajaCols, tableLeft, cajaTableWidth, drawCajaHeader, movCols, movTableWidth, drawMovHeader, buffer;
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
                    totalSaldo = cajas.reduce(function (s, c) { return s + c.saldo; }, 0);
                    drawPageHeader = function () {
                        var W = doc.page.width;
                        doc.fontSize(22).font('Helvetica-Bold').fillColor(AZUL_DARK)
                            .text('Créditos del Sur', 30, 25);
                        doc.fontSize(9).font('Helvetica').fillColor(NAR_MED)
                            .text('REPORTE CONTABLE', 30, 52, { characterSpacing: 0.5 });
                        doc.roundedRect(W - 180, 20, 148, 44, 5).fillAndStroke(BLANCO, GRIS_CLR);
                        doc.fontSize(8).font('Helvetica-Bold').fillColor(GRIS_MED)
                            .text('FECHA GENERACIÓN', W - 180, 28, { width: 148, align: 'center' });
                        doc.fontSize(10).font('Helvetica-Bold').fillColor(AZUL_DARK)
                            .text(new Date().toLocaleDateString('es-CO'), W - 180, 40, { width: 148, align: 'center' });
                        var kW = (doc.page.width - 60) / 3;
                        var kY = 98;
                        [
                            { label: 'TOTAL CAJAS', val: String(cajas.length), bg: '#D6E9F5', color: AZUL_DARK, isNum: false },
                            { label: 'SALDO GLOBAL', val: fmtCOP(totalSaldo), bg: NAR_SOFT, color: NAR_DARK, isNum: true },
                            { label: 'TRANSACCIONES', val: String(transacciones.length), bg: '#F0F4F8', color: GRIS_TXT, isNum: false },
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
                    drawWatermark();
                    y = drawPageHeader();
                    // ── Tabla: Estado de Cajas ──
                    doc.fontSize(12).font('Helvetica-Bold').fillColor(AZUL_DARK).text('Estado de Cajas', 30, y);
                    y += 18;
                    cajaCols = [
                        { label: 'Caja', width: 110 },
                        { label: 'Código', width: 70 },
                        { label: 'Tipo', width: 80 },
                        { label: 'Responsable', width: 156 },
                        { label: 'Ruta', width: 110 },
                        { label: 'Saldo actual', width: 80 },
                        { label: 'Ingresos', width: 80 },
                        { label: 'Egresos', width: 80 },
                    ];
                    tableLeft = 30;
                    cajaTableWidth = cajaCols.reduce(function (s, c) { return s + c.width; }, 0);
                    drawCajaHeader = function (cy) {
                        doc.rect(tableLeft, cy, cajaTableWidth, 24).fill(AZUL_MED);
                        doc.rect(tableLeft, cy + 24, cajaTableWidth, 2).fill(NAR_MED);
                        var x = tableLeft;
                        doc.fontSize(8).font('Helvetica-Bold').fillColor(BLANCO);
                        cajaCols.forEach(function (col) {
                            doc.text(col.label, x + 4, cy + 7, { width: col.width - 8, align: 'center' });
                            x += col.width;
                        });
                        return cy + 30;
                    };
                    y = drawCajaHeader(y);
                    cajas.forEach(function (caja, i) {
                        var maxRowHeight = 17;
                        var vals = [
                            caja.nombre || '',
                            caja.codigo || '',
                            caja.tipo || '',
                            caja.responsable || 'Sin asignar',
                            caja.ruta || 'N/A',
                            fmtCOP(caja.saldo || 0),
                            fmtCOP(caja.ingresosPeriodo || 0),
                            fmtCOP(caja.egresosPeriodo || 0),
                        ];
                        doc.font('Helvetica').fontSize(7.5);
                        vals.forEach(function (val, ci) {
                            if (ci === 0 || ci === 3 || ci === 5)
                                doc.font('Helvetica-Bold');
                            var h = doc.heightOfString(val, { width: cajaCols[ci].width - 8, lineBreak: true });
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
                            y = drawCajaHeader(y);
                            doc.font('Helvetica').fontSize(7.5);
                        }
                        var baseBg = i % 2 === 0 ? BLANCO : AZUL_PALE;
                        doc.rect(tableLeft, y, cajaTableWidth, maxRowHeight).fill(baseBg);
                        doc.moveTo(tableLeft, y + maxRowHeight)
                            .lineTo(tableLeft + cajaTableWidth, y + maxRowHeight)
                            .strokeColor(GRIS_CLR).lineWidth(0.4).stroke();
                        var x = tableLeft;
                        vals.forEach(function (v, ci) {
                            var align = ci >= 5 ? 'right' : (ci === 1 || ci === 2 ? 'center' : 'left');
                            if (ci === 5) {
                                doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
                            }
                            else if (ci === 0 || ci === 3) {
                                doc.font('Helvetica-Bold').fillColor(GRIS_TXT);
                            }
                            else {
                                doc.font('Helvetica').fillColor(GRIS_TXT);
                            }
                            doc.text(v, x + 4, y + 4, { width: cajaCols[ci].width - 8, align: align, lineBreak: true });
                            x += cajaCols[ci].width;
                        });
                        y += maxRowHeight;
                    });
                    // ── Tabla: Últimos Movimientos ──
                    y += 20;
                    if (y > doc.page.height - 120) {
                        drawFooter();
                        pageNumber++;
                        doc.addPage();
                        drawWatermark();
                        y = drawPageHeader();
                    }
                    doc.fontSize(12).font('Helvetica-Bold').fillColor(AZUL_DARK).text('Últimos Movimientos', 30, y);
                    y += 18;
                    movCols = [
                        { label: 'Fecha', width: 110 },
                        { label: 'Tipo', width: 70 },
                        { label: 'Monto', width: 90 },
                        { label: 'Descripción', width: 236 },
                        { label: 'Caja', width: 120 },
                        { label: 'Usuario', width: 140 },
                    ];
                    movTableWidth = movCols.reduce(function (s, c) { return s + c.width; }, 0);
                    drawMovHeader = function (cy) {
                        doc.rect(tableLeft, cy, movTableWidth, 24).fill(AZUL_MED);
                        doc.rect(tableLeft, cy + 24, movTableWidth, 2).fill(NAR_MED);
                        var x = tableLeft;
                        doc.fontSize(8).font('Helvetica-Bold').fillColor(BLANCO);
                        movCols.forEach(function (col) {
                            doc.text(col.label, x + 4, cy + 7, { width: col.width - 8, align: 'center' });
                            x += col.width;
                        });
                        return cy + 30;
                    };
                    y = drawMovHeader(y);
                    transacciones.forEach(function (t, i) {
                        var maxRowHeight = 17;
                        var vals = [
                            t.fecha ? new Date(t.fecha).toLocaleString('es-CO') : '',
                            t.tipo || '',
                            fmtCOP(t.monto || 0),
                            t.descripcion || '',
                            t.caja || '',
                            t.usuario || '',
                        ];
                        doc.font('Helvetica').fontSize(7.5);
                        vals.forEach(function (val, ci) {
                            if (ci === 1 || ci === 2 || ci === 3)
                                doc.font('Helvetica-Bold');
                            var h = doc.heightOfString(val, { width: movCols[ci].width - 8, lineBreak: true });
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
                            y = drawMovHeader(y);
                            doc.font('Helvetica').fontSize(7.5);
                        }
                        var baseBg = i % 2 === 0 ? BLANCO : AZUL_PALE;
                        doc.rect(tableLeft, y, movTableWidth, maxRowHeight).fill(baseBg);
                        doc.moveTo(tableLeft, y + maxRowHeight)
                            .lineTo(tableLeft + movTableWidth, y + maxRowHeight)
                            .strokeColor(GRIS_CLR).lineWidth(0.4).stroke();
                        var x = tableLeft;
                        vals.forEach(function (v, ci) {
                            var align = ci === 2 ? 'right' : (ci === 1 ? 'center' : 'left');
                            if (ci === 1) {
                                doc.font('Helvetica-Bold').fillColor(t.tipo === 'INGRESO' ? '#059669' : '#DC2626');
                            }
                            else if (ci === 2) {
                                doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
                            }
                            else if (ci === 3) {
                                doc.font('Helvetica-Bold').fillColor(GRIS_TXT);
                            }
                            else {
                                doc.font('Helvetica').fillColor(GRIS_TXT);
                            }
                            doc.text(v, x + 4, y + 4, { width: movCols[ci].width - 8, align: align, lineBreak: true });
                            x += movCols[ci].width;
                        });
                        y += maxRowHeight;
                    });
                    y += 38;
                    if (y > doc.page.height - 80) {
                        drawFooter();
                        pageNumber++;
                        doc.addPage();
                        drawWatermark();
                        y = drawPageHeader();
                    }
                    doc.fontSize(7.5).font('Helvetica-Oblique').fillColor(GRIS_MED)
                        .text('Documento expedido por Créditos del Sur. Las cifras presentadas son definitivas y sujetas a revisión de auditoría.', tableLeft, y, { align: 'center', width: movTableWidth });
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
                            filename: "reporte-contable-".concat(fecha, ".pdf"),
                        }];
            }
        });
    });
}
