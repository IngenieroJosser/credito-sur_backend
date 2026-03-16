"use strict";
/**
 * ============================================================================
 * TEMPLATE: INVENTARIO / ARTÍCULOS
 * ============================================================================
 * Usado en: inventory.service.ts → exportarInventario()
 * Endpoints:
 *   GET /inventory/export?format=excel
 *   GET /inventory/export?format=pdf
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
exports.generarExcelInventario = generarExcelInventario;
exports.generarPDFInventario = generarPDFInventario;
var ExcelJS = require("exceljs");
var PDFDocument = require("pdfkit");
var fs = require("fs");
var path = require("path");
// ─── Paleta ───────────────────────────────────────────────────────────────────
var XL = {
    AZUL_DARK: 'FF1A5F8A',
    AZUL_MED: 'FF2B7BB5',
    AZUL_PALE: 'FFEBF4FB',
    NAR_MED: 'FFF07A28',
    NAR_PALE: 'FFFEF3EC',
    BLANCO: 'FFFFFFFF',
    GRIS_TEXTO: 'FF2D3748',
    GRIS_MED: 'FF718096',
    GRIS_CLARO: 'FFE2E8F0',
    ROJO_PALE: 'FFFEF2F2',
    ROJO_DARK: 'FFDC2626',
    SLATE: 'FF334155',
};
var PDF = {
    AZUL_DARK: '#1A5F8A',
    AZUL_MED: '#2B7BB5',
    AZUL_PALE: '#EBF4FB',
    AZUL_SOFT: '#D6E9F5',
    NAR_MED: '#F07A28',
    NAR_SOFT: '#FDE8D5',
    NAR_DARK: '#C05A18',
    BLANCO: '#FFFFFF',
    GRIS_TXT: '#2D3748',
    GRIS_MED: '#718096',
    GRIS_LINEA: '#E2E8F0',
    GRIS_FONDO: '#F7FAFC',
    ROJO_PALE: '#FEF2F2',
    ROJO_DARK: '#DC2626',
};
// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtFecha(f) {
    if (!f)
        return '';
    var d = f instanceof Date ? f : new Date(f);
    return isNaN(d.getTime()) ? String(f) : d.toLocaleDateString('es-CO');
}
function fmtCOP(v) {
    return "$".concat((v || 0).toLocaleString('es-CO'));
}
function getLogoPath() {
    var prod = path.join(process.cwd(), 'dist/assets/logo.png');
    var dev = path.join(process.cwd(), 'src/assets/logo.png');
    return fs.existsSync(prod) ? prod : fs.existsSync(dev) ? dev : null;
}
function solidFill(argb) {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: argb } };
}
function borderHair() {
    return {
        bottom: { style: 'hair', color: { argb: XL.GRIS_CLARO } },
        right: { style: 'hair', color: { argb: XL.GRIS_CLARO } },
    };
}
// ─── Definición de columnas (compartida Excel/PDF lógicamente) ────────────────
var EXCEL_COLS = [
    { key: 'codigo', label: 'Código', width: 14 },
    { key: 'nombre', label: 'Artículo', width: 30 },
    { key: 'categoria', label: 'Categoría', width: 20 },
    { key: 'marca', label: 'Marca', width: 18 },
    { key: 'modelo', label: 'Modelo', width: 18 },
    { key: 'costo', label: 'Costo', width: 16 },
    { key: 'stock', label: 'Stock', width: 10 },
    { key: 'stockMinimo', label: 'Stock mínimo', width: 14 },
    { key: 'activo', label: 'Estado', width: 12 },
    { key: 'creadoEn', label: 'Registrado', width: 16 },
];
// ─── EXCEL ────────────────────────────────────────────────────────────────────
function generarExcelInventario(filas, totales, fecha) {
    return __awaiter(this, void 0, void 0, function () {
        var workbook, ws, titleRow, metaRow, headerRow, tRow, buffer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    workbook = new ExcelJS.Workbook();
                    workbook.creator = 'Créditos del Sur';
                    workbook.created = new Date();
                    ws = workbook.addWorksheet('Inventario', {
                        // ySplit=4: filas 1-3 son título/meta/vacía → headers en fila 4
                        views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
                        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
                        properties: { tabColor: { argb: XL.AZUL_MED } },
                    });
                    // IMPORTANTE: ws.columns SIN header — el campo 'header' haría que ExcelJS
                    // inserte una fila de headers automáticamente en la fila 1, antes de
                    // cualquier addRow(). Solo definimos key y width.
                    ws.columns = EXCEL_COLS.map(function (c) { return (__assign({ key: c.key, width: c.width }, (c.key === 'costo' ? { style: { numFmt: '"$"#,##0' } } : {}))); });
                    titleRow = ws.addRow([
                        "CR\u00C9DITOS DEL SUR \u2014 INVENTARIO DE ART\u00CDCULOS",
                    ]);
                    titleRow.font = { bold: true, size: 14, color: { argb: XL.BLANCO } };
                    titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.AZUL_DARK } };
                    titleRow.height = 28;
                    ws.mergeCells('A1:J1');
                    metaRow = ws.addRow([
                        "Generado: ".concat(new Date().toLocaleString('es-CO')) +
                            "  |  Total: ".concat(totales.totalProductos) +
                            "  |  Bajo stock: ".concat(totales.productosBajoStock) +
                            "  |  Valor: ".concat(fmtCOP(totales.totalValorInventario)),
                    ]);
                    metaRow.font = { size: 9, color: { argb: XL.BLANCO } };
                    metaRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.SLATE } };
                    metaRow.height = 18;
                    ws.mergeCells('A2:J2');
                    // ── Fila 3: vacía ───────────────────────────────────────────────────────────
                    ws.addRow([]);
                    ws.getRow(3).height = 4;
                    headerRow = ws.addRow(EXCEL_COLS.map(function (c) { return c.label; }));
                    headerRow.height = 22;
                    headerRow.eachCell(function (cell, colNum) {
                        cell.font = { bold: true, size: 9, color: { argb: XL.BLANCO } };
                        cell.fill = solidFill(XL.AZUL_MED);
                        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                        cell.border = {
                            bottom: { style: 'medium', color: { argb: XL.NAR_MED } },
                            right: { style: 'thin', color: { argb: XL.BLANCO } },
                        };
                    });
                    ws.autoFilter = { from: 'A4', to: 'J4' };
                    // ── Filas de datos ──────────────────────────────────────────────────────────
                    filas.forEach(function (f, idx) {
                        var lowStock = Number(f.stock) <= Number(f.stockMinimo);
                        var par = idx % 2 === 0;
                        var rowBg = lowStock ? XL.ROJO_PALE : (par ? XL.BLANCO : XL.AZUL_PALE);
                        var row = ws.addRow({
                            codigo: f.codigo,
                            nombre: f.nombre,
                            categoria: f.categoria,
                            marca: f.marca || '',
                            modelo: f.modelo || '',
                            costo: Number(f.costo) || 0,
                            stock: Number(f.stock) || 0,
                            stockMinimo: Number(f.stockMinimo) || 0,
                            activo: f.activo ? 'Activo' : 'Inactivo',
                            creadoEn: fmtFecha(f.creadoEn),
                        });
                        row.eachCell({ includeEmpty: true }, function (cell) {
                            cell.fill = solidFill(rowBg);
                            cell.font = { size: 9, color: { argb: XL.GRIS_TEXTO } };
                            cell.alignment = { vertical: 'middle' };
                            cell.border = borderHair();
                        });
                        row.getCell(6).numFmt = '"$"#,##0'; // Costo
                        if (lowStock) {
                            row.getCell(7).font = { bold: true, size: 9, color: { argb: XL.ROJO_DARK } };
                            row.getCell(8).font = { bold: true, size: 9, color: { argb: XL.ROJO_DARK } };
                        }
                        if (!f.activo) {
                            row.getCell(9).font = { size: 9, color: { argb: XL.GRIS_MED } };
                        }
                    });
                    // ── Fila de totales ─────────────────────────────────────────────────────────
                    ws.addRow([]);
                    tRow = ws.addRow([
                        'TOTALES', '', '', '', '',
                        totales.totalValorInventario,
                        '', '', '', '',
                    ]);
                    ws.mergeCells("A".concat(tRow.number, ":E").concat(tRow.number));
                    tRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
                    tRow.height = 22;
                    tRow.eachCell({ includeEmpty: true }, function (cell, cn) {
                        cell.fill = solidFill(cn <= 5 ? XL.NAR_MED : XL.NAR_PALE);
                        cell.font = { bold: true, color: { argb: cn <= 5 ? XL.BLANCO : XL.GRIS_TEXTO } };
                        cell.border = {
                            top: { style: 'medium', color: { argb: XL.NAR_MED } },
                            right: { style: 'thin', color: { argb: XL.GRIS_CLARO } },
                        };
                    });
                    tRow.getCell(6).numFmt = '"$"#,##0';
                    return [4 /*yield*/, workbook.xlsx.writeBuffer()];
                case 1:
                    buffer = _a.sent();
                    return [2 /*return*/, {
                            data: Buffer.from(buffer),
                            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            filename: "inventario_".concat(fecha, ".xlsx"),
                        }];
            }
        });
    });
}
// ─── PDF ──────────────────────────────────────────────────────────────────────
// Columnas PDF: 8 cols, suman 732pt exactos (792 - 30 - 30)
// Base: 68+200+112+78+48+48+66+112 = 732 ✓
var PDF_COLS = [
    { label: 'Código', w: 68, align: 'left' },
    { label: 'Artículo', w: 200, align: 'left' }, // única col que wrapea
    { label: 'Categoría', w: 112, align: 'left' },
    { label: 'Costo', w: 78, align: 'right' },
    { label: 'Stock', w: 48, align: 'center' },
    { label: 'Mín.', w: 48, align: 'center' },
    { label: 'Estado', w: 66, align: 'center' },
    { label: 'Registrado', w: 112, align: 'center' },
];
var TABLE_LEFT = 30;
var TABLE_WIDTH = PDF_COLS.reduce(function (s, c) { return s + c.w; }, 0); // 732
function generarPDFInventario(filas, totales, fecha) {
    return __awaiter(this, void 0, void 0, function () {
        var doc, buffers, PW, PH, logoPath, drawWatermark, pageNumber, drawFooter, drawHeader, drawTableHeader, y, PAD, FOOTER_RSV, TOTAL_H, descW, costoX, buffer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
                    buffers = [];
                    doc.on('data', function (chunk) { return buffers.push(chunk); });
                    PW = doc.page.width;
                    PH = doc.page.height;
                    logoPath = getLogoPath();
                    drawWatermark = function () {
                        if (!logoPath)
                            return;
                        try {
                            doc.save();
                            doc.opacity(0.08);
                            doc.image(logoPath, (PW - 300) / 2, (PH - 300) / 2, { width: 300 });
                            doc.restore();
                        }
                        catch (_) { }
                    };
                    pageNumber = 1;
                    drawFooter = function () {
                        doc.fontSize(7).font('Helvetica').fillColor(PDF.GRIS_MED)
                            .text("P\u00E1g. ".concat(pageNumber, "  \u2022  Generado: ").concat(new Date().toLocaleString('es-CO')), 0, PH - 25, { align: 'right', width: PW - 30 });
                    };
                    drawHeader = function () {
                        doc.fontSize(22).font('Helvetica-Bold').fillColor(PDF.AZUL_DARK)
                            .text('Créditos del Sur', TABLE_LEFT, 25);
                        doc.fontSize(9).font('Helvetica').fillColor(PDF.NAR_MED)
                            .text('REPORTE DE INVENTARIO', TABLE_LEFT, 52, { characterSpacing: 0.5 });
                        // Badge fecha
                        doc.roundedRect(PW - 180, 20, 148, 44, 5).fillAndStroke(PDF.BLANCO, PDF.GRIS_LINEA);
                        doc.fontSize(8).font('Helvetica-Bold').fillColor(PDF.GRIS_MED)
                            .text('FECHA', PW - 180, 28, { width: 148, align: 'center' });
                        doc.fontSize(10).font('Helvetica-Bold').fillColor(PDF.AZUL_DARK)
                            .text(fecha, PW - 180, 40, { width: 148, align: 'center' });
                        // Banda de contexto
                        doc.roundedRect(TABLE_LEFT, 76, PW - 60, 36, 8).fillAndStroke(PDF.AZUL_PALE, PDF.GRIS_LINEA);
                        doc.fontSize(9).font('Helvetica').fillColor(PDF.GRIS_TXT)
                            .text("Total: ".concat(totales.totalProductos, "   |   Bajo stock: ").concat(totales.productosBajoStock, "   |   Valor total: ").concat(fmtCOP(totales.totalValorInventario)), 40, 91, { width: PW - 80 });
                        // 3 KPI cards
                        var kY = 124;
                        var kH = 44;
                        var kW = (TABLE_WIDTH - 8) / 3;
                        var cards = [
                            { label: 'TOTAL PRODUCTOS', val: String(totales.totalProductos), bg: PDF.AZUL_SOFT, color: PDF.AZUL_DARK },
                            { label: 'BAJO STOCK', val: String(totales.productosBajoStock), bg: PDF.ROJO_PALE, color: PDF.ROJO_DARK },
                            { label: 'VALOR INVENTARIO', val: fmtCOP(totales.totalValorInventario), bg: PDF.NAR_SOFT, color: PDF.NAR_DARK },
                        ];
                        cards.forEach(function (card, i) {
                            var kx = TABLE_LEFT + i * (kW + 4);
                            doc.roundedRect(kx, kY, kW, kH, 6).fillAndStroke(card.bg, PDF.GRIS_LINEA);
                            doc.fontSize(7.5).font('Helvetica-Bold').fillColor(PDF.GRIS_MED)
                                .text(card.label, kx, kY + 9, { width: kW, align: 'center' });
                            doc.fontSize(12).font('Helvetica-Bold').fillColor(card.color)
                                .text(card.val, kx, kY + 23, { width: kW, align: 'center' });
                        });
                        return kY + kH + 8;
                    };
                    drawTableHeader = function (y) {
                        doc.rect(TABLE_LEFT, y, TABLE_WIDTH, 22).fill(PDF.AZUL_MED);
                        doc.rect(TABLE_LEFT, y + 22, TABLE_WIDTH, 2).fill(PDF.NAR_MED);
                        var x = TABLE_LEFT;
                        doc.fontSize(8).font('Helvetica-Bold').fillColor(PDF.BLANCO);
                        PDF_COLS.forEach(function (col) {
                            doc.text(col.label, x + 3, y + 6, {
                                width: col.w - 6,
                                align: 'center',
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
                    PAD = 4;
                    FOOTER_RSV = 50;
                    filas.forEach(function (fila, i) {
                        var _a, _b;
                        var lowStock = Number(fila.stock) <= Number(fila.stockMinimo);
                        // Valores en orden exacto de PDF_COLS
                        var vals = [
                            fila.codigo || '',
                            fila.nombre || '',
                            fila.categoria || '',
                            fmtCOP(Number(fila.costo) || 0),
                            String((_a = fila.stock) !== null && _a !== void 0 ? _a : ''),
                            String((_b = fila.stockMinimo) !== null && _b !== void 0 ? _b : ''),
                            fila.activo ? 'Activo' : 'Inactivo',
                            fmtFecha(fila.creadoEn),
                        ];
                        // rowH determinado SOLO por Artículo (ci=1) — la única col que puede wrappear
                        doc.font('Helvetica-Bold').fontSize(7.5);
                        var hNombre = doc.heightOfString(vals[1], { width: PDF_COLS[1].w - 6, lineBreak: true });
                        var rowH = Math.max(16, hNombre + PAD * 2);
                        if (rowH > 40)
                            rowH = 40;
                        // Salto de página
                        if (y + rowH > PH - FOOTER_RSV) {
                            drawFooter();
                            pageNumber++;
                            doc.addPage();
                            drawWatermark();
                            y = drawHeader();
                            y = drawTableHeader(y);
                        }
                        // Fondo: bajo stock > cebra
                        var baseBg = i % 2 === 0 ? PDF.BLANCO : PDF.AZUL_PALE;
                        var rowBg = lowStock ? PDF.ROJO_PALE : baseBg;
                        doc.rect(TABLE_LEFT, y, TABLE_WIDTH, rowH).fill(rowBg);
                        if (lowStock) {
                            doc.rect(TABLE_LEFT, y, 3, rowH).fill(PDF.ROJO_DARK);
                        }
                        doc.moveTo(TABLE_LEFT, y + rowH)
                            .lineTo(TABLE_LEFT + TABLE_WIDTH, y + rowH)
                            .strokeColor(PDF.GRIS_LINEA).lineWidth(0.3).stroke();
                        // ── Render de celdas ─────────────────────────────────────────────────────
                        // REGLA: solo ci===1 (Artículo) usa lineBreak:true.
                        // Todas las demás usan lineBreak:false + ellipsis:true para que el cursor
                        // Y de PDFKit NO se desplace, garantizando alineación horizontal perfecta.
                        var x = TABLE_LEFT;
                        vals.forEach(function (v, ci) {
                            var col = PDF_COLS[ci];
                            // Estilo
                            if (ci === 3) { // Costo: bold azul
                                doc.font('Helvetica-Bold').fillColor(PDF.AZUL_DARK);
                            }
                            else if ((ci === 4 || ci === 5) && lowStock) { // Stock/Mín bajo stock
                                doc.font('Helvetica-Bold').fillColor(PDF.ROJO_DARK);
                            }
                            else if (ci === 6 && !fila.activo) { // Inactivo: gris
                                doc.font('Helvetica').fillColor(PDF.GRIS_MED);
                            }
                            else {
                                doc.font(ci === 1 ? 'Helvetica-Bold' : 'Helvetica').fillColor(PDF.GRIS_TXT);
                            }
                            var wrap = ci === 1;
                            doc.text(v, x + 3, y + PAD, {
                                width: col.w - 6,
                                align: col.align,
                                lineBreak: wrap,
                                ellipsis: !wrap,
                            });
                            x += col.w;
                        });
                        y += rowH;
                    });
                    TOTAL_H = 28;
                    if (y + TOTAL_H + 20 > PH - FOOTER_RSV) {
                        drawFooter();
                        pageNumber++;
                        doc.addPage();
                        drawWatermark();
                        y = 40;
                    }
                    y += 8;
                    doc.rect(TABLE_LEFT, y, TABLE_WIDTH, TOTAL_H).fill(PDF.AZUL_DARK);
                    doc.rect(TABLE_LEFT, y, TABLE_WIDTH, 2).fill(PDF.NAR_MED);
                    descW = PDF_COLS.slice(0, 3).reduce(function (s, c) { return s + c.w; }, 0);
                    doc.fontSize(8).font('Helvetica-Bold').fillColor(PDF.BLANCO)
                        .text("TOTALES \u2014 ".concat(totales.totalProductos, " producto").concat(totales.totalProductos !== 1 ? 's' : '') +
                        "   |   Bajo stock: ".concat(totales.productosBajoStock), TABLE_LEFT + 8, y + 9, { width: descW - 12 });
                    costoX = TABLE_LEFT + PDF_COLS.slice(0, 3).reduce(function (s, c) { return s + c.w; }, 0);
                    doc.font('Helvetica-Bold').fillColor(PDF.NAR_MED).fontSize(8)
                        .text(fmtCOP(totales.totalValorInventario), costoX + 2, y + 9, { width: PDF_COLS[3].w - 4, align: 'right' });
                    y += TOTAL_H + 10;
                    doc.fontSize(7).font('Helvetica-Oblique').fillColor(PDF.GRIS_MED)
                        .text('Documento expedido por Créditos del Sur. Las cifras son definitivas y sujetas a revisión de auditoría.', TABLE_LEFT, y, { align: 'center', width: TABLE_WIDTH });
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
                            filename: "inventario_".concat(fecha, ".pdf"),
                        }];
            }
        });
    });
}
