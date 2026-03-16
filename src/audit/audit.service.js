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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
var common_1 = require("@nestjs/common");
var auditoria_template_1 = require("../templates/exports/auditoria.template");
var AuditService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var AuditService = _classThis = /** @class */ (function () {
        function AuditService_1(prisma) {
            this.prisma = prisma;
        }
        AuditService_1.prototype.create = function (data) {
            return __awaiter(this, void 0, void 0, function () {
                var cambios;
                var _a, _b, _c;
                return __generator(this, function (_d) {
                    cambios = null;
                    if (data.datosAnteriores && data.datosNuevos) {
                        // Aquí podrías implementar una lógica para calcular diferencias
                        cambios = { diff: 'calculated' };
                    }
                    return [2 /*return*/, this.prisma.registroAuditoria.create({
                            data: {
                                usuarioId: data.usuarioId,
                                accion: data.accion,
                                entidad: data.entidad,
                                entidadId: data.entidadId,
                                valoresAnteriores: data.datosAnteriores || {},
                                valoresNuevos: data.datosNuevos || {},
                                cambios: cambios || {},
                                direccionIP: (_a = data.metadata) === null || _a === void 0 ? void 0 : _a.ip,
                                agenteUsuario: (_b = data.metadata) === null || _b === void 0 ? void 0 : _b.userAgent,
                                endpoint: (_c = data.metadata) === null || _c === void 0 ? void 0 : _c.endpoint,
                            },
                        })];
                });
            });
        };
        AuditService_1.prototype.findAll = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.prisma.registroAuditoria.findMany({
                            orderBy: { creadoEn: 'desc' },
                            take: 100,
                            include: {
                                usuario: {
                                    select: { nombres: true, apellidos: true, correo: true, rol: true },
                                },
                            },
                        })];
                });
            });
        };
        /** Versión paginada con total para el frontend */
        AuditService_1.prototype.findAllPaginated = function () {
            return __awaiter(this, arguments, void 0, function (pagina, limite) {
                var skip, _a, registros, total;
                if (pagina === void 0) { pagina = 1; }
                if (limite === void 0) { limite = 50; }
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            skip = (pagina - 1) * limite;
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.registroAuditoria.findMany({
                                        orderBy: { creadoEn: 'desc' },
                                        take: limite,
                                        skip: skip,
                                        include: {
                                            usuario: {
                                                select: { nombres: true, apellidos: true, correo: true, rol: true },
                                            },
                                        },
                                    }),
                                    this.prisma.registroAuditoria.count(),
                                ])];
                        case 1:
                            _a = _b.sent(), registros = _a[0], total = _a[1];
                            return [2 /*return*/, {
                                    registros: registros,
                                    total: total,
                                    pagina: pagina,
                                    limite: limite,
                                    totalPaginas: Math.ceil(total / limite),
                                }];
                    }
                });
            });
        };
        AuditService_1.prototype.findByUserId = function (usuarioId_1) {
            return __awaiter(this, arguments, void 0, function (usuarioId, take, page, startDate, endDate) {
                var skip, where;
                if (take === void 0) { take = 20; }
                if (page === void 0) { page = 1; }
                return __generator(this, function (_a) {
                    skip = page > 1 ? (page - 1) * take : 0;
                    where = { usuarioId: usuarioId };
                    if (startDate || endDate) {
                        where.creadoEn = {};
                        if (startDate)
                            where.creadoEn.gte = startDate;
                        if (endDate)
                            where.creadoEn.lte = endDate;
                    }
                    return [2 /*return*/, this.prisma.registroAuditoria.findMany({
                            where: where,
                            orderBy: { creadoEn: 'desc' },
                            take: take,
                            skip: skip,
                            select: {
                                id: true,
                                accion: true,
                                entidad: true,
                                entidadId: true,
                                valoresAnteriores: true,
                                valoresNuevos: true,
                                cambios: true,
                                creadoEn: true,
                                endpoint: true,
                            },
                        })];
                });
            });
        };
        AuditService_1.prototype.findOne = function (id) {
            return this.prisma.registroAuditoria.findUnique({
                where: { id: id },
            });
        };
        AuditService_1.prototype.exportAuditLog = function (format, filters) {
            return __awaiter(this, void 0, void 0, function () {
                var where, logs, fecha, filas;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            where = {};
                            if (filters.startDate || filters.endDate) {
                                where.creadoEn = {};
                                if (filters.startDate)
                                    where.creadoEn.gte = new Date(filters.startDate);
                                if (filters.endDate)
                                    where.creadoEn.lte = new Date(filters.endDate);
                            }
                            return [4 /*yield*/, this.prisma.registroAuditoria.findMany({
                                    where: where,
                                    orderBy: { creadoEn: 'desc' },
                                    take: 5000,
                                    include: {
                                        usuario: { select: { nombres: true, apellidos: true } },
                                    },
                                })];
                        case 1:
                            logs = _a.sent();
                            fecha = new Date().toISOString().split('T')[0];
                            filas = logs.map(function (l) { return ({
                                fecha: l.creadoEn,
                                usuario: l.usuario ? "".concat(l.usuario.nombres, " ").concat(l.usuario.apellidos) : '',
                                accion: l.accion || '',
                                entidad: l.entidad || '',
                                entidadId: l.entidadId || '',
                                datosAnteriores: l.valoresAnteriores,
                                datosNuevos: l.valoresNuevos,
                            }); });
                            // 3. Delegamos la generación al template
                            if (format === 'excel')
                                return [2 /*return*/, (0, auditoria_template_1.generarExcelAuditoria)(filas, fecha)];
                            if (format === 'pdf')
                                return [2 /*return*/, (0, auditoria_template_1.generarPDFAuditoria)(filas, fecha)];
                            throw new Error("Formato no soportado: ".concat(format));
                    }
                });
            });
        };
        AuditService_1.prototype.hideArchivedItem = function (data) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.prisma.archivadoOculto.upsert({
                            where: { entidad_entidadId: { entidad: data.entidad, entidadId: data.entidadId } },
                            update: { ocultoEn: new Date() },
                            create: { entidad: data.entidad, entidadId: data.entidadId },
                        })];
                });
            });
        };
        AuditService_1.prototype.listHiddenArchivedItems = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.prisma.archivadoOculto.findMany({
                            select: { entidad: true, entidadId: true },
                            orderBy: { ocultoEn: 'desc' },
                            take: 5000,
                        })];
                });
            });
        };
        return AuditService_1;
    }());
    __setFunctionName(_classThis, "AuditService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AuditService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AuditService = _classThis;
}();
exports.AuditService = AuditService;
