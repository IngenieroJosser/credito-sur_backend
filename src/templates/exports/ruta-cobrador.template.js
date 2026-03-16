"use strict";
/**
 * ============================================================================
 * TEMPLATE: RUTA DEL COBRADOR
 * ============================================================================
 * Usado en: routes.service.ts → exportarRuta()
 * Endpoints:
 *   GET /routes/:id/export/excel
 *   GET /routes/:id/export/pdf
 *
 * CAMBIOS v2:
 *  - PDF: 11 columnas = 732pt exactos (antes 11 cols = 846pt → overflow)
 *  - PDF: columna "Estado" agregada
 *  - PDF: col "✔" eliminada del PDF (queda en Excel)
 *  - PDF: fila totales centrada (igual al original)
 *  - PDF: paginación corregida (reserva 70pt para footer)
 *  - Estilo visual: idéntico al original
 * ============================================================================
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
exports.generarExcelRutaCobrador = generarExcelRutaCobrador;
exports.generarPDFRutaCobrador = generarPDFRutaCobrador;
var ExcelJS = require("exceljs");
var PDFDocument = require("pdfkit");
var fs = require("fs");
var path = require("path");
var C = {
    BLANCO: '#FFFFFF',
    GRIS_LINEA: '#E2E8F0',
    GRIS_TXT: '#475569',
    GRIS_MED: '#94A3B8',
    AZUL_DARK: '#1A5F8A',
    AZUL_MED: '#2676AC',
    AZUL_PALE: '#F0F9FF',
    NAR_MED: '#F07A28',
    ROJO_PALE: '#FEF2F2',
    ROJO_DARK: '#DC2626',
    AMARILLO_PALE: '#FFFBEB',
    AMARILLO_DARK: '#D97706',
    VERDE_PALE: '#ECFDF5',
    VERDE_DARK: '#059669',
};
var fmtCOP = function (v) { return "$".concat((v || 0).toLocaleString('es-CO')); };
function getLogoPath() {
    var prod = path.join(process.cwd(), 'dist/assets/logo.png');
    var dev = path.join(process.cwd(), 'src/assets/logo.png');
    return fs.existsSync(prod) ? prod : fs.existsSync(dev) ? dev : null;
}
// ─── Columnas PDF ─────────────────────────────────────────────────────────────
// LETTER landscape: 792 - 30(ML) - 30(MR) = 732pt
// Suma: 22+120+62+68+112+70+64+56+70+58+30 = 732 ✓
var PDF_COLS = [
    { label: 'N°', w: 20, align: 'center' },
    { label: 'Cliente', w: 116, align: 'left' },
    { label: 'CC', w: 62, align: 'center' },
    { label: 'Teléfono', w: 66, align: 'center' },
    { label: 'Dirección', w: 104, align: 'left' },
    { label: 'Préstamo', w: 82, align: 'center' }, // 82pt: evita wrap en códigos tipo PR-DEMO-MORA-01
    { label: 'Cuota', w: 62, align: 'right' },
    { label: 'Fecha', w: 56, align: 'center' },
    { label: 'Saldo', w: 68, align: 'right' },
    { label: 'Estado', w: 58, align: 'center' },
    { label: 'Mora', w: 38, align: 'center' },
];
var TABLE_LEFT = 30;
var TABLE_WIDTH = PDF_COLS.reduce(function (s, c) { return s + c.w; }, 0); // 732
// ─── EXCEL ────────────────────────────────────────────────────────────────────
function generarExcelRutaCobrador(filas, meta, fecha) {
    return __awaiter(this, void 0, void 0, function () {
        var workbook, ws, title, subtitle, headerRow, totalRow, buffer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    workbook = new ExcelJS.Workbook();
                    workbook.creator = 'Créditos del Sur';
                    workbook.created = new Date();
                    ws = workbook.addWorksheet("Ruta ".concat(meta.rutaNombre), {
                        views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
                        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
                        properties: { tabColor: { argb: 'FF1A5F8A' } },
                    });
                    ws.columns = [
                        { header: 'N°', key: 'nro', width: 5 },
                        { header: 'Cliente', key: 'cliente', width: 28 },
                        { header: 'CC / DNI', key: 'cc', width: 14 },
                        { header: 'Teléfono', key: 'telefono', width: 14 },
                        { header: 'Dirección', key: 'direccion', width: 30 },
                        { header: 'N° Préstamo', key: 'numeroPrestamo', width: 14 },
                        { header: 'Cuota', key: 'cuota', width: 14 },
                        { header: 'Fecha Cuota', key: 'fechaCuota', width: 14 },
                        { header: 'Saldo', key: 'saldo', width: 16 },
                        { header: 'Estado', key: 'estadoPrestamo', width: 13 },
                        { header: 'Días Mora', key: 'diasMora', width: 10 },
                        { header: 'Cobrado ✔', key: 'cobrado', width: 14 },
                        { header: 'Notas', key: 'notas', width: 22 },
                    ];
                    title = ws.addRow([
                        "CR\u00C9DITOS DEL SUR \u2014 RUTA ".concat(meta.rutaNombre.toUpperCase()) +
                            "".concat(meta.rutaCodigo ? " (".concat(meta.rutaCodigo, ")") : ''),
                    ]);
                    title.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
                    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                    ws.mergeCells('A1:M1');
                    ws.getRow(1).height = 26;
                    subtitle = ws.addRow([
                        "Cobrador: ".concat(meta.cobradorNombre, "   |   Fecha: ").concat(meta.fechaExport, "   |") +
                            "   Clientes: ".concat(meta.totalClientes, "   |   En mora: ").concat(meta.enMora),
                    ]);
                    subtitle.font = { size: 10, color: { argb: 'FFFFFFFF' } };
                    subtitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
                    ws.mergeCells('A2:M2');
                    ws.getRow(2).height = 18;
                    ws.addRow([]);
                    headerRow = ws.getRow(4);
                    ws.columns.forEach(function (col, i) {
                        var cell = headerRow.getCell(i + 1);
                        cell.value = col.header;
                        cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2676AC' } };
                        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                        cell.border = {
                            bottom: { style: 'thin', color: { argb: 'FFF07A28' } },
                            right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                        };
                    });
                    headerRow.height = 22;
                    filas.forEach(function (f, idx) {
                        var _a;
                        var row = ws.addRow({
                            nro: f.nro,
                            cliente: f.cliente,
                            cc: f.cc,
                            telefono: f.telefono,
                            direccion: f.direccion,
                            numeroPrestamo: f.numeroPrestamo,
                            cuota: f.cuota,
                            fechaCuota: f.fechaCuota,
                            saldo: f.saldo,
                            estadoPrestamo: ((_a = f.estadoPrestamo) === null || _a === void 0 ? void 0 : _a.replace(/_/g, ' ')) || '',
                            diasMora: f.diasMora,
                            cobrado: '',
                            notas: '',
                        });
                        if (idx % 2 === 1) {
                            row.eachCell(function (cell) {
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                            });
                        }
                        row.getCell(7).numFmt = '#,##0';
                        row.getCell(9).numFmt = '#,##0';
                        var semCell = row.getCell(11);
                        if (f.semaforo === 'ROJO')
                            semCell.font = { bold: true, color: { argb: 'FFDC2626' } };
                        if (f.semaforo === 'AMARILLO')
                            semCell.font = { bold: true, color: { argb: 'FFD97706' } };
                        if (f.semaforo === 'VERDE')
                            semCell.font = { bold: true, color: { argb: 'FF059669' } };
                    });
                    ws.addRow([]);
                    totalRow = ws.addRow([
                        '', 'TOTALES', '', '', '',
                        "".concat(filas.length, " filas"),
                        meta.totalCuota, '',
                        meta.totalSaldo, '',
                        "".concat(meta.enMora, " en mora"),
                        '', '',
                    ]);
                    ws.mergeCells("A".concat(totalRow.number, ":B").concat(totalRow.number));
                    totalRow.eachCell({ includeEmpty: true }, function (cell) {
                        cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                    });
                    totalRow.getCell(7).numFmt = '#,##0';
                    totalRow.getCell(9).numFmt = '#,##0';
                    return [4 /*yield*/, workbook.xlsx.writeBuffer()];
                case 1:
                    buffer = _a.sent();
                    return [2 /*return*/, {
                            data: Buffer.from(buffer),
                            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            filename: "ruta-".concat(meta.rutaNombre, "-").concat(fecha, ".xlsx"),
                        }];
            }
        });
    });
}
// ─── PDF ──────────────────────────────────────────────────────────────────────
function generarPDFRutaCobrador(filas, meta, fecha) {
    return __awaiter(this, void 0, void 0, function () {
        var doc, buffers, PW, PH, drawWatermark, pageNumber, drawFooter, drawHeader, drawTableHeader, y, buffer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
                    buffers = [];
                    doc.on('data', function (chunk) { return buffers.push(chunk); });
                    PW = doc.page.width;
                    PH = doc.page.height;
                    drawWatermark = function () {
                        try {
                            var lp = getLogoPath();
                            if (lp) {
                                doc.save();
                                doc.opacity(0.08);
                                doc.image(lp, (PW - 300) / 2, (PH - 300) / 2, { width: 300 });
                                doc.restore();
                            }
                        }
                        catch (_a) { }
                    };
                    pageNumber = 1;
                    drawFooter = function () {
                        doc.fontSize(7).font('Helvetica').fillColor(C.GRIS_MED)
                            .text("P\u00E1g. ".concat(pageNumber, "  \u2022  Generado: ").concat(new Date().toLocaleString('es-CO')), 0, PH - 25, { align: 'right', width: PW - 30 });
                    };
                    drawHeader = function () {
                        var W = doc.page.width;
                        doc.fontSize(22).font('Helvetica-Bold').fillColor(C.AZUL_DARK)
                            .text('Créditos del Sur', 30, 25);
                        doc.fontSize(9).font('Helvetica').fillColor(C.NAR_MED)
                            .text('RUTA DEL COBRADOR', 30, 52, { characterSpacing: 0.5 });
                        doc.roundedRect(W - 180, 20, 148, 44, 5).fillAndStroke(C.BLANCO, C.GRIS_LINEA);
                        doc.fontSize(8).font('Helvetica-Bold').fillColor(C.GRIS_MED)
                            .text('FECHA', W - 180, 28, { width: 148, align: 'center' });
                        doc.fontSize(10).font('Helvetica-Bold').fillColor(C.AZUL_DARK)
                            .text(meta.fechaExport, W - 180, 40, { width: 148, align: 'center' });
                        doc.roundedRect(30, 76, W - 60, 44, 8).fillAndStroke(C.AZUL_PALE, C.GRIS_LINEA);
                        doc.fontSize(10).font('Helvetica-Bold').fillColor(C.AZUL_DARK)
                            .text("Ruta: ".concat(meta.rutaNombre).concat(meta.rutaCodigo ? " (".concat(meta.rutaCodigo, ")") : ''), 40, 85, { width: W - 80 });
                        doc.fontSize(9).font('Helvetica').fillColor(C.GRIS_TXT)
                            .text("Cobrador: ".concat(meta.cobradorNombre, "   |   Clientes: ").concat(meta.totalClientes, "   |   En mora: ").concat(meta.enMora), 40, 103, { width: W - 80 });
                        var kW = (W - 60) / 4;
                        var kY = 132;
                        var cards = [
                            { label: 'TOTAL FILAS', val: String(filas.length), bg: '#D6E9F5', color: C.AZUL_DARK, isNum: false },
                            { label: 'TOTAL CUOTA', val: meta.totalCuota, bg: '#FDE8D5', color: '#D95C0F', isNum: true },
                            { label: 'TOTAL SALDO', val: meta.totalSaldo, bg: '#F0F4F8', color: C.GRIS_TXT, isNum: true },
                            { label: 'EN MORA', val: String(meta.enMora), bg: C.ROJO_PALE, color: C.ROJO_DARK, isNum: false },
                        ];
                        cards.forEach(function (m, i) {
                            var mx = 30 + i * (kW + 4);
                            doc.roundedRect(mx, kY, kW, 44, 6).fillAndStroke(m.bg, C.GRIS_LINEA);
                            doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.GRIS_MED)
                                .text(m.label, mx, kY + 10, { width: kW, align: 'center' });
                            doc.fontSize(13).font('Helvetica-Bold').fillColor(m.color)
                                .text(m.isNum ? fmtCOP(m.val) : String(m.val), mx, kY + 23, { width: kW, align: 'center' });
                        });
                        return kY + 58;
                    };
                    drawTableHeader = function (y) {
                        doc.rect(TABLE_LEFT, y, TABLE_WIDTH, 24).fill(C.AZUL_MED);
                        doc.rect(TABLE_LEFT, y + 24, TABLE_WIDTH, 2).fill(C.NAR_MED);
                        var x = TABLE_LEFT;
                        doc.fontSize(8).font('Helvetica-Bold').fillColor(C.BLANCO);
                        PDF_COLS.forEach(function (col) {
                            var padX = 3;
                            doc.text(col.label, x + padX, y + 7, {
                                width: col.w - padX * 2,
                                align: col.align,
                                lineBreak: false,
                            });
                            x += col.w;
                        });
                        return y + 26;
                    };
                    // ── Render ─────────────────────────────────────────────────────────────────
                    drawWatermark();
                    y = drawHeader();
                    y = drawTableHeader(y);
                    doc.font('Helvetica').fontSize(7.2);
                    filas.forEach(function (fila, i) {
                        var vals = [
                            String(fila.nro),
                            fila.cliente || '',
                            fila.cc || '',
                            fila.telefono || '',
                            fila.direccion || '',
                            fila.numeroPrestamo || '',
                            fila.cuota > 0 ? fmtCOP(fila.cuota) : '—',
                            fila.fechaCuota || '',
                            fila.saldo > 0 ? fmtCOP(fila.saldo) : '—',
                            (fila.estadoPrestamo || '').replace(/_/g, ' '),
                            fila.diasMora > 0 ? "".concat(fila.diasMora, "d") : '',
                        ];
                        // Altura dinámica
                        doc.font('Helvetica').fontSize(7.2);
                        var rowH = 18;
                        vals.forEach(function (v, ci) {
                            var h = doc.heightOfString(v, { width: PDF_COLS[ci].w - 8, lineBreak: true });
                            if (h + 8 > rowH)
                                rowH = h + 8;
                        });
                        if (rowH > 42)
                            rowH = 42;
                        // Salto de página
                        if (y + rowH > PH - 70) {
                            drawFooter();
                            pageNumber++;
                            doc.addPage();
                            drawWatermark();
                            y = drawHeader();
                            y = drawTableHeader(y);
                            doc.font('Helvetica').fontSize(7.2);
                        }
                        // Fondo de fila
                        var baseBg = i % 2 === 0 ? C.BLANCO : C.AZUL_PALE;
                        var bg = fila.semaforo === 'ROJO' ? C.ROJO_PALE :
                            fila.semaforo === 'AMARILLO' ? C.AMARILLO_PALE :
                                baseBg;
                        doc.rect(TABLE_LEFT, y, TABLE_WIDTH, rowH).fill(bg);
                        doc.moveTo(TABLE_LEFT, y + rowH)
                            .lineTo(TABLE_LEFT + TABLE_WIDTH, y + rowH)
                            .strokeColor(C.GRIS_LINEA).lineWidth(0.4).stroke();
                        // Texto de celdas.
                        // Solo Cliente(1) y Dirección(4) pueden hacer wrap (cols anchas).
                        // El resto usa lineBreak:false + ellipsis para que el cursor Y de PDFKit
                        // no se desplace, garantizando que todas las celdas arranquen en y+4.
                        var WRAP_COLS = new Set([1, 4]);
                        var x = TABLE_LEFT;
                        vals.forEach(function (v, ci) {
                            var col = PDF_COLS[ci];
                            if (ci === 8) {
                                doc.font('Helvetica-Bold').fillColor(C.AZUL_DARK);
                            }
                            else if (ci === 10 && fila.semaforo === 'ROJO') {
                                doc.font('Helvetica-Bold').fillColor(C.ROJO_DARK);
                            }
                            else if (ci === 10 && fila.semaforo === 'AMARILLO') {
                                doc.font('Helvetica-Bold').fillColor(C.AMARILLO_DARK);
                            }
                            else {
                                doc.font(ci === 1 ? 'Helvetica-Bold' : 'Helvetica').fillColor(C.GRIS_TXT);
                            }
                            var canWrap = WRAP_COLS.has(ci);
                            var padX = 3;
                            var cellWidth = col.w - padX * 2;
                            var textH = doc.heightOfString(v, {
                                width: cellWidth,
                                align: col.align,
                                lineBreak: canWrap,
                                ellipsis: !canWrap,
                            });
                            var yText = canWrap
                                ? (y + 4)
                                : (y + Math.max(4, (rowH - textH) / 2));
                            doc.text(v, x + padX, yText, {
                                width: cellWidth,
                                align: col.align,
                                lineBreak: canWrap,
                                ellipsis: !canWrap,
                            });
                            x += col.w;
                        });
                        y += rowH;
                    });
                    // ── Totales ────────────────────────────────────────────────────────────────
                    y += 10;
                    doc.rect(TABLE_LEFT, y, TABLE_WIDTH, 26).fill('#1E293B');
                    doc.rect(TABLE_LEFT, y, TABLE_WIDTH, 2).fill(C.NAR_MED);
                    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.BLANCO)
                        .text("TOTAL CUOTA: ".concat(fmtCOP(meta.totalCuota), "   |   TOTAL SALDO: ").concat(fmtCOP(meta.totalSaldo)), TABLE_LEFT + 8, y + 9, { width: TABLE_WIDTH - 16, align: 'center' });
                    y += 38;
                    doc.fontSize(7.5).font('Helvetica-Oblique').fillColor(C.GRIS_MED)
                        .text('Documento expedido por Créditos del Sur. Las cifras presentadas son definitivas y sujetas a revisión de auditoría.', TABLE_LEFT, y, { align: 'center', width: TABLE_WIDTH });
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
                            filename: "ruta-".concat(meta.rutaNombre, "-").concat(fecha, ".pdf"),
                        }];
            }
        });
    });
}
