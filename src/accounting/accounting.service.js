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
exports.AccountingService = void 0;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var reporte_contable_template_1 = require("../templates/exports/reporte-contable.template");
var AccountingService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var AccountingService = _classThis = /** @class */ (function () {
        function AccountingService_1(prisma, notificacionesService, notificacionesGateway) {
            this.prisma = prisma;
            this.notificacionesService = notificacionesService;
            this.notificacionesGateway = notificacionesGateway;
            this.logger = new common_1.Logger(AccountingService.name);
        }
        AccountingService_1.prototype.onModuleInit = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.ensureCajasDefault()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        /**
         * Crea las cajas por defecto si no existen.
         * - Caja Principal: recibe consolidaciones de rutas.
         * - Caja de Oficina: para movimientos internos de la oficina.
         * El responsable inicial es el primer ADMIN o SUPER_ADMINISTRADOR activo.
         * La asignacion del responsable puede cambiarse en cualquier momento.
         */
        AccountingService_1.prototype.ensureCajasDefault = function () {
            return __awaiter(this, void 0, void 0, function () {
                var adminUser, cajasDefault, _i, cajasDefault_1, def, existe, err_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 7, , 8]);
                            return [4 /*yield*/, this.prisma.usuario.findFirst({
                                    where: {
                                        rol: { in: ['SUPER_ADMINISTRADOR', 'ADMIN'] },
                                        estado: 'ACTIVO',
                                        eliminadoEn: null,
                                    },
                                    orderBy: { creadoEn: 'asc' },
                                    select: { id: true },
                                })];
                        case 1:
                            adminUser = _a.sent();
                            if (!adminUser) {
                                this.logger.warn('No hay un usuario administrador activo para asignar las cajas por defecto. Se reintentara cuando exista uno.');
                                return [2 /*return*/];
                            }
                            cajasDefault = [
                                { codigo: 'CAJA-PRINCIPAL', nombre: 'Caja Principal', tipo: 'PRINCIPAL' },
                                { codigo: 'CAJA-OFICINA', nombre: 'Caja de Oficina', tipo: 'PRINCIPAL' },
                                { codigo: 'CAJA-BANCO', nombre: 'Caja Banco', tipo: 'PRINCIPAL' },
                            ];
                            _i = 0, cajasDefault_1 = cajasDefault;
                            _a.label = 2;
                        case 2:
                            if (!(_i < cajasDefault_1.length)) return [3 /*break*/, 6];
                            def = cajasDefault_1[_i];
                            return [4 /*yield*/, this.prisma.caja.findUnique({ where: { codigo: def.codigo } })];
                        case 3:
                            existe = _a.sent();
                            if (!!existe) return [3 /*break*/, 5];
                            return [4 /*yield*/, this.prisma.caja.create({
                                    data: {
                                        codigo: def.codigo,
                                        nombre: def.nombre,
                                        tipo: def.tipo,
                                        responsableId: adminUser.id,
                                        saldoActual: 0,
                                        activa: true,
                                    },
                                })];
                        case 4:
                            _a.sent();
                            this.logger.log("Caja por defecto creada: ".concat(def.nombre, " (").concat(def.codigo, ")"));
                            _a.label = 5;
                        case 5:
                            _i++;
                            return [3 /*break*/, 2];
                        case 6: return [3 /*break*/, 8];
                        case 7:
                            err_1 = _a.sent();
                            this.logger.error("Error al verificar cajas por defecto: ".concat(err_1.message));
                            return [3 /*break*/, 8];
                        case 8: return [2 /*return*/];
                    }
                });
            });
        };
        // =====================
        // CAJAS
        // =====================
        AccountingService_1.prototype.getCajas = function () {
            return __awaiter(this, void 0, void 0, function () {
                var cajas, ahora, fechaInicio, fechaFin, cajasConSaldo;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.caja.findMany({
                                where: { activa: true },
                                include: {
                                    responsable: {
                                        select: { id: true, nombres: true, apellidos: true },
                                    },
                                    ruta: {
                                        select: { id: true, nombre: true, codigo: true },
                                    },
                                    _count: {
                                        select: { transacciones: true },
                                    },
                                },
                                orderBy: { creadoEn: 'desc' },
                            })];
                        case 1:
                            cajas = _a.sent();
                            ahora = new Date();
                            fechaInicio = new Date(ahora);
                            fechaInicio.setHours(0, 0, 0, 0);
                            fechaFin = new Date(ahora);
                            fechaFin.setHours(23, 59, 59, 999);
                            return [4 /*yield*/, Promise.all(cajas.map(function (caja) { return __awaiter(_this, void 0, void 0, function () {
                                    var saldoCalculado, ingresos, egresos, recaudoDelDia, gastosDelDia, asignaciones, clienteIds, pagosAgg;
                                    var _a;
                                    return __generator(this, function (_b) {
                                        switch (_b.label) {
                                            case 0:
                                                saldoCalculado = Number(caja.saldoActual);
                                                if (!(caja.tipo === 'RUTA' && caja.rutaId)) return [3 /*break*/, 6];
                                                return [4 /*yield*/, this.prisma.transaccion.aggregate({
                                                        where: {
                                                            cajaId: caja.id,
                                                            tipo: 'INGRESO',
                                                            fechaTransaccion: {
                                                                gte: fechaInicio,
                                                                lte: fechaFin,
                                                            },
                                                            NOT: {
                                                                OR: [
                                                                    { tipoReferencia: 'SOLICITUD_BASE' },
                                                                    { tipoReferencia: 'SOLICITUD_BASE_EFECTIVO' },
                                                                ],
                                                            },
                                                        },
                                                        _sum: {
                                                            monto: true,
                                                        },
                                                    })];
                                            case 1:
                                                ingresos = _b.sent();
                                                return [4 /*yield*/, this.prisma.transaccion.aggregate({
                                                        where: {
                                                            cajaId: caja.id,
                                                            tipo: 'EGRESO',
                                                            fechaTransaccion: {
                                                                gte: fechaInicio,
                                                                lte: fechaFin,
                                                            },
                                                        },
                                                        _sum: {
                                                            monto: true,
                                                        },
                                                    })];
                                            case 2:
                                                egresos = _b.sent();
                                                recaudoDelDia = Number(ingresos._sum.monto || 0);
                                                gastosDelDia = Number(egresos._sum.monto || 0);
                                                if (!(recaudoDelDia === 0)) return [3 /*break*/, 5];
                                                return [4 /*yield*/, this.prisma.asignacionRuta.findMany({
                                                        where: { rutaId: caja.rutaId, activa: true },
                                                        select: { clienteId: true },
                                                    })];
                                            case 3:
                                                asignaciones = _b.sent();
                                                if (!(asignaciones.length > 0)) return [3 /*break*/, 5];
                                                clienteIds = asignaciones.map(function (a) { return a.clienteId; });
                                                return [4 /*yield*/, this.prisma.pago.aggregate({
                                                        where: {
                                                            clienteId: { in: clienteIds },
                                                            fechaPago: {
                                                                gte: fechaInicio,
                                                                lte: fechaFin,
                                                            },
                                                        },
                                                        _sum: { montoTotal: true },
                                                    })];
                                            case 4:
                                                pagosAgg = _b.sent();
                                                recaudoDelDia = Number(pagosAgg._sum.montoTotal || 0);
                                                _b.label = 5;
                                            case 5:
                                                saldoCalculado = recaudoDelDia - gastosDelDia;
                                                _b.label = 6;
                                            case 6: return [2 /*return*/, {
                                                    id: caja.id,
                                                    codigo: caja.codigo,
                                                    nombre: caja.nombre,
                                                    tipo: caja.tipo,
                                                    rutaId: caja.rutaId,
                                                    rutaNombre: ((_a = caja.ruta) === null || _a === void 0 ? void 0 : _a.nombre) || null,
                                                    responsable: caja.responsable
                                                        ? "".concat(caja.responsable.nombres, " ").concat(caja.responsable.apellidos)
                                                        : 'Sin asignar',
                                                    responsableId: caja.responsableId,
                                                    saldo: saldoCalculado,
                                                    saldoMinimo: Number(caja.saldoMinimo),
                                                    saldoMaximo: Number(caja.saldoMaximo),
                                                    estado: caja.activa ? 'ABIERTA' : 'CERRADA',
                                                    transacciones: caja._count.transacciones,
                                                    ultimaActualizacion: caja.actualizadoEn.toISOString(),
                                                }];
                                        }
                                    });
                                }); }))];
                        case 2:
                            cajasConSaldo = _a.sent();
                            return [2 /*return*/, cajasConSaldo];
                    }
                });
            });
        };
        AccountingService_1.prototype.getCajaById = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var caja;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.prisma.caja.findUnique({
                                where: { id: id },
                                include: {
                                    responsable: {
                                        select: { id: true, nombres: true, apellidos: true },
                                    },
                                    ruta: true,
                                    transacciones: {
                                        take: 20,
                                        orderBy: { fechaTransaccion: 'desc' },
                                        include: {
                                            creadoPor: { select: { nombres: true, apellidos: true } },
                                        },
                                    },
                                },
                            })];
                        case 1:
                            caja = _b.sent();
                            if (!caja) {
                                throw new common_1.NotFoundException('Caja no encontrada');
                            }
                            return [2 /*return*/, {
                                    id: caja.id,
                                    codigo: caja.codigo,
                                    nombre: caja.nombre,
                                    tipo: caja.tipo,
                                    rutaId: caja.rutaId,
                                    rutaNombre: ((_a = caja.ruta) === null || _a === void 0 ? void 0 : _a.nombre) || null,
                                    responsable: caja.responsable
                                        ? "".concat(caja.responsable.nombres, " ").concat(caja.responsable.apellidos)
                                        : 'Sin asignar',
                                    responsableId: caja.responsableId,
                                    saldo: Number(caja.saldoActual) || 0,
                                    saldoMinimo: Number(caja.saldoMinimo) || 0,
                                    saldoMaximo: Number(caja.saldoMaximo) || 0,
                                    estado: caja.activa ? 'ABIERTA' : 'CERRADA',
                                    ultimaActualizacion: caja.actualizadoEn.toISOString(),
                                    transacciones: caja.transacciones,
                                }];
                    }
                });
            });
        };
        // =====================
        // GASTOS (SOLICITUD)
        // =====================
        AccountingService_1.prototype.registrarGasto = function (data) {
            return __awaiter(this, void 0, void 0, function () {
                var cajaRuta, aprobacion, solicitante, nombreSolicitante, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.prisma.caja.findFirst({
                                where: {
                                    rutaId: data.rutaId,
                                    tipo: 'RUTA',
                                    activa: true,
                                },
                            })];
                        case 1:
                            cajaRuta = _b.sent();
                            if (!cajaRuta) {
                                throw new common_1.NotFoundException('Caja de ruta no encontrada para registrar el gasto');
                            }
                            return [4 /*yield*/, this.prisma.aprobacion.create({
                                    data: {
                                        tipoAprobacion: data.tipoAprobacion,
                                        referenciaId: cajaRuta.id,
                                        tablaReferencia: 'Gasto',
                                        solicitadoPorId: data.solicitadoPorId,
                                        estado: client_1.EstadoAprobacion.PENDIENTE,
                                        datosSolicitud: {
                                            rutaId: data.rutaId,
                                            cobradorId: data.cobradorId,
                                            cajaId: cajaRuta.id,
                                            tipoGasto: 'OPERATIVO',
                                            monto: data.monto,
                                            descripcion: data.descripcion,
                                        },
                                        montoSolicitud: data.monto,
                                    },
                                })];
                        case 2:
                            aprobacion = _b.sent();
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: { id: data.solicitadoPorId },
                                    select: { nombres: true, apellidos: true },
                                })];
                        case 3:
                            solicitante = _b.sent();
                            nombreSolicitante = solicitante
                                ? "".concat(solicitante.nombres, " ").concat(solicitante.apellidos).trim()
                                : 'Cobrador';
                            return [4 /*yield*/, this.notificacionesService.notifyApprovers({
                                    titulo: 'Nuevo Gasto Requiere Aprobación',
                                    mensaje: "".concat(nombreSolicitante, " ha registrado un gasto por ").concat(Number(data.monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP' }), "."),
                                    tipo: 'GASTO',
                                    entidad: 'Aprobacion',
                                    entidadId: aprobacion.id,
                                    metadata: {
                                        tipoAprobacion: 'GASTO',
                                        rutaId: data.rutaId,
                                        cajaId: cajaRuta.id,
                                        cobradorId: data.cobradorId,
                                        monto: data.monto,
                                        descripcion: data.descripcion,
                                        solicitadoPor: nombreSolicitante,
                                    },
                                })];
                        case 4:
                            _b.sent();
                            _b.label = 5;
                        case 5:
                            _b.trys.push([5, 7, , 8]);
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: data.solicitadoPorId,
                                    titulo: 'Solicitud enviada',
                                    mensaje: 'Tu solicitud fue enviada con éxito y quedó pendiente de aprobación.',
                                    tipo: 'INFORMATIVO',
                                    entidad: 'Aprobacion',
                                    entidadId: aprobacion.id,
                                    metadata: {
                                        tipoAprobacion: data.tipoAprobacion,
                                        rutaId: data.rutaId,
                                        cajaId: cajaRuta.id,
                                    },
                                })];
                        case 6:
                            _b.sent();
                            return [3 /*break*/, 8];
                        case 7:
                            _a = _b.sent();
                            return [3 /*break*/, 8];
                        case 8:
                            this.notificacionesGateway.broadcastDashboardsActualizados({
                                origen: 'GASTO',
                                rutaId: data.rutaId,
                            });
                            return [2 /*return*/, {
                                    success: true,
                                    message: 'Gasto registrado y enviado para aprobación del coordinador',
                                    approvalId: aprobacion.id,
                                }];
                    }
                });
            });
        };
        AccountingService_1.prototype.solicitarBase = function (data) {
            return __awaiter(this, void 0, void 0, function () {
                var cajaRuta, aprobacion, solicitanteBase, nombreSolicitanteBase, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.prisma.caja.findFirst({
                                where: {
                                    rutaId: data.rutaId,
                                    tipo: 'RUTA',
                                    activa: true,
                                },
                            })];
                        case 1:
                            cajaRuta = _b.sent();
                            if (!cajaRuta) {
                                throw new common_1.NotFoundException('Caja de ruta no encontrada para registrar la base');
                            }
                            return [4 /*yield*/, this.prisma.aprobacion.create({
                                    data: {
                                        tipoAprobacion: client_1.TipoAprobacion.SOLICITUD_BASE_EFECTIVO,
                                        referenciaId: cajaRuta.id,
                                        tablaReferencia: 'Caja',
                                        solicitadoPorId: data.solicitadoPorId,
                                        estado: client_1.EstadoAprobacion.PENDIENTE,
                                        datosSolicitud: {
                                            rutaId: data.rutaId,
                                            cobradorId: data.cobradorId,
                                            cajaId: cajaRuta.id,
                                            monto: data.monto,
                                            descripcion: data.descripcion,
                                        },
                                        montoSolicitud: data.monto,
                                    },
                                })];
                        case 2:
                            aprobacion = _b.sent();
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: { id: data.solicitadoPorId },
                                    select: { nombres: true, apellidos: true },
                                })];
                        case 3:
                            solicitanteBase = _b.sent();
                            nombreSolicitanteBase = solicitanteBase
                                ? "".concat(solicitanteBase.nombres, " ").concat(solicitanteBase.apellidos).trim()
                                : 'Cobrador';
                            return [4 /*yield*/, this.notificacionesService.notifyApprovers({
                                    titulo: 'Nueva Solicitud de Base de Efectivo',
                                    mensaje: "".concat(nombreSolicitanteBase, " ha solicitado una base de efectivo por ").concat(Number(data.monto).toLocaleString('es-CO', {
                                        style: 'currency',
                                        currency: 'COP',
                                    }), "."),
                                    tipo: 'SOLICITUD_DINERO',
                                    entidad: 'Aprobacion',
                                    entidadId: aprobacion.id,
                                    metadata: {
                                        tipoAprobacion: 'SOLICITUD_BASE_EFECTIVO',
                                        rutaId: data.rutaId,
                                        cajaId: cajaRuta.id,
                                        cobradorId: data.cobradorId,
                                        monto: data.monto,
                                        descripcion: data.descripcion,
                                        solicitadoPor: nombreSolicitanteBase,
                                    },
                                })];
                        case 4:
                            _b.sent();
                            _b.label = 5;
                        case 5:
                            _b.trys.push([5, 7, , 8]);
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: data.solicitadoPorId,
                                    titulo: 'Solicitud enviada',
                                    mensaje: 'Tu solicitud fue enviada con éxito y quedó pendiente de aprobación.',
                                    tipo: 'INFORMATIVO',
                                    entidad: 'Aprobacion',
                                    entidadId: aprobacion.id,
                                    metadata: {
                                        tipoAprobacion: 'SOLICITUD_BASE_EFECTIVO',
                                        rutaId: data.rutaId,
                                        cajaId: cajaRuta.id,
                                    },
                                })];
                        case 6:
                            _b.sent();
                            return [3 /*break*/, 8];
                        case 7:
                            _a = _b.sent();
                            return [3 /*break*/, 8];
                        case 8:
                            this.notificacionesGateway.broadcastDashboardsActualizados({
                                origen: 'BASE',
                                rutaId: data.rutaId,
                            });
                            return [2 /*return*/, {
                                    success: true,
                                    message: 'Solicitud de base registrada y enviada para aprobación',
                                    approvalId: aprobacion.id,
                                }];
                    }
                });
            });
        };
        AccountingService_1.prototype.createCaja = function (data, userId) {
            return __awaiter(this, void 0, void 0, function () {
                var currentUser, rolesPermitidos, responsable, rutaIdSanitizado_1, ruta, lastCaja, nextNum, lastNum, codigo_1, error_1;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 7, , 8]);
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: { id: userId },
                                    select: { id: true, rol: true },
                                })];
                        case 1:
                            currentUser = _a.sent();
                            if (!currentUser) {
                                throw new common_1.UnauthorizedException('Usuario no válido para realizar esta acción');
                            }
                            // Regla: Solo Admin, SuperAdmin, Contador y Coordinador pueden crear Cajas Principales
                            if (data.tipo === 'PRINCIPAL') {
                                rolesPermitidos = [
                                    'ADMIN',
                                    'SUPER_ADMINISTRADOR',
                                    'CONTADOR',
                                    'COORDINADOR',
                                ];
                                if (!rolesPermitidos.includes(currentUser.rol)) {
                                    throw new common_1.ForbiddenException('No tienes permisos para crear una Caja Principal');
                                }
                            }
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: { id: data.responsableId },
                                })];
                        case 2:
                            responsable = _a.sent();
                            if (!responsable) {
                                throw new common_1.BadRequestException('El responsable asignado no es un usuario válido');
                            }
                            rutaIdSanitizado_1 = data.rutaId ? data.rutaId : undefined;
                            if (!(data.tipo === 'RUTA' && rutaIdSanitizado_1)) return [3 /*break*/, 4];
                            return [4 /*yield*/, this.prisma.ruta.findUnique({
                                    where: { id: rutaIdSanitizado_1 },
                                })];
                        case 3:
                            ruta = _a.sent();
                            if (!ruta) {
                                throw new common_1.BadRequestException('La ruta especificada no existe');
                            }
                            _a.label = 4;
                        case 4: return [4 /*yield*/, this.prisma.caja.findFirst({
                                orderBy: { creadoEn: 'desc' },
                            })];
                        case 5:
                            lastCaja = _a.sent();
                            nextNum = 1;
                            if (lastCaja && lastCaja.codigo.startsWith('CAJA-')) {
                                lastNum = parseInt(lastCaja.codigo.split('-')[1]);
                                if (!isNaN(lastNum)) {
                                    nextNum = lastNum + 1;
                                }
                            }
                            codigo_1 = "CAJA-".concat(nextNum.toString().padStart(4, '0'));
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    var nuevaCaja, count, numeroTransaccion;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, tx.caja.create({
                                                    data: {
                                                        codigo: codigo_1,
                                                        nombre: data.nombre,
                                                        tipo: data.tipo,
                                                        rutaId: rutaIdSanitizado_1,
                                                        responsableId: data.responsableId,
                                                        saldoActual: data.saldoInicial || 0,
                                                    },
                                                    include: {
                                                        responsable: { select: { nombres: true, apellidos: true } },
                                                    },
                                                })];
                                            case 1:
                                                nuevaCaja = _a.sent();
                                                if (!(data.saldoInicial && data.saldoInicial > 0)) return [3 /*break*/, 4];
                                                return [4 /*yield*/, tx.transaccion.count()];
                                            case 2:
                                                count = _a.sent();
                                                numeroTransaccion = "TRX-".concat(Date.now().toString().slice(-8), "-").concat((count + 1).toString().padStart(4, '0'));
                                                return [4 /*yield*/, tx.transaccion.create({
                                                        data: {
                                                            numeroTransaccion: numeroTransaccion,
                                                            cajaId: nuevaCaja.id,
                                                            tipo: client_1.TipoTransaccion.INGRESO,
                                                            monto: data.saldoInicial,
                                                            descripcion: 'Saldo Inicial de Apertura de Caja',
                                                            creadoPorId: userId, // El usuario que crea la caja es quien registra el saldo inicial
                                                            tipoReferencia: 'APERTURA_CAJA',
                                                            referenciaId: nuevaCaja.codigo,
                                                        },
                                                    })];
                                            case 3:
                                                _a.sent();
                                                _a.label = 4;
                                            case 4: return [2 /*return*/, nuevaCaja];
                                        }
                                    });
                                }); })];
                        case 6: return [2 /*return*/, _a.sent()];
                        case 7:
                            error_1 = _a.sent();
                            this.logger.error("Error creando caja: ".concat(error_1.message), error_1.stack);
                            if (error_1 instanceof common_1.BadRequestException ||
                                error_1 instanceof common_1.ForbiddenException ||
                                error_1 instanceof common_1.UnauthorizedException) {
                                throw error_1;
                            }
                            // Si es un error de base de datos específico (ej: input syntax for uuid), devolvemos BadRequest
                            if (error_1.code === 'P2023' || error_1.message.includes('uuid')) {
                                throw new common_1.BadRequestException('Formato de ID inválido (UUID requerido). Verifique responsableId o rutaId.');
                            }
                            throw new common_1.BadRequestException("No se pudo crear la caja: ".concat(error_1.message || 'Error desconocido'));
                        case 8: return [2 /*return*/];
                    }
                });
            });
        };
        AccountingService_1.prototype.updateCaja = function (id, data) {
            return __awaiter(this, void 0, void 0, function () {
                var caja;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.caja.findUnique({ where: { id: id } })];
                        case 1:
                            caja = _a.sent();
                            if (!caja)
                                throw new common_1.NotFoundException('Caja no encontrada');
                            // Las cajas por defecto NO pueden desactivarse ni renombrarse, solo cambiar responsable
                            if (AccountingService.CODIGOS_DEFAULT.includes(caja.codigo)) {
                                if (data.activa === false) {
                                    throw new common_1.ForbiddenException("La caja \"".concat(caja.nombre, "\" es una caja del sistema y no puede desactivarse."));
                                }
                                if (data.nombre && data.nombre !== caja.nombre) {
                                    throw new common_1.ForbiddenException("El nombre de la caja \"".concat(caja.nombre, "\" no puede modificarse."));
                                }
                                // Solo se permite actualizar responsableId y saldoActual
                                return [2 /*return*/, this.prisma.caja.update({
                                        where: { id: id },
                                        data: {
                                            responsableId: data.responsableId,
                                            saldoActual: data.saldoActual,
                                        },
                                    })];
                            }
                            return [2 /*return*/, this.prisma.caja.update({
                                    where: { id: id },
                                    data: data,
                                })];
                    }
                });
            });
        };
        AccountingService_1.prototype.deleteCaja = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var caja, txRecientes;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.caja.findUnique({ where: { id: id } })];
                        case 1:
                            caja = _a.sent();
                            if (!caja)
                                throw new common_1.NotFoundException('Caja no encontrada');
                            if (AccountingService.CODIGOS_DEFAULT.includes(caja.codigo)) {
                                throw new common_1.ForbiddenException("La caja \"".concat(caja.nombre, "\" es una caja del sistema y no puede eliminarse. Solo puede reasignarse su responsable."));
                            }
                            return [4 /*yield*/, this.prisma.transaccion.count({
                                    where: {
                                        cajaId: id,
                                        fechaTransaccion: { gte: new Date(Date.now() - 86400000) },
                                    },
                                })];
                        case 2:
                            txRecientes = _a.sent();
                            if (txRecientes > 0) {
                                throw new common_1.BadRequestException("La caja tiene ".concat(txRecientes, " transacciones en las ultimas 24 horas. Espere antes de eliminarla o desactivela primero."));
                            }
                            // Desactivar en lugar de borrar fisicamente para conservar historial
                            return [2 /*return*/, this.prisma.caja.update({
                                    where: { id: id },
                                    data: { activa: false },
                                })];
                    }
                });
            });
        };
        // =====================
        // TRANSACCIONES / MOVIMIENTOS
        // =====================
        AccountingService_1.prototype.getTransacciones = function (filtros) {
            return __awaiter(this, void 0, void 0, function () {
                var cajaId, tipo, fechaInicio, fechaFin, _a, page, _b, limit, skip, where, start, end, _c, transacciones, total, error_2;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            _d.trys.push([0, 2, , 3]);
                            cajaId = filtros.cajaId, tipo = filtros.tipo, fechaInicio = filtros.fechaInicio, fechaFin = filtros.fechaFin, _a = filtros.page, page = _a === void 0 ? 1 : _a, _b = filtros.limit, limit = _b === void 0 ? 50 : _b;
                            skip = (page - 1) * limit;
                            where = {};
                            // Se eliminó el filtro que excluía consolidaciones para mostrarlas en movimientos recientes
                            if (cajaId) {
                                where.cajaId = cajaId;
                                if (tipo)
                                    where.tipo = tipo;
                            }
                            else {
                                // Movimientos recientes (global): mostrar solo movimientos entre cajas.
                                // Además, ocultar la "doble partida" de transferencias mostrando solo el lado TRX-IN.
                                where.tipo = client_1.TipoTransaccion.TRANSFERENCIA;
                                where.numeroTransaccion = { startsWith: 'TRX-IN' };
                            }
                            if (fechaInicio || fechaFin) {
                                where.fechaTransaccion = {};
                                if (fechaInicio) {
                                    start = new Date(fechaInicio.includes('T') ? fechaInicio : "".concat(fechaInicio, "T00:00:00"));
                                    start.setHours(0, 0, 0, 0);
                                    where.fechaTransaccion.gte = start;
                                }
                                if (fechaFin) {
                                    end = new Date(fechaFin.includes('T') ? fechaFin : "".concat(fechaFin, "T23:59:59.999"));
                                    end.setHours(23, 59, 59, 999);
                                    where.fechaTransaccion.lte = end;
                                }
                            }
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.transaccion.findMany({
                                        where: where,
                                        skip: skip,
                                        take: limit,
                                        include: {
                                            caja: {
                                                select: {
                                                    nombre: true,
                                                    codigo: true,
                                                    tipo: true,
                                                    rutaId: true,
                                                    saldoActual: true,
                                                },
                                            },
                                            creadoPor: { select: { nombres: true, apellidos: true } },
                                        },
                                        orderBy: { fechaTransaccion: 'desc' },
                                    }),
                                    this.prisma.transaccion.count({ where: where }),
                                ])];
                        case 1:
                            _c = _d.sent(), transacciones = _c[0], total = _c[1];
                            return [2 /*return*/, {
                                    data: transacciones.map(function (t) { return ({
                                        id: t.id,
                                        numero: t.numeroTransaccion,
                                        fecha: t.fechaTransaccion.toISOString(),
                                        tipo: t.tipo,
                                        monto: Number(t.monto),
                                        descripcion: t.descripcion,
                                        caja: t.caja.nombre,
                                        cajaId: t.cajaId,
                                        responsable: "".concat(t.creadoPor.nombres, " ").concat(t.creadoPor.apellidos),
                                        estado: 'APROBADO', // Todas las trx en DB están aprobadas
                                        origen: t.caja.tipo === 'RUTA' ? 'COBRADOR' : 'EMPRESA',
                                        categoria: t.tipoReferencia || 'GENERAL',
                                        rutaId: t.caja.rutaId,
                                        cajaSaldo: Number(t.caja.saldoActual),
                                    }); }),
                                    meta: {
                                        total: total,
                                        page: page,
                                        limit: limit,
                                        totalPages: Math.ceil(total / limit),
                                    },
                                }];
                        case 2:
                            error_2 = _d.sent();
                            this.logger.error("Error fetching transacciones: ".concat(error_2.message), error_2.stack);
                            throw error_2;
                        case 3: return [2 /*return*/];
                    }
                });
            });
        };
        /**
         * Obtener saldo disponible de una ruta (recaudo del día - gastos)
         */
        AccountingService_1.prototype.getSaldoDisponibleRuta = function (rutaId, fecha, fechaInicio, fechaFin) {
            return __awaiter(this, void 0, void 0, function () {
                var rangeStart, rangeEnd, baseDate, caja, transacciones, cobranzaTrx, baseEfectivo, gastosOperativos, desembolsos, otrosIngresos, otrosEgresos, cobranzaPagos, asignaciones, clienteIds, pagosAgg, totalCobranza, totalRecaudo, totalGastos, saldoNetoPeriodo;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (fechaInicio && fechaFin) {
                                // Usar los rangos proporcionados, asegurando que cubran todo el día
                                // Agregamos la hora para que el constructor de Date lo trate como hora local del servidor
                                rangeStart = new Date(fechaInicio.includes('T') ? fechaInicio : "".concat(fechaInicio, "T00:00:00"));
                                rangeEnd = new Date(fechaFin.includes('T') ? fechaFin : "".concat(fechaFin, "T23:59:59.999"));
                            }
                            else {
                                baseDate = fecha ? new Date(fecha.includes('T') ? fecha : "".concat(fecha, "T00:00:00")) : new Date();
                                rangeStart = new Date(baseDate);
                                rangeStart.setHours(0, 0, 0, 0);
                                rangeEnd = new Date(baseDate);
                                rangeEnd.setHours(23, 59, 59, 999);
                            }
                            return [4 /*yield*/, this.prisma.caja.findFirst({
                                    where: {
                                        rutaId: rutaId,
                                        tipo: 'RUTA',
                                        activa: true,
                                    },
                                })];
                        case 1:
                            caja = _a.sent();
                            if (!caja) {
                                // Retornar ceros si no hay caja, para evitar errores en el dashboard
                                return [2 /*return*/, {
                                        rutaId: rutaId,
                                        recaudoDelDia: 0,
                                        cobranzaDelDia: 0,
                                        gastosDelDia: 0,
                                        baseEfectivo: 0,
                                        desembolsos: 0,
                                        saldoDisponible: 0,
                                        fechaInicio: rangeStart.toISOString(),
                                        fechaFin: rangeEnd.toISOString(),
                                    }];
                            }
                            return [4 /*yield*/, this.prisma.transaccion.findMany({
                                    where: {
                                        cajaId: caja.id,
                                        fechaTransaccion: {
                                            gte: rangeStart,
                                            lte: rangeEnd,
                                        },
                                    },
                                })];
                        case 2:
                            transacciones = _a.sent();
                            cobranzaTrx = 0;
                            baseEfectivo = 0;
                            gastosOperativos = 0;
                            desembolsos = 0;
                            otrosIngresos = 0;
                            otrosEgresos = 0;
                            transacciones.forEach(function (t) {
                                var monto = Number(t.monto);
                                if (t.tipo === 'INGRESO') {
                                    if (t.tipoReferencia === 'PAGO') {
                                        cobranzaTrx += monto;
                                    }
                                    else if (t.tipoReferencia === 'SOLICITUD_BASE_EFECTIVO' ||
                                        t.tipoReferencia === 'SOLICITUD_BASE' ||
                                        t.tipoReferencia === 'APERTURA_CAJA' ||
                                        t.descripcion.toLowerCase().includes('apertura de caja') ||
                                        t.descripcion.toLowerCase().includes('base de efectivo')) {
                                        baseEfectivo += monto;
                                    }
                                    else {
                                        otrosIngresos += monto;
                                    }
                                }
                                else if (t.tipo === 'EGRESO') {
                                    if (t.tipoReferencia === 'GASTO') {
                                        gastosOperativos += monto;
                                    }
                                    else if (t.tipoReferencia === 'PRESTAMO' ||
                                        t.descripcion.toLowerCase().includes('desembolso') ||
                                        t.descripcion.toLowerCase().includes('préstamo')) {
                                        desembolsos += monto;
                                    }
                                    else {
                                        otrosEgresos += monto;
                                    }
                                }
                            });
                            cobranzaPagos = 0;
                            if (!(cobranzaTrx === 0)) return [3 /*break*/, 5];
                            return [4 /*yield*/, this.prisma.asignacionRuta.findMany({
                                    where: { rutaId: rutaId, activa: true },
                                    select: { clienteId: true },
                                })];
                        case 3:
                            asignaciones = _a.sent();
                            clienteIds = asignaciones.map(function (a) { return a.clienteId; });
                            return [4 /*yield*/, this.prisma.pago.aggregate({
                                    where: {
                                        clienteId: { in: clienteIds },
                                        fechaPago: {
                                            gte: rangeStart,
                                            lte: rangeEnd,
                                        },
                                    },
                                    _sum: { montoTotal: true },
                                })];
                        case 4:
                            pagosAgg = _a.sent();
                            cobranzaPagos = Number(pagosAgg._sum.montoTotal || 0);
                            _a.label = 5;
                        case 5:
                            totalCobranza = cobranzaTrx > 0 ? cobranzaTrx : cobranzaPagos;
                            totalRecaudo = totalCobranza + otrosIngresos;
                            totalGastos = gastosOperativos + otrosEgresos;
                            saldoNetoPeriodo = totalRecaudo - totalGastos - desembolsos;
                            return [2 /*return*/, {
                                    rutaId: rutaId,
                                    cajaId: caja.id,
                                    fecha: rangeStart.toISOString(),
                                    saldoDisponible: Number(caja.saldoActual), // Saldo real en libros actual
                                    recaudoDelDia: totalRecaudo,
                                    cobranzaDelDia: totalCobranza,
                                    gastosDelDia: totalGastos,
                                    baseEfectivo: baseEfectivo,
                                    desembolsos: desembolsos,
                                    netoPeriodo: saldoNetoPeriodo,
                                    fechaInicio: rangeStart.toISOString(),
                                    fechaFin: rangeEnd.toISOString(),
                                    saldoCaja: Number(caja.saldoActual),
                                }];
                    }
                });
            });
        };
        AccountingService_1.prototype.createTransaccion = function (data) {
            return __awaiter(this, void 0, void 0, function () {
                var count, numeroTransaccion, caja, saldoInfo, cajaOrigen_1, numeroReferencia_1, cajaOrigenId_1, nuevoSaldo, transaccion, error_3;
                var _this = this;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.prisma.transaccion.count()];
                        case 1:
                            count = _b.sent();
                            numeroTransaccion = "TRX-".concat(Date.now().toString().slice(-8), "-").concat((count + 1).toString().padStart(4, '0'));
                            return [4 /*yield*/, this.prisma.caja.findUnique({
                                    where: { id: data.cajaId },
                                    include: { ruta: true },
                                })];
                        case 2:
                            caja = _b.sent();
                            if (!caja)
                                throw new common_1.NotFoundException('Caja no encontrada');
                            if (!(data.tipo === 'EGRESO' && caja.tipo === 'RUTA' && caja.rutaId)) return [3 /*break*/, 4];
                            return [4 /*yield*/, this.getSaldoDisponibleRuta(caja.rutaId)];
                        case 3:
                            saldoInfo = _b.sent();
                            if (data.monto > saldoInfo.saldoDisponible) {
                                throw new common_1.BadRequestException("Saldo insuficiente. Disponible: $".concat(saldoInfo.saldoDisponible.toLocaleString(), ", Recaudo del d\u00EDa: $").concat(saldoInfo.recaudoDelDia.toLocaleString(), ", Gastos del d\u00EDa: $").concat(saldoInfo.gastosDelDia.toLocaleString()));
                            }
                            _b.label = 4;
                        case 4:
                            if (!data.cajaOrigenId) return [3 /*break*/, 6];
                            return [4 /*yield*/, this.prisma.caja.findUnique({
                                    where: { id: data.cajaOrigenId },
                                })];
                        case 5:
                            cajaOrigen_1 = _b.sent();
                            if (!cajaOrigen_1)
                                throw new common_1.NotFoundException('Caja origen no encontrada');
                            numeroReferencia_1 = "CONS-".concat(Date.now().toString().slice(-6));
                            cajaOrigenId_1 = data.cajaOrigenId;
                            return [2 /*return*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    var transaccion;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: 
                                            // 1. Salida de la caja origen
                                            return [4 /*yield*/, tx.transaccion.create({
                                                    data: {
                                                        numeroTransaccion: "TRX-OUT-".concat(Date.now(), "-").concat(Math.floor(Math.random() * 1000)),
                                                        cajaId: cajaOrigenId_1,
                                                        tipo: client_1.TipoTransaccion.TRANSFERENCIA,
                                                        monto: data.monto,
                                                        descripcion: "Transferencia enviada a ".concat(caja.nombre),
                                                        creadoPorId: data.creadoPorId,
                                                        tipoReferencia: 'TRANSFERENCIA_INTERNA',
                                                        referenciaId: numeroReferencia_1,
                                                    },
                                                })];
                                            case 1:
                                                // 1. Salida de la caja origen
                                                _a.sent();
                                                return [4 /*yield*/, tx.transaccion.create({
                                                        data: {
                                                            numeroTransaccion: "TRX-IN-".concat(Date.now(), "-").concat(Math.floor(Math.random() * 1000)),
                                                            cajaId: data.cajaId,
                                                            tipo: client_1.TipoTransaccion.TRANSFERENCIA,
                                                            monto: data.monto,
                                                            descripcion: "Transferencia recibida de ".concat(cajaOrigen_1.nombre),
                                                            creadoPorId: data.creadoPorId,
                                                            tipoReferencia: 'TRANSFERENCIA_INTERNA',
                                                            referenciaId: numeroReferencia_1,
                                                        },
                                                    })];
                                            case 2:
                                                transaccion = _a.sent();
                                                // 3. Actualizar Saldos
                                                return [4 /*yield*/, tx.caja.update({
                                                        where: { id: data.cajaOrigenId },
                                                        data: { saldoActual: { decrement: data.monto } },
                                                    })];
                                            case 3:
                                                // 3. Actualizar Saldos
                                                _a.sent();
                                                return [4 /*yield*/, tx.caja.update({
                                                        where: { id: data.cajaId },
                                                        data: { saldoActual: { increment: data.monto } },
                                                    })];
                                            case 4:
                                                _a.sent();
                                                return [2 /*return*/, transaccion];
                                        }
                                    });
                                }); })];
                        case 6:
                            nuevoSaldo = data.tipo === 'INGRESO'
                                ? Number(caja.saldoActual) + data.monto
                                : Number(caja.saldoActual) - data.monto;
                            return [4 /*yield*/, this.prisma.$transaction([
                                    this.prisma.transaccion.create({
                                        data: {
                                            numeroTransaccion: numeroTransaccion,
                                            cajaId: data.cajaId,
                                            tipo: data.tipo,
                                            monto: data.monto,
                                            descripcion: data.descripcion,
                                            creadoPorId: data.creadoPorId,
                                            tipoReferencia: data.tipoReferencia,
                                            referenciaId: data.referenciaId,
                                        },
                                    }),
                                    this.prisma.caja.update({
                                        where: { id: data.cajaId },
                                        data: { saldoActual: nuevoSaldo },
                                    }),
                                ])];
                        case 7:
                            transaccion = (_b.sent())[0];
                            _b.label = 8;
                        case 8:
                            _b.trys.push([8, 11, , 12]);
                            if (!(data.tipo === 'EGRESO' && caja.tipo === 'RUTA')) return [3 /*break*/, 10];
                            return [4 /*yield*/, this.notificacionesService.notifyCoordinator({
                                    titulo: 'Gasto Registrado en Ruta',
                                    mensaje: "Se registr\u00F3 un gasto de ".concat(data.monto.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }), " en la ruta ").concat(((_a = caja.ruta) === null || _a === void 0 ? void 0 : _a.nombre) || 'Sin ruta', " (Caja: ").concat(caja.nombre, ")"),
                                    tipo: 'SISTEMA',
                                    entidad: 'TRANSACCION',
                                    entidadId: transaccion.id,
                                    metadata: {
                                        rutaId: caja.rutaId,
                                        cajaId: data.cajaId,
                                        tipoTransaccion: data.tipo,
                                        descripcion: data.descripcion,
                                    },
                                })];
                        case 9:
                            _b.sent();
                            _b.label = 10;
                        case 10: return [3 /*break*/, 12];
                        case 11:
                            error_3 = _b.sent();
                            this.logger.error('Error enviando notificación de gasto:', error_3);
                            return [3 /*break*/, 12];
                        case 12: return [2 /*return*/, transaccion];
                    }
                });
            });
        };
        AccountingService_1.prototype.consolidarCaja = function (cajaOrigenId, administradorId, montoRecolectar) {
            return __awaiter(this, void 0, void 0, function () {
                var cajaOrigen, saldoDisponible, montoATransferir, cajaDestino, _a, numeroRef, esTotal, rutaNombre, resultado, montoFmt, notifErr_1;
                var _this = this;
                var _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0: return [4 /*yield*/, this.prisma.caja.findUnique({
                                where: { id: cajaOrigenId },
                                include: { ruta: { select: { nombre: true, id: true } } },
                            })];
                        case 1:
                            cajaOrigen = _d.sent();
                            if (!cajaOrigen)
                                throw new common_1.NotFoundException('Caja origen no encontrada');
                            saldoDisponible = Number(cajaOrigen.saldoActual);
                            montoATransferir = montoRecolectar && montoRecolectar > 0 ? montoRecolectar : saldoDisponible;
                            if (montoATransferir <= 0) {
                                throw new common_1.BadRequestException('El monto a recolectar debe ser mayor a cero');
                            }
                            if (montoATransferir > saldoDisponible) {
                                throw new common_1.BadRequestException("El monto (".concat(montoATransferir, ") supera el saldo disponible (").concat(saldoDisponible, ")"));
                            }
                            return [4 /*yield*/, this.prisma.caja.findFirst({
                                    where: {
                                        OR: [
                                            { codigo: 'CAJA-OFICINA' },
                                            { tipo: client_1.TipoCaja.PRINCIPAL, activa: true, NOT: { codigo: 'CAJA-PRINCIPAL' } },
                                        ],
                                    },
                                    orderBy: { creadoEn: 'asc' },
                                })];
                        case 2:
                            if (!((_b = _d.sent()) !== null && _b !== void 0)) return [3 /*break*/, 3];
                            _a = _b;
                            return [3 /*break*/, 5];
                        case 3: return [4 /*yield*/, this.prisma.caja.findFirst({
                                where: { tipo: client_1.TipoCaja.PRINCIPAL, activa: true },
                                orderBy: { creadoEn: 'asc' },
                            })];
                        case 4:
                            _a = _d.sent();
                            _d.label = 5;
                        case 5:
                            cajaDestino = _a;
                            if (!cajaDestino)
                                throw new common_1.BadRequestException('No existe una Caja de Oficina activa');
                            if (cajaDestino.id === cajaOrigen.id)
                                throw new common_1.BadRequestException('No se puede recolectar desde la caja destino');
                            numeroRef = "RECOL-".concat(Date.now().toString().slice(-8));
                            esTotal = montoATransferir === saldoDisponible;
                            rutaNombre = ((_c = cajaOrigen.ruta) === null || _c === void 0 ? void 0 : _c.nombre) || cajaOrigen.nombre;
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    var egreso, ingreso;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, tx.transaccion.create({
                                                    data: {
                                                        numeroTransaccion: "TRX-OUT-".concat(Date.now(), "-").concat(Math.floor(Math.random() * 1000)),
                                                        cajaId: cajaOrigen.id,
                                                        tipo: client_1.TipoTransaccion.TRANSFERENCIA,
                                                        monto: montoATransferir,
                                                        descripcion: "Recoleccion ".concat(esTotal ? 'total' : 'parcial', " enviada a ").concat(cajaDestino.nombre),
                                                        creadoPorId: administradorId,
                                                        tipoReferencia: 'RECOLECCION',
                                                        referenciaId: numeroRef,
                                                    },
                                                })];
                                            case 1:
                                                egreso = _a.sent();
                                                return [4 /*yield*/, tx.transaccion.create({
                                                        data: {
                                                            numeroTransaccion: "TRX-IN-".concat(Date.now(), "-").concat(Math.floor(Math.random() * 1000)),
                                                            cajaId: cajaDestino.id,
                                                            tipo: client_1.TipoTransaccion.TRANSFERENCIA,
                                                            monto: montoATransferir,
                                                            descripcion: "Recoleccion recibida de ".concat(rutaNombre),
                                                            creadoPorId: administradorId,
                                                            tipoReferencia: 'RECOLECCION',
                                                            referenciaId: numeroRef,
                                                        },
                                                    })];
                                            case 2:
                                                ingreso = _a.sent();
                                                // Descontar de la caja origen
                                                return [4 /*yield*/, tx.caja.update({
                                                        where: { id: cajaOrigen.id },
                                                        data: { saldoActual: { decrement: montoATransferir } },
                                                    })];
                                            case 3:
                                                // Descontar de la caja origen
                                                _a.sent();
                                                // Acreditar en la caja de oficina
                                                return [4 /*yield*/, tx.caja.update({
                                                        where: { id: cajaDestino.id },
                                                        data: { saldoActual: { increment: montoATransferir } },
                                                    })];
                                            case 4:
                                                // Acreditar en la caja de oficina
                                                _a.sent();
                                                return [2 /*return*/, { egreso: egreso, ingreso: ingreso }];
                                        }
                                    });
                                }); })];
                        case 6:
                            resultado = _d.sent();
                            _d.label = 7;
                        case 7:
                            _d.trys.push([7, 9, , 10]);
                            montoFmt = montoATransferir.toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
                            return [4 /*yield*/, this.notificacionesService.notifyCoordinator({
                                    titulo: 'Recoleccion de Dinero Registrada',
                                    mensaje: "Se recolectaron ".concat(montoFmt, " de la ruta \"").concat(rutaNombre, "\" hacia ").concat(cajaDestino.nombre, ". Referencia: ").concat(numeroRef, "."),
                                    tipo: 'SISTEMA',
                                    entidad: 'Transaccion',
                                    entidadId: resultado.ingreso.id,
                                    metadata: {
                                        cajaOrigenId: cajaOrigen.id,
                                        cajaDestinoId: cajaDestino.id,
                                        monto: montoATransferir,
                                        numeroRef: numeroRef,
                                        administradorId: administradorId,
                                        esTotal: esTotal,
                                    },
                                })];
                        case 8:
                            _d.sent();
                            return [3 /*break*/, 10];
                        case 9:
                            notifErr_1 = _d.sent();
                            this.logger.warn('No se pudo enviar notificacion de recoleccion:', notifErr_1);
                            return [3 /*break*/, 10];
                        case 10:
                            // 5. Auditoria
                            this.logger.log("[RECOLECCION] ".concat(numeroRef, " | Admin: ").concat(administradorId, " | Origen: ").concat(cajaOrigen.nombre, " (").concat(cajaOrigenId, ") | Destino: ").concat(cajaDestino.nombre, " | Monto: ").concat(montoATransferir, " | Tipo: ").concat(esTotal ? 'TOTAL' : 'PARCIAL'));
                            return [2 /*return*/, {
                                    origen: cajaOrigen.nombre,
                                    destino: cajaDestino.nombre,
                                    monto: montoATransferir,
                                    numeroRef: numeroRef,
                                    transacciones: [resultado.egreso.id, resultado.ingreso.id],
                                }];
                    }
                });
            });
        };
        // =====================
        // RESUMEN FINANCIERO
        // =====================
        AccountingService_1.prototype.getResumenFinanciero = function (fechaInicio, fechaFin) {
            return __awaiter(this, void 0, void 0, function () {
                var rangeStart, rangeEnd, hoy, inicioHoy, finHoy, duration, inicioAnterior, finAnterior, whereHoy, whereAyer, _a, ingresosHoy, egresosHoy, ingresosAyer, egresosAyer, totalCajas, prestamosActivos, totalRutasCount, rutasAbiertasCount, rutasPendientesConsolidacion, consolidacionesHoy, ingresos, egresos, ingresosAyerVal, egresosAyerVal, calcularDiferencia, esUnSoloDia, usarComparacionAyer, porcentajeCierres;
                var _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            if (fechaInicio && fechaFin) {
                                rangeStart = new Date(fechaInicio.includes('T') ? fechaInicio : "".concat(fechaInicio, "T00:00:00"));
                                rangeEnd = new Date(fechaFin.includes('T') ? fechaFin : "".concat(fechaFin, "T23:59:59.999"));
                            }
                            else {
                                hoy = new Date();
                                rangeStart = new Date(hoy);
                                rangeStart.setHours(0, 0, 0, 0);
                                rangeEnd = new Date(hoy);
                                rangeEnd.setHours(23, 59, 59, 999);
                            }
                            inicioHoy = rangeStart;
                            finHoy = rangeEnd;
                            duration = finHoy.getTime() - inicioHoy.getTime();
                            inicioAnterior = new Date(inicioHoy.getTime() - duration - 1);
                            finAnterior = new Date(inicioHoy.getTime() - 1);
                            whereHoy = {
                                fechaTransaccion: { gte: inicioHoy, lte: finHoy },
                            };
                            whereAyer = {
                                fechaTransaccion: { gte: inicioAnterior, lte: finAnterior },
                            };
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.transaccion.aggregate({
                                        where: __assign(__assign({}, whereHoy), { OR: [
                                                { tipo: 'INGRESO' },
                                                {
                                                    tipo: 'TRANSFERENCIA',
                                                    numeroTransaccion: { startsWith: 'TRX-IN' },
                                                },
                                            ], NOT: {
                                                OR: [
                                                    { tipoReferencia: 'SOLICITUD_BASE' },
                                                    { tipoReferencia: 'SOLICITUD_BASE_EFECTIVO' },
                                                ],
                                            } }),
                                        _sum: { monto: true },
                                    }),
                                    this.prisma.transaccion.aggregate({
                                        where: __assign(__assign({}, whereHoy), { OR: [
                                                { tipo: 'EGRESO' },
                                                {
                                                    tipo: 'TRANSFERENCIA',
                                                    numeroTransaccion: { startsWith: 'TRX-OUT' },
                                                },
                                            ] }),
                                        _sum: { monto: true },
                                    }),
                                    this.prisma.transaccion.aggregate({
                                        where: __assign(__assign({}, whereAyer), { OR: [
                                                { tipo: 'INGRESO' },
                                                {
                                                    tipo: 'TRANSFERENCIA',
                                                    numeroTransaccion: { startsWith: 'TRX-IN' },
                                                },
                                            ], NOT: {
                                                OR: [
                                                    { tipoReferencia: 'SOLICITUD_BASE' },
                                                    { tipoReferencia: 'SOLICITUD_BASE_EFECTIVO' },
                                                ],
                                            } }),
                                        _sum: { monto: true },
                                    }),
                                    this.prisma.transaccion.aggregate({
                                        where: __assign(__assign({}, whereAyer), { OR: [
                                                { tipo: 'EGRESO' },
                                                {
                                                    tipo: 'TRANSFERENCIA',
                                                    numeroTransaccion: { startsWith: 'TRX-OUT' },
                                                },
                                            ] }),
                                        _sum: { monto: true },
                                    }),
                                    this.prisma.caja.aggregate({
                                        where: { activa: true },
                                        _sum: { saldoActual: true },
                                    }),
                                    this.prisma.prestamo.aggregate({
                                        where: { estado: { in: ['ACTIVO', 'EN_MORA'] } },
                                        _sum: { monto: true },
                                    }),
                                    this.prisma.caja.count({ where: { tipo: 'RUTA' } }),
                                    this.prisma.caja.count({ where: { tipo: 'RUTA', activa: true } }),
                                    this.prisma.caja.count({
                                        where: { tipo: 'RUTA', saldoActual: { gt: 0 } },
                                    }),
                                    this.prisma.transaccion.count({
                                        where: __assign(__assign({}, whereHoy), { tipoReferencia: 'CONSOLIDACION', tipo: 'TRANSFERENCIA', caja: { tipo: 'RUTA' } }),
                                    }),
                                ])];
                        case 1:
                            _a = _c.sent(), ingresosHoy = _a[0], egresosHoy = _a[1], ingresosAyer = _a[2], egresosAyer = _a[3], totalCajas = _a[4], prestamosActivos = _a[5], totalRutasCount = _a[6], rutasAbiertasCount = _a[7], rutasPendientesConsolidacion = _a[8], consolidacionesHoy = _a[9];
                            ingresos = Number(ingresosHoy._sum.monto || 0);
                            egresos = Number(egresosHoy._sum.monto || 0);
                            ingresosAyerVal = Number(ingresosAyer._sum.monto || 0);
                            egresosAyerVal = Number(egresosAyer._sum.monto || 0);
                            calcularDiferencia = function (actual, anterior) {
                                if (anterior === 0)
                                    return actual > 0 ? 100 : 0;
                                return Number((((actual - anterior) / anterior) * 100).toFixed(2));
                            };
                            esUnSoloDia = duration < 24 * 60 * 60 * 1000;
                            usarComparacionAyer = esUnSoloDia;
                            porcentajeCierres = totalRutasCount > 0
                                ? Math.round(((totalRutasCount - rutasAbiertasCount) / totalRutasCount) * 100)
                                : 0;
                            _b = {
                                ingresosHoy: ingresos,
                                egresosHoy: egresos,
                                gananciaNeta: ingresos - egresos,
                                capitalEnCalle: Number(prestamosActivos._sum.monto || 0),
                                saldoCajas: Number(totalCajas._sum.saldoActual || 0)
                            };
                            return [4 /*yield*/, this.prisma.caja.count({
                                    where: { activa: true },
                                })];
                        case 2: return [2 /*return*/, (_b.cajasAbiertasCount = _c.sent(),
                                _b.rutasTotales = totalRutasCount,
                                _b.rutasAbiertas = rutasAbiertasCount,
                                _b.rutasPendientesConsolidacion = rutasPendientesConsolidacion,
                                _b.consolidacionesHoy = consolidacionesHoy,
                                _b.porcentajeCierre = porcentajeCierres,
                                _b.fecha = inicioHoy.toISOString(),
                                _b.porcentajeIngresosVsAyer = usarComparacionAyer ? calcularDiferencia(ingresos, ingresosAyerVal) : null,
                                _b.porcentajeEgresosVsAyer = usarComparacionAyer ? calcularDiferencia(egresos, egresosAyerVal) : null,
                                _b.esIngresoPositivo = usarComparacionAyer ? ingresos >= ingresosAyerVal : true,
                                _b.esEgresoPositivo = usarComparacionAyer ? egresos <= egresosAyerVal : true,
                                _b)];
                    }
                });
            });
        };
        // =====================
        // CIERRES
        // =====================
        AccountingService_1.prototype.getHistorialCierres = function (filtros) {
            return __awaiter(this, void 0, void 0, function () {
                var where, or, tipo, transacciones, mapped;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            where = {};
                            or = [];
                            tipo = filtros === null || filtros === void 0 ? void 0 : filtros.tipo;
                            if (!tipo || tipo === undefined) {
                                or.push({ tipoReferencia: 'CONSOLIDACION', tipo: 'TRANSFERENCIA' });
                                or.push({ tipoReferencia: 'ARQUEO' });
                            }
                            else if (tipo === 'CONSOLIDACION') {
                                or.push({ tipoReferencia: 'CONSOLIDACION', tipo: 'TRANSFERENCIA' });
                            }
                            else if (tipo === 'ARQUEO') {
                                or.push({ tipoReferencia: 'ARQUEO' });
                            }
                            where.OR = or;
                            if (filtros === null || filtros === void 0 ? void 0 : filtros.cajaId)
                                where.cajaId = filtros.cajaId;
                            if ((filtros === null || filtros === void 0 ? void 0 : filtros.fechaInicio) || (filtros === null || filtros === void 0 ? void 0 : filtros.fechaFin)) {
                                where.fechaTransaccion = {};
                                if (filtros.fechaInicio)
                                    where.fechaTransaccion.gte = new Date(filtros.fechaInicio);
                                if (filtros.fechaFin)
                                    where.fechaTransaccion.lte = new Date(filtros.fechaFin);
                            }
                            return [4 /*yield*/, this.prisma.transaccion.findMany({
                                    where: where,
                                    include: {
                                        caja: { select: { nombre: true, tipo: true } },
                                        creadoPor: { select: { nombres: true, apellidos: true } },
                                    },
                                    orderBy: { fechaTransaccion: 'desc' },
                                    take: 200,
                                })];
                        case 1:
                            transacciones = _a.sent();
                            mapped = transacciones.map(function (t) {
                                if (t.tipoReferencia === 'ARQUEO') {
                                    // referenciaId formateado como "SS:<saldoSistema>|ER:<efectivoReal>|DF:<diferencia>"
                                    var saldoSistema = 0;
                                    var efectivoReal = 0;
                                    var diferencia = Number(t.monto);
                                    try {
                                        var parts = (t.referenciaId || '').split('|');
                                        for (var _i = 0, parts_1 = parts; _i < parts_1.length; _i++) {
                                            var p = parts_1[_i];
                                            var _a = p.split(':'), k = _a[0], v = _a[1];
                                            if (k === 'SS')
                                                saldoSistema = Number(v);
                                            if (k === 'ER')
                                                efectivoReal = Number(v);
                                            if (k === 'DF')
                                                diferencia = Number(v);
                                        }
                                    }
                                    catch (_) {
                                        void 0;
                                    }
                                    return {
                                        id: t.id,
                                        fecha: t.fechaTransaccion.toISOString(),
                                        caja: t.caja.nombre,
                                        responsable: "".concat(t.creadoPor.nombres, " ").concat(t.creadoPor.apellidos),
                                        saldoSistema: saldoSistema,
                                        saldoReal: efectivoReal,
                                        diferencia: diferencia,
                                        estado: diferencia === 0 ? 'CUADRADA' : 'DESCUADRADA',
                                        descripcion: t.descripcion,
                                        tipo: 'ARQUEO',
                                        referenciaId: t.referenciaId,
                                        cajaId: t.cajaId,
                                    };
                                }
                                return {
                                    id: t.id,
                                    fecha: t.fechaTransaccion.toISOString(),
                                    caja: t.caja.nombre,
                                    responsable: "".concat(t.creadoPor.nombres, " ").concat(t.creadoPor.apellidos),
                                    saldoSistema: Number(t.monto),
                                    saldoReal: Number(t.monto),
                                    diferencia: 0,
                                    estado: 'CUADRADA',
                                    cajaTipo: t.caja.tipo,
                                    descripcion: t.descripcion,
                                    tipo: 'CONSOLIDACION',
                                    referenciaId: t.referenciaId,
                                    cajaId: t.cajaId,
                                };
                            });
                            // Filtro opcional por estado (solo aplicable para ARQUEO)
                            if (filtros === null || filtros === void 0 ? void 0 : filtros.estado) {
                                if (filtros.estado === 'DESCUADRADA') {
                                    mapped = mapped.filter(function (m) { return m.estado === 'DESCUADRADA'; });
                                }
                                else if (filtros.estado === 'CUADRADA') {
                                    mapped = mapped.filter(function (m) { return m.estado === 'CUADRADA'; });
                                }
                            }
                            // Filtro opcional: solo cajas de rutas (cobradores)
                            if (filtros === null || filtros === void 0 ? void 0 : filtros.soloRutas) {
                                mapped = mapped.filter(function (m) { return m.cajaTipo === 'RUTA'; });
                            }
                            return [2 /*return*/, mapped];
                    }
                });
            });
        };
        AccountingService_1.prototype.registrarArqueo = function (cajaId, data, userId) {
            return __awaiter(this, void 0, void 0, function () {
                var caja, montoAjuste, referenciaId, descripcionBase, descripcion, tipoAjuste;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.caja.findUnique({ where: { id: cajaId } })];
                        case 1:
                            caja = _a.sent();
                            if (!caja)
                                throw new common_1.NotFoundException('Caja no encontrada');
                            montoAjuste = Math.abs(Number(data.diferencia || 0));
                            referenciaId = "SS:".concat(Number(data.saldoSistema), "|ER:").concat(Number(data.efectivoReal), "|DF:").concat(Number(data.diferencia));
                            descripcionBase = 'Arqueo de Caja';
                            descripcion = data.observaciones
                                ? "".concat(descripcionBase, ": ").concat(data.observaciones)
                                : descripcionBase;
                            // Si no hay diferencia, registramos evento neutro para historial (monto 0)
                            if (montoAjuste === 0) {
                                return [2 /*return*/, this.prisma.transaccion.create({
                                        data: {
                                            numeroTransaccion: "ARQ-".concat(Date.now(), "-").concat(Math.floor(Math.random() * 1000)),
                                            cajaId: cajaId,
                                            tipo: client_1.TipoTransaccion.TRANSFERENCIA,
                                            monto: 0,
                                            descripcion: descripcion,
                                            creadoPorId: userId,
                                            tipoReferencia: 'ARQUEO',
                                            referenciaId: referenciaId,
                                        },
                                    })];
                            }
                            tipoAjuste = Number(data.diferencia) > 0
                                ? client_1.TipoTransaccion.INGRESO
                                : client_1.TipoTransaccion.EGRESO;
                            return [2 /*return*/, this.createTransaccion({
                                    cajaId: cajaId,
                                    tipo: tipoAjuste,
                                    monto: montoAjuste,
                                    descripcion: descripcion,
                                    creadoPorId: userId,
                                    tipoReferencia: 'ARQUEO',
                                    referenciaId: referenciaId,
                                })];
                    }
                });
            });
        };
        // =====================
        // GASTOS
        // =====================
        AccountingService_1.prototype.getGastos = function (filtros) {
            return __awaiter(this, void 0, void 0, function () {
                var rutaId, estado, _a, page, _b, limit, fechaInicio, fechaFin, skip, where, start, end, _c, gastos, total;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            rutaId = filtros.rutaId, estado = filtros.estado, _a = filtros.page, page = _a === void 0 ? 1 : _a, _b = filtros.limit, limit = _b === void 0 ? 50 : _b, fechaInicio = filtros.fechaInicio, fechaFin = filtros.fechaFin;
                            skip = (page - 1) * limit;
                            where = {};
                            if (rutaId)
                                where.rutaId = rutaId;
                            if (estado)
                                where.estadoAprobacion = estado;
                            if (fechaInicio || fechaFin) {
                                where.fechaGasto = {};
                                if (fechaInicio) {
                                    start = new Date(fechaInicio);
                                    start.setHours(0, 0, 0, 0);
                                    where.fechaGasto.gte = start;
                                }
                                if (fechaFin) {
                                    end = new Date(fechaFin);
                                    end.setHours(23, 59, 59, 999);
                                    where.fechaGasto.lte = end;
                                }
                            }
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.gasto.findMany({
                                        where: where,
                                        skip: skip,
                                        take: limit,
                                        include: {
                                            cobrador: { select: { nombres: true, apellidos: true } },
                                            ruta: { select: { nombre: true } },
                                            caja: { select: { nombre: true } },
                                        },
                                        orderBy: { fechaGasto: 'desc' },
                                    }),
                                    this.prisma.gasto.count({ where: where }),
                                ])];
                        case 1:
                            _c = _d.sent(), gastos = _c[0], total = _c[1];
                            return [2 /*return*/, {
                                    data: gastos.map(function (g) {
                                        var _a;
                                        return ({
                                            id: g.id,
                                            numero: g.numeroGasto,
                                            fecha: g.fechaGasto.toISOString(),
                                            tipo: g.tipoGasto,
                                            monto: Number(g.monto),
                                            descripcion: g.descripcion,
                                            cobrador: "".concat(g.cobrador.nombres, " ").concat(g.cobrador.apellidos),
                                            ruta: ((_a = g.ruta) === null || _a === void 0 ? void 0 : _a.nombre) || 'Sin ruta',
                                            caja: g.caja.nombre,
                                            estado: g.estadoAprobacion,
                                        });
                                    }),
                                    meta: { total: total, page: page, limit: limit, totalPages: Math.ceil(total / limit) },
                                }];
                    }
                });
            });
        };
        AccountingService_1.prototype.exportAccountingReport = function (format) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, cajas, transacciones, fecha, filasCjas, filasTransacciones;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, Promise.all([
                                this.prisma.caja.findMany({
                                    where: { activa: true },
                                    include: {
                                        responsable: { select: { nombres: true, apellidos: true } },
                                        ruta: { select: { nombre: true } },
                                    },
                                    orderBy: { creadoEn: 'desc' },
                                }),
                                this.prisma.transaccion.findMany({
                                    include: {
                                        caja: { select: { nombre: true } },
                                        creadoPor: { select: { nombres: true, apellidos: true } },
                                    },
                                    orderBy: { creadoEn: 'desc' },
                                    take: 500,
                                }),
                            ])];
                        case 1:
                            _a = _b.sent(), cajas = _a[0], transacciones = _a[1];
                            fecha = new Date().toISOString().split('T')[0];
                            filasCjas = cajas.map(function (c) {
                                var _a;
                                return ({
                                    nombre: c.nombre,
                                    codigo: c.codigo,
                                    tipo: c.tipo,
                                    responsable: c.responsable ? "".concat(c.responsable.nombres, " ").concat(c.responsable.apellidos) : 'Sin asignar',
                                    ruta: ((_a = c.ruta) === null || _a === void 0 ? void 0 : _a.nombre) || 'N/A',
                                    saldo: Number(c.saldoActual),
                                });
                            });
                            filasTransacciones = transacciones.map(function (t) {
                                var _a;
                                return ({
                                    fecha: t.creadoEn,
                                    tipo: t.tipo,
                                    monto: Number(t.monto),
                                    descripcion: t.descripcion || '',
                                    caja: ((_a = t.caja) === null || _a === void 0 ? void 0 : _a.nombre) || '',
                                    usuario: t.creadoPor ? "".concat(t.creadoPor.nombres, " ").concat(t.creadoPor.apellidos) : '',
                                });
                            });
                            // 3. Delegamos al template
                            if (format === 'excel')
                                return [2 /*return*/, (0, reporte_contable_template_1.generarExcelContable)(filasCjas, filasTransacciones, fecha)];
                            if (format === 'pdf')
                                return [2 /*return*/, (0, reporte_contable_template_1.generarPDFContable)(filasCjas, filasTransacciones, fecha)];
                            throw new Error("Formato no soportado: ".concat(format));
                    }
                });
            });
        };
        return AccountingService_1;
    }());
    __setFunctionName(_classThis, "AccountingService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AccountingService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
    })();
    // Codigos reservados para las cajas que no se pueden eliminar
    _classThis.CODIGOS_DEFAULT = ['CAJA-PRINCIPAL', 'CAJA-OFICINA', 'CAJA-BANCO'];
    (function () {
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AccountingService = _classThis;
}();
exports.AccountingService = AccountingService;
