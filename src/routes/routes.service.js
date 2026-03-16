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
exports.RoutesService = void 0;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var exports_1 = require("../templates/exports");
var RoutesService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var RoutesService = _classThis = /** @class */ (function () {
        function RoutesService_1(prisma, auditService, notificacionesGateway, notificacionesService) {
            this.prisma = prisma;
            this.auditService = auditService;
            this.notificacionesGateway = notificacionesGateway;
            this.notificacionesService = notificacionesService;
        }
        RoutesService_1.prototype.listarCreditosAsignadosACobrador = function (cobradorId) {
            return __awaiter(this, void 0, void 0, function () {
                var asignaciones, filas, _i, asignaciones_1, asig, cliente, prestamos, _a, prestamos_1, p, proxima, cuotaEnProrroga, extension, fechaEfectiva;
                var _b, _c, _d, _e, _f, _g, _h, _j;
                return __generator(this, function (_k) {
                    switch (_k.label) {
                        case 0: return [4 /*yield*/, this.prisma.asignacionRuta.findMany({
                                where: {
                                    cobradorId: cobradorId,
                                    activa: true,
                                    ruta: {
                                        eliminadoEn: null,
                                    },
                                    cliente: {
                                        eliminadoEn: null,
                                    },
                                },
                                orderBy: { ordenVisita: 'asc' },
                                include: {
                                    ruta: { select: { id: true, nombre: true, codigo: true, activa: true } },
                                    cliente: {
                                        select: {
                                            id: true,
                                            nombres: true,
                                            apellidos: true,
                                            telefono: true,
                                            direccion: true,
                                            nivelRiesgo: true,
                                            prestamos: {
                                                where: {
                                                    eliminadoEn: null,
                                                    estado: { in: ['ACTIVO', 'EN_MORA'] },
                                                },
                                                orderBy: { creadoEn: 'asc' },
                                                select: {
                                                    id: true,
                                                    numeroPrestamo: true,
                                                    tipoPrestamo: true,
                                                    saldoPendiente: true,
                                                    frecuenciaPago: true,
                                                    cantidadCuotas: true,
                                                    estado: true,
                                                    producto: {
                                                        select: {
                                                            id: true,
                                                            nombre: true,
                                                            descripcion: true,
                                                        },
                                                    },
                                                    cuotas: {
                                                        where: {
                                                            estado: { in: ['PENDIENTE', 'VENCIDA', 'PARCIAL', 'PRORROGADA'] },
                                                        },
                                                        orderBy: { numeroCuota: 'asc' },
                                                        take: 1,
                                                        select: {
                                                            id: true,
                                                            numeroCuota: true,
                                                            monto: true,
                                                            estado: true,
                                                            fechaVencimiento: true,
                                                            fechaVencimientoProrroga: true,
                                                        },
                                                    },
                                                    extensiones: {
                                                        orderBy: { creadoEn: 'desc' },
                                                        take: 1,
                                                        select: { id: true, nuevaFechaVencimiento: true },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            })];
                        case 1:
                            asignaciones = _k.sent();
                            filas = [];
                            for (_i = 0, asignaciones_1 = asignaciones; _i < asignaciones_1.length; _i++) {
                                asig = asignaciones_1[_i];
                                cliente = asig.cliente;
                                prestamos = (cliente === null || cliente === void 0 ? void 0 : cliente.prestamos) || [];
                                if (!prestamos.length)
                                    continue;
                                for (_a = 0, prestamos_1 = prestamos; _a < prestamos_1.length; _a++) {
                                    p = prestamos_1[_a];
                                    proxima = ((_b = p.cuotas) === null || _b === void 0 ? void 0 : _b[0]) || null;
                                    cuotaEnProrroga = (proxima === null || proxima === void 0 ? void 0 : proxima.estado) === 'PRORROGADA';
                                    extension = ((_c = p.extensiones) === null || _c === void 0 ? void 0 : _c[0]) || null;
                                    fechaEfectiva = (cuotaEnProrroga && (proxima === null || proxima === void 0 ? void 0 : proxima.fechaVencimientoProrroga))
                                        ? proxima.fechaVencimientoProrroga
                                        : ((_e = (_d = extension === null || extension === void 0 ? void 0 : extension.nuevaFechaVencimiento) !== null && _d !== void 0 ? _d : proxima === null || proxima === void 0 ? void 0 : proxima.fechaVencimiento) !== null && _e !== void 0 ? _e : null);
                                    filas.push({
                                        asignacionId: asig.id,
                                        rutaId: asig.rutaId,
                                        rutaNombre: (_f = asig.ruta) === null || _f === void 0 ? void 0 : _f.nombre,
                                        rutaCodigo: (_g = asig.ruta) === null || _g === void 0 ? void 0 : _g.codigo,
                                        ordenVisita: asig.ordenVisita,
                                        cliente: {
                                            id: cliente.id,
                                            nombres: cliente.nombres,
                                            apellidos: cliente.apellidos,
                                            telefono: cliente.telefono,
                                            direccion: cliente.direccion,
                                            nivelRiesgo: cliente.nivelRiesgo,
                                        },
                                        prestamo: {
                                            id: p.id,
                                            tipo: p.tipoPrestamo,
                                            numeroPrestamo: p.numeroPrestamo,
                                            saldoPendiente: Number(p.saldoPendiente),
                                            frecuenciaPago: p.frecuenciaPago,
                                            cantidadCuotas: p.cantidadCuotas,
                                            estado: p.estado,
                                            articulo: ((_h = p.producto) === null || _h === void 0 ? void 0 : _h.nombre) || ((_j = p.producto) === null || _j === void 0 ? void 0 : _j.descripcion) || null,
                                            proximaCuota: proxima
                                                ? {
                                                    id: proxima.id,
                                                    numeroCuota: proxima.numeroCuota,
                                                    monto: Number(proxima.monto),
                                                    estado: proxima.estado,
                                                    fechaVencimiento: proxima.fechaVencimiento,
                                                    fechaVencimientoProrroga: proxima.fechaVencimientoProrroga,
                                                    enProrroga: cuotaEnProrroga,
                                                }
                                                : null,
                                            fechaEfectiva: fechaEfectiva,
                                        },
                                    });
                                }
                            }
                            return [2 /*return*/, {
                                    cobradorId: cobradorId,
                                    total: filas.length,
                                    data: filas,
                                }];
                    }
                });
            });
        };
        RoutesService_1.prototype.create = function (createRouteDto) {
            return __awaiter(this, void 0, void 0, function () {
                var existingRoute, cobrador, supervisor, route, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 10, , 11]);
                            return [4 /*yield*/, this.prisma.ruta.findUnique({
                                    where: { codigo: createRouteDto.codigo },
                                })];
                        case 1:
                            existingRoute = _a.sent();
                            if (existingRoute) {
                                throw new common_1.ConflictException('El código de ruta ya existe');
                            }
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: {
                                        id: createRouteDto.cobradorId,
                                        rol: 'COBRADOR',
                                    },
                                })];
                        case 2:
                            cobrador = _a.sent();
                            if (!cobrador) {
                                throw new common_1.BadRequestException('El cobrador especificado no existe o no tiene el rol correcto');
                            }
                            if (!createRouteDto.supervisorId) return [3 /*break*/, 4];
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: {
                                        id: createRouteDto.supervisorId,
                                        rol: { in: ['SUPERVISOR', 'COORDINADOR'] },
                                    },
                                })];
                        case 3:
                            supervisor = _a.sent();
                            if (!supervisor) {
                                throw new common_1.BadRequestException('El supervisor especificado no existe o no tiene el rol correcto');
                            }
                            _a.label = 4;
                        case 4: return [4 /*yield*/, this.prisma.ruta.create({
                                data: {
                                    codigo: createRouteDto.codigo,
                                    nombre: createRouteDto.nombre,
                                    descripcion: createRouteDto.descripcion,
                                    zona: createRouteDto.zona,
                                    cobradorId: createRouteDto.cobradorId,
                                    supervisorId: createRouteDto.supervisorId,
                                    activa: true,
                                },
                                include: {
                                    cobrador: {
                                        select: {
                                            id: true,
                                            nombres: true,
                                            apellidos: true,
                                            correo: true,
                                            telefono: true,
                                            rol: true,
                                        },
                                    },
                                    supervisor: {
                                        select: {
                                            id: true,
                                            nombres: true,
                                            apellidos: true,
                                            correo: true,
                                            telefono: true,
                                            rol: true,
                                        },
                                    },
                                },
                            })];
                        case 5:
                            route = _a.sent();
                            if (!createRouteDto.cobradorId) return [3 /*break*/, 7];
                            return [4 /*yield*/, this.auditService.create({
                                    usuarioId: createRouteDto.cobradorId,
                                    accion: 'CREAR_RUTA',
                                    entidad: 'Ruta',
                                    entidadId: route.id,
                                    datosNuevos: {
                                        codigo: route.codigo,
                                        nombre: route.nombre,
                                        descripcion: route.descripcion,
                                        zona: route.zona,
                                        cobrador: "".concat(route.cobrador.nombres, " ").concat(route.cobrador.apellidos),
                                        supervisor: route.supervisor ? "".concat(route.supervisor.nombres, " ").concat(route.supervisor.apellidos) : null,
                                    },
                                })];
                        case 6:
                            _a.sent();
                            _a.label = 7;
                        case 7:
                            if (!createRouteDto.cobradorId) return [3 /*break*/, 9];
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: createRouteDto.cobradorId,
                                    titulo: 'Nueva Ruta Asignada',
                                    mensaje: "Se te ha asignado la ruta ".concat(route.nombre, " (").concat(route.codigo, ")"),
                                    tipo: 'RUTA',
                                    entidad: 'Ruta',
                                    entidadId: route.id,
                                })];
                        case 8:
                            _a.sent();
                            _a.label = 9;
                        case 9:
                            this.notificacionesGateway.broadcastRutasActualizadas({
                                accion: 'CREAR',
                                rutaId: route.id,
                            });
                            this.notificacionesGateway.broadcastDashboardsActualizados({});
                            return [2 /*return*/, route];
                        case 10:
                            error_1 = _a.sent();
                            if (error_1 instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                                if (error_1.code === 'P2002') {
                                    throw new common_1.ConflictException('El código de ruta ya existe');
                                }
                                if (error_1.code === 'P2003') {
                                    throw new common_1.BadRequestException('Relación inválida con cobrador o supervisor');
                                }
                            }
                            throw error_1;
                        case 11: return [2 /*return*/];
                    }
                });
            });
        };
        RoutesService_1.prototype.findAll = function (options) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, skip, take, search, activa, cobradorId, supervisorId, where, _b, rutas, total, rutasConEstadisticas, error_2;
                var _this = this;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _a = options || {}, skip = _a.skip, take = _a.take, search = _a.search, activa = _a.activa, cobradorId = _a.cobradorId, supervisorId = _a.supervisorId;
                            where = {
                                eliminadoEn: null,
                            };
                            if (search) {
                                where.OR = [
                                    { nombre: { contains: search, mode: 'insensitive' } },
                                    { codigo: { contains: search, mode: 'insensitive' } },
                                    { zona: { contains: search, mode: 'insensitive' } },
                                    { descripcion: { contains: search, mode: 'insensitive' } },
                                ];
                            }
                            if (activa !== undefined) {
                                where.activa = activa;
                            }
                            if (cobradorId) {
                                where.cobradorId = cobradorId;
                            }
                            if (supervisorId) {
                                where.supervisorId = supervisorId;
                            }
                            _c.label = 1;
                        case 1:
                            _c.trys.push([1, 4, , 5]);
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.ruta.findMany({
                                        where: where,
                                        skip: skip,
                                        take: take,
                                        include: {
                                            cobrador: {
                                                select: {
                                                    id: true,
                                                    nombres: true,
                                                    apellidos: true,
                                                    correo: true,
                                                    telefono: true,
                                                    rol: true,
                                                },
                                            },
                                            supervisor: {
                                                select: {
                                                    id: true,
                                                    nombres: true,
                                                    apellidos: true,
                                                    correo: true,
                                                    telefono: true,
                                                    rol: true,
                                                },
                                            },
                                            asignaciones: {
                                                where: { activa: true },
                                                include: {
                                                    cliente: {
                                                        select: {
                                                            id: true,
                                                            nombres: true,
                                                            apellidos: true,
                                                            dni: true,
                                                        },
                                                    },
                                                },
                                            },
                                            _count: {
                                                select: {
                                                    asignaciones: { where: { activa: true } },
                                                    gastos: true,
                                                },
                                            },
                                        },
                                        orderBy: { creadoEn: 'desc' },
                                    }),
                                    this.prisma.ruta.count({ where: where }),
                                ])];
                        case 2:
                            _b = _c.sent(), rutas = _b[0], total = _b[1];
                            return [4 /*yield*/, Promise.all(rutas.map(function (ruta) { return __awaiter(_this, void 0, void 0, function () {
                                    var asignaciones, clientesIds, estadisticas, nivelRiesgo, porcentajeMora, avanceDiario, prestamosActivos, pIds, dInicio, dFin, _a, pagosHoy, cuotasHoy, cuotasVencidasTotal, deudaTotal, montoVencido, sieteDiasAtras, _b;
                                    var _c, _d, _e;
                                    return __generator(this, function (_f) {
                                        switch (_f.label) {
                                            case 0: return [4 /*yield*/, this.prisma.asignacionRuta.findMany({
                                                    where: { rutaId: ruta.id, activa: true },
                                                    select: { clienteId: true }
                                                })];
                                            case 1:
                                                asignaciones = _f.sent();
                                                clientesIds = asignaciones.map(function (a) { return a.clienteId; });
                                                estadisticas = {
                                                    clientesAsignados: asignaciones.length,
                                                    cobranzaDelDia: 0,
                                                    metaDelDia: 0,
                                                    clientesNuevos: 0,
                                                };
                                                nivelRiesgo = 'PELIGRO_MINIMO';
                                                porcentajeMora = 0;
                                                avanceDiario = 0;
                                                if (!(clientesIds.length > 0)) return [3 /*break*/, 6];
                                                return [4 /*yield*/, this.prisma.prestamo.findMany({
                                                        where: {
                                                            clienteId: { in: clientesIds },
                                                            estado: { in: ['ACTIVO', 'EN_MORA'] },
                                                            eliminadoEn: null,
                                                        },
                                                        select: { id: true, saldoPendiente: true }
                                                    })];
                                            case 2:
                                                prestamosActivos = _f.sent();
                                                pIds = prestamosActivos.map(function (p) { return p.id; });
                                                dInicio = new Date();
                                                dInicio.setHours(0, 0, 0, 0);
                                                dFin = new Date();
                                                dFin.setHours(23, 59, 59, 999);
                                                if (!(pIds.length > 0)) return [3 /*break*/, 4];
                                                return [4 /*yield*/, Promise.all([
                                                        this.prisma.pago.aggregate({
                                                            where: {
                                                                prestamoId: { in: pIds },
                                                                fechaPago: { gte: dInicio, lt: dFin },
                                                            },
                                                            _sum: { montoTotal: true },
                                                        }),
                                                        this.prisma.cuota.aggregate({
                                                            where: {
                                                                prestamoId: { in: pIds },
                                                                fechaVencimiento: { gte: dInicio, lt: dFin },
                                                            },
                                                            _sum: { monto: true },
                                                        }),
                                                        this.prisma.cuota.aggregate({
                                                            where: {
                                                                prestamoId: { in: pIds },
                                                                fechaVencimiento: { lt: dInicio },
                                                                estado: { not: 'PAGADA' },
                                                            },
                                                            _sum: { monto: true },
                                                        })
                                                    ])];
                                            case 3:
                                                _a = _f.sent(), pagosHoy = _a[0], cuotasHoy = _a[1], cuotasVencidasTotal = _a[2];
                                                estadisticas.cobranzaDelDia = ((_c = pagosHoy._sum.montoTotal) === null || _c === void 0 ? void 0 : _c.toNumber()) || 0;
                                                estadisticas.metaDelDia = ((_d = cuotasHoy._sum.monto) === null || _d === void 0 ? void 0 : _d.toNumber()) || 0;
                                                // Calcular AVANCE DIARIO
                                                if (estadisticas.metaDelDia > 0) {
                                                    avanceDiario = (estadisticas.cobranzaDelDia / estadisticas.metaDelDia) * 100;
                                                }
                                                deudaTotal = prestamosActivos.reduce(function (acc, curr) { return acc + curr.saldoPendiente.toNumber(); }, 0);
                                                montoVencido = ((_e = cuotasVencidasTotal._sum.monto) === null || _e === void 0 ? void 0 : _e.toNumber()) || 0;
                                                porcentajeMora = deudaTotal > 0 ? (montoVencido / deudaTotal) * 100 : 0;
                                                if (porcentajeMora > 30)
                                                    nivelRiesgo = 'ALTO_RIESGO';
                                                else if (porcentajeMora > 15)
                                                    nivelRiesgo = 'RIESGO_MODERADO';
                                                else if (porcentajeMora > 10)
                                                    nivelRiesgo = 'PRECAUCION';
                                                else if (porcentajeMora > 5)
                                                    nivelRiesgo = 'LEVE_RETRASO';
                                                _f.label = 4;
                                            case 4:
                                                sieteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                                                _b = estadisticas;
                                                return [4 /*yield*/, this.prisma.asignacionRuta.count({
                                                        where: {
                                                            rutaId: ruta.id,
                                                            creadoEn: { gte: sieteDiasAtras },
                                                            activa: true,
                                                        },
                                                    })];
                                            case 5:
                                                _b.clientesNuevos = _f.sent();
                                                _f.label = 6;
                                            case 6: return [2 /*return*/, __assign(__assign(__assign({}, ruta), estadisticas), { clientesAsignados: estadisticas.clientesAsignados, clientesNuevos: estadisticas.clientesNuevos, cobranzaDelDia: estadisticas.cobranzaDelDia, metaDelDia: estadisticas.metaDelDia, nivelRiesgo: nivelRiesgo, porcentajeMora: parseFloat(porcentajeMora.toFixed(2)), avanceDiario: parseFloat(avanceDiario.toFixed(2)), cobrador: "".concat(ruta.cobrador.nombres, " ").concat(ruta.cobrador.apellidos), estado: ruta.activa ? 'ACTIVA' : 'INACTIVA', frecuenciaVisita: 'DIARIO' })];
                                        }
                                    });
                                }); }))];
                        case 3:
                            rutasConEstadisticas = _c.sent();
                            return [2 /*return*/, {
                                    data: rutasConEstadisticas,
                                    meta: {
                                        total: total,
                                        skip: skip || 0,
                                        take: take || rutas.length,
                                    },
                                }];
                        case 4:
                            error_2 = _c.sent();
                            throw new common_1.InternalServerErrorException("Error al obtener las rutas: ".concat(error_2 instanceof Error ? error_2.message : 'Unknown error'));
                        case 5: return [2 /*return*/];
                    }
                });
            });
        };
        RoutesService_1.prototype.findOne = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var ruta, clientesIds, estadisticas, nivelRiesgo, porcentajeMora, avanceDiario, prestamosActivos, hoyInicio, hoyFin, pagosHoy, cuotasHoy, deudaTotal, sieteDiasAtras, _a, cuotasVencidasTotal, montoVencido, error_3;
                var _b, _c, _d, _e, _f, _g, _h;
                return __generator(this, function (_j) {
                    switch (_j.label) {
                        case 0:
                            _j.trys.push([0, 8, , 9]);
                            return [4 /*yield*/, this.prisma.ruta.findFirst({
                                    where: {
                                        id: id,
                                        eliminadoEn: null,
                                    },
                                    include: {
                                        cobrador: {
                                            select: {
                                                id: true,
                                                nombres: true,
                                                apellidos: true,
                                                correo: true,
                                                telefono: true,
                                                rol: true,
                                            },
                                        },
                                        supervisor: {
                                            select: {
                                                id: true,
                                                nombres: true,
                                                apellidos: true,
                                                correo: true,
                                                telefono: true,
                                                rol: true,
                                            },
                                        },
                                        asignaciones: {
                                            where: { activa: true },
                                            include: {
                                                cliente: {
                                                    include: {
                                                        prestamos: {
                                                            where: {
                                                                OR: [
                                                                    { estado: client_1.EstadoPrestamo.ACTIVO },
                                                                    { estado: client_1.EstadoPrestamo.EN_MORA },
                                                                ],
                                                            },
                                                            include: {
                                                                cuotas: {
                                                                    where: {
                                                                        estado: {
                                                                            in: [
                                                                                client_1.EstadoCuota.PENDIENTE,
                                                                                client_1.EstadoCuota.VENCIDA,
                                                                                client_1.EstadoCuota.PARCIAL,
                                                                                client_1.EstadoCuota.PRORROGADA,
                                                                            ],
                                                                        },
                                                                    },
                                                                    orderBy: { numeroCuota: 'asc' },
                                                                    take: 1,
                                                                    select: {
                                                                        id: true,
                                                                        numeroCuota: true,
                                                                        monto: true,
                                                                        estado: true,
                                                                        fechaVencimiento: true,
                                                                        fechaVencimientoProrroga: true,
                                                                        extensionId: true,
                                                                    },
                                                                },
                                                                extensiones: {
                                                                    orderBy: { creadoEn: 'desc' },
                                                                    take: 1,
                                                                    select: {
                                                                        id: true,
                                                                        nuevaFechaVencimiento: true,
                                                                        creadoEn: true,
                                                                    },
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                            orderBy: { ordenVisita: 'asc' },
                                        },
                                        cajas: {
                                            where: { activa: true },
                                            select: {
                                                id: true,
                                                codigo: true,
                                                nombre: true,
                                                saldoActual: true,
                                            },
                                        },
                                        gastos: {
                                            where: { estadoAprobacion: 'APROBADO' },
                                            take: 10,
                                            orderBy: { fechaGasto: 'desc' },
                                        },
                                        _count: {
                                            select: {
                                                asignaciones: {
                                                    where: { activa: true },
                                                },
                                                gastos: true,
                                            },
                                        },
                                    },
                                })];
                        case 1:
                            ruta = _j.sent();
                            if (!ruta) {
                                throw new common_1.NotFoundException('Ruta no encontrada');
                            }
                            clientesIds = ruta.asignaciones.map(function (a) { return a.clienteId; });
                            estadisticas = {
                                clientesAsignados: ruta._count.asignaciones,
                                cobranzaDelDia: 0,
                                metaDelDia: 0,
                                clientesNuevos: 0,
                                totalDeuda: 0,
                                prestamosActivos: 0,
                            };
                            nivelRiesgo = 'PELIGRO_MINIMO';
                            porcentajeMora = 0;
                            avanceDiario = 0;
                            if (!(clientesIds.length > 0)) return [3 /*break*/, 7];
                            return [4 /*yield*/, this.prisma.prestamo.findMany({
                                    where: {
                                        clienteId: { in: clientesIds },
                                        estado: { in: ['ACTIVO', 'EN_MORA'] },
                                        eliminadoEn: null,
                                    },
                                    include: {
                                        cuotas: {
                                            where: {
                                                estado: 'PENDIENTE',
                                            },
                                        },
                                    },
                                })];
                        case 2:
                            prestamosActivos = _j.sent();
                            hoyInicio = new Date();
                            hoyInicio.setHours(0, 0, 0, 0);
                            hoyFin = new Date();
                            hoyFin.setHours(23, 59, 59, 999);
                            return [4 /*yield*/, this.prisma.pago.aggregate({
                                    where: {
                                        prestamoId: { in: prestamosActivos.map(function (p) { return p.id; }) },
                                        fechaPago: {
                                            gte: hoyInicio,
                                            lt: hoyFin,
                                        },
                                    },
                                    _sum: {
                                        montoTotal: true,
                                    },
                                })];
                        case 3:
                            pagosHoy = _j.sent();
                            return [4 /*yield*/, this.prisma.cuota.aggregate({
                                    where: {
                                        prestamoId: { in: prestamosActivos.map(function (p) { return p.id; }) },
                                        fechaVencimiento: {
                                            gte: hoyInicio,
                                            lt: hoyFin,
                                        },
                                    },
                                    _sum: {
                                        monto: true,
                                    },
                                })];
                        case 4:
                            cuotasHoy = _j.sent();
                            deudaTotal = prestamosActivos.reduce(function (total, prestamo) {
                                return total + prestamo.saldoPendiente.toNumber();
                            }, 0);
                            estadisticas.cobranzaDelDia = ((_b = pagosHoy._sum.montoTotal) === null || _b === void 0 ? void 0 : _b.toNumber()) || 0;
                            estadisticas.metaDelDia = ((_c = cuotasHoy._sum.monto) === null || _c === void 0 ? void 0 : _c.toNumber()) || 0;
                            estadisticas.totalDeuda = deudaTotal;
                            estadisticas.prestamosActivos = prestamosActivos.length;
                            // Calcular avance diario
                            if (estadisticas.metaDelDia > 0) {
                                avanceDiario =
                                    (estadisticas.cobranzaDelDia / estadisticas.metaDelDia) * 100;
                            }
                            sieteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                            _a = estadisticas;
                            return [4 /*yield*/, this.prisma.asignacionRuta.count({
                                    where: {
                                        rutaId: id,
                                        creadoEn: {
                                            gte: sieteDiasAtras,
                                        },
                                        activa: true,
                                    },
                                })];
                        case 5:
                            _a.clientesNuevos = _j.sent();
                            return [4 /*yield*/, this.prisma.cuota.aggregate({
                                    where: {
                                        prestamoId: { in: prestamosActivos.map(function (p) { return p.id; }) },
                                        fechaVencimiento: { lt: hoyInicio },
                                        estado: { not: 'PAGADA' },
                                    },
                                    _sum: {
                                        monto: true,
                                    },
                                })];
                        case 6:
                            cuotasVencidasTotal = _j.sent();
                            montoVencido = ((_d = cuotasVencidasTotal._sum.monto) === null || _d === void 0 ? void 0 : _d.toNumber()) || 0;
                            porcentajeMora =
                                estadisticas.totalDeuda > 0
                                    ? (montoVencido / estadisticas.totalDeuda) * 100
                                    : 0;
                            if (porcentajeMora > 30)
                                nivelRiesgo = 'ALTO_RIESGO';
                            else if (porcentajeMora > 15)
                                nivelRiesgo = 'RIESGO_MODERADO';
                            else if (porcentajeMora > 10)
                                nivelRiesgo = 'PRECAUCION';
                            else if (porcentajeMora > 5)
                                nivelRiesgo = 'LEVE_RETRASO';
                            _j.label = 7;
                        case 7: return [2 /*return*/, __assign(__assign({}, ruta), { estadisticas: __assign(__assign({}, estadisticas), { avanceDiario: parseFloat(avanceDiario.toFixed(2)) }), nivelRiesgo: nivelRiesgo, porcentajeMora: parseFloat(porcentajeMora.toFixed(2)), cobrador: "".concat(ruta.cobrador.nombres, " ").concat(ruta.cobrador.apellidos), supervisor: ruta.supervisorId
                                    ? "".concat((_f = (_e = ruta.supervisor) === null || _e === void 0 ? void 0 : _e.nombres) !== null && _f !== void 0 ? _f : '', " ").concat((_h = (_g = ruta.supervisor) === null || _g === void 0 ? void 0 : _g.apellidos) !== null && _h !== void 0 ? _h : '')
                                    : undefined })];
                        case 8:
                            error_3 = _j.sent();
                            if (error_3 instanceof common_1.NotFoundException)
                                throw error_3;
                            if (error_3 instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                                throw new common_1.BadRequestException({
                                    message: 'Datos inválidos para obtener la ruta.',
                                    code: error_3.code,
                                    meta: error_3.meta,
                                });
                            }
                            if (error_3 instanceof client_1.Prisma.PrismaClientValidationError) {
                                throw new common_1.BadRequestException({
                                    message: 'Datos inválidos para obtener la ruta.',
                                    details: error_3.message,
                                });
                            }
                            throw new common_1.InternalServerErrorException("Error al obtener la ruta: ".concat(error_3 instanceof Error ? error_3.message : 'Unknown error'));
                        case 9: return [2 /*return*/];
                    }
                });
            });
        };
        RoutesService_1.prototype.update = function (id, updateRouteDto) {
            return __awaiter(this, void 0, void 0, function () {
                var existingRoute, duplicateCode, cobrador, supervisor, updatedRoute, error_4;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.ruta.findUnique({
                                where: {
                                    id: id,
                                    eliminadoEn: null,
                                },
                            })];
                        case 1:
                            existingRoute = _a.sent();
                            if (!existingRoute) {
                                throw new common_1.NotFoundException('Ruta no encontrada');
                            }
                            if (!(updateRouteDto.codigo &&
                                updateRouteDto.codigo !== existingRoute.codigo)) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.prisma.ruta.findUnique({
                                    where: { codigo: updateRouteDto.codigo },
                                })];
                        case 2:
                            duplicateCode = _a.sent();
                            if (duplicateCode) {
                                throw new common_1.ConflictException('El código de ruta ya existe');
                            }
                            _a.label = 3;
                        case 3:
                            if (!updateRouteDto.cobradorId) return [3 /*break*/, 5];
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: {
                                        id: updateRouteDto.cobradorId,
                                        rol: 'COBRADOR',
                                    },
                                })];
                        case 4:
                            cobrador = _a.sent();
                            if (!cobrador) {
                                throw new common_1.BadRequestException('El cobrador especificado no existe o no tiene el rol correcto');
                            }
                            _a.label = 5;
                        case 5:
                            if (!updateRouteDto.supervisorId) return [3 /*break*/, 7];
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: {
                                        id: updateRouteDto.supervisorId,
                                        rol: { in: ['SUPERVISOR', 'COORDINADOR'] },
                                    },
                                })];
                        case 6:
                            supervisor = _a.sent();
                            if (!supervisor) {
                                throw new common_1.BadRequestException('El supervisor especificado no existe o no tiene el rol correcto');
                            }
                            _a.label = 7;
                        case 7:
                            _a.trys.push([7, 11, , 12]);
                            return [4 /*yield*/, this.prisma.ruta.update({
                                    where: { id: id },
                                    data: updateRouteDto,
                                    include: {
                                        cobrador: {
                                            select: {
                                                id: true,
                                                nombres: true,
                                                apellidos: true,
                                                correo: true,
                                                telefono: true,
                                                rol: true,
                                            },
                                        },
                                        supervisor: {
                                            select: {
                                                id: true,
                                                nombres: true,
                                                apellidos: true,
                                                correo: true,
                                                telefono: true,
                                                rol: true,
                                            },
                                        },
                                    },
                                })];
                        case 8:
                            updatedRoute = _a.sent();
                            if (!(updateRouteDto.cobradorId && updateRouteDto.cobradorId !== existingRoute.cobradorId)) return [3 /*break*/, 10];
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: updateRouteDto.cobradorId,
                                    titulo: 'Ruta Asignada',
                                    mensaje: "Se te ha asignado la ruta ".concat(updatedRoute.nombre, " (").concat(updatedRoute.codigo, ")"),
                                    tipo: 'RUTA',
                                    entidad: 'Ruta',
                                    entidadId: updatedRoute.id,
                                })];
                        case 9:
                            _a.sent();
                            _a.label = 10;
                        case 10:
                            this.notificacionesGateway.broadcastRutasActualizadas({
                                accion: 'ACTUALIZAR',
                                rutaId: updatedRoute.id,
                            });
                            this.notificacionesGateway.broadcastDashboardsActualizados({});
                            return [2 /*return*/, updatedRoute];
                        case 11:
                            error_4 = _a.sent();
                            if (error_4 instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                                if (error_4.code === 'P2002') {
                                    throw new common_1.ConflictException('El código de ruta ya existe');
                                }
                                if (error_4.code === 'P2003') {
                                    throw new common_1.BadRequestException('Relación inválida con cobrador o supervisor');
                                }
                            }
                            throw error_4;
                        case 12: return [2 /*return*/];
                    }
                });
            });
        };
        RoutesService_1.prototype.remove = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var existingRoute, updatedRoute, error_5;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.ruta.findUnique({
                                where: {
                                    id: id,
                                    eliminadoEn: null,
                                },
                                include: {
                                    _count: {
                                        select: {
                                            asignaciones: {
                                                where: { activa: true },
                                            },
                                            cajas: {
                                                where: { activa: true },
                                            },
                                        },
                                    },
                                },
                            })];
                        case 1:
                            existingRoute = _a.sent();
                            if (!existingRoute) {
                                throw new common_1.NotFoundException('Ruta no encontrada');
                            }
                            // Verificar si hay asignaciones activas
                            if (existingRoute._count.asignaciones > 0) {
                                throw new common_1.BadRequestException('No se puede eliminar una ruta con clientes asignados');
                            }
                            // Verificar si hay cajas activas
                            if (existingRoute._count.cajas > 0) {
                                throw new common_1.BadRequestException('No se puede eliminar una ruta con cajas activas');
                            }
                            _a.label = 2;
                        case 2:
                            _a.trys.push([2, 4, , 5]);
                            return [4 /*yield*/, this.prisma.ruta.update({
                                    where: { id: id },
                                    data: {
                                        eliminadoEn: new Date(),
                                        activa: false,
                                    },
                                })];
                        case 3:
                            updatedRoute = _a.sent();
                            this.notificacionesGateway.broadcastRutasActualizadas({
                                accion: 'ELIMINAR',
                                rutaId: updatedRoute.id,
                            });
                            this.notificacionesGateway.broadcastDashboardsActualizados({});
                            return [2 /*return*/, { message: 'Ruta eliminada correctamente' }];
                        case 4:
                            error_5 = _a.sent();
                            throw new common_1.InternalServerErrorException('Error al eliminar la ruta');
                        case 5: return [2 /*return*/];
                    }
                });
            });
        };
        RoutesService_1.prototype.toggleActive = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var existingRoute, updatedRoute, error_6;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.ruta.findUnique({
                                where: {
                                    id: id,
                                    eliminadoEn: null,
                                },
                            })];
                        case 1:
                            existingRoute = _a.sent();
                            if (!existingRoute) {
                                throw new common_1.NotFoundException('Ruta no encontrada');
                            }
                            _a.label = 2;
                        case 2:
                            _a.trys.push([2, 6, , 7]);
                            return [4 /*yield*/, this.prisma.ruta.update({
                                    where: { id: id },
                                    data: {
                                        activa: !existingRoute.activa,
                                    },
                                    include: {
                                        cobrador: {
                                            select: {
                                                id: true,
                                                nombres: true,
                                                apellidos: true,
                                                correo: true,
                                                telefono: true,
                                                rol: true,
                                            },
                                        },
                                    },
                                })];
                        case 3:
                            updatedRoute = _a.sent();
                            if (!(updatedRoute.activa && updatedRoute.cobradorId)) return [3 /*break*/, 5];
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: updatedRoute.cobradorId,
                                    titulo: 'Ruta Activada',
                                    mensaje: "Tu ruta ".concat(updatedRoute.nombre, " ha sido activada"),
                                    tipo: 'RUTA',
                                    entidad: 'Ruta',
                                    entidadId: updatedRoute.id,
                                })];
                        case 4:
                            _a.sent();
                            _a.label = 5;
                        case 5:
                            this.notificacionesGateway.broadcastRutasActualizadas({
                                accion: 'ACTUALIZAR',
                                rutaId: updatedRoute.id,
                            });
                            this.notificacionesGateway.broadcastDashboardsActualizados({});
                            return [2 /*return*/, __assign(__assign({}, updatedRoute), { message: "Ruta ".concat(updatedRoute.activa ? 'activada' : 'desactivada', " correctamente") })];
                        case 6:
                            error_6 = _a.sent();
                            throw new common_1.InternalServerErrorException('Error al cambiar el estado de la ruta');
                        case 7: return [2 /*return*/];
                    }
                });
            });
        };
        RoutesService_1.prototype.getStatistics = function () {
            return __awaiter(this, void 0, void 0, function () {
                var _a, totalRutas, rutasActivas, rutasInactivas, totalClientesAsignados, cobranzaHoy, metaHoy, supervisores, totalSupervisores, error_7;
                var _this = this;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 3, , 4]);
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.ruta.count({ where: { eliminadoEn: null } }),
                                    this.prisma.ruta.count({ where: { activa: true, eliminadoEn: null } }),
                                    this.prisma.ruta.count({ where: { activa: false, eliminadoEn: null } }),
                                    this.prisma.asignacionRuta.count({ where: { activa: true } }),
                                    // Cobranza de hoy
                                    (function () { return __awaiter(_this, void 0, void 0, function () {
                                        var hoyInicio, hoyFin, result;
                                        var _a;
                                        return __generator(this, function (_b) {
                                            switch (_b.label) {
                                                case 0:
                                                    hoyInicio = new Date();
                                                    hoyInicio.setHours(0, 0, 0, 0);
                                                    hoyFin = new Date();
                                                    hoyFin.setHours(23, 59, 59, 999);
                                                    return [4 /*yield*/, this.prisma.pago.aggregate({
                                                            where: {
                                                                fechaPago: {
                                                                    gte: hoyInicio,
                                                                    lt: hoyFin,
                                                                },
                                                            },
                                                            _sum: {
                                                                montoTotal: true,
                                                            },
                                                        })];
                                                case 1:
                                                    result = _b.sent();
                                                    return [2 /*return*/, ((_a = result._sum.montoTotal) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0];
                                            }
                                        });
                                    }); })(),
                                    // Meta de hoy (cuotas vencidas hoy)
                                    (function () { return __awaiter(_this, void 0, void 0, function () {
                                        var hoyInicio, hoyFin, result;
                                        var _a;
                                        return __generator(this, function (_b) {
                                            switch (_b.label) {
                                                case 0:
                                                    hoyInicio = new Date();
                                                    hoyInicio.setHours(0, 0, 0, 0);
                                                    hoyFin = new Date();
                                                    hoyFin.setHours(23, 59, 59, 999);
                                                    return [4 /*yield*/, this.prisma.cuota.aggregate({
                                                            where: {
                                                                fechaVencimiento: {
                                                                    gte: hoyInicio,
                                                                    lt: hoyFin,
                                                                },
                                                                prestamo: {
                                                                    estado: { in: ['ACTIVO', 'EN_MORA'] },
                                                                },
                                                            },
                                                            _sum: {
                                                                monto: true,
                                                            },
                                                        })];
                                                case 1:
                                                    result = _b.sent();
                                                    return [2 /*return*/, ((_a = result._sum.monto) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0];
                                            }
                                        });
                                    }); })(),
                                ])];
                        case 1:
                            _a = _b.sent(), totalRutas = _a[0], rutasActivas = _a[1], rutasInactivas = _a[2], totalClientesAsignados = _a[3], cobranzaHoy = _a[4], metaHoy = _a[5];
                            return [4 /*yield*/, this.prisma.ruta.groupBy({
                                    by: ['supervisorId'],
                                    where: {
                                        eliminadoEn: null,
                                        supervisorId: { not: null },
                                    },
                                    _count: {
                                        _all: true,
                                    },
                                })];
                        case 2:
                            supervisores = _b.sent();
                            totalSupervisores = supervisores.length;
                            return [2 /*return*/, {
                                    totalRutas: totalRutas,
                                    rutasActivas: rutasActivas,
                                    rutasInactivas: rutasInactivas,
                                    totalClientesAsignados: totalClientesAsignados,
                                    cobranzaHoy: cobranzaHoy,
                                    metaHoy: metaHoy,
                                    porcentajeAvance: metaHoy > 0 ? (cobranzaHoy / metaHoy) * 100 : 0,
                                    totalSupervisores: totalSupervisores,
                                }];
                        case 3:
                            error_7 = _b.sent();
                            throw new common_1.InternalServerErrorException('Error al obtener estadísticas');
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        RoutesService_1.prototype.getCobradores = function () {
            return __awaiter(this, void 0, void 0, function () {
                var cobradores, error_8;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, this.prisma.usuario.findMany({
                                    where: {
                                        rol: 'COBRADOR',
                                        estado: 'ACTIVO',
                                        eliminadoEn: null,
                                    },
                                    select: {
                                        id: true,
                                        nombres: true,
                                        apellidos: true,
                                        correo: true,
                                        telefono: true,
                                    },
                                    orderBy: { nombres: 'asc' },
                                })];
                        case 1:
                            cobradores = _a.sent();
                            return [2 /*return*/, cobradores.map(function (c) { return ({
                                    id: c.id,
                                    nombre: "".concat(c.nombres, " ").concat(c.apellidos),
                                    correo: c.correo,
                                    telefono: c.telefono,
                                }); })];
                        case 2:
                            error_8 = _a.sent();
                            throw new common_1.InternalServerErrorException('Error al obtener cobradores');
                        case 3: return [2 /*return*/];
                    }
                });
            });
        };
        RoutesService_1.prototype.getSupervisores = function () {
            return __awaiter(this, void 0, void 0, function () {
                var supervisores, error_9;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, this.prisma.usuario.findMany({
                                    where: {
                                        rol: { in: ['SUPERVISOR', 'COORDINADOR'] },
                                        estado: 'ACTIVO',
                                        eliminadoEn: null,
                                    },
                                    select: {
                                        id: true,
                                        nombres: true,
                                        apellidos: true,
                                        correo: true,
                                        telefono: true,
                                        rol: true,
                                    },
                                    orderBy: { nombres: 'asc' },
                                })];
                        case 1:
                            supervisores = _a.sent();
                            return [2 /*return*/, supervisores.map(function (s) { return ({
                                    id: s.id,
                                    nombre: "".concat(s.nombres, " ").concat(s.apellidos),
                                    correo: s.correo,
                                    telefono: s.telefono,
                                    rol: s.rol,
                                }); })];
                        case 2:
                            error_9 = _a.sent();
                            throw new common_1.InternalServerErrorException('Error al obtener supervisores');
                        case 3: return [2 /*return*/];
                    }
                });
            });
        };
        RoutesService_1.prototype.assignClient = function (rutaId, clienteId, cobradorId) {
            return __awaiter(this, void 0, void 0, function () {
                var ruta, cliente, existingAssignment, maxOrden, nuevoOrden, asignacion, error_10;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 8, , 9]);
                            return [4 /*yield*/, this.prisma.ruta.findUnique({
                                    where: {
                                        id: rutaId,
                                        eliminadoEn: null,
                                        activa: true,
                                    },
                                })];
                        case 1:
                            ruta = _a.sent();
                            if (!ruta) {
                                throw new common_1.NotFoundException('Ruta no encontrada o inactiva');
                            }
                            return [4 /*yield*/, this.prisma.cliente.findUnique({
                                    where: {
                                        id: clienteId,
                                        eliminadoEn: null,
                                    },
                                })];
                        case 2:
                            cliente = _a.sent();
                            if (!cliente) {
                                throw new common_1.NotFoundException('Cliente no encontrado');
                            }
                            return [4 /*yield*/, this.prisma.asignacionRuta.findFirst({
                                    where: {
                                        clienteId: clienteId,
                                        rutaId: rutaId,
                                        activa: true,
                                    },
                                })];
                        case 3:
                            existingAssignment = _a.sent();
                            if (existingAssignment) {
                                throw new common_1.ConflictException('El cliente ya está asignado a esta ruta');
                            }
                            return [4 /*yield*/, this.prisma.asignacionRuta.aggregate({
                                    where: { rutaId: rutaId, activa: true },
                                    _max: { ordenVisita: true },
                                })];
                        case 4:
                            maxOrden = _a.sent();
                            nuevoOrden = (maxOrden._max.ordenVisita || 0) + 1;
                            return [4 /*yield*/, this.prisma.asignacionRuta.create({
                                    data: {
                                        rutaId: rutaId,
                                        clienteId: clienteId,
                                        cobradorId: cobradorId,
                                        ordenVisita: nuevoOrden,
                                        activa: true,
                                    },
                                    include: {
                                        cliente: {
                                            select: {
                                                id: true,
                                                nombres: true,
                                                apellidos: true,
                                                dni: true,
                                                telefono: true,
                                            },
                                        },
                                    },
                                })];
                        case 5:
                            asignacion = _a.sent();
                            if (!cobradorId) return [3 /*break*/, 7];
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: cobradorId,
                                    titulo: 'Nuevo Cliente Asignado',
                                    mensaje: "Se ha asignado el cliente ".concat(asignacion.cliente.nombres, " ").concat(asignacion.cliente.apellidos, " a tu ruta ").concat(ruta.nombre),
                                    tipo: 'CLIENTE',
                                    entidad: 'Cliente',
                                    entidadId: asignacion.clienteId,
                                })];
                        case 6:
                            _a.sent();
                            _a.label = 7;
                        case 7: return [2 /*return*/, asignacion];
                        case 8:
                            error_10 = _a.sent();
                            if (error_10 instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                                if (error_10.code === 'P2003') {
                                    throw new common_1.BadRequestException('Relación inválida');
                                }
                            }
                            throw error_10;
                        case 9: return [2 /*return*/];
                    }
                });
            });
        };
        RoutesService_1.prototype.removeClient = function (rutaId, clienteId) {
            return __awaiter(this, void 0, void 0, function () {
                var asignacion, ruta, cliente, error_11;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 8, , 9]);
                            return [4 /*yield*/, this.prisma.asignacionRuta.findFirst({
                                    where: {
                                        rutaId: rutaId,
                                        clienteId: clienteId,
                                        activa: true,
                                    },
                                })];
                        case 1:
                            asignacion = _a.sent();
                            if (!asignacion) {
                                throw new common_1.NotFoundException('Asignación no encontrada');
                            }
                            // Actualizar el estado de la asignación
                            return [4 /*yield*/, this.prisma.asignacionRuta.update({
                                    where: { id: asignacion.id },
                                    data: { activa: false },
                                })];
                        case 2:
                            // Actualizar el estado de la asignación
                            _a.sent();
                            // Reordenar las asignaciones restantes
                            return [4 /*yield*/, this.reorderAssignments(rutaId)];
                        case 3:
                            // Reordenar las asignaciones restantes
                            _a.sent();
                            return [4 /*yield*/, this.prisma.ruta.findUnique({
                                    where: { id: rutaId },
                                    select: { nombre: true, cobradorId: true },
                                })];
                        case 4:
                            ruta = _a.sent();
                            return [4 /*yield*/, this.prisma.cliente.findUnique({
                                    where: { id: clienteId },
                                    select: { nombres: true, apellidos: true },
                                })];
                        case 5:
                            cliente = _a.sent();
                            if (!(ruta === null || ruta === void 0 ? void 0 : ruta.cobradorId)) return [3 /*break*/, 7];
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: ruta.cobradorId,
                                    titulo: 'Cliente Removido',
                                    mensaje: "El cliente ".concat(cliente === null || cliente === void 0 ? void 0 : cliente.nombres, " ").concat(cliente === null || cliente === void 0 ? void 0 : cliente.apellidos, " ha sido removido de tu ruta ").concat(ruta.nombre),
                                    tipo: 'CLIENTE',
                                })];
                        case 6:
                            _a.sent();
                            _a.label = 7;
                        case 7: return [2 /*return*/, { message: 'Cliente removido de la ruta correctamente' }];
                        case 8:
                            error_11 = _a.sent();
                            throw new common_1.InternalServerErrorException('Error al remover el cliente');
                        case 9: return [2 /*return*/];
                    }
                });
            });
        };
        RoutesService_1.prototype.moveClient = function (clientId, fromRutaId, toRutaId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, rutaOrigen, rutaDestino, asignacionActual, existingInDestination, maxOrdenDestino, cliente, error_12;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 10, , 11]);
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.ruta.findUnique({
                                        where: {
                                            id: fromRutaId,
                                            eliminadoEn: null,
                                        },
                                    }),
                                    this.prisma.ruta.findUnique({
                                        where: {
                                            id: toRutaId,
                                            eliminadoEn: null,
                                        },
                                    }),
                                ])];
                        case 1:
                            _a = _b.sent(), rutaOrigen = _a[0], rutaDestino = _a[1];
                            if (!rutaOrigen || !rutaDestino) {
                                throw new common_1.NotFoundException('Una o ambas rutas no existen');
                            }
                            return [4 /*yield*/, this.prisma.asignacionRuta.findFirst({
                                    where: {
                                        clienteId: clientId,
                                        rutaId: fromRutaId,
                                        activa: true,
                                    },
                                })];
                        case 2:
                            asignacionActual = _b.sent();
                            if (!asignacionActual) {
                                throw new common_1.NotFoundException('El cliente no está asignado a la ruta de origen');
                            }
                            return [4 /*yield*/, this.prisma.asignacionRuta.findFirst({
                                    where: {
                                        clienteId: clientId,
                                        rutaId: toRutaId,
                                        activa: true,
                                    },
                                })];
                        case 3:
                            existingInDestination = _b.sent();
                            if (existingInDestination) {
                                throw new common_1.ConflictException('El cliente ya está asignado a la ruta destino');
                            }
                            return [4 /*yield*/, this.prisma.asignacionRuta.aggregate({
                                    where: { rutaId: toRutaId, activa: true },
                                    _max: { ordenVisita: true },
                                })];
                        case 4:
                            maxOrdenDestino = _b.sent();
                            // Mover el cliente
                            return [4 /*yield*/, this.prisma.$transaction([
                                    // Desactivar la asignación actual
                                    this.prisma.asignacionRuta.update({
                                        where: { id: asignacionActual.id },
                                        data: { activa: false },
                                    }),
                                    // Crear nueva asignación en la ruta destino
                                    this.prisma.asignacionRuta.create({
                                        data: {
                                            rutaId: toRutaId,
                                            clienteId: clientId,
                                            cobradorId: rutaDestino.cobradorId,
                                            ordenVisita: (maxOrdenDestino._max.ordenVisita || 0) + 1,
                                            activa: true,
                                        },
                                    }),
                                ])];
                        case 5:
                            // Mover el cliente
                            _b.sent();
                            // Reordenar ambas rutas
                            return [4 /*yield*/, Promise.all([
                                    this.reorderAssignments(fromRutaId),
                                    this.reorderAssignments(toRutaId),
                                ])];
                        case 6:
                            // Reordenar ambas rutas
                            _b.sent();
                            if (!rutaDestino.cobradorId) return [3 /*break*/, 9];
                            return [4 /*yield*/, this.prisma.cliente.findUnique({
                                    where: { id: clientId },
                                    select: { nombres: true, apellidos: true },
                                })];
                        case 7:
                            cliente = _b.sent();
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: rutaDestino.cobradorId,
                                    titulo: 'Nuevo Cliente Trasladado',
                                    mensaje: "Se ha trasladado al cliente ".concat(cliente === null || cliente === void 0 ? void 0 : cliente.nombres, " ").concat(cliente === null || cliente === void 0 ? void 0 : cliente.apellidos, " a tu ruta ").concat(rutaDestino.nombre),
                                    tipo: 'CLIENTE',
                                })];
                        case 8:
                            _b.sent();
                            _b.label = 9;
                        case 9: return [2 /*return*/, { message: 'Cliente movido correctamente' }];
                        case 10:
                            error_12 = _b.sent();
                            throw new common_1.InternalServerErrorException('Error al mover el cliente');
                        case 11: return [2 /*return*/];
                    }
                });
            });
        };
        /**
      
         * Mueve un crédito específico de un cliente a otra ruta.
      
         * Como la asignación es por cliente, esto crea una nueva asignación del cliente
      
         * en la ruta destino sin eliminar la original, permitiendo que el cliente
      
         * aparezca en rutas distintas según el tipo/frecuencia de cada crédito.
      
         */
        RoutesService_1.prototype.moveLoan = function (prestamoId, toRutaId) {
            return __awaiter(this, void 0, void 0, function () {
                var prestamo, rutaDestino, yaAsignado, maxOrden, cliente, error_13;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 9, , 10]);
                            return [4 /*yield*/, this.prisma.prestamo.findUnique({
                                    where: { id: prestamoId },
                                    select: { id: true, clienteId: true, frecuenciaPago: true, estado: true },
                                })];
                        case 1:
                            prestamo = _a.sent();
                            if (!prestamo)
                                throw new common_1.NotFoundException('Préstamo no encontrado');
                            return [4 /*yield*/, this.prisma.ruta.findUnique({
                                    where: { id: toRutaId, eliminadoEn: null },
                                })];
                        case 2:
                            rutaDestino = _a.sent();
                            if (!rutaDestino)
                                throw new common_1.NotFoundException('Ruta destino no encontrada');
                            return [4 /*yield*/, this.prisma.asignacionRuta.findFirst({
                                    where: { clienteId: prestamo.clienteId, rutaId: toRutaId, activa: true },
                                })];
                        case 3:
                            yaAsignado = _a.sent();
                            if (yaAsignado) {
                                return [2 /*return*/, { message: 'El cliente ya está asignado a esa ruta' }];
                            }
                            return [4 /*yield*/, this.prisma.asignacionRuta.aggregate({
                                    where: { rutaId: toRutaId, activa: true },
                                    _max: { ordenVisita: true },
                                })];
                        case 4:
                            maxOrden = _a.sent();
                            return [4 /*yield*/, this.prisma.asignacionRuta.create({
                                    data: {
                                        rutaId: toRutaId,
                                        clienteId: prestamo.clienteId,
                                        cobradorId: rutaDestino.cobradorId,
                                        ordenVisita: (maxOrden._max.ordenVisita || 0) + 1,
                                        activa: true,
                                    },
                                })];
                        case 5:
                            _a.sent();
                            this.notificacionesGateway.broadcastRutasActualizadas({
                                accion: 'ACTUALIZAR',
                                rutaId: toRutaId,
                            });
                            if (!rutaDestino.cobradorId) return [3 /*break*/, 8];
                            return [4 /*yield*/, this.prisma.cliente.findUnique({
                                    where: { id: prestamo.clienteId },
                                    select: { nombres: true, apellidos: true },
                                })];
                        case 6:
                            cliente = _a.sent();
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: rutaDestino.cobradorId,
                                    titulo: 'Nuevo Crédito en Ruta',
                                    mensaje: "Se ha asignado un nuevo cr\u00E9dito del cliente ".concat(cliente === null || cliente === void 0 ? void 0 : cliente.nombres, " ").concat(cliente === null || cliente === void 0 ? void 0 : cliente.apellidos, " a tu ruta ").concat(rutaDestino.nombre),
                                    tipo: 'PRESTAMO',
                                })];
                        case 7:
                            _a.sent();
                            _a.label = 8;
                        case 8: return [2 /*return*/, { message: 'Crédito asignado a la nueva ruta correctamente' }];
                        case 9:
                            error_13 = _a.sent();
                            if (error_13 instanceof common_1.NotFoundException)
                                throw error_13;
                            throw new common_1.InternalServerErrorException('Error al mover el crédito');
                        case 10: return [2 /*return*/];
                    }
                });
            });
        };
        RoutesService_1.prototype.reorderAssignments = function (rutaId) {
            return __awaiter(this, void 0, void 0, function () {
                var asignaciones, updates, error_14;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            return [4 /*yield*/, this.prisma.asignacionRuta.findMany({
                                    where: { rutaId: rutaId, activa: true },
                                    orderBy: { ordenVisita: 'asc' },
                                })];
                        case 1:
                            asignaciones = _a.sent();
                            updates = asignaciones.map(function (asignacion, index) {
                                return _this.prisma.asignacionRuta.update({
                                    where: { id: asignacion.id },
                                    data: { ordenVisita: index + 1 },
                                });
                            });
                            return [4 /*yield*/, this.prisma.$transaction(updates)];
                        case 2:
                            _a.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            error_14 = _a.sent();
                            throw new common_1.InternalServerErrorException('Error al reordenar asignaciones');
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        /**
      
         * Obtener visitas del día para una ruta
      
         * Calcula qué clientes deben aparecer hoy según frecuencia de pago y estado de cuotas
      
         */
        RoutesService_1.prototype.getDailyVisits = function (rutaId, fecha) {
            return __awaiter(this, void 0, void 0, function () {
                var fechaConsulta, asignaciones, visitasDelDia, clientesProcesados, _i, asignaciones_2, asignacion, cliente, debeAparecerHoy, _a, _b, prestamo, fechaInicioPrestamo, proximaCuota, fechaEfectiva, diasHastaVencimiento;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            fechaConsulta = fecha ? new Date(fecha) : new Date();
                            fechaConsulta.setHours(0, 0, 0, 0);
                            return [4 /*yield*/, this.prisma.asignacionRuta.findMany({
                                    where: {
                                        rutaId: rutaId,
                                        activa: true,
                                    },
                                    include: {
                                        cliente: {
                                            include: {
                                                prestamos: {
                                                    where: {
                                                        estado: { in: ['ACTIVO', 'EN_MORA'] },
                                                    },
                                                    include: {
                                                        cuotas: {
                                                            where: {
                                                                estado: { in: ['PENDIENTE', 'VENCIDA', 'PARCIAL', 'PRORROGADA'] },
                                                            },
                                                            orderBy: { fechaVencimiento: 'asc' },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    orderBy: { ordenVisita: 'asc' },
                                })];
                        case 1:
                            asignaciones = _c.sent();
                            visitasDelDia = [];
                            clientesProcesados = new Set();
                            for (_i = 0, asignaciones_2 = asignaciones; _i < asignaciones_2.length; _i++) {
                                asignacion = asignaciones_2[_i];
                                cliente = asignacion.cliente;
                                // Si el cliente ya fue agregado a la lista de hoy (evitar duplicados por múltiples asignaciones)
                                if (clientesProcesados.has(cliente.id))
                                    continue;
                                debeAparecerHoy = false;
                                // Revisar cada préstamo activo
                                for (_a = 0, _b = cliente.prestamos; _a < _b.length; _a++) {
                                    prestamo = _b[_a];
                                    fechaInicioPrestamo = new Date(prestamo.fechaInicio);
                                    fechaInicioPrestamo.setHours(0, 0, 0, 0);
                                    // Si el préstamo inicia hoy, debe aparecer hoy para empezar a cobrar.
                                    if (fechaInicioPrestamo.getTime() === fechaConsulta.getTime()) {
                                        debeAparecerHoy = true;
                                        break;
                                    }
                                    if (prestamo.cuotas.length === 0)
                                        continue;
                                    proximaCuota = prestamo.cuotas[0];
                                    fechaEfectiva = proximaCuota.estado === 'PRORROGADA' && proximaCuota.fechaVencimientoProrroga
                                        ? new Date(proximaCuota.fechaVencimientoProrroga)
                                        : new Date(proximaCuota.fechaVencimiento);
                                    fechaEfectiva.setHours(0, 0, 0, 0);
                                    // Si la cuota está vencida o prorrogada expirada, siempre aparece
                                    if (fechaEfectiva <= fechaConsulta) {
                                        debeAparecerHoy = true;
                                        break;
                                    }
                                    diasHastaVencimiento = Math.ceil((fechaEfectiva.getTime() - fechaConsulta.getTime()) /
                                        (1000 * 60 * 60 * 24));
                                    switch (prestamo.frecuenciaPago) {
                                        case 'DIARIO':
                                            // Aparece todos los días si tiene cuota pendiente
                                            if (diasHastaVencimiento <= 1)
                                                debeAparecerHoy = true;
                                            break;
                                        case 'SEMANAL':
                                            // Aparece 1 día antes del vencimiento
                                            if (diasHastaVencimiento <= 1)
                                                debeAparecerHoy = true;
                                            break;
                                        case 'QUINCENAL':
                                            // Aparece 1 día antes del vencimiento
                                            if (diasHastaVencimiento <= 1)
                                                debeAparecerHoy = true;
                                            break;
                                        case 'MENSUAL':
                                            // Aparece 2 días antes del vencimiento
                                            if (diasHastaVencimiento <= 2)
                                                debeAparecerHoy = true;
                                            break;
                                    }
                                    if (debeAparecerHoy)
                                        break;
                                }
                                if (debeAparecerHoy) {
                                    visitasDelDia.push({
                                        asignacionId: asignacion.id,
                                        ordenVisita: asignacion.ordenVisita,
                                        cliente: {
                                            id: cliente.id,
                                            codigo: cliente.codigo,
                                            dni: cliente.dni,
                                            nombres: cliente.nombres,
                                            apellidos: cliente.apellidos,
                                            telefono: cliente.telefono,
                                            direccion: cliente.direccion,
                                            nivelRiesgo: cliente.nivelRiesgo,
                                            prestamosActivos: cliente.prestamos.length,
                                        },
                                        prestamos: cliente.prestamos.map(function (p) { return ({
                                            id: p.id,
                                            numeroPrestamo: p.numeroPrestamo,
                                            monto: Number(p.monto),
                                            saldoPendiente: Number(p.saldoPendiente),
                                            frecuenciaPago: p.frecuenciaPago,
                                            cantidadCuotas: p.cantidadCuotas,
                                            estado: p.estado,
                                            proximaCuota: p.cuotas[0]
                                                ? {
                                                    numeroCuota: p.cuotas[0].numeroCuota,
                                                    fechaVencimiento: (p.cuotas[0].estado === 'PRORROGADA' && p.cuotas[0].fechaVencimientoProrroga
                                                        ? p.cuotas[0].fechaVencimientoProrroga
                                                        : p.cuotas[0].fechaVencimiento),
                                                    monto: Number(p.cuotas[0].monto),
                                                    estado: p.cuotas[0].estado,
                                                    enProrroga: p.cuotas[0].estado === 'PRORROGADA',
                                                    fechaOriginalVencimiento: p.cuotas[0].estado === 'PRORROGADA'
                                                        ? p.cuotas[0].fechaVencimiento
                                                        : undefined,
                                                }
                                                : null,
                                        }); }),
                                    });
                                    clientesProcesados.add(cliente.id);
                                }
                            }
                            return [2 /*return*/, {
                                    fecha: fechaConsulta.toISOString(),
                                    rutaId: rutaId,
                                    totalVisitas: visitasDelDia.length,
                                    visitas: visitasDelDia,
                                }];
                    }
                });
            });
        };
        /**
      
         * Actualizar orden de clientes en una ruta (para drag & drop)
      
         */
        RoutesService_1.prototype.updateClientOrder = function (rutaId, reorderData) {
            return __awaiter(this, void 0, void 0, function () {
                var ruta, updates, error_15;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            return [4 /*yield*/, this.prisma.ruta.findUnique({
                                    where: { id: rutaId },
                                })];
                        case 1:
                            ruta = _a.sent();
                            if (!ruta) {
                                throw new common_1.NotFoundException('Ruta no encontrada');
                            }
                            updates = reorderData.map(function (item) {
                                return _this.prisma.asignacionRuta.updateMany({
                                    where: {
                                        rutaId: rutaId,
                                        clienteId: item.clienteId,
                                        activa: true,
                                    },
                                    data: {
                                        ordenVisita: item.orden,
                                    },
                                });
                            });
                            return [4 /*yield*/, this.prisma.$transaction(updates)];
                        case 2:
                            _a.sent();
                            return [2 /*return*/, {
                                    message: 'Orden actualizado correctamente',
                                    totalActualizados: reorderData.length,
                                }];
                        case 3:
                            error_15 = _a.sent();
                            if (error_15 instanceof common_1.NotFoundException) {
                                throw error_15;
                            }
                            throw new common_1.InternalServerErrorException('Error al actualizar el orden de clientes');
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        /**
      
         * Exportar ruta completa como Excel (.xlsx) o PDF
      
         * Incluye: datos del cobrador, todos los clientes con sus préstamos activos,
      
         * semáforo de mora, cuota próxima, saldo y columna "Cobrado" vacía para campo.
      
         */
        RoutesService_1.prototype.exportarRuta = function (rutaId, formato) {
            return __awaiter(this, void 0, void 0, function () {
                var ruta, hoy, filas, nro, _i, _a, asig, c, prestamosActivos, _b, prestamosActivos_1, p, proxCuota, diasMora, fechaVenc, semaforo, fechaExport, cobradorNombre, totalSaldo, totalCuota, enMora, fechaArchivo, meta, filasTpl, out_1, out;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: return [4 /*yield*/, this.prisma.ruta.findFirst({
                                where: { id: rutaId, eliminadoEn: null },
                                include: {
                                    cobrador: { select: { nombres: true, apellidos: true, telefono: true } },
                                    supervisor: { select: { nombres: true, apellidos: true } },
                                    asignaciones: {
                                        where: { activa: true },
                                        orderBy: { ordenVisita: 'asc' },
                                        include: {
                                            cliente: {
                                                select: {
                                                    nombres: true,
                                                    apellidos: true,
                                                    dni: true,
                                                    telefono: true,
                                                    direccion: true,
                                                    prestamos: {
                                                        where: { estado: { in: ['ACTIVO', 'EN_MORA'] }, eliminadoEn: null },
                                                        orderBy: { creadoEn: 'asc' },
                                                        select: {
                                                            id: true,
                                                            numeroPrestamo: true,
                                                            monto: true,
                                                            saldoPendiente: true,
                                                            estado: true,
                                                            frecuenciaPago: true,
                                                            cuotas: {
                                                                where: { estado: { in: ['PENDIENTE', 'VENCIDA', 'PARCIAL', 'PRORROGADA'] } },
                                                                orderBy: { numeroCuota: 'asc' },
                                                                take: 1,
                                                                select: { monto: true, fechaVencimiento: true, estado: true },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            })];
                        case 1:
                            ruta = _c.sent();
                            if (!ruta)
                                throw new common_1.NotFoundException('Ruta no encontrada');
                            hoy = new Date();
                            hoy.setHours(0, 0, 0, 0);
                            filas = [];
                            nro = 1;
                            for (_i = 0, _a = ruta.asignaciones; _i < _a.length; _i++) {
                                asig = _a[_i];
                                c = asig.cliente;
                                prestamosActivos = c.prestamos;
                                if (prestamosActivos.length === 0) {
                                    // Cliente sin préstamo activo — incluir igualmente con datos vacios
                                    filas.push({
                                        nro: nro++,
                                        cliente: "".concat(c.nombres, " ").concat(c.apellidos),
                                        cc: c.dni,
                                        telefono: c.telefono || '—',
                                        direccion: c.direccion || '—',
                                        numeroPrestamo: '—',
                                        cuota: 0,
                                        fechaCuota: '—',
                                        saldo: 0,
                                        estadoPrestamo: 'SIN_PRESTAMO',
                                        diasMora: 0,
                                        semaforo: 'VERDE',
                                    });
                                    continue;
                                }
                                for (_b = 0, prestamosActivos_1 = prestamosActivos; _b < prestamosActivos_1.length; _b++) {
                                    p = prestamosActivos_1[_b];
                                    proxCuota = p.cuotas[0];
                                    diasMora = 0;
                                    if (proxCuota) {
                                        fechaVenc = new Date(proxCuota.fechaVencimiento);
                                        fechaVenc.setHours(0, 0, 0, 0);
                                        if (fechaVenc < hoy) {
                                            diasMora = Math.floor((hoy.getTime() - fechaVenc.getTime()) / 86400000);
                                        }
                                    }
                                    semaforo = 'VERDE';
                                    if (diasMora > 7 || p.estado === 'EN_MORA')
                                        semaforo = 'ROJO';
                                    else if (diasMora > 0)
                                        semaforo = 'AMARILLO';
                                    filas.push({
                                        nro: nro++,
                                        cliente: "".concat(c.nombres, " ").concat(c.apellidos),
                                        cc: c.dni,
                                        telefono: c.telefono || '—',
                                        direccion: c.direccion || '—',
                                        numeroPrestamo: p.numeroPrestamo,
                                        cuota: proxCuota ? Number(proxCuota.monto) : 0,
                                        fechaCuota: proxCuota
                                            ? new Date(proxCuota.fechaVencimiento).toLocaleDateString('es-CO')
                                            : '—',
                                        saldo: Number(p.saldoPendiente),
                                        estadoPrestamo: p.estado,
                                        diasMora: diasMora,
                                        semaforo: semaforo,
                                    });
                                }
                            }
                            fechaExport = new Date().toLocaleDateString('es-CO', {
                                day: '2-digit', month: 'long', year: 'numeric',
                            });
                            cobradorNombre = "".concat(ruta.cobrador.nombres, " ").concat(ruta.cobrador.apellidos);
                            totalSaldo = filas.reduce(function (s, f) { return s + f.saldo; }, 0);
                            totalCuota = filas.reduce(function (s, f) { return s + f.cuota; }, 0);
                            enMora = filas.filter(function (f) { return f.semaforo === 'ROJO'; }).length;
                            fechaArchivo = new Date().toISOString().slice(0, 10);
                            meta = {
                                rutaNombre: ruta.nombre,
                                rutaCodigo: ruta.codigo,
                                cobradorNombre: cobradorNombre,
                                fechaExport: fechaExport,
                                totalClientes: ruta.asignaciones.length,
                                enMora: enMora,
                                totalCuota: totalCuota,
                                totalSaldo: totalSaldo,
                            };
                            filasTpl = filas.map(function (f) { return ({
                                nro: f.nro,
                                cliente: f.cliente,
                                cc: f.cc,
                                telefono: f.telefono,
                                direccion: f.direccion,
                                numeroPrestamo: f.numeroPrestamo,
                                cuota: f.cuota,
                                fechaCuota: f.fechaCuota,
                                saldo: f.saldo,
                                estadoPrestamo: f.estadoPrestamo,
                                diasMora: f.diasMora,
                                semaforo: f.semaforo,
                            }); });
                            if (!(formato === 'excel')) return [3 /*break*/, 3];
                            return [4 /*yield*/, (0, exports_1.generarExcelRutaCobrador)(filasTpl, meta, fechaArchivo)];
                        case 2:
                            out_1 = _c.sent();
                            return [2 /*return*/, out_1.data];
                        case 3: return [4 /*yield*/, (0, exports_1.generarPDFRutaCobrador)(filasTpl, meta, fechaArchivo)];
                        case 4:
                            out = _c.sent();
                            return [2 /*return*/, out.data];
                    }
                });
            });
        };
        return RoutesService_1;
    }());
    __setFunctionName(_classThis, "RoutesService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        RoutesService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return RoutesService = _classThis;
}();
exports.RoutesService = RoutesService;
