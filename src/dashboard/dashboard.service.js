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
exports.DashboardService = void 0;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var DashboardService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var DashboardService = _classThis = /** @class */ (function () {
        function DashboardService_1(prisma) {
            this.prisma = prisma;
            this.logger = new common_1.Logger(DashboardService.name);
        }
        DashboardService_1.prototype.getDashboardData = function (timeFilter) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, startDate, endDate, pendingApprovals, delinquentAccounts, _requestedBaseResult, totalLoans, paidLoans, efficiency, capitalPrestado, recaudo, totalPagos, pendingApprovalsList, delinquentAccountsList, recentActivityList, trendData, topCollectorsRaw, topCollectorsList, _i, topCollectorsRaw_1, item, user, metaCobroRes, montoMeta, collected, efficiency_1, result, error_1;
                var _this = this;
                var _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            _d.trys.push([0, 20, , 21]);
                            _a = this.calculateDateRangeFromFilter(timeFilter), startDate = _a.startDate, endDate = _a.endDate;
                            return [4 /*yield*/, this.prisma.aprobacion.count({
                                    where: {
                                        estado: client_1.EstadoAprobacion.PENDIENTE,
                                        creadoEn: { gte: startDate, lte: endDate },
                                    },
                                })];
                        case 1:
                            pendingApprovals = _d.sent();
                            return [4 /*yield*/, this.prisma.prestamo.count({
                                    where: {
                                        estado: client_1.EstadoPrestamo.EN_MORA,
                                        eliminadoEn: null,
                                    },
                                })];
                        case 2:
                            delinquentAccounts = _d.sent();
                            return [4 /*yield*/, this.prisma.aprobacion.aggregate({
                                    where: {
                                        estado: client_1.EstadoAprobacion.PENDIENTE,
                                        tipoAprobacion: client_1.TipoAprobacion.SOLICITUD_BASE_EFECTIVO,
                                        creadoEn: { gte: startDate, lte: endDate },
                                    },
                                    _sum: {
                                        montoSolicitud: true,
                                    },
                                })];
                        case 3:
                            _requestedBaseResult = _d.sent();
                            return [4 /*yield*/, this.prisma.prestamo.count({
                                    where: {
                                        estado: {
                                            in: [
                                                client_1.EstadoPrestamo.ACTIVO,
                                                client_1.EstadoPrestamo.PAGADO,
                                                client_1.EstadoPrestamo.EN_MORA,
                                            ],
                                        },
                                        creadoEn: { gte: startDate, lte: endDate },
                                    },
                                })];
                        case 4:
                            totalLoans = _d.sent();
                            return [4 /*yield*/, this.prisma.prestamo.count({
                                    where: {
                                        estado: client_1.EstadoPrestamo.PAGADO,
                                        creadoEn: { gte: startDate, lte: endDate },
                                    },
                                })];
                        case 5:
                            paidLoans = _d.sent();
                            efficiency = totalLoans > 0 ? (paidLoans / totalLoans) * 100 : 0;
                            return [4 /*yield*/, this.prisma.prestamo.aggregate({
                                    where: {
                                        creadoEn: { gte: startDate, lte: endDate },
                                        eliminadoEn: null,
                                    },
                                    _sum: {
                                        monto: true,
                                    },
                                })];
                        case 6:
                            capitalPrestado = _d.sent();
                            return [4 /*yield*/, this.prisma.pago.aggregate({
                                    where: {
                                        fechaPago: { gte: startDate, lte: endDate },
                                    },
                                    _sum: {
                                        montoTotal: true,
                                    },
                                })];
                        case 7:
                            recaudo = _d.sent();
                            return [4 /*yield*/, this.prisma.pago.count({
                                    where: { fechaPago: { gte: startDate, lte: endDate } },
                                })];
                        case 8:
                            totalPagos = _d.sent();
                            return [4 /*yield*/, this.prisma.aprobacion.findMany({
                                    where: {
                                        estado: client_1.EstadoAprobacion.PENDIENTE,
                                        creadoEn: { gte: startDate, lte: endDate },
                                    },
                                    include: {
                                        solicitadoPor: {
                                            select: {
                                                nombres: true,
                                                apellidos: true,
                                            },
                                        },
                                    },
                                    orderBy: { creadoEn: 'desc' },
                                    take: 5,
                                })];
                        case 9:
                            pendingApprovalsList = _d.sent();
                            return [4 /*yield*/, this.prisma.prestamo.findMany({
                                    where: {
                                        estado: client_1.EstadoPrestamo.EN_MORA,
                                        eliminadoEn: null,
                                    },
                                    include: {
                                        cliente: {
                                            select: {
                                                nombres: true,
                                                apellidos: true,
                                                asignacionesRuta: {
                                                    where: { activa: true },
                                                    include: {
                                                        ruta: { select: { nombre: true } },
                                                        cobrador: { select: { nombres: true, apellidos: true } }
                                                    },
                                                    take: 1
                                                }
                                            },
                                        },
                                        cuotas: {
                                            where: { estado: client_1.EstadoCuota.VENCIDA },
                                            orderBy: { fechaVencimiento: 'desc' },
                                            take: 1,
                                        },
                                    },
                                    take: 10,
                                })];
                        case 10:
                            delinquentAccountsList = _d.sent();
                            return [4 /*yield*/, this.prisma.aprobacion.findMany({
                                    where: {
                                        estado: { in: [client_1.EstadoAprobacion.APROBADO, client_1.EstadoAprobacion.RECHAZADO] },
                                        actualizadoEn: { gte: startDate, lte: endDate },
                                    },
                                    include: {
                                        solicitadoPor: {
                                            select: {
                                                nombres: true,
                                                apellidos: true,
                                            },
                                        },
                                    },
                                    orderBy: { actualizadoEn: 'desc' },
                                    take: 5,
                                })];
                        case 11:
                            recentActivityList = _d.sent();
                            return [4 /*yield*/, this.getTrendData(timeFilter)];
                        case 12:
                            trendData = _d.sent();
                            return [4 /*yield*/, this.prisma.pago.groupBy({
                                    by: ['cobradorId'],
                                    _sum: {
                                        montoTotal: true,
                                    },
                                    where: {
                                        fechaPago: { gte: startDate, lte: endDate },
                                    },
                                    orderBy: {
                                        _sum: {
                                            montoTotal: 'desc',
                                        },
                                    },
                                    take: 10, // Traemos extra para filtrar
                                })];
                        case 13:
                            topCollectorsRaw = _d.sent();
                            topCollectorsList = [];
                            _i = 0, topCollectorsRaw_1 = topCollectorsRaw;
                            _d.label = 14;
                        case 14:
                            if (!(_i < topCollectorsRaw_1.length)) return [3 /*break*/, 19];
                            item = topCollectorsRaw_1[_i];
                            if (!item.cobradorId)
                                return [3 /*break*/, 18];
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: { id: item.cobradorId },
                                    select: { nombres: true, apellidos: true, rol: true },
                                })];
                        case 15:
                            user = _d.sent();
                            if (!(user && ['COBRADOR', 'SUPERVISOR', 'COORDINADOR'].includes(user.rol))) return [3 /*break*/, 17];
                            return [4 /*yield*/, this.prisma.cuota.aggregate({
                                    where: {
                                        fechaVencimiento: { gte: startDate, lte: endDate },
                                        prestamo: {
                                            cliente: {
                                                asignacionesRuta: {
                                                    some: {
                                                        cobradorId: item.cobradorId,
                                                        activa: true
                                                    }
                                                }
                                            }
                                        }
                                    },
                                    _sum: { monto: true }
                                })];
                        case 16:
                            metaCobroRes = _d.sent();
                            montoMeta = Number(metaCobroRes._sum.monto || 0);
                            collected = Number(item._sum.montoTotal || 0);
                            efficiency_1 = montoMeta > 0
                                ? Math.min(100, (collected / montoMeta) * 100)
                                : (collected > 0 ? 100 : 0);
                            topCollectorsList.push({
                                name: "".concat(user.nombres, " ").concat(user.apellidos),
                                collected: collected,
                                efficiency: parseFloat(efficiency_1.toFixed(1)),
                                trend: efficiency_1 >= 90 ? 'up' : 'down',
                            });
                            _d.label = 17;
                        case 17:
                            if (topCollectorsList.length >= 5)
                                return [3 /*break*/, 19];
                            _d.label = 18;
                        case 18:
                            _i++;
                            return [3 /*break*/, 14];
                        case 19:
                            result = {
                                metrics: {
                                    pendingApprovals: pendingApprovals,
                                    delinquentAccounts: delinquentAccounts,
                                    requestedBase: this.calculateRequestedBase(pendingApprovalsList),
                                    efficiency: parseFloat(efficiency.toFixed(1)),
                                    capitalPrestado: Number(((_b = capitalPrestado._sum) === null || _b === void 0 ? void 0 : _b.monto) || 0),
                                    recaudo: Number(((_c = recaudo._sum) === null || _c === void 0 ? void 0 : _c.montoTotal) || 0),
                                    totalPagos: totalPagos,
                                },
                                trend: trendData,
                                pendingApprovals: pendingApprovalsList.map(function (item) {
                                    return _this.mapApproval(item);
                                }),
                                delinquentAccounts: delinquentAccountsList.map(function (item) {
                                    return _this.mapDelinquentAccount(item);
                                }),
                                recentActivity: recentActivityList.map(function (item) {
                                    return _this.mapRecentActivity(item);
                                }),
                                topCollectors: topCollectorsList,
                            };
                            return [2 /*return*/, result];
                        case 20:
                            error_1 = _d.sent();
                            this.logger.error('Error obteniendo datos del dashboard', error_1 instanceof Error ? error_1.stack : error_1);
                            // Retornar datos de fallback en caso de error
                            return [2 /*return*/, {
                                    metrics: {
                                        pendingApprovals: 0,
                                        delinquentAccounts: 0,
                                        requestedBase: 0,
                                        efficiency: 0,
                                        capitalPrestado: 0,
                                        recaudo: 0,
                                    },
                                    trend: [],
                                    pendingApprovals: [],
                                    delinquentAccounts: [],
                                    recentActivity: [],
                                    topCollectors: [],
                                }];
                        case 21: return [2 /*return*/];
                    }
                });
            });
        };
        DashboardService_1.prototype.calculateRequestedBase = function (approvals) {
            var total = 0;
            approvals.forEach(function (approval) {
                if (approval.tipoAprobacion === 'SOLICITUD_BASE_EFECTIVO' &&
                    approval.datosSolicitud) {
                    try {
                        var data = typeof approval.datosSolicitud === 'string'
                            ? JSON.parse(approval.datosSolicitud)
                            : approval.datosSolicitud;
                        total += data.monto || 0;
                    }
                    catch (error) {
                        // Error parsing datosSolicitud, continuar con siguiente
                    }
                }
            });
            return total;
        };
        DashboardService_1.prototype.getTrendData = function (timeFilter) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, startDate, endDate, today, groupBy, payments, thirtyDaysAgo, historicalPayments, totalHistorical, dailyTarget, weeklyTarget, processedData, error_2;
                var _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _c.trys.push([0, 3, , 4]);
                            _a = this.calculateDateRangeFromFilter(timeFilter), startDate = _a.startDate, endDate = _a.endDate;
                            today = new Date();
                            groupBy = 'day';
                            // Determinar cómo agrupar según el filtro de período
                            switch (timeFilter) {
                                case 'today':
                                    groupBy = 'day';
                                    break;
                                case 'week':
                                    groupBy = 'day';
                                    break;
                                case 'month':
                                    groupBy = 'day';
                                    break;
                                case 'year':
                                    groupBy = 'month'; // Año → agrupa por mes (12 barras)
                                    break;
                                default:
                                    groupBy = 'day';
                            }
                            return [4 /*yield*/, this.prisma.pago.groupBy({
                                    by: ['fechaPago'],
                                    where: {
                                        fechaPago: {
                                            gte: startDate,
                                            lte: endDate,
                                        },
                                    },
                                    _sum: {
                                        montoTotal: true,
                                    },
                                    orderBy: {
                                        fechaPago: 'asc',
                                    },
                                })];
                        case 1:
                            payments = _c.sent();
                            thirtyDaysAgo = new Date(today);
                            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                            return [4 /*yield*/, this.prisma.pago.aggregate({
                                    where: {
                                        fechaPago: {
                                            gte: thirtyDaysAgo,
                                            lte: today,
                                        },
                                    },
                                    _sum: {
                                        montoTotal: true,
                                    },
                                })];
                        case 2:
                            historicalPayments = _c.sent();
                            totalHistorical = Number(((_b = historicalPayments._sum) === null || _b === void 0 ? void 0 : _b.montoTotal) || 0);
                            dailyTarget = Math.round(totalHistorical / 30);
                            weeklyTarget = dailyTarget * 7;
                            processedData = this.processTrendData(payments, startDate, endDate, groupBy, dailyTarget, weeklyTarget);
                            return [2 /*return*/, processedData];
                        case 3:
                            error_2 = _c.sent();
                            // En caso de error, devolver datos de muestra
                            return [2 /*return*/, []];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        DashboardService_1.prototype.processTrendData = function (payments, startDate, endDate, groupBy, dailyTarget, weeklyTarget) {
            var _a;
            var result = [];
            if (groupBy === 'day') {
                // Agrupar por día
                var daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                var daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
                // Limitar a máximo 30 días para evitar sobrecarga, pero asegurar que incluya todos los días del período
                var maxDays = Math.min(daysDiff, 30);
                var _loop_1 = function (i) {
                    var currentDate = new Date(startDate);
                    currentDate.setDate(startDate.getDate() + i);
                    // No procesar días futuros
                    if (currentDate > endDate)
                        return "break";
                    var dayStart = new Date(currentDate);
                    dayStart.setHours(0, 0, 0, 0);
                    var dayEnd = new Date(currentDate);
                    dayEnd.setHours(23, 59, 59, 999);
                    var dayPayments = payments.filter(function (p) {
                        var paymentDate = new Date(p.fechaPago);
                        return paymentDate >= dayStart && paymentDate <= dayEnd;
                    });
                    var total = dayPayments.reduce(function (sum, p) { var _a; return sum + parseFloat(((_a = p._sum.montoTotal) === null || _a === void 0 ? void 0 : _a.toString()) || '0'); }, 0);
                    // Crear etiqueta más descriptiva: día de semana + fecha
                    var dayName = daysOfWeek[currentDate.getDay()];
                    var dayNumber = currentDate.getDate();
                    var monthName = currentDate.toLocaleDateString('es-CO', { month: 'short' });
                    var label = "".concat(dayName, " ").concat(dayNumber, "/").concat(monthName);
                    result.push({
                        label: label,
                        value: total,
                        target: dailyTarget,
                    });
                };
                for (var i = 0; i <= maxDays; i++) {
                    var state_1 = _loop_1(i);
                    if (state_1 === "break")
                        break;
                }
            }
            else if (groupBy === 'week') {
                // Agrupar por semana
                var weeksDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
                var weekLabels = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'];
                var _loop_2 = function (i) {
                    var weekStart = new Date(startDate);
                    weekStart.setDate(startDate.getDate() + i * 7);
                    var weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekStart.getDate() + 6);
                    weekEnd.setHours(23, 59, 59, 999);
                    var weekPayments = payments.filter(function (p) {
                        var paymentDate = new Date(p.fechaPago);
                        return paymentDate >= weekStart && paymentDate <= weekEnd;
                    });
                    var total = weekPayments.reduce(function (sum, p) { var _a; return sum + parseFloat(((_a = p._sum.montoTotal) === null || _a === void 0 ? void 0 : _a.toString()) || '0'); }, 0);
                    result.push({
                        label: weekLabels[i],
                        value: total,
                        target: weeklyTarget,
                    });
                };
                for (var i = 0; i <= weeksDiff && i < 4; i++) {
                    _loop_2(i);
                }
            }
            else if (groupBy === 'month') {
                // Agrupar pagos por mes (YYYY-MM)
                var monthMap = new Map();
                for (var _i = 0, payments_1 = payments; _i < payments_1.length; _i++) {
                    var payment = payments_1[_i];
                    var date = new Date(payment.fechaPago);
                    var key = "".concat(date.getFullYear(), "-").concat(String(date.getMonth() + 1).padStart(2, '0'));
                    var total = parseFloat(((_a = payment._sum.montoTotal) === null || _a === void 0 ? void 0 : _a.toString()) || '0');
                    monthMap.set(key, (monthMap.get(key) || 0) + total);
                }
                // Generar puntos de tendencia por mes dentro del rango
                var current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
                current.setHours(0, 0, 0, 0);
                while (current <= endDate) {
                    var key = "".concat(current.getFullYear(), "-").concat(String(current.getMonth() + 1).padStart(2, '0'));
                    var total = monthMap.get(key) || 0;
                    var monthName = current.toLocaleDateString('es-CO', {
                        month: 'short',
                    });
                    var label = "".concat(monthName, " ").concat(current.getFullYear());
                    result.push({
                        label: label,
                        value: total,
                        // Para rangos largos usamos la meta semanal como referencia aproximada
                        target: weeklyTarget,
                    });
                    // Avanzar al siguiente mes
                    current.setMonth(current.getMonth() + 1);
                }
            }
            return result;
        };
        DashboardService_1.prototype.getSampleTrendData = function () {
            // Devolvemos array vacío para evitar datos ficticios en producción
            return [];
        };
        DashboardService_1.prototype.mapApproval = function (approval) {
            return {
                id: approval.id,
                type: this.mapApprovalType(approval.tipoAprobacion),
                description: this.getApprovalDescription(approval.tipoAprobacion),
                requestedBy: "".concat(approval.solicitadoPor.nombres, " ").concat(approval.solicitadoPor.apellidos),
                time: new Date(approval.creadoEn).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                }),
                details: this.getApprovalDetails(approval),
                status: 'pending',
                priority: this.determinePriority(approval.tipoAprobacion),
                amount: this.extractAmountFromApproval(approval),
            };
        };
        DashboardService_1.prototype.mapApprovalType = function (tipo) {
            var map = {
                NUEVO_CLIENTE: 'cliente',
                NUEVO_PRESTAMO: 'credito',
                GASTO: 'gasto',
                SOLICITUD_BASE_EFECTIVO: 'base-dinero',
                PRORROGA_PAGO: 'prorroga',
            };
            return map[tipo] || 'cliente';
        };
        DashboardService_1.prototype.getApprovalDescription = function (tipo) {
            var map = {
                NUEVO_CLIENTE: 'Nuevo cliente',
                NUEVO_PRESTAMO: 'Solicitud de crédito',
                GASTO: 'Gasto operativo',
                SOLICITUD_BASE_EFECTIVO: 'Base de efectivo',
                PRORROGA_PAGO: 'Prórroga de cuota',
            };
            return map[tipo] || 'Aprobación pendiente';
        };
        DashboardService_1.prototype.getApprovalDetails = function (approval) {
            try {
                var data = typeof approval.datosSolicitud === 'string'
                    ? JSON.parse(approval.datosSolicitud)
                    : approval.datosSolicitud;
                switch (approval.tipoAprobacion) {
                    case 'NUEVO_CLIENTE':
                        return "".concat(data.nombres || '', " ").concat(data.apellidos || '', " - ").concat(data.dni || 'Sin DNI');
                    case 'NUEVO_PRESTAMO':
                        return "".concat(data.producto || 'Producto no especificado', " - ").concat(data.plazo || 0, " meses");
                    case 'GASTO':
                        return "".concat(data.descripcion || 'Gasto sin descripción');
                    case 'SOLICITUD_BASE_EFECTIVO':
                        return "Para cambio a clientes";
                    case 'PRORROGA_PAGO':
                        return "Reprogramaci\u00F3n hasta ".concat(data.nuevaFecha || 'fecha no especificada');
                    default:
                        return 'Detalles no disponibles';
                }
            }
            catch (error) {
                return 'Error al obtener detalles';
            }
        };
        DashboardService_1.prototype.determinePriority = function (tipo) {
            var highPriority = ['NUEVO_PRESTAMO', 'SOLICITUD_BASE_EFECTIVO'];
            var mediumPriority = ['NUEVO_CLIENTE', 'PRORROGA_PAGO'];
            if (highPriority.includes(tipo))
                return 'high';
            if (mediumPriority.includes(tipo))
                return 'medium';
            return 'low';
        };
        DashboardService_1.prototype.extractAmountFromApproval = function (approval) {
            try {
                var data = typeof approval.datosSolicitud === 'string'
                    ? JSON.parse(approval.datosSolicitud)
                    : approval.datosSolicitud;
                if (data.monto)
                    return parseFloat(data.monto);
                return undefined;
            }
            catch (error) {
                return undefined;
            }
        };
        DashboardService_1.prototype.mapDelinquentAccount = function (loan) {
            var _a, _b;
            var cuotaVencida = loan.cuotas[0];
            var daysLate = cuotaVencida
                ? Math.ceil((Date.now() - new Date(cuotaVencida.fechaVencimiento).getTime()) /
                    (1000 * 60 * 60 * 24))
                : 0;
            var asignacion = (_a = loan.cliente.asignacionesRuta) === null || _a === void 0 ? void 0 : _a[0];
            var collectorName = (asignacion === null || asignacion === void 0 ? void 0 : asignacion.cobrador)
                ? "".concat(asignacion.cobrador.nombres, " ").concat(asignacion.cobrador.apellidos)
                : 'No asignado';
            var routeName = ((_b = asignacion === null || asignacion === void 0 ? void 0 : asignacion.ruta) === null || _b === void 0 ? void 0 : _b.nombre) || 'General';
            return {
                id: loan.id,
                client: "".concat(loan.cliente.nombres, " ").concat(loan.cliente.apellidos),
                daysLate: daysLate,
                amountDue: parseFloat(loan.saldoPendiente.toString()),
                collector: collectorName,
                route: routeName,
                status: this.determineDelinquentStatus(daysLate),
            };
        };
        DashboardService_1.prototype.determineDelinquentStatus = function (daysLate) {
            if (daysLate > 15)
                return 'critical';
            if (daysLate > 8)
                return 'moderate';
            return 'mild';
        };
        DashboardService_1.prototype.mapRecentActivity = function (approval) {
            return {
                id: approval.id,
                client: "".concat(approval.solicitadoPor.nombres, " ").concat(approval.solicitadoPor.apellidos),
                action: this.getRecentActivityAction(approval.tipoAprobacion, approval.estado),
                amount: this.getRecentActivityAmount(approval),
                time: new Date(approval.actualizadoEn).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                }),
                status: approval.estado === client_1.EstadoAprobacion.APROBADO ? 'approved' : 'alert',
            };
        };
        DashboardService_1.prototype.getRecentActivityAction = function (tipo, estado) {
            var actionMap = {
                NUEVO_CLIENTE: 'Cliente aprobado',
                NUEVO_PRESTAMO: 'Crédito aprobado',
                GASTO: 'Gasto aprobado',
                SOLICITUD_BASE_EFECTIVO: 'Base de efectivo aprobada',
                PRORROGA_PAGO: 'Prórroga autorizada',
            };
            var baseAction = actionMap[tipo] || 'Aprobación procesada';
            return estado === client_1.EstadoAprobacion.APROBADO
                ? baseAction
                : "".concat(baseAction, " rechazada");
        };
        DashboardService_1.prototype.getRecentActivityAmount = function (approval) {
            try {
                var data = typeof approval.datosSolicitud === 'string'
                    ? JSON.parse(approval.datosSolicitud)
                    : approval.datosSolicitud;
                if (data.monto) {
                    return new Intl.NumberFormat('es-ES', {
                        style: 'currency',
                        currency: 'COP',
                        minimumFractionDigits: 0,
                    }).format(Number(data.monto));
                }
                return '-';
            }
            catch (error) {
                return '-';
            }
        };
        /**
         * Calcula el rango de fechas según el filtro de período
         */
        DashboardService_1.prototype.calculateDateRangeFromFilter = function (timeFilter) {
            var today = new Date();
            var startDate;
            var endDate = new Date(today);
            endDate.setHours(23, 59, 59, 999);
            switch (timeFilter) {
                case 'today':
                    startDate = new Date(today);
                    startDate.setHours(0, 0, 0, 0);
                    endDate = new Date(today);
                    endDate.setHours(23, 59, 59, 999);
                    break;
                case 'week':
                    startDate = new Date(today);
                    // Inicio de semana (domingo = 0)
                    var day = today.getDay();
                    // Calcular diferencia para llegar al domingo (día 0)
                    var diff = day === 0 ? 0 : -day; // Si es domingo, diff = 0; si no, retrocedemos días
                    startDate.setDate(today.getDate() + diff);
                    startDate.setHours(0, 0, 0, 0);
                    endDate = new Date(today);
                    endDate.setHours(23, 59, 59, 999);
                    break;
                case 'month':
                    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                    startDate.setHours(0, 0, 0, 0);
                    endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
                    break;
                case 'year':
                    startDate = new Date(today.getFullYear(), 0, 1);
                    startDate.setHours(0, 0, 0, 0);
                    endDate = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
                    break;
                default:
                    // Por defecto: mes actual
                    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                    startDate.setHours(0, 0, 0, 0);
                    endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
            }
            return { startDate: startDate, endDate: endDate };
        };
        return DashboardService_1;
    }());
    __setFunctionName(_classThis, "DashboardService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        DashboardService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return DashboardService = _classThis;
}();
exports.DashboardService = DashboardService;
