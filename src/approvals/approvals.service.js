"use strict";
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
exports.ApprovalsService = void 0;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var ApprovalsService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var ApprovalsService = _classThis = /** @class */ (function () {
        function ApprovalsService_1(prisma, notificacionesService, notificacionesGateway) {
            this.prisma = prisma;
            this.notificacionesService = notificacionesService;
            this.notificacionesGateway = notificacionesGateway;
            this.logger = new common_1.Logger(ApprovalsService.name);
        }
        ApprovalsService_1.prototype.notifyCobradorGestionVencida = function (params) {
            return __awaiter(this, void 0, void 0, function () {
                var asignacion, cobradorId, e_1;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 3, , 4]);
                            return [4 /*yield*/, this.prisma.asignacionRuta.findFirst({
                                    where: { cliente: { prestamos: { some: { id: params.prestamoId } } }, activa: true },
                                    select: { ruta: { select: { cobradorId: true } } },
                                })];
                        case 1:
                            asignacion = _b.sent();
                            cobradorId = (_a = asignacion === null || asignacion === void 0 ? void 0 : asignacion.ruta) === null || _a === void 0 ? void 0 : _a.cobradorId;
                            if (!cobradorId)
                                return [2 /*return*/];
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: cobradorId,
                                    titulo: params.titulo,
                                    mensaje: params.mensaje,
                                    tipo: params.tipo || 'SISTEMA',
                                    entidad: 'Prestamo',
                                    entidadId: params.prestamoId,
                                    metadata: __assign(__assign({}, (params.metadata || {})), { prestamoId: params.prestamoId }),
                                })];
                        case 2:
                            _b.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            e_1 = _b.sent();
                            this.logger.warn('No se pudo notificar al cobrador por gestión vencida', e_1);
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        ApprovalsService_1.prototype.approveItem = function (id, _type, aprobadoPorId, notas, editedData) {
            return __awaiter(this, void 0, void 0, function () {
                var approval, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.prisma.aprobacion.findUnique({
                                where: { id: id },
                            })];
                        case 1:
                            approval = _b.sent();
                            if (!approval) {
                                throw new common_1.NotFoundException('Aprobación no encontrada');
                            }
                            if (approval.estado !== client_1.EstadoAprobacion.PENDIENTE) {
                                throw new common_1.BadRequestException("Esta solicitud ya fue procesada (estado: ".concat(approval.estado, ")"));
                            }
                            _a = approval.tipoAprobacion;
                            switch (_a) {
                                case client_1.TipoAprobacion.NUEVO_CLIENTE: return [3 /*break*/, 2];
                                case client_1.TipoAprobacion.NUEVO_PRESTAMO: return [3 /*break*/, 4];
                                case client_1.TipoAprobacion.GASTO: return [3 /*break*/, 6];
                                case client_1.TipoAprobacion.SOLICITUD_BASE_EFECTIVO: return [3 /*break*/, 8];
                                case client_1.TipoAprobacion.PRORROGA_PAGO: return [3 /*break*/, 10];
                            }
                            return [3 /*break*/, 12];
                        case 2: return [4 /*yield*/, this.approveNewClient(approval)];
                        case 3:
                            _b.sent();
                            return [3 /*break*/, 13];
                        case 4: return [4 /*yield*/, this.approveNewLoan(approval, aprobadoPorId, editedData)];
                        case 5:
                            _b.sent();
                            return [3 /*break*/, 13];
                        case 6: return [4 /*yield*/, this.approveExpense(approval, aprobadoPorId)];
                        case 7:
                            _b.sent();
                            return [3 /*break*/, 13];
                        case 8: return [4 /*yield*/, this.approveCashBase(approval, aprobadoPorId)];
                        case 9:
                            _b.sent();
                            return [3 /*break*/, 13];
                        case 10: return [4 /*yield*/, this.approvePaymentExtension(approval, aprobadoPorId)];
                        case 11:
                            _b.sent();
                            return [3 /*break*/, 13];
                        case 12: throw new common_1.BadRequestException('Tipo de aprobación no soportado');
                        case 13: return [4 /*yield*/, this.prisma.aprobacion.update({
                                where: { id: id },
                                data: {
                                    estado: client_1.EstadoAprobacion.APROBADO,
                                    aprobadoPorId: aprobadoPorId || undefined,
                                    comentarios: notas || undefined,
                                    datosAprobados: editedData || undefined,
                                    revisadoEn: new Date(),
                                },
                            })];
                        case 14:
                            _b.sent();
                            this.notificacionesGateway.broadcastAprobacionesActualizadas({
                                accion: 'APROBAR',
                                aprobacionId: id,
                                tipoAprobacion: approval.tipoAprobacion,
                            });
                            this.logger.log("Aprobaci\u00F3n ".concat(id, " procesada por ").concat(aprobadoPorId || 'desconocido', " (tipo: ").concat(approval.tipoAprobacion, ")"));
                            return [2 /*return*/, { success: true, message: 'Aprobación procesada exitosamente' }];
                    }
                });
            });
        };
        /**
         * Obtener el historial de aprobaciones para una entidad específica
         */
        ApprovalsService_1.prototype.getHistory = function (referenciaId, tablaReferencia) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.prisma.aprobacion.findMany({
                            where: {
                                referenciaId: referenciaId,
                                tablaReferencia: tablaReferencia,
                            },
                            include: {
                                solicitadoPor: {
                                    select: { nombres: true, apellidos: true }
                                },
                                aprobadoPor: {
                                    select: { nombres: true, apellidos: true }
                                }
                            },
                            orderBy: { creadoEn: 'desc' }
                        })];
                });
            });
        };
        /**
         * Obtener todas las aprobaciones pendientes agrupadas por tipo.
         * Incluye datos del solicitante y montos para el módulo de Revisiones.
         */
        ApprovalsService_1.prototype.getPendingApprovals = function (tipo) {
            return __awaiter(this, void 0, void 0, function () {
                var where, pendientes, grouped, conteo, _i, pendientes_1, item, key, datos;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            where = { estado: client_1.EstadoAprobacion.PENDIENTE };
                            if (tipo)
                                where.tipoAprobacion = tipo;
                            return [4 /*yield*/, this.prisma.aprobacion.findMany({
                                    where: where,
                                    include: {
                                        solicitadoPor: {
                                            select: { id: true, nombres: true, apellidos: true, rol: true }
                                        },
                                        aprobadoPor: {
                                            select: { id: true, nombres: true, apellidos: true }
                                        }
                                    },
                                    orderBy: { creadoEn: 'desc' }
                                })];
                        case 1:
                            pendientes = _b.sent();
                            grouped = {};
                            conteo = {};
                            for (_i = 0, pendientes_1 = pendientes; _i < pendientes_1.length; _i++) {
                                item = pendientes_1[_i];
                                key = item.tipoAprobacion;
                                if (!grouped[key]) {
                                    grouped[key] = [];
                                    conteo[key] = 0;
                                }
                                datos = typeof item.datosSolicitud === 'string'
                                    ? JSON.parse(item.datosSolicitud)
                                    : item.datosSolicitud;
                                grouped[key].push(__assign(__assign({}, item), { datosSolicitud: datos, solicitante: item.solicitadoPor
                                        ? "".concat(item.solicitadoPor.nombres, " ").concat(item.solicitadoPor.apellidos).trim()
                                        : 'Desconocido', rolSolicitante: ((_a = item.solicitadoPor) === null || _a === void 0 ? void 0 : _a.rol) || 'N/A' }));
                                conteo[key]++;
                            }
                            return [2 /*return*/, {
                                    total: pendientes.length,
                                    conteo: conteo,
                                    items: grouped,
                                }];
                    }
                });
            });
        };
        /**
         * Obtener items rechazados que necesitan revisión final del SuperAdmin.
         */
        ApprovalsService_1.prototype.getSuperadminReviewItems = function () {
            return __awaiter(this, void 0, void 0, function () {
                var rechazados;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.aprobacion.findMany({
                                where: {
                                    estado: client_1.EstadoAprobacion.RECHAZADO,
                                    revisadoEn: {
                                        gte: new Date(Date.now() - 72 * 60 * 60 * 1000),
                                    },
                                },
                                include: {
                                    solicitadoPor: {
                                        select: { id: true, nombres: true, apellidos: true, rol: true }
                                    },
                                    aprobadoPor: {
                                        select: { id: true, nombres: true, apellidos: true, rol: true }
                                    }
                                },
                                orderBy: { revisadoEn: 'desc' },
                            })];
                        case 1:
                            rechazados = _a.sent();
                            return [2 /*return*/, {
                                    total: rechazados.length,
                                    items: rechazados.map(function (item) {
                                        var _a;
                                        var datos = typeof item.datosSolicitud === 'string'
                                            ? JSON.parse(item.datosSolicitud)
                                            : item.datosSolicitud;
                                        return __assign(__assign({}, item), { datosSolicitud: datos, solicitante: item.solicitadoPor
                                                ? "".concat(item.solicitadoPor.nombres, " ").concat(item.solicitadoPor.apellidos).trim()
                                                : 'Desconocido', rechazadoPor: item.aprobadoPor
                                                ? "".concat(item.aprobadoPor.nombres, " ").concat(item.aprobadoPor.apellidos).trim()
                                                : 'Desconocido', rolRechazador: ((_a = item.aprobadoPor) === null || _a === void 0 ? void 0 : _a.rol) || 'N/A' });
                                    }),
                                }];
                    }
                });
            });
        };
        /**
         * Confirmar o revertir un rechazo (decisión final del SuperAdmin).
         */
        ApprovalsService_1.prototype.confirmSuperadminAction = function (id, accion, userId, notas) {
            return __awaiter(this, void 0, void 0, function () {
                var approval, error_1, error_2, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.prisma.aprobacion.findUnique({ where: { id: id } })];
                        case 1:
                            approval = _b.sent();
                            if (!approval) {
                                throw new common_1.NotFoundException('Aprobación no encontrada');
                            }
                            if (!(accion === 'CONFIRMAR')) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.prisma.aprobacion.update({
                                    where: { id: id },
                                    data: {
                                        estado: client_1.EstadoAprobacion.CANCELADO,
                                        comentarios: notas
                                            ? "[SuperAdmin] Eliminaci\u00F3n confirmada: ".concat(notas)
                                            : "[SuperAdmin] Eliminaci\u00F3n confirmada",
                                    },
                                })];
                        case 2:
                            _b.sent();
                            this.notificacionesGateway.broadcastAprobacionesActualizadas({
                                accion: 'CONFIRMAR',
                                aprobacionId: id,
                                tipoAprobacion: approval.tipoAprobacion,
                            });
                            return [2 /*return*/, { success: true, message: 'Eliminación confirmada por el SuperAdministrador' }];
                        case 3: return [4 /*yield*/, this.prisma.aprobacion.update({
                                where: { id: id },
                                data: {
                                    estado: client_1.EstadoAprobacion.PENDIENTE,
                                    aprobadoPorId: null,
                                    revisadoEn: null,
                                    comentarios: notas
                                        ? "[SuperAdmin] Revertido a pendiente: ".concat(notas)
                                        : "[SuperAdmin] Revertido a pendiente para re-evaluaci\u00F3n",
                                },
                            })];
                        case 4:
                            _b.sent();
                            this.notificacionesGateway.broadcastAprobacionesActualizadas({
                                accion: 'REVERTIR',
                                aprobacionId: id,
                                tipoAprobacion: approval.tipoAprobacion,
                            });
                            if (!(approval.tipoAprobacion === client_1.TipoAprobacion.NUEVO_PRESTAMO && approval.referenciaId)) return [3 /*break*/, 9];
                            _b.label = 5;
                        case 5:
                            _b.trys.push([5, 7, , 8]);
                            return [4 /*yield*/, this.prisma.prestamo.update({
                                    where: { id: approval.referenciaId },
                                    data: { estadoAprobacion: client_1.EstadoAprobacion.PENDIENTE, eliminadoEn: null },
                                })];
                        case 6:
                            _b.sent();
                            return [3 /*break*/, 8];
                        case 7:
                            error_1 = _b.sent();
                            this.logger.error("Error revirtiendo pr\u00E9stamo ".concat(approval.referenciaId, ":"), error_1);
                            return [3 /*break*/, 8];
                        case 8: return [3 /*break*/, 13];
                        case 9:
                            if (!(approval.tipoAprobacion === client_1.TipoAprobacion.NUEVO_CLIENTE && approval.referenciaId)) return [3 /*break*/, 13];
                            _b.label = 10;
                        case 10:
                            _b.trys.push([10, 12, , 13]);
                            return [4 /*yield*/, this.prisma.cliente.update({
                                    where: { id: approval.referenciaId },
                                    data: { estadoAprobacion: client_1.EstadoAprobacion.PENDIENTE, eliminadoEn: null },
                                })];
                        case 11:
                            _b.sent();
                            return [3 /*break*/, 13];
                        case 12:
                            error_2 = _b.sent();
                            this.logger.error("Error revirtiendo cliente ".concat(approval.referenciaId, ":"), error_2);
                            return [3 /*break*/, 13];
                        case 13:
                            _b.trys.push([13, 15, , 16]);
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: approval.solicitadoPorId,
                                    titulo: 'Solicitud Restaurada',
                                    mensaje: 'Tu solicitud fue restaurada a estado pendiente por el SuperAdministrador para re-evaluación.',
                                    tipo: 'SISTEMA',
                                    entidad: 'Aprobacion',
                                    entidadId: approval.id,
                                })];
                        case 14:
                            _b.sent();
                            return [3 /*break*/, 16];
                        case 15:
                            _a = _b.sent();
                            return [3 /*break*/, 16];
                        case 16: return [2 /*return*/, { success: true, message: 'Solicitud restaurada a pendiente para re-evaluación' }];
                    }
                });
            });
        };
        ApprovalsService_1.prototype.rejectItem = function (id, _type, rechazadoPorId, motivoRechazo) {
            return __awaiter(this, void 0, void 0, function () {
                var approval, data, nombreCliente, numeroPrestamo, decision, fechaOriginal, _a, _b, error_3, error_4, nombreRevisor, usuario, datos, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0: return [4 /*yield*/, this.prisma.aprobacion.findUnique({
                                where: { id: id },
                            })];
                        case 1:
                            approval = _d.sent();
                            if (!approval) {
                                throw new common_1.NotFoundException('Aprobación no encontrada');
                            }
                            if (approval.estado !== client_1.EstadoAprobacion.PENDIENTE) {
                                throw new common_1.BadRequestException("Esta solicitud ya fue procesada (estado: ".concat(approval.estado, ")"));
                            }
                            return [4 /*yield*/, this.prisma.aprobacion.update({
                                    where: { id: id },
                                    data: {
                                        estado: client_1.EstadoAprobacion.RECHAZADO,
                                        aprobadoPorId: rechazadoPorId || undefined,
                                        comentarios: motivoRechazo || 'Rechazado sin motivo especificado',
                                        revisadoEn: new Date(),
                                    },
                                })];
                        case 2:
                            _d.sent();
                            if (!(approval.tipoAprobacion === client_1.TipoAprobacion.PRORROGA_PAGO)) return [3 /*break*/, 11];
                            _d.label = 3;
                        case 3:
                            _d.trys.push([3, 10, , 11]);
                            data = typeof approval.datosSolicitud === 'string'
                                ? JSON.parse(approval.datosSolicitud)
                                : approval.datosSolicitud;
                            if (!((data === null || data === void 0 ? void 0 : data.tipo) === 'GESTION_VENCIDA' && (data === null || data === void 0 ? void 0 : data.prestamoId))) return [3 /*break*/, 9];
                            nombreCliente = (data === null || data === void 0 ? void 0 : data.clienteNombre) || (data === null || data === void 0 ? void 0 : data.cliente) || 'Cliente';
                            numeroPrestamo = (data === null || data === void 0 ? void 0 : data.numeroPrestamo) || '';
                            decision = (data === null || data === void 0 ? void 0 : data.decision) || 'PRORROGAR';
                            fechaOriginal = (data === null || data === void 0 ? void 0 : data.fechaVencimientoOriginal) ? new Date(data.fechaVencimientoOriginal) : null;
                            if (!(fechaOriginal && !isNaN(fechaOriginal.getTime()))) return [3 /*break*/, 7];
                            _d.label = 4;
                        case 4:
                            _d.trys.push([4, 6, , 7]);
                            return [4 /*yield*/, this.prisma.prestamo.update({
                                    where: { id: data.prestamoId },
                                    data: { fechaFin: fechaOriginal },
                                })];
                        case 5:
                            _d.sent();
                            this.notificacionesGateway.broadcastPrestamosActualizados({
                                accion: 'REVERTIR_PRORROGA',
                                prestamoId: data.prestamoId,
                            });
                            return [3 /*break*/, 7];
                        case 6:
                            _a = _d.sent();
                            return [3 /*break*/, 7];
                        case 7: return [4 /*yield*/, this.notifyCobradorGestionVencida({
                                prestamoId: data.prestamoId,
                                titulo: "Gesti\u00F3n de cuenta vencida rechazada \u2014 ".concat(nombreCliente).concat(numeroPrestamo ? " (".concat(numeroPrestamo, ")") : ''),
                                mensaje: "La solicitud de ".concat(decision === 'DEJAR_QUIETO' ? 'dejar quieto' : 'prórroga', " fue rechazada.").concat(motivoRechazo ? " Motivo: ".concat(motivoRechazo) : ''),
                                tipo: 'ADVERTENCIA',
                                metadata: {
                                    tipo: 'GESTION_VENCIDA',
                                    decision: decision,
                                    aprobado: false,
                                    motivoRechazo: motivoRechazo || undefined,
                                    rechazadoPorId: rechazadoPorId,
                                    aprobacionId: approval.id,
                                },
                            })];
                        case 8:
                            _d.sent();
                            _d.label = 9;
                        case 9: return [3 /*break*/, 11];
                        case 10:
                            _b = _d.sent();
                            return [3 /*break*/, 11];
                        case 11:
                            this.notificacionesGateway.broadcastAprobacionesActualizadas({
                                accion: 'RECHAZAR',
                                aprobacionId: id,
                                tipoAprobacion: approval.tipoAprobacion,
                            });
                            if (!(approval.tipoAprobacion === client_1.TipoAprobacion.NUEVO_PRESTAMO && approval.referenciaId)) return [3 /*break*/, 16];
                            _d.label = 12;
                        case 12:
                            _d.trys.push([12, 14, , 15]);
                            return [4 /*yield*/, this.prisma.prestamo.update({
                                    where: { id: approval.referenciaId },
                                    data: {
                                        estadoAprobacion: client_1.EstadoAprobacion.RECHAZADO,
                                        aprobadoPorId: rechazadoPorId || undefined,
                                        eliminadoEn: new Date(), // Oculta el préstamo del listado
                                    },
                                })];
                        case 13:
                            _d.sent();
                            return [3 /*break*/, 15];
                        case 14:
                            error_3 = _d.sent();
                            this.logger.error("Error actualizando pr\u00E9stamo rechazado ".concat(approval.referenciaId, ":"), error_3);
                            return [3 /*break*/, 15];
                        case 15: return [3 /*break*/, 20];
                        case 16:
                            if (!(approval.tipoAprobacion === client_1.TipoAprobacion.NUEVO_CLIENTE && approval.referenciaId)) return [3 /*break*/, 20];
                            _d.label = 17;
                        case 17:
                            _d.trys.push([17, 19, , 20]);
                            return [4 /*yield*/, this.prisma.cliente.update({
                                    where: { id: approval.referenciaId },
                                    data: {
                                        estadoAprobacion: client_1.EstadoAprobacion.RECHAZADO,
                                        aprobadoPorId: rechazadoPorId || undefined,
                                        eliminadoEn: new Date(), // Oculta el cliente del listado
                                    },
                                })];
                        case 18:
                            _d.sent();
                            return [3 /*break*/, 20];
                        case 19:
                            error_4 = _d.sent();
                            this.logger.error("Error actualizando cliente rechazado ".concat(approval.referenciaId, ":"), error_4);
                            return [3 /*break*/, 20];
                        case 20:
                            if (!rechazadoPorId) return [3 /*break*/, 22];
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: { id: rechazadoPorId },
                                    select: { nombres: true, apellidos: true },
                                })];
                        case 21:
                            usuario = _d.sent();
                            nombreRevisor = usuario ? "".concat(usuario.nombres, " ").concat(usuario.apellidos).trim() : undefined;
                            _d.label = 22;
                        case 22:
                            datos = approval.datosSolicitud || {};
                            _d.label = 23;
                        case 23:
                            _d.trys.push([23, 25, , 26]);
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: approval.solicitadoPorId,
                                    titulo: 'Solicitud Rechazada',
                                    mensaje: motivoRechazo
                                        ? "Tu solicitud fue rechazada. Motivo: ".concat(motivoRechazo)
                                        : 'Tu solicitud fue rechazada por el administrador.',
                                    tipo: 'ALERTA',
                                    entidad: 'Aprobacion',
                                    entidadId: approval.id,
                                    metadata: {
                                        estadoAprobacion: 'RECHAZADO',
                                        revisadoPor: nombreRevisor,
                                        descSolicitud: datos.descripcion || datos.motivo,
                                    },
                                })];
                        case 24:
                            _d.sent();
                            return [3 /*break*/, 26];
                        case 25:
                            _c = _d.sent();
                            return [3 /*break*/, 26];
                        case 26:
                            this.logger.log("Aprobaci\u00F3n ".concat(id, " rechazada por ").concat(rechazadoPorId || 'desconocido'));
                            return [2 /*return*/, { success: true, message: 'Aprobación rechazada' }];
                    }
                });
            });
        };
        ApprovalsService_1.prototype.approveNewClient = function (approval) {
            return __awaiter(this, void 0, void 0, function () {
                var data, cliente;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            data = typeof approval.datosSolicitud === 'string'
                                ? JSON.parse(approval.datosSolicitud)
                                : approval.datosSolicitud;
                            return [4 /*yield*/, this.prisma.cliente.update({
                                    where: { id: approval.referenciaId },
                                    data: {
                                        estadoAprobacion: client_1.EstadoAprobacion.APROBADO,
                                        // Sincronizar otros campos por si hubo ediciones en la aprobación
                                        dni: data.dni,
                                        nombres: data.nombres,
                                        apellidos: data.apellidos,
                                        telefono: data.telefono,
                                        direccion: data.direccion,
                                        correo: data.correo,
                                    },
                                })];
                        case 1:
                            cliente = _a.sent();
                            this.notificacionesGateway.broadcastClientesActualizados({
                                accion: 'ACTUALIZAR',
                                clienteId: cliente.id,
                            });
                            return [2 /*return*/];
                    }
                });
            });
        };
        ApprovalsService_1.prototype.approveNewLoan = function (approval, aprobadoPorId, editedData) {
            return __awaiter(this, void 0, void 0, function () {
                var data, finalData, isArticulo, label, e_2;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            data = typeof approval.datosSolicitud === 'string'
                                ? JSON.parse(approval.datosSolicitud)
                                : approval.datosSolicitud;
                            finalData = editedData || data;
                            // Ejecutar en una transacción
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    var prestamo, montoFinanciar, tasaInteres, frecuencia_1, cantidadCuotas, realPlazoMeses, tipoAmort, fechaInicio_1, interesTotal, cuotasData, tasaMensual, tasaPeriodo, montoCuota_1, cuotaFija, saldo, i, intPeriodo, capPeriodo, mesesInteres, montoTotalSimple, montoCuota_2, montoCapitalCuota_1, montoInteresCuota_1, calcularFecha_1, rutaId, cajaRuta;
                                    var _a, _b, _c;
                                    return __generator(this, function (_d) {
                                        switch (_d.label) {
                                            case 0: return [4 /*yield*/, tx.prestamo.update({
                                                    where: { id: approval.referenciaId },
                                                    data: {
                                                        estado: client_1.EstadoPrestamo.ACTIVO,
                                                        estadoAprobacion: client_1.EstadoAprobacion.APROBADO,
                                                        aprobadoPorId: aprobadoPorId || undefined,
                                                        // Actualizar campos financieros si cambiaron en la revisión
                                                        monto: finalData.monto || finalData.valorArticulo ? Number(finalData.monto || finalData.valorArticulo) : undefined,
                                                        cantidadCuotas: finalData.cantidadCuotas || finalData.cuotas || finalData.numCuotas ? Number(finalData.cantidadCuotas || finalData.cuotas || finalData.numCuotas) : undefined,
                                                        tasaInteres: finalData.porcentaje !== undefined ? Number(finalData.porcentaje) : undefined,
                                                        frecuenciaPago: finalData.frecuenciaPago || undefined,
                                                        cuotaInicial: finalData.cuotaInicial !== undefined ? Number(finalData.cuotaInicial) : undefined,
                                                        fechaInicio: finalData.fechaInicio ? new Date(finalData.fechaInicio) : undefined,
                                                        notas: finalData.notas || undefined,
                                                    },
                                                    include: {
                                                        cliente: {
                                                            include: {
                                                                asignacionesRuta: {
                                                                    where: { activa: true },
                                                                    take: 1
                                                                }
                                                            }
                                                        }
                                                    }
                                                })];
                                            case 1:
                                                prestamo = _d.sent();
                                                if (!editedData) return [3 /*break*/, 5];
                                                montoFinanciar = Number(prestamo.monto);
                                                tasaInteres = Number(prestamo.tasaInteres);
                                                frecuencia_1 = prestamo.frecuenciaPago;
                                                cantidadCuotas = Number(prestamo.cantidadCuotas || (finalData.cantidadCuotas || finalData.cuotas || finalData.numCuotas || 0));
                                                realPlazoMeses = Number(finalData.plazoMeses || finalData.plajeMeses || finalData.plazo || prestamo.plazoMeses || 1);
                                                // Sincronizar con la lógica de loans.service: derivar el plazo de las cuotas si existen
                                                if (cantidadCuotas > 0) {
                                                    if (frecuencia_1 === client_1.FrecuenciaPago.DIARIO)
                                                        realPlazoMeses = cantidadCuotas / 30;
                                                    else if (frecuencia_1 === client_1.FrecuenciaPago.SEMANAL)
                                                        realPlazoMeses = cantidadCuotas / 4;
                                                    else if (frecuencia_1 === client_1.FrecuenciaPago.QUINCENAL)
                                                        realPlazoMeses = cantidadCuotas / 2;
                                                    else if (frecuencia_1 === client_1.FrecuenciaPago.MENSUAL)
                                                        realPlazoMeses = cantidadCuotas;
                                                }
                                                tipoAmort = prestamo.tipoAmortizacion;
                                                fechaInicio_1 = new Date(prestamo.fechaInicio);
                                                interesTotal = 0;
                                                cuotasData = [];
                                                if (tipoAmort === client_1.TipoAmortizacion.FRANCESA) {
                                                    tasaMensual = tasaInteres / realPlazoMeses / 100;
                                                    tasaPeriodo = tasaMensual;
                                                    if (frecuencia_1 === client_1.FrecuenciaPago.DIARIO)
                                                        tasaPeriodo = tasaMensual / 30;
                                                    else if (frecuencia_1 === client_1.FrecuenciaPago.SEMANAL)
                                                        tasaPeriodo = tasaMensual / 4;
                                                    else if (frecuencia_1 === client_1.FrecuenciaPago.QUINCENAL)
                                                        tasaPeriodo = tasaMensual / 2;
                                                    if (tasaPeriodo === 0) {
                                                        interesTotal = 0;
                                                        montoCuota_1 = montoFinanciar / cantidadCuotas;
                                                        cuotasData = Array.from({ length: cantidadCuotas }, function (_, i) { return ({
                                                            numeroCuota: i + 1,
                                                            montoCapital: montoCuota_1,
                                                            montoInteres: 0,
                                                            monto: montoCuota_1
                                                        }); });
                                                    }
                                                    else {
                                                        cuotaFija = (montoFinanciar * tasaPeriodo) / (1 - Math.pow(1 + tasaPeriodo, -cantidadCuotas));
                                                        saldo = montoFinanciar;
                                                        for (i = 0; i < cantidadCuotas; i++) {
                                                            intPeriodo = saldo * tasaPeriodo;
                                                            capPeriodo = i === cantidadCuotas - 1 ? saldo : cuotaFija - intPeriodo;
                                                            interesTotal += intPeriodo;
                                                            cuotasData.push({
                                                                numeroCuota: i + 1,
                                                                montoCapital: capPeriodo,
                                                                montoInteres: intPeriodo,
                                                                monto: capPeriodo + intPeriodo
                                                            });
                                                            saldo -= capPeriodo;
                                                        }
                                                    }
                                                }
                                                else {
                                                    mesesInteres = Math.max(1, realPlazoMeses);
                                                    interesTotal = (montoFinanciar * tasaInteres * mesesInteres) / 100;
                                                    montoTotalSimple = montoFinanciar + interesTotal;
                                                    montoCuota_2 = cantidadCuotas > 0 ? montoTotalSimple / cantidadCuotas : 0;
                                                    montoCapitalCuota_1 = cantidadCuotas > 0 ? montoFinanciar / cantidadCuotas : 0;
                                                    montoInteresCuota_1 = cantidadCuotas > 0 ? interesTotal / cantidadCuotas : 0;
                                                    cuotasData = Array.from({ length: cantidadCuotas }, function (_, i) { return ({
                                                        numeroCuota: i + 1,
                                                        monto: montoCuota_2,
                                                        montoCapital: montoCapitalCuota_1,
                                                        montoInteres: montoInteresCuota_1
                                                    }); });
                                                }
                                                // Actualizar el préstamo con el nuevo interés calculado y saldo
                                                return [4 /*yield*/, tx.prestamo.update({
                                                        where: { id: prestamo.id },
                                                        data: {
                                                            interesTotal: interesTotal,
                                                            saldoPendiente: montoFinanciar + interesTotal
                                                        }
                                                    })];
                                            case 2:
                                                // Actualizar el préstamo con el nuevo interés calculado y saldo
                                                _d.sent();
                                                // Eliminar cuotas viejas y crear nuevas para que coincidan con la edición
                                                return [4 /*yield*/, tx.cuota.deleteMany({ where: { prestamoId: prestamo.id } })];
                                            case 3:
                                                // Eliminar cuotas viejas y crear nuevas para que coincidan con la edición
                                                _d.sent();
                                                calcularFecha_1 = function (base, num, freq) {
                                                    var d = new Date(base);
                                                    if (freq === client_1.FrecuenciaPago.DIARIO)
                                                        d.setDate(d.getDate() + num);
                                                    else if (freq === client_1.FrecuenciaPago.SEMANAL)
                                                        d.setDate(d.getDate() + num * 7);
                                                    else if (freq === client_1.FrecuenciaPago.QUINCENAL)
                                                        d.setDate(d.getDate() + num * 15);
                                                    else if (freq === client_1.FrecuenciaPago.MENSUAL)
                                                        d.setMonth(d.getMonth() + num);
                                                    return d;
                                                };
                                                return [4 /*yield*/, tx.cuota.createMany({
                                                        data: cuotasData.map(function (c) { return ({
                                                            prestamoId: prestamo.id,
                                                            numeroCuota: c.numeroCuota,
                                                            monto: c.monto,
                                                            montoCapital: c.montoCapital,
                                                            montoInteres: c.montoInteres,
                                                            fechaVencimiento: calcularFecha_1(fechaInicio_1, c.numeroCuota, frecuencia_1),
                                                            estado: client_1.EstadoCuota.PENDIENTE
                                                        }); })
                                                    })];
                                            case 4:
                                                _d.sent();
                                                _d.label = 5;
                                            case 5:
                                                rutaId = (_c = (_b = (_a = prestamo.cliente) === null || _a === void 0 ? void 0 : _a.asignacionesRuta) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.rutaId;
                                                if (!rutaId) return [3 /*break*/, 9];
                                                return [4 /*yield*/, tx.caja.findFirst({
                                                        where: { rutaId: rutaId, tipo: 'RUTA', activa: true }
                                                    })];
                                            case 6:
                                                cajaRuta = _d.sent();
                                                if (!cajaRuta) return [3 /*break*/, 9];
                                                // 3. Crear transacción de egreso (Desembolso)
                                                return [4 /*yield*/, tx.transaccion.create({
                                                        data: {
                                                            numeroTransaccion: "T".concat(Date.now()),
                                                            cajaId: cajaRuta.id,
                                                            tipo: client_1.TipoTransaccion.EGRESO,
                                                            monto: Number(prestamo.monto),
                                                            descripcion: "Desembolso de pr\u00E9stamo #".concat(prestamo.numeroPrestamo, " - Cliente: ").concat(prestamo.cliente.nombres, " ").concat(prestamo.cliente.apellidos),
                                                            creadoPorId: approval.solicitadoPorId,
                                                            aprobadoPorId: aprobadoPorId || undefined,
                                                            tipoReferencia: 'PRESTAMO',
                                                            referenciaId: prestamo.id,
                                                        },
                                                    })];
                                            case 7:
                                                // 3. Crear transacción de egreso (Desembolso)
                                                _d.sent();
                                                // 4. Actualizar saldo de la caja
                                                return [4 /*yield*/, tx.caja.update({
                                                        where: { id: cajaRuta.id },
                                                        data: {
                                                            saldoActual: {
                                                                decrement: prestamo.monto
                                                            }
                                                        }
                                                    })];
                                            case 8:
                                                // 4. Actualizar saldo de la caja
                                                _d.sent();
                                                _d.label = 9;
                                            case 9: return [2 /*return*/];
                                        }
                                    });
                                }); })];
                        case 1:
                            // Ejecutar en una transacción
                            _a.sent();
                            _a.label = 2;
                        case 2:
                            _a.trys.push([2, 4, , 5]);
                            isArticulo = data.tipo === 'ARTICULO' || data.tipoPrestamo === 'ARTICULO';
                            label = isArticulo ? 'crédito por un artículo' : 'préstamo';
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: approval.solicitadoPorId,
                                    titulo: 'Solicitud Aprobada',
                                    mensaje: "Tu solicitud de ".concat(label, " para ").concat(data.cliente || 'el cliente', " ha sido aprobada."),
                                    tipo: 'EXITO',
                                    entidad: 'Prestamo',
                                    entidadId: approval.referenciaId,
                                    metadata: {
                                        estadoAprobacion: 'APROBADO',
                                        monto: data.monto,
                                        articulo: data.articulo
                                    }
                                })];
                        case 3:
                            _a.sent();
                            return [3 /*break*/, 5];
                        case 4:
                            e_2 = _a.sent();
                            this.logger.error('Error notifying loan approval:', e_2);
                            return [3 /*break*/, 5];
                        case 5:
                            this.notificacionesGateway.broadcastPrestamosActualizados({
                                accion: 'APROBAR',
                                prestamoId: approval.referenciaId,
                            });
                            this.notificacionesGateway.broadcastDashboardsActualizados({});
                            return [2 /*return*/];
                    }
                });
            });
        };
        ApprovalsService_1.prototype.approveExpense = function (approval, aprobadoPorId) {
            return __awaiter(this, void 0, void 0, function () {
                var data, gasto, error_5;
                var _this = this;
                var _a, _b, _c, _d, _e;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0:
                            data = typeof approval.datosSolicitud === 'string'
                                ? JSON.parse(approval.datosSolicitud)
                                : approval.datosSolicitud;
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    var newGasto;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, tx.gasto.create({
                                                    data: {
                                                        numeroGasto: "G".concat(Date.now()),
                                                        rutaId: data.rutaId,
                                                        cobradorId: data.cobradorId,
                                                        cajaId: data.cajaId,
                                                        tipoGasto: ({
                                                            GASTO_OPERATIVO: 'OPERATIVO',
                                                            OPERATIVO: 'OPERATIVO',
                                                            TRANSPORTE: 'TRANSPORTE',
                                                            OTRO: 'OTRO',
                                                        }[data.tipoGasto] || 'OPERATIVO'),
                                                        monto: data.monto,
                                                        descripcion: data.descripcion,
                                                        aprobadoPorId: aprobadoPorId || undefined,
                                                        estadoAprobacion: client_1.EstadoAprobacion.APROBADO,
                                                    },
                                                    include: {
                                                        ruta: { select: { id: true, nombre: true } },
                                                        caja: { select: { id: true, nombre: true } },
                                                        cobrador: { select: { id: true, nombres: true, apellidos: true } },
                                                    },
                                                })];
                                            case 1:
                                                newGasto = _a.sent();
                                                // 2. Crear la Transacción financiera (Egreso para la caja)
                                                return [4 /*yield*/, tx.transaccion.create({
                                                        data: {
                                                            numeroTransaccion: "T".concat(Date.now()),
                                                            cajaId: data.cajaId,
                                                            tipo: client_1.TipoTransaccion.EGRESO,
                                                            monto: data.monto,
                                                            descripcion: "Gasto aprobado: ".concat(data.descripcion),
                                                            creadoPorId: approval.solicitadoPorId,
                                                            aprobadoPorId: aprobadoPorId || undefined,
                                                            tipoReferencia: 'GASTO',
                                                            referenciaId: newGasto.id,
                                                        },
                                                    })];
                                            case 2:
                                                // 2. Crear la Transacción financiera (Egreso para la caja)
                                                _a.sent();
                                                // 3. Actualizar Saldo de la Caja
                                                return [4 /*yield*/, tx.caja.update({
                                                        where: { id: data.cajaId },
                                                        data: {
                                                            saldoActual: {
                                                                decrement: data.monto,
                                                            },
                                                        },
                                                    })];
                                            case 3:
                                                // 3. Actualizar Saldo de la Caja
                                                _a.sent();
                                                return [2 /*return*/, [newGasto]];
                                        }
                                    });
                                }); })];
                        case 1:
                            gasto = (_f.sent())[0];
                            _f.label = 2;
                        case 2:
                            _f.trys.push([2, 5, , 6]);
                            // Notificar al solicitante que su gasto fue aprobado
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: approval.solicitadoPorId,
                                    titulo: 'Tu Gasto fue Aprobado',
                                    mensaje: "Tu gasto de ".concat(Number(data.monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP' }), " fue aprobado."),
                                    tipo: 'EXITO',
                                    entidad: 'GASTO',
                                    entidadId: gasto.id,
                                })];
                        case 3:
                            // Notificar al solicitante que su gasto fue aprobado
                            _f.sent();
                            return [4 /*yield*/, this.notificacionesService.notifyCoordinator({
                                    titulo: 'Gasto Aprobado',
                                    mensaje: "Se aprob\u00F3 un gasto de ".concat(Number(data.monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP' }), " en la ruta ").concat(((_a = gasto.ruta) === null || _a === void 0 ? void 0 : _a.nombre) || 'Sin ruta', " (Caja: ").concat(((_b = gasto.caja) === null || _b === void 0 ? void 0 : _b.nombre) || 'N/A', ") por ").concat(gasto.cobrador ? gasto.cobrador.nombres + ' ' + gasto.cobrador.apellidos : 'usuario', "."),
                                    tipo: 'SISTEMA',
                                    entidad: 'GASTO',
                                    entidadId: gasto.id,
                                    metadata: {
                                        rutaId: (_c = gasto.ruta) === null || _c === void 0 ? void 0 : _c.id,
                                        cajaId: (_d = gasto.caja) === null || _d === void 0 ? void 0 : _d.id,
                                        cobradorId: (_e = gasto.cobrador) === null || _e === void 0 ? void 0 : _e.id,
                                    },
                                })];
                        case 4:
                            _f.sent();
                            return [3 /*break*/, 6];
                        case 5:
                            error_5 = _f.sent();
                            return [3 /*break*/, 6];
                        case 6:
                            this.notificacionesGateway.broadcastDashboardsActualizados({
                                origen: 'GASTO',
                            });
                            return [2 /*return*/];
                    }
                });
            });
        };
        ApprovalsService_1.prototype.approveCashBase = function (approval, aprobadoPorId) {
            return __awaiter(this, void 0, void 0, function () {
                var data, trx, error_6;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            data = typeof approval.datosSolicitud === 'string'
                                ? JSON.parse(approval.datosSolicitud)
                                : approval.datosSolicitud;
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    var cajaPrincipal, monto, newTrx;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, tx.caja.findFirst({
                                                    where: { tipo: 'PRINCIPAL', activa: true },
                                                })];
                                            case 1:
                                                cajaPrincipal = _a.sent();
                                                if (!cajaPrincipal) {
                                                    throw new common_1.BadRequestException('No se encontró una Caja Principal activa para entregar la base.');
                                                }
                                                monto = Number(data.monto);
                                                // 2. Verificar fondos en Caja Principal
                                                if (Number(cajaPrincipal.saldoActual) < monto) {
                                                    throw new common_1.BadRequestException("Fondos insuficientes en la Caja Principal (".concat(cajaPrincipal.nombre, "). Saldo actual: ").concat(Number(cajaPrincipal.saldoActual).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })));
                                                }
                                                // 3. Crear transacción de salida (EGRESO) desde la Caja Principal
                                                return [4 /*yield*/, tx.transaccion.create({
                                                        data: {
                                                            numeroTransaccion: "TRX-OUT-".concat(Date.now()),
                                                            cajaId: cajaPrincipal.id,
                                                            tipo: client_1.TipoTransaccion.EGRESO,
                                                            monto: monto,
                                                            descripcion: "Entrega de base operativa a Ruta (Caja ID: ".concat(data.cajaId, ") - Solicitud #").concat(approval.id),
                                                            creadoPorId: aprobadoPorId || approval.solicitadoPorId,
                                                            aprobadoPorId: aprobadoPorId || undefined,
                                                            tipoReferencia: 'SOLICITUD_BASE',
                                                            referenciaId: approval.id,
                                                        },
                                                    })];
                                            case 2:
                                                // 3. Crear transacción de salida (EGRESO) desde la Caja Principal
                                                _a.sent();
                                                // 4. Actualizar Saldo de la Caja Principal
                                                return [4 /*yield*/, tx.caja.update({
                                                        where: { id: cajaPrincipal.id },
                                                        data: {
                                                            saldoActual: {
                                                                decrement: monto,
                                                            },
                                                        },
                                                    })];
                                            case 3:
                                                // 4. Actualizar Saldo de la Caja Principal
                                                _a.sent();
                                                return [4 /*yield*/, tx.transaccion.create({
                                                        data: {
                                                            numeroTransaccion: "TRX-IN-".concat(Date.now()),
                                                            cajaId: data.cajaId,
                                                            tipo: client_1.TipoTransaccion.INGRESO,
                                                            monto: monto,
                                                            descripcion: "Base de efectivo recibida - ".concat(data.descripcion),
                                                            creadoPorId: approval.solicitadoPorId,
                                                            aprobadoPorId: aprobadoPorId || undefined,
                                                            tipoReferencia: 'SOLICITUD_BASE',
                                                            referenciaId: approval.id,
                                                        },
                                                    })];
                                            case 4:
                                                newTrx = _a.sent();
                                                // 6. Actualizar Saldo de la Caja de Ruta
                                                return [4 /*yield*/, tx.caja.update({
                                                        where: { id: data.cajaId },
                                                        data: {
                                                            saldoActual: {
                                                                increment: monto,
                                                            },
                                                        },
                                                    })];
                                            case 5:
                                                // 6. Actualizar Saldo de la Caja de Ruta
                                                _a.sent();
                                                return [2 /*return*/, newTrx];
                                        }
                                    });
                                }); })];
                        case 1:
                            trx = _a.sent();
                            _a.label = 2;
                        case 2:
                            _a.trys.push([2, 5, , 6]);
                            return [4 /*yield*/, this.notificacionesService.notifyCoordinator({
                                    titulo: 'Base de Efectivo Aprobada',
                                    mensaje: "Se aprob\u00F3 una base de efectivo por ".concat(Number(data.monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP' }), "."),
                                    tipo: 'SISTEMA',
                                    entidad: 'TRANSACCION',
                                    entidadId: trx.id,
                                    metadata: {
                                        cajaId: data.cajaId,
                                        monto: data.monto,
                                        solicitadoPorId: approval.solicitadoPorId,
                                        aprobadoPorId: aprobadoPorId,
                                    },
                                })];
                        case 3:
                            _a.sent();
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: approval.solicitadoPorId,
                                    titulo: 'Tu Solicitud de Base fue Aprobada',
                                    mensaje: "Tu solicitud por ".concat(Number(data.monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP' }), " fue aprobada."),
                                    tipo: 'EXITO',
                                    entidad: 'TRANSACCION',
                                    entidadId: trx.id,
                                    metadata: {
                                        cajaId: data.cajaId,
                                    },
                                })];
                        case 4:
                            _a.sent();
                            return [3 /*break*/, 6];
                        case 5:
                            error_6 = _a.sent();
                            return [3 /*break*/, 6];
                        case 6:
                            this.notificacionesGateway.broadcastDashboardsActualizados({
                                origen: 'BASE',
                            });
                            return [2 /*return*/];
                    }
                });
            });
        };
        ApprovalsService_1.prototype.approvePaymentExtension = function (approval, aprobadoPorId) {
            return __awaiter(this, void 0, void 0, function () {
                var data, fechaOriginal, nuevaFecha, nombreCliente, numeroPrestamo, dias, montoInteres, conMora, decision, accionLabel, detalleMora;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            data = typeof approval.datosSolicitud === 'string'
                                ? JSON.parse(approval.datosSolicitud)
                                : approval.datosSolicitud;
                            fechaOriginal = data.fechaVencimientoOriginal
                                ? new Date(data.fechaVencimientoOriginal)
                                : new Date();
                            if (data.nuevaFechaVencimiento) {
                                nuevaFecha = new Date(data.nuevaFechaVencimiento);
                            }
                            else if (data.diasGracia) {
                                nuevaFecha = new Date(Date.now() + Number(data.diasGracia) * 24 * 60 * 60 * 1000);
                            }
                            else {
                                // Por defecto 30 dias de gracia
                                nuevaFecha = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                            }
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    var extension, cuotaActual;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, tx.extensionPago.create({
                                                    data: {
                                                        prestamoId: data.prestamoId,
                                                        // cuotaId omitido aquí - se vincula abajo individualmente para evitar violación unique
                                                        fechaVencimientoOriginal: fechaOriginal,
                                                        nuevaFechaVencimiento: nuevaFecha,
                                                        razon: data.comentarios || data.razon || 'Prorroga aprobada',
                                                        aprobadoPorId: aprobadoPorId || approval.solicitadoPorId,
                                                    },
                                                })];
                                            case 1:
                                                extension = _a.sent();
                                                // 2. Marcar TODAS las cuotas vencidas como PRORROGADA y actualizar su fecha
                                                //    (updateMany no asigna extensionId para evitar conflicto @unique)
                                                return [4 /*yield*/, tx.cuota.updateMany({
                                                        where: {
                                                            prestamoId: data.prestamoId,
                                                            estado: 'VENCIDA',
                                                        },
                                                        data: {
                                                            estado: 'PRORROGADA',
                                                            fechaVencimientoProrroga: nuevaFecha,
                                                        },
                                                    })];
                                            case 2:
                                                // 2. Marcar TODAS las cuotas vencidas como PRORROGADA y actualizar su fecha
                                                //    (updateMany no asigna extensionId para evitar conflicto @unique)
                                                _a.sent();
                                                if (!data.cuotaId) return [3 /*break*/, 6];
                                                return [4 /*yield*/, tx.cuota.findUnique({
                                                        where: { id: data.cuotaId },
                                                        select: { extensionId: true },
                                                    })];
                                            case 3:
                                                cuotaActual = _a.sent();
                                                if (!!(cuotaActual === null || cuotaActual === void 0 ? void 0 : cuotaActual.extensionId)) return [3 /*break*/, 6];
                                                return [4 /*yield*/, tx.cuota.update({
                                                        where: { id: data.cuotaId },
                                                        data: { extensionId: extension.id },
                                                    })];
                                            case 4:
                                                _a.sent();
                                                // Actualizar el extensionPago también con el cuotaId
                                                return [4 /*yield*/, tx.extensionPago.update({
                                                        where: { id: extension.id },
                                                        data: { cuotaId: data.cuotaId },
                                                    })];
                                            case 5:
                                                // Actualizar el extensionPago también con el cuotaId
                                                _a.sent();
                                                _a.label = 6;
                                            case 6: 
                                            // 4. Cambiar estado del préstamo a ACTIVO para que salga de cuentas en mora
                                            //    El job nocturno (LoansScheduler) lo volverá a marcar EN_MORA si la prórroga vence sin pago
                                            return [4 /*yield*/, tx.prestamo.update({
                                                    where: { id: data.prestamoId },
                                                    data: {
                                                        fechaFin: nuevaFecha,
                                                        estado: 'ACTIVO',
                                                    },
                                                })];
                                            case 7:
                                                // 4. Cambiar estado del préstamo a ACTIVO para que salga de cuentas en mora
                                                //    El job nocturno (LoansScheduler) lo volverá a marcar EN_MORA si la prórroga vence sin pago
                                                _a.sent();
                                                return [2 /*return*/];
                                        }
                                    });
                                }); })];
                        case 1:
                            _a.sent();
                            if (!((data === null || data === void 0 ? void 0 : data.tipo) === 'GESTION_VENCIDA' && (data === null || data === void 0 ? void 0 : data.prestamoId))) return [3 /*break*/, 3];
                            nombreCliente = (data === null || data === void 0 ? void 0 : data.clienteNombre) || (data === null || data === void 0 ? void 0 : data.cliente) || 'Cliente';
                            numeroPrestamo = (data === null || data === void 0 ? void 0 : data.numeroPrestamo) || '';
                            dias = Number((data === null || data === void 0 ? void 0 : data.diasGracia) || 0);
                            montoInteres = Number((data === null || data === void 0 ? void 0 : data.montoInteres) || 0);
                            conMora = montoInteres > 0;
                            decision = (data === null || data === void 0 ? void 0 : data.decision) || 'PRORROGAR';
                            accionLabel = decision === 'DEJAR_QUIETO' ? 'dejar quieto' : 'prórroga';
                            detalleMora = decision === 'DEJAR_QUIETO'
                                ? ''
                                : (conMora ? " con mora ($".concat(montoInteres.toLocaleString('es-CO'), ")") : ' sin mora');
                            return [4 /*yield*/, this.notifyCobradorGestionVencida({
                                    prestamoId: data.prestamoId,
                                    titulo: "Cuenta vencida gestionada \u2014 ".concat(nombreCliente).concat(numeroPrestamo ? " (".concat(numeroPrestamo, ")") : ''),
                                    mensaje: "Se aprob\u00F3 ".concat(accionLabel, " por ").concat(dias, " d\u00EDas").concat(detalleMora, " para este cliente."),
                                    tipo: 'INFORMATIVO',
                                    metadata: {
                                        tipo: 'GESTION_VENCIDA',
                                        decision: decision,
                                        diasGracia: dias,
                                        montoInteres: montoInteres,
                                        conMora: conMora,
                                        aprobadoPorId: aprobadoPorId || approval.solicitadoPorId,
                                        aprobacionId: approval.id,
                                    },
                                })];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3:
                            this.notificacionesGateway.broadcastPrestamosActualizados({
                                accion: 'PRORROGA',
                                prestamoId: approval.referenciaId,
                            });
                            return [2 /*return*/];
                    }
                });
            });
        };
        return ApprovalsService_1;
    }());
    __setFunctionName(_classThis, "ApprovalsService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ApprovalsService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ApprovalsService = _classThis;
}();
exports.ApprovalsService = ApprovalsService;
