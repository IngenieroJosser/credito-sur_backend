"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
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
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var inventario_template_1 = require("../templates/exports/inventario.template");
var InventoryService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var InventoryService = _classThis = /** @class */ (function () {
        function InventoryService_1(prisma, notificacionesGateway) {
            this.prisma = prisma;
            this.notificacionesGateway = notificacionesGateway;
        }
        InventoryService_1.prototype.exportarInventario = function (format) {
            return __awaiter(this, void 0, void 0, function () {
                var productos, filas, totales, fecha;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.producto.findMany({
                                where: { eliminadoEn: null },
                                select: {
                                    codigo: true,
                                    nombre: true,
                                    categoria: true,
                                    marca: true,
                                    modelo: true,
                                    costo: true,
                                    stock: true,
                                    stockMinimo: true,
                                    activo: true,
                                    creadoEn: true,
                                },
                                orderBy: { creadoEn: 'desc' },
                            })];
                        case 1:
                            productos = _a.sent();
                            filas = productos.map(function (p) {
                                var _a, _b;
                                return ({
                                    codigo: p.codigo,
                                    nombre: p.nombre,
                                    categoria: p.categoria,
                                    marca: (_a = p.marca) !== null && _a !== void 0 ? _a : null,
                                    modelo: (_b = p.modelo) !== null && _b !== void 0 ? _b : null,
                                    costo: Number(p.costo) || 0,
                                    stock: Number(p.stock) || 0,
                                    stockMinimo: Number(p.stockMinimo) || 0,
                                    activo: Boolean(p.activo),
                                    creadoEn: p.creadoEn,
                                });
                            });
                            totales = {
                                totalProductos: filas.length,
                                totalValorInventario: filas.reduce(function (acc, f) { return acc + (Number(f.costo) || 0) * (Number(f.stock) || 0); }, 0),
                                productosBajoStock: filas.filter(function (f) { return Number(f.stock) <= Number(f.stockMinimo); }).length,
                            };
                            fecha = new Date().toISOString().split('T')[0];
                            if (format === 'excel')
                                return [2 /*return*/, (0, inventario_template_1.generarExcelInventario)(filas, totales, fecha)];
                            return [2 /*return*/, (0, inventario_template_1.generarPDFInventario)(filas, totales, fecha)];
                    }
                });
            });
        };
        InventoryService_1.prototype.getInventoryStats = function () {
            return __awaiter(this, void 0, void 0, function () {
                var totalReferencias, products, totalValor, bajoStock;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.producto.count({
                                where: { activo: true, eliminadoEn: null },
                            })];
                        case 1:
                            totalReferencias = _a.sent();
                            return [4 /*yield*/, this.prisma.producto.findMany({
                                    where: { activo: true, eliminadoEn: null },
                                    select: { costo: true, stock: true, stockMinimo: true },
                                })];
                        case 2:
                            products = _a.sent();
                            totalValor = products.reduce(function (acc, curr) { return acc + Number(curr.costo) * curr.stock; }, 0);
                            bajoStock = products.filter(function (p) { return p.stock <= p.stockMinimo; }).length;
                            return [2 /*return*/, {
                                    totalProductos: totalReferencias, // Changed key to match interface if needed, or kept generic
                                    totalReferencias: totalReferencias,
                                    totalValorInventario: totalValor,
                                    productosBajoStock: bajoStock,
                                    productosActivos: totalReferencias, // Added based on frontend DTO
                                }];
                    }
                });
            });
        };
        InventoryService_1.prototype.create = function (createInventoryDto) {
            return __awaiter(this, void 0, void 0, function () {
                var existingProduct, preciosData, hasContado, categoriaNombre, categoriaId, cat, cat, product, error_1;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 7, , 8]);
                            return [4 /*yield*/, this.prisma.producto.findUnique({
                                    where: { codigo: createInventoryDto.codigo },
                                })];
                        case 1:
                            existingProduct = _b.sent();
                            if (existingProduct) {
                                throw new common_1.ConflictException('El código de producto ya existe');
                            }
                            preciosData = createInventoryDto.precios
                                ? __spreadArray([], createInventoryDto.precios, true) : [];
                            if (createInventoryDto.precioContado !== undefined) {
                                hasContado = preciosData.some(function (p) { return p.meses === 0; });
                                if (!hasContado) {
                                    preciosData.push({
                                        meses: 0,
                                        precio: createInventoryDto.precioContado,
                                    });
                                }
                            }
                            categoriaNombre = createInventoryDto.categoria || 'General';
                            categoriaId = createInventoryDto.categoriaId;
                            if (!categoriaId) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.prisma.categoria.findUnique({
                                    where: { id: categoriaId },
                                })];
                        case 2:
                            cat = _b.sent();
                            if (cat) {
                                categoriaNombre = cat.nombre;
                            }
                            else {
                                // If ID invalid, maybe reset? Or throw?
                                // Let's assume valid or ignore ID
                                categoriaId = undefined;
                            }
                            return [3 /*break*/, 5];
                        case 3:
                            if (!createInventoryDto.categoria) return [3 /*break*/, 5];
                            return [4 /*yield*/, this.prisma.categoria.findFirst({
                                    where: {
                                        nombre: {
                                            equals: createInventoryDto.categoria,
                                            mode: 'insensitive',
                                        },
                                    },
                                })];
                        case 4:
                            cat = _b.sent();
                            if (cat) {
                                categoriaId = cat.id;
                                categoriaNombre = cat.nombre; // Normalize case
                            }
                            _b.label = 5;
                        case 5: return [4 /*yield*/, this.prisma.producto.create({
                                data: {
                                    codigo: createInventoryDto.codigo,
                                    nombre: createInventoryDto.nombre,
                                    descripcion: createInventoryDto.descripcion,
                                    categoria: categoriaNombre,
                                    categoriaId: categoriaId,
                                    marca: createInventoryDto.marca,
                                    modelo: createInventoryDto.modelo,
                                    costo: createInventoryDto.costo,
                                    stock: createInventoryDto.stock,
                                    stockMinimo: createInventoryDto.stockMinimo,
                                    activo: (_a = createInventoryDto.activo) !== null && _a !== void 0 ? _a : true,
                                    precios: {
                                        create: preciosData.map(function (p) { return ({
                                            meses: p.meses,
                                            precio: p.precio,
                                        }); }),
                                    },
                                },
                                include: {
                                    precios: true,
                                },
                            })];
                        case 6:
                            product = _b.sent();
                            this.notificacionesGateway.broadcastInventarioActualizado({ action: 'create', product: product });
                            return [2 /*return*/, product];
                        case 7:
                            error_1 = _b.sent();
                            if (error_1 instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                                if (error_1.code === 'P2002') {
                                    throw new common_1.ConflictException('El código de producto ya existe');
                                }
                            }
                            throw error_1;
                        case 8: return [2 /*return*/];
                    }
                });
            });
        };
        InventoryService_1.prototype.findAll = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.prisma.producto.findMany({
                            where: { eliminadoEn: null },
                            include: {
                                precios: {
                                    orderBy: { meses: 'asc' },
                                },
                            },
                            orderBy: { creadoEn: 'desc' },
                        })];
                });
            });
        };
        InventoryService_1.prototype.findOne = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var product;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.producto.findUnique({
                                where: { id: id },
                                include: {
                                    precios: {
                                        orderBy: { meses: 'asc' },
                                    },
                                },
                            })];
                        case 1:
                            product = _a.sent();
                            if (!product) {
                                throw new common_1.NotFoundException('Producto no encontrado');
                            }
                            return [2 /*return*/, product];
                    }
                });
            });
        };
        InventoryService_1.prototype.update = function (id, updateInventoryDto) {
            return __awaiter(this, void 0, void 0, function () {
                var existingProduct, duplicate, updatedProduct, error_2;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.producto.findUnique({
                                where: { id: id },
                            })];
                        case 1:
                            existingProduct = _a.sent();
                            if (!existingProduct) {
                                throw new common_1.NotFoundException('Producto no encontrado');
                            }
                            if (!(updateInventoryDto.codigo &&
                                updateInventoryDto.codigo !== existingProduct.codigo)) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.prisma.producto.findUnique({
                                    where: { codigo: updateInventoryDto.codigo },
                                })];
                        case 2:
                            duplicate = _a.sent();
                            if (duplicate)
                                throw new common_1.ConflictException('El código de producto ya existe');
                            _a.label = 3;
                        case 3:
                            _a.trys.push([3, 5, , 6]);
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    var catName, catId, cat, cat;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                catName = updateInventoryDto.categoria;
                                                catId = updateInventoryDto.categoriaId;
                                                if (!(catId !== undefined || catName !== undefined)) return [3 /*break*/, 4];
                                                if (!catId) return [3 /*break*/, 2];
                                                return [4 /*yield*/, tx.categoria.findUnique({
                                                        where: { id: catId },
                                                    })];
                                            case 1:
                                                cat = _a.sent();
                                                if (cat) {
                                                    catName = cat.nombre;
                                                }
                                                else {
                                                    catId = null; // Invalid ID provided, unlink
                                                }
                                                return [3 /*break*/, 4];
                                            case 2:
                                                if (!catName) return [3 /*break*/, 4];
                                                return [4 /*yield*/, tx.categoria.findFirst({
                                                        where: { nombre: { equals: catName, mode: 'insensitive' } },
                                                    })];
                                            case 3:
                                                cat = _a.sent();
                                                if (cat) {
                                                    catId = cat.id;
                                                    catName = cat.nombre;
                                                }
                                                else {
                                                    catId = null; // No match, unlink
                                                }
                                                _a.label = 4;
                                            case 4: 
                                            // Update basic fields
                                            return [4 /*yield*/, tx.producto.update({
                                                    where: { id: id },
                                                    data: {
                                                        codigo: updateInventoryDto.codigo,
                                                        nombre: updateInventoryDto.nombre,
                                                        descripcion: updateInventoryDto.descripcion,
                                                        categoria: catName,
                                                        categoriaId: catId,
                                                        marca: updateInventoryDto.marca,
                                                        modelo: updateInventoryDto.modelo,
                                                        costo: updateInventoryDto.costo,
                                                        stock: updateInventoryDto.stock,
                                                        stockMinimo: updateInventoryDto.stockMinimo,
                                                        activo: updateInventoryDto.activo,
                                                    },
                                                })];
                                            case 5:
                                                // Update basic fields
                                                _a.sent();
                                                if (!(updateInventoryDto.precios ||
                                                    updateInventoryDto.precioContado !== undefined)) return [3 /*break*/, 10];
                                                if (!updateInventoryDto.precios) return [3 /*break*/, 8];
                                                return [4 /*yield*/, tx.precioProducto.deleteMany({
                                                        where: { productoId: id, meses: { gt: 0 } }, // Delete credit prices
                                                    })];
                                            case 6:
                                                _a.sent();
                                                if (!(updateInventoryDto.precios.length > 0)) return [3 /*break*/, 8];
                                                return [4 /*yield*/, tx.precioProducto.createMany({
                                                        data: updateInventoryDto.precios.map(function (p) { return ({
                                                            productoId: id,
                                                            meses: p.meses,
                                                            precio: p.precio,
                                                        }); }),
                                                    })];
                                            case 7:
                                                _a.sent();
                                                _a.label = 8;
                                            case 8:
                                                if (!(updateInventoryDto.precioContado !== undefined)) return [3 /*break*/, 10];
                                                // Update or create precioContado (meses=0)
                                                return [4 /*yield*/, tx.precioProducto.upsert({
                                                        where: { productoId_meses: { productoId: id, meses: 0 } },
                                                        update: { precio: updateInventoryDto.precioContado },
                                                        create: {
                                                            productoId: id,
                                                            meses: 0,
                                                            precio: updateInventoryDto.precioContado,
                                                        },
                                                    })];
                                            case 9:
                                                // Update or create precioContado (meses=0)
                                                _a.sent();
                                                _a.label = 10;
                                            case 10: return [4 /*yield*/, tx.producto.findUnique({
                                                    where: { id: id },
                                                    include: { precios: { orderBy: { meses: 'asc' } } },
                                                })];
                                            case 11: return [2 /*return*/, _a.sent()];
                                        }
                                    });
                                }); })];
                        case 4:
                            updatedProduct = _a.sent();
                            this.notificacionesGateway.broadcastInventarioActualizado({ action: 'update', product: updatedProduct });
                            return [2 /*return*/, updatedProduct];
                        case 5:
                            error_2 = _a.sent();
                            throw error_2;
                        case 6: return [2 /*return*/];
                    }
                });
            });
        };
        InventoryService_1.prototype.remove = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var existingProduct, deletedProduct;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.producto.findUnique({
                                where: { id: id },
                            })];
                        case 1:
                            existingProduct = _a.sent();
                            if (!existingProduct)
                                throw new common_1.NotFoundException('Producto no encontrado');
                            return [4 /*yield*/, this.prisma.producto.update({
                                    where: { id: id },
                                    data: {
                                        eliminadoEn: new Date(),
                                        activo: false,
                                    },
                                })];
                        case 2:
                            deletedProduct = _a.sent();
                            this.notificacionesGateway.broadcastInventarioActualizado({ action: 'remove', id: id });
                            return [2 /*return*/, deletedProduct];
                    }
                });
            });
        };
        InventoryService_1.prototype.findArchived = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.prisma.producto.findMany({
                            where: {
                                eliminadoEn: { not: null },
                                ocultoArchivadosEn: null,
                            },
                            include: {
                                precios: {
                                    orderBy: { meses: 'asc' },
                                },
                            },
                            orderBy: { eliminadoEn: 'desc' },
                        })];
                });
            });
        };
        InventoryService_1.prototype.restore = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var existingProduct, restoredProduct;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.producto.findUnique({
                                where: { id: id },
                                select: { id: true },
                            })];
                        case 1:
                            existingProduct = _a.sent();
                            if (!existingProduct)
                                throw new common_1.NotFoundException('Producto no encontrado');
                            return [4 /*yield*/, this.prisma.producto.update({
                                    where: { id: id },
                                    data: {
                                        eliminadoEn: null,
                                        ocultoArchivadosEn: null,
                                        activo: true,
                                    },
                                })];
                        case 2:
                            restoredProduct = _a.sent();
                            this.notificacionesGateway.broadcastInventarioActualizado({ action: 'restore', id: id });
                            return [2 /*return*/, restoredProduct];
                    }
                });
            });
        };
        InventoryService_1.prototype.hideArchived = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var existingProduct, hiddenProduct;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.producto.findUnique({
                                where: { id: id },
                                select: { id: true, eliminadoEn: true },
                            })];
                        case 1:
                            existingProduct = _a.sent();
                            if (!existingProduct)
                                throw new common_1.NotFoundException('Producto no encontrado');
                            // Solo aplica para elementos archivados
                            if (!existingProduct.eliminadoEn) {
                                throw new common_1.ConflictException('El producto no está archivado');
                            }
                            return [4 /*yield*/, this.prisma.producto.update({
                                    where: { id: id },
                                    data: {
                                        ocultoArchivadosEn: new Date(),
                                    },
                                })];
                        case 2:
                            hiddenProduct = _a.sent();
                            this.notificacionesGateway.broadcastInventarioActualizado({ action: 'hideArchived', id: id });
                            return [2 /*return*/, hiddenProduct];
                    }
                });
            });
        };
        return InventoryService_1;
    }());
    __setFunctionName(_classThis, "InventoryService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        InventoryService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return InventoryService = _classThis;
}();
exports.InventoryService = InventoryService;
