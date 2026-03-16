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
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
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
exports.LoansController = void 0;
var common_1 = require("@nestjs/common");
var swagger_1 = require("@nestjs/swagger");
var jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
var roles_guard_1 = require("../auth/guards/roles.guard");
var roles_decorator_1 = require("../auth/decorators/roles.decorator");
var client_1 = require("@prisma/client");
var create_loan_dto_1 = require("./dto/create-loan.dto");
var reprogramar_cuota_dto_1 = require("./dto/reprogramar-cuota.dto");
var LoansController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('loans'), (0, swagger_1.ApiBearerAuth)(), (0, common_1.Controller)('loans'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard)];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _getAllLoans_decorators;
    var _exportLoans_decorators;
    var _exportContrato_decorators;
    var _getLoanById_decorators;
    var _getArchivedLoanById_decorators;
    var _getLoanCuotas_decorators;
    var _createLoan_decorators;
    var _approveLoan_decorators;
    var _rejectLoan_decorators;
    var _deleteLoan_decorators;
    var _updateLoan_decorators;
    var _restoreLoan_decorators;
    var _archiveLoan_decorators;
    var _reprogramarCuota_decorators;
    var _fixInterestCalculations_decorators;
    var _procesarMora_decorators;
    var _getResumenMoraCliente_decorators;
    var _asignarMora_decorators;
    var _gestionarVencida_decorators;
    var _solicitarReprogramacion_decorators;
    var _listarReprogramacionesPendientes_decorators;
    var _aprobarReprogramacion_decorators;
    var _rechazarReprogramacion_decorators;
    var LoansController = _classThis = /** @class */ (function () {
        function LoansController_1(loansService, moraService, prisma, notificacionesService, auditService, approvalsService) {
            this.loansService = (__runInitializers(this, _instanceExtraInitializers), loansService);
            this.moraService = moraService;
            this.prisma = prisma;
            this.notificacionesService = notificacionesService;
            this.auditService = auditService;
            this.approvalsService = approvalsService;
        }
        LoansController_1.prototype.getAllLoans = function (estado, ruta, search, tipo, page, limit, req) {
            return __awaiter(this, void 0, void 0, function () {
                var safeLimit;
                return __generator(this, function (_a) {
                    safeLimit = Math.min(limit, 100);
                    return [2 /*return*/, this.loansService.getAllLoans({
                            estado: estado,
                            ruta: ruta,
                            search: search,
                            tipo: tipo,
                            page: page,
                            limit: safeLimit,
                        })];
                });
            });
        };
        LoansController_1.prototype.exportLoans = function (res, format, estado, ruta, search) {
            return __awaiter(this, void 0, void 0, function () {
                var result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.loansService.exportLoans(format, {
                                estado: estado,
                                ruta: ruta,
                                search: search,
                            })];
                        case 1:
                            result = _a.sent();
                            res.setHeader('Content-Type', result.contentType);
                            res.setHeader('Content-Disposition', "attachment; filename=\"".concat(result.filename, "\""));
                            res.send(result.data);
                            return [2 /*return*/];
                    }
                });
            });
        };
        LoansController_1.prototype.exportContrato = function (res, id, format) {
            return __awaiter(this, void 0, void 0, function () {
                var result, e_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (format !== 'pdf') {
                                throw new common_1.BadRequestException('Formato no soportado');
                            }
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, this.loansService.generarContrato(id)];
                        case 2:
                            result = _a.sent();
                            res.setHeader('Content-Type', result.contentType);
                            res.setHeader('Content-Disposition', "attachment; filename=\"".concat(result.filename, "\""));
                            res.send(result.data);
                            return [3 /*break*/, 4];
                        case 3:
                            e_1 = _a.sent();
                            console.error('PDF GENERATION ERROR: ' + e_1.message, e_1.stack);
                            throw e_1;
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        LoansController_1.prototype.getLoanById = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.loansService.getLoanById(id)];
                });
            });
        };
        LoansController_1.prototype.getArchivedLoanById = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.loansService.getLoanByIdIncludingArchived(id)];
                });
            });
        };
        LoansController_1.prototype.getLoanCuotas = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.loansService.getLoanCuotas(id)];
                });
            });
        };
        LoansController_1.prototype.createLoan = function (createLoanDto, req) {
            return __awaiter(this, void 0, void 0, function () {
                var usuarioId, datosConCreador;
                return __generator(this, function (_a) {
                    console.log('[CONTROLLER DEBUG] createLoan received:', JSON.stringify(createLoanDto));
                    usuarioId = req.user.id;
                    // Validar que el usuario existe y está activo
                    if (!usuarioId) {
                        throw new Error('Usuario no autenticado');
                    }
                    datosConCreador = __assign(__assign({}, createLoanDto), { creadoPorId: usuarioId });
                    return [2 /*return*/, this.loansService.createLoan(datosConCreador)];
                });
            });
        };
        LoansController_1.prototype.approveLoan = function (id, req) {
            return __awaiter(this, void 0, void 0, function () {
                var aprobadoPorId;
                return __generator(this, function (_a) {
                    aprobadoPorId = req.user.id;
                    return [2 /*return*/, this.loansService.approveLoan(id, aprobadoPorId)];
                });
            });
        };
        LoansController_1.prototype.rejectLoan = function (id, body, req) {
            return __awaiter(this, void 0, void 0, function () {
                var rechazadoPorId;
                return __generator(this, function (_a) {
                    rechazadoPorId = req.user.id;
                    return [2 /*return*/, this.loansService.rejectLoan(id, rechazadoPorId, body.motivo)];
                });
            });
        };
        LoansController_1.prototype.deleteLoan = function (id, req) {
            return __awaiter(this, void 0, void 0, function () {
                var userId;
                return __generator(this, function (_a) {
                    userId = req.user.id;
                    return [2 /*return*/, this.loansService.deleteLoan(id, userId)];
                });
            });
        };
        LoansController_1.prototype.updateLoan = function (id, updateData, req) {
            return __awaiter(this, void 0, void 0, function () {
                var userId;
                return __generator(this, function (_a) {
                    userId = req.user.id;
                    return [2 /*return*/, this.loansService.updateLoan(id, updateData, userId)];
                });
            });
        };
        LoansController_1.prototype.restoreLoan = function (id, req) {
            return __awaiter(this, void 0, void 0, function () {
                var userId;
                return __generator(this, function (_a) {
                    userId = req.user.id;
                    return [2 /*return*/, this.loansService.restoreLoan(id, userId)];
                });
            });
        };
        LoansController_1.prototype.archiveLoan = function (id, body, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.loansService.archiveLoan(id, {
                            motivo: body.motivo,
                            notas: body.notas,
                            archivarPorId: req.user.id,
                        })];
                });
            });
        };
        LoansController_1.prototype.reprogramarCuota = function (id, numeroCuota, reprogramarDto, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.loansService.reprogramarCuota(id, numeroCuota, __assign(__assign({}, reprogramarDto), { reprogramadoPorId: req.user.id }))];
                });
            });
        };
        LoansController_1.prototype.fixInterestCalculations = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.loansService.fixInterestCalculations()];
                });
            });
        };
        // ─── ENDPOINTS DE MORA ────────────────────────────────────────────────────
        LoansController_1.prototype.procesarMora = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.moraService.procesarMoraAutomatica()];
                });
            });
        };
        LoansController_1.prototype.getResumenMoraCliente = function (clienteId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.moraService.getResumenMoraCliente(clienteId)];
                });
            });
        };
        // ─────────────────────────────────────────────────────────────────────
        // GESTIÓN MORA — Asignar interés de mora manual
        // Crea Aprobacion + Auditoria + Notificación
        // ─────────────────────────────────────────────────────────────────────
        LoansController_1.prototype.asignarMora = function (prestamoId, body, req) {
            return __awaiter(this, void 0, void 0, function () {
                var usuarioId, prestamo, usuario, nombreUsuario, nombreCliente, fechaLimite, aprobacion, _a;
                var _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            usuarioId = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.sub) || ((_c = req.user) === null || _c === void 0 ? void 0 : _c.id);
                            if (!usuarioId)
                                throw new Error('Usuario no autenticado');
                            return [4 /*yield*/, this.prisma.prestamo.findUnique({
                                    where: { id: prestamoId },
                                    include: {
                                        cliente: { select: { nombres: true, apellidos: true, dni: true } },
                                    },
                                })];
                        case 1:
                            prestamo = _d.sent();
                            if (!prestamo)
                                throw new Error('Préstamo no encontrado');
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: { id: usuarioId },
                                    select: { nombres: true, apellidos: true, rol: true },
                                })];
                        case 2:
                            usuario = _d.sent();
                            nombreUsuario = usuario ? "".concat(usuario.nombres, " ").concat(usuario.apellidos) : 'Usuario';
                            nombreCliente = prestamo.cliente
                                ? "".concat(prestamo.cliente.nombres, " ").concat(prestamo.cliente.apellidos)
                                : 'Cliente';
                            fechaLimite = new Date();
                            fechaLimite.setDate(fechaLimite.getDate() + body.diasGracia);
                            return [4 /*yield*/, this.prisma.aprobacion.create({
                                    data: {
                                        tipoAprobacion: 'PRORROGA_PAGO', // reutilizamos tipo existente
                                        solicitadoPorId: usuarioId,
                                        referenciaId: prestamoId,
                                        tablaReferencia: 'Prestamo',
                                        montoSolicitud: body.montoInteres,
                                        datosSolicitud: {
                                            tipo: 'ASIGNAR_MORA',
                                            prestamoId: prestamoId,
                                            numeroPrestamo: prestamo.numeroPrestamo,
                                            cliente: nombreCliente,
                                            montoInteres: body.montoInteres,
                                            diasGracia: body.diasGracia,
                                            fechaLimite: fechaLimite.toISOString(),
                                            comentarios: body.comentarios,
                                            saldoPendiente: Number(prestamo.saldoPendiente),
                                            asignadoPor: nombreUsuario,
                                            rolAsignador: usuario === null || usuario === void 0 ? void 0 : usuario.rol,
                                        },
                                    },
                                })];
                        case 3:
                            aprobacion = _d.sent();
                            // 2. Registrar en auditoría
                            return [4 /*yield*/, this.auditService.create({
                                    usuarioId: usuarioId,
                                    accion: 'ASIGNAR_MORA',
                                    entidad: 'Prestamo',
                                    entidadId: prestamoId,
                                    datosNuevos: {
                                        aprobacionId: aprobacion.id,
                                        montoInteres: body.montoInteres,
                                        diasGracia: body.diasGracia,
                                        cliente: nombreCliente,
                                        prestamo: prestamo.numeroPrestamo,
                                        comentarios: body.comentarios,
                                    },
                                    metadata: { endpoint: "POST /loans/".concat(prestamoId, "/asignar-mora") },
                                })];
                        case 4:
                            // 2. Registrar en auditoría
                            _d.sent();
                            // 3. Notificar a aprobadores (interna + push)
                            return [4 /*yield*/, this.notificacionesService.notifyApprovers({
                                    titulo: 'Mora asignada — Requiere aprobacion',
                                    mensaje: "".concat(nombreUsuario, " asign\u00F3 $").concat(body.montoInteres.toLocaleString('es-CO'), " de mora al pr\u00E9stamo ").concat(prestamo.numeroPrestamo, " (").concat(nombreCliente, "). Plazo: ").concat(body.diasGracia, " d\u00EDas. Requiere aprobaci\u00F3n."),
                                    tipo: 'ALERTA',
                                    entidad: 'Aprobacion',
                                    entidadId: aprobacion.id,
                                    metadata: {
                                        tipoAprobacion: 'PRORROGA_PAGO',
                                        tipo: 'ASIGNAR_MORA',
                                        prestamoId: prestamoId,
                                        montoInteres: body.montoInteres,
                                        diasGracia: body.diasGracia,
                                        cliente: nombreCliente,
                                        asignadoPor: nombreUsuario,
                                    },
                                })];
                        case 5:
                            // 3. Notificar a aprobadores (interna + push)
                            _d.sent();
                            _d.label = 6;
                        case 6:
                            _d.trys.push([6, 8, , 9]);
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: usuarioId,
                                    titulo: 'Solicitud enviada',
                                    mensaje: 'Tu solicitud fue enviada con éxito y quedó pendiente de aprobación.',
                                    tipo: 'INFORMATIVO',
                                    entidad: 'Aprobacion',
                                    entidadId: aprobacion.id,
                                    metadata: {
                                        tipoAprobacion: 'PRORROGA_PAGO',
                                        tipo: 'ASIGNAR_MORA',
                                        prestamoId: prestamoId,
                                    },
                                })];
                        case 7:
                            _d.sent();
                            return [3 /*break*/, 9];
                        case 8:
                            _a = _d.sent();
                            return [3 /*break*/, 9];
                        case 9: return [2 /*return*/, {
                                mensaje: 'Mora pendiente de aprobación creada exitosamente',
                                aprobacionId: aprobacion.id,
                                fechaLimite: fechaLimite.toISOString(),
                            }];
                    }
                });
            });
        };
        // GESTIÓN VENCIDA — Prorrogar / Castigar / Dejar Quieto
        // Crea Aprobacion + Auditoria + Notificación
        // ─────────────────────────────────────────────────────────────────────
        LoansController_1.prototype.gestionarVencida = function (prestamoId, body, req) {
            return __awaiter(this, void 0, void 0, function () {
                var usuarioId, prestamo, usuario, nombreUsuario, nombreCliente, LABEL_DECISION, cuotaId, cuotaVencida, tipoAprobacion, dias, nuevaFecha, aprobacion, _a, rolesAutoAprobacion, error_1, msgPorDecision, _b, _c;
                var _d, _e;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0:
                            usuarioId = ((_d = req.user) === null || _d === void 0 ? void 0 : _d.sub) || ((_e = req.user) === null || _e === void 0 ? void 0 : _e.id);
                            if (!usuarioId)
                                throw new Error('Usuario no autenticado');
                            return [4 /*yield*/, this.prisma.prestamo.findUnique({
                                    where: { id: prestamoId },
                                    include: { cliente: true },
                                })];
                        case 1:
                            prestamo = _f.sent();
                            if (!prestamo)
                                throw new Error('Préstamo no encontrado');
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: { id: usuarioId },
                                    select: { nombres: true, apellidos: true, rol: true },
                                })];
                        case 2:
                            usuario = _f.sent();
                            nombreUsuario = usuario ? "".concat(usuario.nombres, " ").concat(usuario.apellidos).trim() : 'Usuario';
                            nombreCliente = prestamo.cliente
                                ? "".concat(prestamo.cliente.nombres, " ").concat(prestamo.cliente.apellidos).trim()
                                : 'Cliente';
                            LABEL_DECISION = {
                                PRORROGAR: 'Prórroga',
                                DEJAR_QUIETO: 'Dejar quieto',
                                CASTIGAR: 'Baja por pérdida',
                            };
                            cuotaId = null;
                            if (!(body.decision === 'PRORROGAR')) return [3 /*break*/, 4];
                            return [4 /*yield*/, this.prisma.cuota.findFirst({
                                    where: {
                                        prestamoId: prestamoId,
                                        estado: { in: ['VENCIDA', 'PENDIENTE'] },
                                    },
                                    orderBy: { numeroCuota: 'asc' },
                                })];
                        case 3:
                            cuotaVencida = _f.sent();
                            cuotaId = (cuotaVencida === null || cuotaVencida === void 0 ? void 0 : cuotaVencida.id) || null;
                            _f.label = 4;
                        case 4:
                            tipoAprobacion = body.decision === 'CASTIGAR'
                                ? 'BAJA_POR_PERDIDA'
                                : 'PRORROGA_PAGO';
                            dias = Number(body.diasGracia || 0) > 0 ? Number(body.diasGracia) : 30;
                            nuevaFecha = new Date();
                            nuevaFecha.setDate(nuevaFecha.getDate() + dias);
                            return [4 /*yield*/, this.prisma.aprobacion.create({
                                    data: {
                                        tipoAprobacion: tipoAprobacion,
                                        solicitadoPorId: usuarioId,
                                        referenciaId: prestamoId,
                                        tablaReferencia: 'Prestamo',
                                        montoSolicitud: Number(prestamo.saldoPendiente),
                                        datosSolicitud: {
                                            tipo: 'GESTION_VENCIDA',
                                            decision: body.decision,
                                            prestamoId: prestamoId,
                                            cuotaId: cuotaId,
                                            numeroPrestamo: prestamo.numeroPrestamo,
                                            cliente: nombreCliente,
                                            clienteNombre: nombreCliente,
                                            saldoPendiente: Number(prestamo.saldoPendiente),
                                            montoInteres: Number(body.montoInteres || 0),
                                            diasGracia: body.decision === 'CASTIGAR' ? 0 : dias,
                                            fechaVencimientoOriginal: prestamo.fechaFin ? new Date(prestamo.fechaFin).toISOString() : undefined,
                                            nuevaFechaVencimiento: body.decision === 'PRORROGAR' ? nuevaFecha.toISOString() : undefined,
                                            comentarios: body.comentarios,
                                            gestionadoPor: nombreUsuario,
                                            rolGestor: usuario === null || usuario === void 0 ? void 0 : usuario.rol,
                                        },
                                    },
                                })];
                        case 5:
                            aprobacion = _f.sent();
                            return [4 /*yield*/, this.auditService.create({
                                    usuarioId: usuarioId,
                                    accion: "GESTION_VENCIDA_".concat(body.decision),
                                    entidad: 'Prestamo',
                                    entidadId: prestamoId,
                                    datosNuevos: {
                                        aprobacionId: aprobacion.id,
                                        decision: body.decision,
                                        cliente: nombreCliente,
                                        prestamo: prestamo.numeroPrestamo,
                                        montoInteres: Number(body.montoInteres || 0),
                                        diasGracia: body.decision === 'CASTIGAR' ? 0 : dias,
                                        comentarios: body.comentarios,
                                    },
                                    metadata: { endpoint: "POST /loans/".concat(prestamoId, "/gestion-vencida") },
                                })];
                        case 6:
                            _f.sent();
                            if (!(body.decision === 'PRORROGAR')) return [3 /*break*/, 10];
                            _f.label = 7;
                        case 7:
                            _f.trys.push([7, 9, , 10]);
                            return [4 /*yield*/, this.prisma.prestamo.update({
                                    where: { id: prestamoId },
                                    data: { fechaFin: nuevaFecha },
                                })];
                        case 8:
                            _f.sent();
                            return [3 /*break*/, 10];
                        case 9:
                            _a = _f.sent();
                            return [3 /*break*/, 10];
                        case 10:
                            rolesAutoAprobacion = [
                                client_1.RolUsuario.ADMIN,
                                client_1.RolUsuario.SUPER_ADMINISTRADOR,
                                client_1.RolUsuario.COORDINADOR,
                            ];
                            if (!(usuario && rolesAutoAprobacion.includes(usuario.rol))) return [3 /*break*/, 18];
                            _f.label = 11;
                        case 11:
                            _f.trys.push([11, 17, , 18]);
                            if (!(tipoAprobacion === 'BAJA_POR_PERDIDA')) return [3 /*break*/, 14];
                            return [4 /*yield*/, this.prisma.aprobacion.update({
                                    where: { id: aprobacion.id },
                                    data: { estado: 'APROBADO', aprobadoPorId: usuarioId, revisadoEn: new Date() },
                                })];
                        case 12:
                            _f.sent();
                            return [4 /*yield*/, this.loansService.archiveLoan(prestamoId, {
                                    motivo: body.comentarios || 'Baja por pérdida (auto-aprobado)',
                                    archivarPorId: usuarioId,
                                })];
                        case 13:
                            _f.sent();
                            return [3 /*break*/, 16];
                        case 14: return [4 /*yield*/, this.approvalsService.approveItem(aprobacion.id, tipoAprobacion, usuarioId)];
                        case 15:
                            _f.sent();
                            _f.label = 16;
                        case 16: return [2 /*return*/, {
                                mensaje: "Decisi\u00F3n de ".concat(LABEL_DECISION[body.decision], " aprobada y ejecutada autom\u00E1ticamente"),
                                aprobacionId: aprobacion.id,
                                decision: body.decision,
                            }];
                        case 17:
                            error_1 = _f.sent();
                            console.error('Error auto-aprobando gestión vencida:', error_1);
                            return [3 /*break*/, 18];
                        case 18:
                            _f.trys.push([18, 20, , 21]);
                            msgPorDecision = {
                                PRORROGAR: "".concat(nombreUsuario, " solicit\u00F3 una pr\u00F3rroga de ").concat(dias, " d\u00EDas para el pr\u00E9stamo ").concat(prestamo.numeroPrestamo, " del cliente ").concat(nombreCliente, "."),
                                DEJAR_QUIETO: "".concat(nombreUsuario, " solicit\u00F3 dejar quieto el pr\u00E9stamo ").concat(prestamo.numeroPrestamo, " del cliente ").concat(nombreCliente, "."),
                                CASTIGAR: "".concat(nombreUsuario, " solicit\u00F3 dar de baja por p\u00E9rdida el pr\u00E9stamo ").concat(prestamo.numeroPrestamo, " del cliente ").concat(nombreCliente, "."),
                            };
                            return [4 /*yield*/, this.notificacionesService.notifyApprovers({
                                    titulo: "".concat(LABEL_DECISION[body.decision], " \u2014 ").concat(nombreCliente, " (").concat(prestamo.numeroPrestamo, ")"),
                                    mensaje: msgPorDecision[body.decision] || "".concat(nombreUsuario, " solicit\u00F3 ").concat(LABEL_DECISION[body.decision].toLowerCase(), " para el pr\u00E9stamo ").concat(prestamo.numeroPrestamo, "."),
                                    tipo: body.decision === 'CASTIGAR' ? 'WARNING' : 'INFO',
                                    entidad: 'Aprobacion',
                                    entidadId: aprobacion.id,
                                    metadata: {
                                        tipoAprobacion: tipoAprobacion,
                                        tipo: 'GESTION_VENCIDA',
                                        decision: body.decision,
                                        prestamoId: prestamoId,
                                        cliente: nombreCliente,
                                        numeroPrestamo: prestamo.numeroPrestamo,
                                        saldoPendiente: Number(prestamo.saldoPendiente),
                                        diasGracia: body.decision === 'CASTIGAR' ? 0 : dias,
                                        montoInteres: Number(body.montoInteres || 0),
                                        gestionadoPor: nombreUsuario,
                                    },
                                })];
                        case 19:
                            _f.sent();
                            return [3 /*break*/, 21];
                        case 20:
                            _b = _f.sent();
                            return [3 /*break*/, 21];
                        case 21:
                            _f.trys.push([21, 23, , 24]);
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: usuarioId,
                                    titulo: "Solicitud de ".concat(LABEL_DECISION[body.decision], " enviada"),
                                    mensaje: 'Tu solicitud fue enviada con éxito y quedó pendiente de aprobación.',
                                    tipo: 'INFORMATIVO',
                                    entidad: 'Aprobacion',
                                    entidadId: aprobacion.id,
                                    metadata: {
                                        tipoAprobacion: tipoAprobacion,
                                        tipo: 'GESTION_VENCIDA',
                                        decision: body.decision,
                                        prestamoId: prestamoId,
                                    },
                                })];
                        case 22:
                            _f.sent();
                            return [3 /*break*/, 24];
                        case 23:
                            _c = _f.sent();
                            return [3 /*break*/, 24];
                        case 24: return [2 /*return*/, {
                                mensaje: "Solicitud de ".concat(LABEL_DECISION[body.decision], " enviada a revisi\u00F3n"),
                                aprobacionId: aprobacion.id,
                                decision: body.decision,
                            }];
                    }
                });
            });
        };
        LoansController_1.prototype.solicitarReprogramacion = function (prestamoId, body, req) {
            return __awaiter(this, void 0, void 0, function () {
                var usuarioId, prestamo, usuario, nombreUsuario, nombreCliente, cuota, nuevaFechaCuota, aprobacion, _a, _b;
                var _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            usuarioId = ((_c = req.user) === null || _c === void 0 ? void 0 : _c.sub) || ((_d = req.user) === null || _d === void 0 ? void 0 : _d.id);
                            if (!usuarioId)
                                throw new Error('Usuario no autenticado');
                            return [4 /*yield*/, this.prisma.prestamo.findUnique({
                                    where: { id: prestamoId },
                                    include: { cliente: true },
                                })];
                        case 1:
                            prestamo = _e.sent();
                            if (!prestamo)
                                throw new Error('Préstamo no encontrado');
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: { id: usuarioId },
                                    select: { nombres: true, apellidos: true, rol: true },
                                })];
                        case 2:
                            usuario = _e.sent();
                            nombreUsuario = usuario ? "".concat(usuario.nombres, " ").concat(usuario.apellidos).trim() : 'Usuario';
                            nombreCliente = prestamo.cliente
                                ? "".concat(prestamo.cliente.nombres, " ").concat(prestamo.cliente.apellidos).trim()
                                : 'Cliente';
                            return [4 /*yield*/, this.prisma.cuota.findUnique({
                                    where: { id: body.cuotaId },
                                    include: { prestamo: true },
                                })];
                        case 3:
                            cuota = _e.sent();
                            if (!cuota)
                                throw new Error('Cuota no encontrada');
                            nuevaFechaCuota = new Date(body.nuevaFecha);
                            if (nuevaFechaCuota < new Date()) {
                                throw new Error('La nueva fecha de la cuota debe ser posterior a la fecha actual');
                            }
                            return [4 /*yield*/, this.prisma.aprobacion.create({
                                    data: {
                                        tipoAprobacion: 'REPROGRAMACION_CUOTA',
                                        solicitadoPorId: usuarioId,
                                        referenciaId: prestamoId,
                                        tablaReferencia: 'Prestamo',
                                        montoSolicitud: cuota.monto,
                                        datosSolicitud: {
                                            tipo: 'REPROGRAMACION_CUOTA',
                                            prestamoId: prestamoId,
                                            cuotaId: body.cuotaId,
                                            numeroPrestamo: prestamo.numeroPrestamo,
                                            cliente: nombreCliente,
                                            clienteNombre: nombreCliente,
                                            saldoPendiente: Number(prestamo.saldoPendiente),
                                            montoCuota: cuota.monto,
                                            fechaVencimientoOriginal: cuota.fechaVencimiento ? new Date(cuota.fechaVencimiento).toISOString() : undefined,
                                            nuevaFechaVencimiento: nuevaFechaCuota.toISOString(),
                                            motivo: body.motivo,
                                            solicitadoPor: nombreUsuario,
                                            rolSolicitante: usuario === null || usuario === void 0 ? void 0 : usuario.rol,
                                        },
                                    },
                                })];
                        case 4:
                            aprobacion = _e.sent();
                            return [4 /*yield*/, this.auditService.create({
                                    usuarioId: usuarioId,
                                    accion: 'REPROGRAMACION_CUOTA',
                                    entidad: 'Prestamo',
                                    entidadId: prestamoId,
                                    datosNuevos: {
                                        aprobacionId: aprobacion.id,
                                        cuotaId: body.cuotaId,
                                        nuevaFechaVencimiento: nuevaFechaCuota.toISOString(),
                                        motivo: body.motivo,
                                    },
                                    metadata: { endpoint: "POST /loans/".concat(prestamoId, "/reprogramacion") },
                                })];
                        case 5:
                            _e.sent();
                            _e.label = 6;
                        case 6:
                            _e.trys.push([6, 8, , 9]);
                            return [4 /*yield*/, this.notificacionesService.notifyApprovers({
                                    titulo: "Reprogramaci\u00F3n de cuota \u2014 ".concat(nombreCliente, " (").concat(prestamo.numeroPrestamo, ")"),
                                    mensaje: "".concat(nombreUsuario, " solicit\u00F3 reprogramar la cuota ").concat(cuota.numeroCuota, " del pr\u00E9stamo ").concat(prestamo.numeroPrestamo, " del cliente ").concat(nombreCliente, " para el ").concat(nuevaFechaCuota.toLocaleDateString('es-CO'), "."),
                                    tipo: 'INFO',
                                    entidad: 'Aprobacion',
                                    entidadId: aprobacion.id,
                                    metadata: {
                                        tipoAprobacion: 'REPROGRAMACION_CUOTA',
                                        tipo: 'REPROGRAMACION_CUOTA',
                                        prestamoId: prestamoId,
                                        cuotaId: body.cuotaId,
                                        numeroPrestamo: prestamo.numeroPrestamo,
                                        cliente: nombreCliente,
                                        saldoPendiente: Number(prestamo.saldoPendiente),
                                        montoCuota: cuota.monto,
                                        nuevaFechaVencimiento: nuevaFechaCuota.toISOString(),
                                        motivo: body.motivo,
                                        solicitadoPor: nombreUsuario,
                                    },
                                })];
                        case 7:
                            _e.sent();
                            return [3 /*break*/, 9];
                        case 8:
                            _a = _e.sent();
                            return [3 /*break*/, 9];
                        case 9:
                            _e.trys.push([9, 11, , 12]);
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: usuarioId,
                                    titulo: 'Solicitud de reprogramación enviada',
                                    mensaje: 'Tu solicitud fue enviada con éxito y quedó pendiente de aprobación.',
                                    tipo: 'INFORMATIVO',
                                    entidad: 'Aprobacion',
                                    entidadId: aprobacion.id,
                                    metadata: {
                                        tipoAprobacion: 'REPROGRAMACION_CUOTA',
                                        tipo: 'REPROGRAMACION_CUOTA',
                                        prestamoId: prestamoId,
                                    },
                                })];
                        case 10:
                            _e.sent();
                            return [3 /*break*/, 12];
                        case 11:
                            _b = _e.sent();
                            return [3 /*break*/, 12];
                        case 12: return [2 /*return*/, {
                                mensaje: 'Solicitud de reprogramación enviada a revisión',
                                aprobacionId: aprobacion.id,
                            }];
                    }
                });
            });
        };
        LoansController_1.prototype.listarReprogramacionesPendientes = function (estado) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.loansService.listarReprogramacionesPendientes(estado)];
                });
            });
        };
        LoansController_1.prototype.aprobarReprogramacion = function (id, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.loansService.aprobarReprogramacion(id, req.user.id)];
                });
            });
        };
        LoansController_1.prototype.rechazarReprogramacion = function (id, body, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.loansService.rechazarReprogramacion(id, req.user.id, body.comentarios)];
                });
            });
        };
        return LoansController_1;
    }());
    __setFunctionName(_classThis, "LoansController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _getAllLoans_decorators = [(0, common_1.Get)(), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COBRADOR, client_1.RolUsuario.CONTADOR, client_1.RolUsuario.PUNTO_DE_VENTA), (0, swagger_1.ApiOperation)({
                summary: 'Obtener todos los préstamos',
                description: 'Obtiene una lista paginada de préstamos con filtros opcionales',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.OK,
                description: 'Lista de préstamos obtenida exitosamente',
                schema: {
                    example: {
                        prestamos: [],
                        estadisticas: {},
                        paginacion: {},
                    },
                },
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.UNAUTHORIZED,
                description: 'No autorizado',
            }), (0, swagger_1.ApiQuery)({
                name: 'estado',
                required: false,
                description: 'Filtro por estado (ACTIVO, EN_MORA, PAGADO, etc.)',
                example: 'ACTIVO',
            }), (0, swagger_1.ApiQuery)({
                name: 'ruta',
                required: false,
                description: 'Filtro por ID de ruta',
                example: 'cl67qg5e80001c8ibw3d2q7p8',
            }), (0, swagger_1.ApiQuery)({
                name: 'search',
                required: false,
                description: 'Búsqueda por texto (nombre, apellido, DNI, número de préstamo)',
                example: 'Juan',
            }), (0, swagger_1.ApiQuery)({
                name: 'page',
                required: false,
                type: Number,
                description: 'Número de página',
                example: 1,
            }), (0, swagger_1.ApiQuery)({
                name: 'limit',
                required: false,
                type: Number,
                description: 'Límite por página (máximo 100)',
                example: 8,
            })];
        _exportLoans_decorators = [(0, common_1.Get)('export'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.CONTADOR), (0, swagger_1.ApiOperation)({ summary: 'Exportar listado de préstamos y cartera en Excel o PDF' }), (0, swagger_1.ApiQuery)({ name: 'format', enum: ['excel', 'pdf'], required: true }), (0, swagger_1.ApiQuery)({ name: 'estado', required: false }), (0, swagger_1.ApiQuery)({ name: 'ruta', required: false }), (0, swagger_1.ApiQuery)({ name: 'search', required: false }), (0, common_1.HttpCode)(common_1.HttpStatus.OK)];
        _exportContrato_decorators = [(0, common_1.Get)(':id/contrato'), (0, swagger_1.ApiOperation)({ summary: 'Exportar contrato de crédito de artículo en PDF' }), (0, swagger_1.ApiQuery)({ name: 'format', enum: ['pdf'], required: false }), (0, common_1.HttpCode)(common_1.HttpStatus.OK)];
        _getLoanById_decorators = [(0, common_1.Get)(':id'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COBRADOR, client_1.RolUsuario.CONTADOR, client_1.RolUsuario.PUNTO_DE_VENTA), (0, swagger_1.ApiOperation)({
                summary: 'Obtener un préstamo por ID',
                description: 'Obtiene los detalles completos de un préstamo específico',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.OK,
                description: 'Préstamo encontrado',
                schema: {
                    example: {
                        id: 'cl67qg5e80001c8ibw3d2q7p8',
                        numeroPrestamo: 'PRES-000001',
                        clienteId: 'cl67qg5e80001c8ibw3d2q7p8',
                        // ... más campos
                    },
                },
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.NOT_FOUND,
                description: 'Préstamo no encontrado',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.UNAUTHORIZED,
                description: 'No autorizado',
            }), (0, swagger_1.ApiParam)({
                name: 'id',
                description: 'ID del préstamo',
                example: 'cl67qg5e80001c8ibw3d2q7p8',
            })];
        _getArchivedLoanById_decorators = [(0, common_1.Get)(':id/archived'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.CONTADOR), (0, swagger_1.ApiOperation)({
                summary: 'Obtener un préstamo archivado por ID',
                description: 'Obtiene los detalles de un préstamo incluso si está eliminado (soft delete).',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.OK,
                description: 'Préstamo encontrado',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.NOT_FOUND,
                description: 'Préstamo no encontrado',
            }), (0, swagger_1.ApiParam)({
                name: 'id',
                description: 'ID del préstamo',
            })];
        _getLoanCuotas_decorators = [(0, common_1.Get)(':id/cuotas'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COBRADOR, client_1.RolUsuario.CONTADOR, client_1.RolUsuario.PUNTO_DE_VENTA), (0, swagger_1.ApiOperation)({
                summary: 'Obtener cuotas de un préstamo',
                description: 'Obtiene todas las cuotas asociadas a un préstamo específico',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.OK,
                description: 'Lista de cuotas obtenida exitosamente',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.NOT_FOUND,
                description: 'Préstamo no encontrado',
            }), (0, swagger_1.ApiParam)({
                name: 'id',
                description: 'ID del préstamo',
                example: 'cl67qg5e80001c8ibw3d2q7p8',
            })];
        _createLoan_decorators = [(0, common_1.Post)(), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.COBRADOR, client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.PUNTO_DE_VENTA), (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true })), (0, common_1.HttpCode)(common_1.HttpStatus.CREATED), (0, swagger_1.ApiOperation)({
                summary: 'Crear un nuevo préstamo',
                description: 'Crea un nuevo préstamo (en efectivo o por artículo) con cuotas automáticas',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.CREATED,
                description: 'Préstamo creado exitosamente',
                schema: {
                    example: {
                        id: 'cl67qg5e80001c8ibw3d2q7p8',
                        numeroPrestamo: 'PRES-000001',
                        mensaje: 'Préstamo creado exitosamente. Pendiente de aprobación.',
                        requiereAprobacion: true,
                        // ... más campos
                    },
                },
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.BAD_REQUEST,
                description: 'Datos inválidos o validación fallida',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.UNAUTHORIZED,
                description: 'No autorizado',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.NOT_FOUND,
                description: 'Cliente o producto no encontrado',
            }), (0, swagger_1.ApiBody)({
                type: create_loan_dto_1.CreateLoanDto,
                description: 'Datos para crear el préstamo',
                examples: {
                    'Préstamo en efectivo': {
                        value: {
                            clienteId: 'cl67qg5e80001c8ibw3d2q7p8',
                            tipoPrestamo: 'EFECTIVO',
                            monto: 1000000,
                            tasaInteres: 10,
                            tasaInteresMora: 2,
                            plazoMeses: 12,
                            frecuenciaPago: 'QUINCENAL',
                            fechaInicio: '2024-01-01',
                            notas: 'Préstamo para negocios',
                        },
                    },
                    'Crédito por artículo': {
                        value: {
                            clienteId: 'cl67qg5e80001c8ibw3d2q7p8',
                            productoId: 'cl67qg5e80001c8ibw3d2q7p8',
                            precioProductoId: 'cl67qg5e80001c8ibw3d2q7p8',
                            tipoPrestamo: 'ARTICULO',
                            monto: 1500000,
                            tasaInteres: 0,
                            tasaInteresMora: 2,
                            plazoMeses: 6,
                            frecuenciaPago: 'MENSUAL',
                            fechaInicio: '2024-01-01',
                            cuotaInicial: 300000,
                            notas: 'Televisor Samsung 55"',
                        },
                    },
                },
            })];
        _approveLoan_decorators = [(0, common_1.Post)(':id/approve'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN), (0, common_1.HttpCode)(common_1.HttpStatus.OK), (0, swagger_1.ApiOperation)({
                summary: 'Aprobar un préstamo',
                description: 'Aprueba un préstamo pendiente de aprobación, cambiando su estado a ACTIVO',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.OK,
                description: 'Préstamo aprobado exitosamente',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.NOT_FOUND,
                description: 'Préstamo no encontrado',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.BAD_REQUEST,
                description: 'El préstamo no está pendiente de aprobación',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.UNAUTHORIZED,
                description: 'No autorizado',
            }), (0, swagger_1.ApiParam)({
                name: 'id',
                description: 'ID del préstamo a aprobar',
                example: 'cl67qg5e80001c8ibw3d2q7p8',
            }), (0, swagger_1.ApiBody)({
                description: 'Datos para aprobar el préstamo',
                schema: {
                    type: 'object',
                    properties: {
                        aprobadoPorId: {
                            type: 'string',
                            description: 'ID del usuario que aprueba (se obtiene automáticamente del JWT)',
                            example: 'cl67qg5e80001c8ibw3d2q7p8',
                        },
                    },
                },
            })];
        _rejectLoan_decorators = [(0, common_1.Post)(':id/reject'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN), (0, common_1.HttpCode)(common_1.HttpStatus.OK), (0, swagger_1.ApiOperation)({
                summary: 'Rechazar un préstamo',
                description: 'Rechaza un préstamo pendiente de aprobación',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.OK,
                description: 'Préstamo rechazado exitosamente',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.NOT_FOUND,
                description: 'Préstamo no encontrado',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.UNAUTHORIZED,
                description: 'No autorizado',
            }), (0, swagger_1.ApiParam)({
                name: 'id',
                description: 'ID del préstamo a rechazar',
                example: 'cl67qg5e80001c8ibw3d2q7p8',
            }), (0, swagger_1.ApiBody)({
                description: 'Datos para rechazar el préstamo',
                schema: {
                    type: 'object',
                    properties: {
                        rechazadoPorId: {
                            type: 'string',
                            description: 'ID del usuario que rechaza (se obtiene automáticamente del JWT)',
                            example: 'cl67qg5e80001c8ibw3d2q7p8',
                        },
                        motivo: {
                            type: 'string',
                            description: 'Motivo del rechazo',
                            example: 'Cliente con historial crediticio deficiente',
                            // required: false
                        },
                    },
                },
            })];
        _deleteLoan_decorators = [(0, common_1.Delete)(':id'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN), (0, common_1.HttpCode)(common_1.HttpStatus.OK), (0, swagger_1.ApiOperation)({
                summary: 'Eliminar un préstamo (marcar como eliminado)',
                description: 'Marca un préstamo como eliminado (soft delete) cambiando su estado a PERDIDA',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.OK,
                description: 'Préstamo eliminado exitosamente',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.NOT_FOUND,
                description: 'Préstamo no encontrado',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.UNAUTHORIZED,
                description: 'No autorizado',
            }), (0, swagger_1.ApiParam)({
                name: 'id',
                description: 'ID del préstamo a eliminar',
                example: 'cl67qg5e80001c8ibw3d2q7p8',
            })];
        _updateLoan_decorators = [(0, common_1.Patch)(':id'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN), (0, common_1.HttpCode)(common_1.HttpStatus.OK), (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true })), (0, swagger_1.ApiOperation)({
                summary: 'Actualizar un préstamo',
                description: 'Actualiza los datos editables de un préstamo existente',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.OK,
                description: 'Préstamo actualizado exitosamente',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.NOT_FOUND,
                description: 'Préstamo no encontrado',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.UNAUTHORIZED,
                description: 'No autorizado',
            }), (0, swagger_1.ApiParam)({
                name: 'id',
                description: 'ID del préstamo a actualizar',
                example: 'cl67qg5e80001c8ibw3d2q7p8',
            })];
        _restoreLoan_decorators = [(0, common_1.Patch)(':id/restore'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN), (0, common_1.HttpCode)(common_1.HttpStatus.OK), (0, swagger_1.ApiOperation)({
                summary: 'Restaurar un préstamo eliminado',
                description: 'Restaura un préstamo previamente eliminado (soft delete)',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.OK,
                description: 'Préstamo restaurado exitosamente',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.NOT_FOUND,
                description: 'Préstamo no encontrado',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.BAD_REQUEST,
                description: 'El préstamo no está eliminado',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.UNAUTHORIZED,
                description: 'No autorizado',
            }), (0, swagger_1.ApiParam)({
                name: 'id',
                description: 'ID del préstamo a restaurar',
                example: 'cl67qg5e80001c8ibw3d2q7p8',
            })];
        _archiveLoan_decorators = [(0, common_1.Post)(':id/archive'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPERVISOR), (0, swagger_1.ApiOperation)({ summary: 'Archivar préstamo como pérdida y agregar cliente a blacklist' }), (0, swagger_1.ApiParam)({ name: 'id', description: 'ID del préstamo a archivar' }), (0, swagger_1.ApiBody)({
                schema: {
                    type: 'object',
                    properties: {
                        motivo: { type: 'string', example: 'Impago reiterado' },
                        notas: { type: 'string', example: 'Cliente no responde llamadas' },
                    },
                    required: ['motivo'],
                },
            }), (0, swagger_1.ApiResponse)({ status: common_1.HttpStatus.OK, description: 'Préstamo archivado exitosamente' }), (0, swagger_1.ApiResponse)({ status: common_1.HttpStatus.NOT_FOUND, description: 'Préstamo no encontrado' }), (0, swagger_1.ApiResponse)({ status: common_1.HttpStatus.BAD_REQUEST, description: 'El préstamo ya está archivado' })];
        _reprogramarCuota_decorators = [(0, common_1.Patch)(':id/cuotas/:numeroCuota/reprogramar'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPERVISOR), (0, swagger_1.ApiOperation)({ summary: 'Reprogramar fecha de vencimiento de una cuota' }), (0, swagger_1.ApiParam)({ name: 'id', description: 'ID del préstamo' }), (0, swagger_1.ApiParam)({ name: 'numeroCuota', description: 'Número de la cuota a reprogramar' }), (0, swagger_1.ApiBody)({ type: reprogramar_cuota_dto_1.ReprogramarCuotaDto }), (0, swagger_1.ApiResponse)({ status: common_1.HttpStatus.OK, description: 'Cuota reprogramada exitosamente' }), (0, swagger_1.ApiResponse)({ status: common_1.HttpStatus.NOT_FOUND, description: 'Préstamo o cuota no encontrada' }), (0, swagger_1.ApiResponse)({ status: common_1.HttpStatus.BAD_REQUEST, description: 'Datos inválidos' })];
        _fixInterestCalculations_decorators = [(0, common_1.Post)('fix-interest-calculations'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR), (0, swagger_1.ApiOperation)({
                summary: 'Corregir cálculos de intereses en préstamos existentes',
                description: 'Ejecuta script de corrección masiva para préstamos con interés simple mal calculado',
            })];
        _procesarMora_decorators = [(0, common_1.Post)('procesar-mora'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR), (0, common_1.HttpCode)(common_1.HttpStatus.OK), (0, swagger_1.ApiOperation)({
                summary: 'Procesar mora automática',
                description: 'Marca cuotas vencidas, actualiza préstamos a EN_MORA y actualiza nivel de riesgo de clientes. ' +
                    'Este proceso también se ejecuta automáticamente al arrancar el servidor.',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.OK,
                description: 'Proceso de mora ejecutado exitosamente',
                schema: {
                    example: {
                        cuotasVencidas: 5,
                        prestamosEnMoraActualizados: 3,
                        prestamosActivosRecuperados: 1,
                        clientesRiesgoActualizado: 4,
                        errores: [],
                        procesadoEn: '2026-02-27T17:00:00.000Z',
                    },
                },
            })];
        _getResumenMoraCliente_decorators = [(0, common_1.Get)('mora/cliente/:clienteId'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COBRADOR), (0, swagger_1.ApiOperation)({
                summary: 'Resumen de mora de un cliente',
                description: 'Retorna días en mora, nivel de riesgo, etiqueta (Mínimo/Leve/Precaución/Moderado/Crítico) y montos vencidos del cliente.',
            }), (0, swagger_1.ApiParam)({ name: 'clienteId', description: 'ID del cliente' }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.OK,
                description: 'Resumen de mora del cliente',
                schema: {
                    example: {
                        clienteId: 'abc123',
                        diasEnMora: 12,
                        nivelRiesgo: 'AMARILLO',
                        etiqueta: 'Precaución',
                        cuotasVencidas: 2,
                        montoVencido: 150000,
                    },
                },
            })];
        _asignarMora_decorators = [(0, common_1.Post)(':id/asignar-mora'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPERVISOR), (0, swagger_1.ApiOperation)({ summary: 'Asignar interés de mora a un préstamo (requiere aprobación)' })];
        _gestionarVencida_decorators = [(0, common_1.Post)(':id/gestion-vencida'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.CONTADOR), (0, common_1.HttpCode)(common_1.HttpStatus.CREATED), (0, swagger_1.ApiOperation)({ summary: 'Procesar gestión sobre cuenta vencida' })];
        _solicitarReprogramacion_decorators = [(0, common_1.Post)(':id/reprogramacion'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COBRADOR), (0, swagger_1.ApiOperation)({ summary: 'Solicitar reprogramación de cuota' })];
        _listarReprogramacionesPendientes_decorators = [(0, common_1.Get)('reprogramaciones-pendientes'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPERVISOR), (0, swagger_1.ApiOperation)({ summary: 'Listar solicitudes de reprogramación pendientes' }), (0, swagger_1.ApiQuery)({ name: 'estado', required: false, enum: ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'TODOS'] })];
        _aprobarReprogramacion_decorators = [(0, common_1.Patch)('reprogramaciones/:id/aprobar'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPERVISOR), (0, common_1.HttpCode)(common_1.HttpStatus.OK), (0, swagger_1.ApiOperation)({ summary: 'Aprobar solicitud de reprogramación' })];
        _rechazarReprogramacion_decorators = [(0, common_1.Patch)('reprogramaciones/:id/rechazar'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPERVISOR), (0, common_1.HttpCode)(common_1.HttpStatus.OK), (0, swagger_1.ApiOperation)({ summary: 'Rechazar solicitud de reprogramación' })];
        __esDecorate(_classThis, null, _getAllLoans_decorators, { kind: "method", name: "getAllLoans", static: false, private: false, access: { has: function (obj) { return "getAllLoans" in obj; }, get: function (obj) { return obj.getAllLoans; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _exportLoans_decorators, { kind: "method", name: "exportLoans", static: false, private: false, access: { has: function (obj) { return "exportLoans" in obj; }, get: function (obj) { return obj.exportLoans; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _exportContrato_decorators, { kind: "method", name: "exportContrato", static: false, private: false, access: { has: function (obj) { return "exportContrato" in obj; }, get: function (obj) { return obj.exportContrato; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getLoanById_decorators, { kind: "method", name: "getLoanById", static: false, private: false, access: { has: function (obj) { return "getLoanById" in obj; }, get: function (obj) { return obj.getLoanById; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getArchivedLoanById_decorators, { kind: "method", name: "getArchivedLoanById", static: false, private: false, access: { has: function (obj) { return "getArchivedLoanById" in obj; }, get: function (obj) { return obj.getArchivedLoanById; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getLoanCuotas_decorators, { kind: "method", name: "getLoanCuotas", static: false, private: false, access: { has: function (obj) { return "getLoanCuotas" in obj; }, get: function (obj) { return obj.getLoanCuotas; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _createLoan_decorators, { kind: "method", name: "createLoan", static: false, private: false, access: { has: function (obj) { return "createLoan" in obj; }, get: function (obj) { return obj.createLoan; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _approveLoan_decorators, { kind: "method", name: "approveLoan", static: false, private: false, access: { has: function (obj) { return "approveLoan" in obj; }, get: function (obj) { return obj.approveLoan; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _rejectLoan_decorators, { kind: "method", name: "rejectLoan", static: false, private: false, access: { has: function (obj) { return "rejectLoan" in obj; }, get: function (obj) { return obj.rejectLoan; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _deleteLoan_decorators, { kind: "method", name: "deleteLoan", static: false, private: false, access: { has: function (obj) { return "deleteLoan" in obj; }, get: function (obj) { return obj.deleteLoan; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateLoan_decorators, { kind: "method", name: "updateLoan", static: false, private: false, access: { has: function (obj) { return "updateLoan" in obj; }, get: function (obj) { return obj.updateLoan; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _restoreLoan_decorators, { kind: "method", name: "restoreLoan", static: false, private: false, access: { has: function (obj) { return "restoreLoan" in obj; }, get: function (obj) { return obj.restoreLoan; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _archiveLoan_decorators, { kind: "method", name: "archiveLoan", static: false, private: false, access: { has: function (obj) { return "archiveLoan" in obj; }, get: function (obj) { return obj.archiveLoan; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _reprogramarCuota_decorators, { kind: "method", name: "reprogramarCuota", static: false, private: false, access: { has: function (obj) { return "reprogramarCuota" in obj; }, get: function (obj) { return obj.reprogramarCuota; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _fixInterestCalculations_decorators, { kind: "method", name: "fixInterestCalculations", static: false, private: false, access: { has: function (obj) { return "fixInterestCalculations" in obj; }, get: function (obj) { return obj.fixInterestCalculations; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _procesarMora_decorators, { kind: "method", name: "procesarMora", static: false, private: false, access: { has: function (obj) { return "procesarMora" in obj; }, get: function (obj) { return obj.procesarMora; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getResumenMoraCliente_decorators, { kind: "method", name: "getResumenMoraCliente", static: false, private: false, access: { has: function (obj) { return "getResumenMoraCliente" in obj; }, get: function (obj) { return obj.getResumenMoraCliente; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _asignarMora_decorators, { kind: "method", name: "asignarMora", static: false, private: false, access: { has: function (obj) { return "asignarMora" in obj; }, get: function (obj) { return obj.asignarMora; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _gestionarVencida_decorators, { kind: "method", name: "gestionarVencida", static: false, private: false, access: { has: function (obj) { return "gestionarVencida" in obj; }, get: function (obj) { return obj.gestionarVencida; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _solicitarReprogramacion_decorators, { kind: "method", name: "solicitarReprogramacion", static: false, private: false, access: { has: function (obj) { return "solicitarReprogramacion" in obj; }, get: function (obj) { return obj.solicitarReprogramacion; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _listarReprogramacionesPendientes_decorators, { kind: "method", name: "listarReprogramacionesPendientes", static: false, private: false, access: { has: function (obj) { return "listarReprogramacionesPendientes" in obj; }, get: function (obj) { return obj.listarReprogramacionesPendientes; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _aprobarReprogramacion_decorators, { kind: "method", name: "aprobarReprogramacion", static: false, private: false, access: { has: function (obj) { return "aprobarReprogramacion" in obj; }, get: function (obj) { return obj.aprobarReprogramacion; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _rechazarReprogramacion_decorators, { kind: "method", name: "rechazarReprogramacion", static: false, private: false, access: { has: function (obj) { return "rechazarReprogramacion" in obj; }, get: function (obj) { return obj.rechazarReprogramacion; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        LoansController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return LoansController = _classThis;
}();
exports.LoansController = LoansController;
