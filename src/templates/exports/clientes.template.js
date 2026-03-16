"use strict";
/**
 * ============================================================================
 * TEMPLATE: LISTADO DE CLIENTES
 * ============================================================================
 * Usado en: clients.service.ts → exportarClientes()
 * Endpoint: GET /clients/export?format=excel|pdf
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
exports.generarExcelClientes = generarExcelClientes;
exports.generarPDFClientes = generarPDFClientes;
var ExcelJS = require("exceljs");
var PDFDocument = require("pdfkit");
var fs = require("fs");
var path = require("path");
// ─── Helpers ──────────────────────────────────────────────────────────────────
var COP = function (n) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
};
var RIESGO_COLOR = {
    ROJO: 'FFdc2626',
    AMARILLO: 'FFeab308',
    VERDE: 'FF22c55e',
    LISTA_NEGRA: 'FF1e293b',
};
var AZUL_OSCURO = 'FF004F7B';
var NARANJA = 'FFF37920';
// ─── Generador Excel ──────────────────────────────────────────────────────────
function generarExcelClientes(filas, fecha) {
    return __awaiter(this, void 0, void 0, function () {
        var workbook, ws, titleRow, c2, metaRow, headerRow, sumRow, mergeCell, buffer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    workbook = new ExcelJS.Workbook();
                    workbook.creator = 'Créditos del Sur';
                    workbook.created = new Date();
                    ws = workbook.addWorksheet('Clientes', {
                        views: [{ state: 'frozen', ySplit: 5, showGridLines: false }],
                        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
                        properties: { tabColor: { argb: 'FF0ea5e9' } },
                    });
                    ws.columns = [
                        { header: 'Código', key: 'codigo', width: 12 },
                        { header: 'Nombres', key: 'nombres', width: 22 },
                        { header: 'Apellidos', key: 'apellidos', width: 22 },
                        { header: 'Documento', key: 'dni', width: 14 },
                        { header: 'Teléfono', key: 'telefono', width: 14 },
                        { header: 'Correo', key: 'correo', width: 28 },
                        { header: 'Dirección', key: 'direccion', width: 30 },
                        { header: 'Nivel Riesgo', key: 'nivelRiesgo', width: 14 },
                        { header: 'Estado', key: 'estadoAprobacion', width: 14 },
                        { header: 'Créditos Activos', key: 'prestamosActivos', width: 16 },
                        { header: 'Saldo Total', key: 'montoTotal', width: 18 },
                        { header: 'Saldo en Mora', key: 'montoMora', width: 18 },
                        { header: 'Ruta', key: 'rutaNombre', width: 20 },
                        { header: 'Registrado', key: 'creadoEn', width: 18 },
                    ];
                    titleRow = ws.addRow(['CRÉDITOS DEL SUR — LISTADO DE CLIENTES']);
                    titleRow.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
                    titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_OSCURO } };
                    ws.mergeCells('A1:N1');
                    // Subtítulo
                    ws.addRow(['LISTADO DE CLIENTES']);
                    c2 = ws.getCell('A2');
                    c2.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
                    c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NARANJA } };
                    c2.alignment = { horizontal: 'center', vertical: 'middle' };
                    ws.mergeCells('A2:N2');
                    metaRow = ws.addRow([
                        "Generado: ".concat(new Date().toLocaleString('es-CO'), "   |   Total clientes: ").concat(filas.length),
                    ]);
                    metaRow.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
                    ws.mergeCells('A3:N3');
                    ws.getRow(1).height = 32;
                    ws.getRow(2).height = 22;
                    ws.getRow(3).height = 16;
                    ws.addRow([]);
                    headerRow = ws.getRow(5);
                    ws.columns.forEach(function (col, i) {
                        var cell = headerRow.getCell(i + 1);
                        cell.value = col.header;
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_OSCURO } };
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                        cell.border = {
                            bottom: { style: 'thin', color: { argb: 'FF0369a1' } },
                        };
                    });
                    headerRow.height = 24;
                    ws.autoFilter = { from: 'A5', to: 'N5' };
                    // Datos
                    filas.forEach(function (fila, idx) {
                        var _a;
                        var row = ws.addRow({
                            codigo: fila.codigo,
                            nombres: fila.nombres,
                            apellidos: fila.apellidos,
                            dni: fila.dni,
                            telefono: fila.telefono,
                            correo: fila.correo || '',
                            direccion: fila.direccion || '',
                            nivelRiesgo: fila.nivelRiesgo,
                            estadoAprobacion: (_a = fila.estadoAprobacion) === null || _a === void 0 ? void 0 : _a.replace(/_/g, ' '),
                            prestamosActivos: fila.prestamosActivos,
                            montoTotal: fila.montoTotal, // Keep as number for formula
                            montoMora: fila.montoMora, // Keep as number for formula
                            rutaNombre: fila.rutaNombre || 'Sin ruta',
                            creadoEn: fila.creadoEn ? new Date(fila.creadoEn).toLocaleDateString('es-CO') : '',
                        });
                        // Format currency columns
                        row.getCell(11).numFmt = '"$"#,##0';
                        row.getCell(12).numFmt = '"$"#,##0';
                        // Fila cebra
                        if (idx % 2 === 1) {
                            row.eachCell(function (cell) {
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
                            });
                        }
                        // Color en celda de nivel de riesgo
                        var riesgoCell = row.getCell(8);
                        var color = RIESGO_COLOR[fila.nivelRiesgo] || 'FF64748B';
                        riesgoCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        riesgoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
                        riesgoCell.alignment = { horizontal: 'center' };
                        // Mora en rojo si tiene
                        if (fila.montoMora > 0) {
                            row.getCell(12).font = { color: { argb: 'FFdc2626' }, bold: true };
                        }
                    });
                    // Fila total
                    ws.addRow([]);
                    sumRow = ws.addRow([
                        'TOTALES', '', '', '', '', '', '', '', '', '',
                        { formula: "SUM(K6:K".concat(5 + filas.length, ")") }, // K column for montoTotal
                        { formula: "SUM(L6:L".concat(5 + filas.length, ")") }, // L column for montoMora
                    ]);
                    sumRow.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
                    mergeCell = sumRow.getCell(1);
                    sumRow.eachCell({ includeEmpty: true }, function (c, cn) {
                        if (cn <= 10) {
                            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NARANJA } };
                            c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        }
                    });
                    ws.mergeCells("A".concat(sumRow.number, ":J").concat(sumRow.number));
                    mergeCell.alignment = { horizontal: 'right', vertical: 'middle' };
                    sumRow.height = 24;
                    sumRow.eachCell({ includeEmpty: true }, function (c, cn) {
                        c.border = {
                            top: { style: 'medium', color: { argb: 'FFFFFFFF' } },
                            right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                        };
                    });
                    [11, 12].forEach(function (c) {
                        var sc = sumRow.getCell(c);
                        sc.numFmt = '"$"#,##0';
                        sc.font = { bold: true, size: 10, color: { argb: 'FF000000' } };
                        sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
                        sc.alignment = { horizontal: 'right', vertical: 'middle' };
                    });
                    return [4 /*yield*/, workbook.xlsx.writeBuffer()];
                case 1:
                    buffer = _a.sent();
                    return [2 /*return*/, {
                            data: Buffer.from(buffer),
                            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            filename: "clientes-".concat(fecha, ".xlsx"),
                        }];
            }
        });
    });
}
// ─── Generador PDF ────────────────────────────────────────────────────────────
function generarPDFClientes(filas, fecha) {
    return __awaiter(this, void 0, void 0, function () {
        var doc, buffers, BLANCO, GRIS_CLR, GRIS_MED, GRIS_TXT, AZUL_DARK, AZUL_MED, AZUL_PALE, NAR_DARK, NAR_MED, NAR_SOFT, ROJO_DARK, ROJO_PALE, VERDE_DARK, AMARILLO_DARK, fmtCOP, getLogoPath, drawWatermark, pageNumber, mTotal, mTotalMora, drawPageHeader, drawFooter, cols, tableLeft, tableWidth, drawTableHeader, y, tx, buffer;
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
                    ROJO_DARK = '#DC2626';
                    ROJO_PALE = '#FEF2F2';
                    VERDE_DARK = '#059669';
                    AMARILLO_DARK = '#D97706';
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
                    mTotal = filas.reduce(function (s, f) { return s + (f.montoTotal || 0); }, 0);
                    mTotalMora = filas.reduce(function (s, f) { return s + (f.montoMora || 0); }, 0);
                    drawPageHeader = function () {
                        var W = doc.page.width;
                        doc.fontSize(22).font('Helvetica-Bold').fillColor(AZUL_DARK)
                            .text('Créditos del Sur', 30, 25);
                        doc.fontSize(9).font('Helvetica').fillColor(NAR_MED)
                            .text('DIRECTORIO DE CLIENTES', 30, 52, { characterSpacing: 0.5 });
                        doc.roundedRect(W - 180, 20, 148, 44, 5).fillAndStroke(BLANCO, GRIS_CLR);
                        doc.fontSize(8).font('Helvetica-Bold').fillColor(GRIS_MED)
                            .text('FECHA GENERACIÓN', W - 180, 28, { width: 148, align: 'center' });
                        doc.fontSize(10).font('Helvetica-Bold').fillColor(AZUL_DARK)
                            .text(new Date().toLocaleDateString('es-CO'), W - 180, 40, { width: 148, align: 'center' });
                        var kW = (doc.page.width - 60) / 4;
                        var kY = 98;
                        [
                            { label: 'CLIENTES REGISTRADOS', val: String(filas.length), bg: '#D6E9F5', color: AZUL_DARK, isNum: false },
                            { label: 'SALDO TOTAL', val: mTotal, bg: NAR_SOFT, color: NAR_DARK, isNum: true },
                            { label: 'EN MORA', val: mTotalMora, bg: ROJO_PALE, color: ROJO_DARK, isNum: true },
                            { label: 'CLIENTES ACTIVOS', val: String(filas.filter(function (f) { return f.prestamosActivos > 0; }).length), bg: '#F0F4F8', color: GRIS_TXT, isNum: false },
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
                        { label: 'Cód.', width: 45 },
                        { label: 'Nombre Completo', width: 150 },
                        { label: 'Documento', width: 80 },
                        { label: 'Teléfono', width: 80 },
                        { label: 'Riesgo', width: 60 },
                        { label: 'Estado', width: 80 },
                        { label: 'Créditos', width: 50 },
                        { label: 'Saldo Total', width: 80 },
                        { label: 'En Mora', width: 80 },
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
                        var _a;
                        var maxRowHeight = 17;
                        var riesgoMora = fila.montoMora > 0;
                        // Simplificamos el nombre para que quepa bien
                        var nomCompleto = "".concat(fila.nombres || '', " ").concat(fila.apellidos || '').trim();
                        var vals = [
                            fila.codigo || '',
                            nomCompleto,
                            fila.dni || '',
                            fila.telefono || '',
                            fila.nivelRiesgo || '',
                            ((_a = fila.estadoAprobacion) === null || _a === void 0 ? void 0 : _a.replace(/_/g, ' ')) || '',
                            String(fila.prestamosActivos || 0),
                            fmtCOP(fila.montoTotal || 0),
                            fmtCOP(fila.montoMora || 0),
                        ];
                        doc.font('Helvetica').fontSize(7.5);
                        vals.forEach(function (val, ci) {
                            if (ci === 0 || ci === 1 || ci === 7 || (ci === 8 && riesgoMora))
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
                        var bg = riesgoMora ? ROJO_PALE : baseBg;
                        doc.rect(tableLeft, y, tableWidth, maxRowHeight).fill(bg);
                        doc.moveTo(tableLeft, y + maxRowHeight)
                            .lineTo(tableLeft + tableWidth, y + maxRowHeight)
                            .strokeColor(GRIS_CLR).lineWidth(0.4).stroke();
                        var x = tableLeft;
                        vals.forEach(function (v, ci) {
                            var _a;
                            var align = ci >= 7 ? 'right' : (ci === 4 || ci === 6 ? 'center' : 'left');
                            if (ci === 1) {
                                doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
                            }
                            else if (ci === 8 && riesgoMora) {
                                doc.font('Helvetica-Bold').fillColor(ROJO_DARK);
                            }
                            else if (ci === 7) {
                                doc.font('Helvetica-Bold').fillColor(AZUL_DARK);
                            }
                            else if (ci === 0) {
                                doc.font('Helvetica-Bold').fillColor(GRIS_TXT);
                            }
                            else if (ci === 4) {
                                var rr = ((_a = fila.nivelRiesgo) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || '';
                                if (rr === 'ROJO' || rr === 'LISTA_NEGRA')
                                    doc.font('Helvetica-Bold').fillColor(ROJO_DARK);
                                else if (rr === 'VERDE')
                                    doc.font('Helvetica-Bold').fillColor(VERDE_DARK);
                                else if (rr === 'AMARILLO')
                                    doc.font('Helvetica-Bold').fillColor(AMARILLO_DARK);
                                else
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
                    doc.text("TOTAL GENERAL  /  ".concat(filas.length, " clientes"), tableLeft + 6, y + 8, { width: cols.slice(0, 7).reduce(function (s, c) { return s + c.width; }, 0) - 10 });
                    tx = tableLeft + cols.slice(0, 7).reduce(function (s, c) { return s + c.width; }, 0);
                    [
                        fmtCOP(mTotal),
                        fmtCOP(mTotalMora),
                    ].forEach(function (val, i) {
                        var ci = i + 7; // a partir de la columna 7
                        if (ci < cols.length) {
                            doc.fillColor(i === 1 ? '#FECACA' : BLANCO).font('Helvetica-Bold').fontSize(8);
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
                            filename: "clientes-".concat(fecha, ".pdf"),
                        }];
            }
        });
    });
}
