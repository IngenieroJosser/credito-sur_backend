"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
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
exports.ReportsService = void 0;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var date_fns_1 = require("date-fns");
var client_2 = require("@prisma/client");
var date_utils_1 = require("../utils/date-utils");
var cuentas_mora_template_1 = require("../templates/exports/cuentas-mora.template");
var cuentas_vencidas_template_1 = require("../templates/exports/cuentas-vencidas.template");
var reporte_operativo_template_1 = require("../templates/exports/reporte-operativo.template");
var reporte_financiero_template_1 = require("../templates/exports/reporte-financiero.template");
var ReportsService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var ReportsService = _classThis = /** @class */ (function () {
        function ReportsService_1(prisma, notificacionesService) {
            this.prisma = prisma;
            this.notificacionesService = notificacionesService;
        }
        ReportsService_1.prototype.getFinancialSummary = function (startDate, endDate) {
            return __awaiter(this, void 0, void 0, function () {
                var end, ingresosResult, egresosResult, ingresos, egresos, utilidad, margen;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            end = new Date(endDate);
                            end.setHours(23, 59, 59, 999);
                            return [4 /*yield*/, this.prisma.pago.aggregate({
                                    _sum: { montoTotal: true },
                                    where: {
                                        fechaPago: {
                                            gte: startDate,
                                            lte: end,
                                        },
                                    },
                                })];
                        case 1:
                            ingresosResult = _a.sent();
                            return [4 /*yield*/, this.prisma.gasto.aggregate({
                                    _sum: { monto: true },
                                    where: {
                                        fechaGasto: {
                                            gte: startDate,
                                            lte: end,
                                        },
                                        estadoAprobacion: client_1.EstadoAprobacion.APROBADO,
                                    },
                                })];
                        case 2:
                            egresosResult = _a.sent();
                            ingresos = Number(ingresosResult._sum.montoTotal || 0);
                            egresos = Number(egresosResult._sum.monto || 0);
                            utilidad = ingresos - egresos;
                            margen = ingresos > 0 ? (utilidad / ingresos) * 100 : 0;
                            return [2 /*return*/, {
                                    ingresos: ingresos,
                                    egresos: egresos,
                                    utilidad: utilidad,
                                    margen: Number(margen.toFixed(2)),
                                }];
                    }
                });
            });
        };
        ReportsService_1.prototype.getMonthlyEvolution = function (year) {
            return __awaiter(this, void 0, void 0, function () {
                var startOfYear, endOfYear, pagos, gastos, months;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            startOfYear = new Date(year, 0, 1);
                            endOfYear = new Date(year, 11, 31, 23, 59, 59);
                            return [4 /*yield*/, this.prisma.pago.findMany({
                                    where: {
                                        fechaPago: { gte: startOfYear, lte: endOfYear },
                                    },
                                    select: { fechaPago: true, montoTotal: true },
                                })];
                        case 1:
                            pagos = _a.sent();
                            return [4 /*yield*/, this.prisma.gasto.findMany({
                                    where: {
                                        fechaGasto: { gte: startOfYear, lte: endOfYear },
                                        estadoAprobacion: client_1.EstadoAprobacion.APROBADO,
                                    },
                                    select: { fechaGasto: true, monto: true },
                                })];
                        case 2:
                            gastos = _a.sent();
                            months = Array.from({ length: 12 }, function (_, i) { return ({
                                mes: new Date(year, i).toLocaleString('es-ES', { month: 'short' }),
                                ingresos: 0,
                                egresos: 0,
                                utilidad: 0,
                            }); });
                            pagos.forEach(function (p) {
                                var month = p.fechaPago.getMonth();
                                months[month].ingresos += Number(p.montoTotal);
                            });
                            gastos.forEach(function (g) {
                                var month = g.fechaGasto.getMonth();
                                months[month].egresos += Number(g.monto);
                            });
                            months.forEach(function (m) {
                                m.utilidad = m.ingresos - m.egresos;
                            });
                            return [2 /*return*/, months];
                    }
                });
            });
        };
        ReportsService_1.prototype.getExpenseDistribution = function (startDate, endDate) {
            return __awaiter(this, void 0, void 0, function () {
                var end, gastos;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            end = new Date(endDate);
                            end.setHours(23, 59, 59, 999);
                            return [4 /*yield*/, this.prisma.gasto.groupBy({
                                    by: ['tipoGasto'],
                                    _sum: { monto: true },
                                    where: {
                                        fechaGasto: { gte: startDate, lte: end },
                                        estadoAprobacion: client_1.EstadoAprobacion.APROBADO,
                                    },
                                })];
                        case 1:
                            gastos = _a.sent();
                            return [2 /*return*/, gastos.map(function (g) { return ({
                                    categoria: g.tipoGasto,
                                    monto: Number(g._sum.monto || 0),
                                }); })];
                    }
                });
            });
        };
        ReportsService_1.prototype.getFinancialTargets = function () {
            return __awaiter(this, void 0, void 0, function () {
                var envValue, parsed, metaMargen;
                return __generator(this, function (_a) {
                    envValue = process.env.REPORTS_META_MARGEN ||
                        process.env.META_MARGEN ||
                        process.env.NEXT_PUBLIC_META_MARGEN;
                    if (typeof envValue === 'undefined' ||
                        envValue === null ||
                        envValue === '') {
                        return [2 /*return*/, { metaMargen: null }];
                    }
                    parsed = parseFloat(envValue);
                    metaMargen = Number.isFinite(parsed) ? parsed : null;
                    return [2 /*return*/, { metaMargen: metaMargen }];
                });
            });
        };
        ReportsService_1.prototype.obtenerPrestamosEnMora = function (filtros_1) {
            return __awaiter(this, arguments, void 0, function (filtros, pagina, limite) {
                var skip, whereConditions, clientesRuta, clienteIds, rutasCobrador, rutaIds, clientesRuta, clienteIds, total, prestamos, prestamosEnriquecidos, totalMora, totalDeuda, totalCasosCriticos, totales;
                var _this = this;
                if (pagina === void 0) { pagina = 1; }
                if (limite === void 0) { limite = 50; }
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            skip = (pagina - 1) * limite;
                            whereConditions = {
                                estado: { in: ['EN_MORA', 'ACTIVO'] },
                                cuotas: {
                                    some: {
                                        estado: { in: ['VENCIDA', 'PRORROGADA'] },
                                    },
                                },
                            };
                            // Aplicar filtros
                            if (filtros.busqueda) {
                                whereConditions.OR = [
                                    {
                                        cliente: {
                                            nombres: {
                                                contains: filtros.busqueda,
                                                mode: 'insensitive',
                                            },
                                        },
                                    },
                                    {
                                        cliente: {
                                            apellidos: {
                                                contains: filtros.busqueda,
                                                mode: 'insensitive',
                                            },
                                        },
                                    },
                                    {
                                        cliente: {
                                            dni: {
                                                contains: filtros.busqueda,
                                                mode: 'insensitive',
                                            },
                                        },
                                    },
                                    {
                                        numeroPrestamo: {
                                            contains: filtros.busqueda,
                                            mode: 'insensitive',
                                        },
                                    },
                                ];
                            }
                            if (filtros.nivelRiesgo) {
                                whereConditions.cliente = __assign(__assign({}, whereConditions.cliente), { nivelRiesgo: filtros.nivelRiesgo });
                            }
                            if (!filtros.rutaId) return [3 /*break*/, 2];
                            return [4 /*yield*/, this.prisma.asignacionRuta.findMany({
                                    where: {
                                        rutaId: filtros.rutaId,
                                        activa: true,
                                    },
                                    select: { clienteId: true },
                                })];
                        case 1:
                            clientesRuta = _a.sent();
                            clienteIds = clientesRuta.map(function (cr) { return cr.clienteId; });
                            whereConditions.clienteId = { in: clienteIds };
                            _a.label = 2;
                        case 2:
                            if (!filtros.cobradorId) return [3 /*break*/, 5];
                            return [4 /*yield*/, this.prisma.ruta.findMany({
                                    where: {
                                        cobradorId: filtros.cobradorId,
                                        activa: true,
                                    },
                                    select: { id: true },
                                })];
                        case 3:
                            rutasCobrador = _a.sent();
                            rutaIds = rutasCobrador.map(function (rc) { return rc.id; });
                            return [4 /*yield*/, this.prisma.asignacionRuta.findMany({
                                    where: {
                                        rutaId: { in: rutaIds },
                                        activa: true,
                                    },
                                    select: { clienteId: true },
                                })];
                        case 4:
                            clientesRuta = _a.sent();
                            clienteIds = clientesRuta.map(function (cr) { return cr.clienteId; });
                            whereConditions.clienteId = { in: clienteIds };
                            _a.label = 5;
                        case 5: return [4 /*yield*/, this.prisma.prestamo.count({
                                where: whereConditions,
                            })];
                        case 6:
                            total = _a.sent();
                            return [4 /*yield*/, this.prisma.prestamo.findMany({
                                    where: whereConditions,
                                    skip: skip,
                                    take: limite,
                                    include: {
                                        cliente: true,
                                        cuotas: {
                                            where: {
                                                estado: { in: ['VENCIDA', 'PRORROGADA'] },
                                            },
                                            orderBy: {
                                                fechaVencimiento: 'asc',
                                            },
                                        },
                                        pagos: {
                                            orderBy: {
                                                fechaPago: 'desc',
                                            },
                                            take: 1,
                                        },
                                        extensiones: {
                                            orderBy: { id: 'desc' },
                                            take: 1,
                                        },
                                    },
                                    orderBy: [
                                        {
                                            cliente: {
                                                nivelRiesgo: 'desc',
                                            },
                                        },
                                        {
                                            saldoPendiente: 'desc',
                                        },
                                    ],
                                })];
                        case 7:
                            prestamos = _a.sent();
                            return [4 /*yield*/, Promise.all(prestamos.map(function (prestamo) { return __awaiter(_this, void 0, void 0, function () {
                                    var asignacion, primeraCuotaVencida, diasMora, montoMora, ultimoPago, extension, fechaProrroga, diasProrroga;
                                    var _a, _b, _c;
                                    return __generator(this, function (_d) {
                                        switch (_d.label) {
                                            case 0: return [4 /*yield*/, this.prisma.asignacionRuta.findFirst({
                                                    where: {
                                                        clienteId: prestamo.clienteId,
                                                        activa: true,
                                                    },
                                                    include: {
                                                        ruta: {
                                                            include: {
                                                                cobrador: true,
                                                            },
                                                        },
                                                    },
                                                })];
                                            case 1:
                                                asignacion = _d.sent();
                                                primeraCuotaVencida = prestamo.cuotas[0];
                                                diasMora = primeraCuotaVencida
                                                    ? (0, date_fns_1.differenceInDays)(new Date(), primeraCuotaVencida.fechaVencimiento)
                                                    : 0;
                                                montoMora = prestamo.cuotas.reduce(function (sum, cuota) { return sum + cuota.montoInteresMora.toNumber(); }, 0);
                                                ultimoPago = prestamo.pagos[0];
                                                extension = (_a = prestamo.extensiones) === null || _a === void 0 ? void 0 : _a[0];
                                                fechaProrroga = (extension === null || extension === void 0 ? void 0 : extension.nuevaFechaVencimiento)
                                                    ? (0, date_fns_1.format)(new Date(extension.nuevaFechaVencimiento), 'yyyy-MM-dd')
                                                    : undefined;
                                                diasProrroga = (extension === null || extension === void 0 ? void 0 : extension.nuevaFechaVencimiento)
                                                    ? Math.ceil((new Date(extension.nuevaFechaVencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                                                    : undefined;
                                                return [2 /*return*/, {
                                                        id: prestamo.id,
                                                        numeroPrestamo: prestamo.numeroPrestamo,
                                                        clienteId: prestamo.clienteId,
                                                        cliente: {
                                                            id: prestamo.clienteId,
                                                            nombre: "".concat(prestamo.cliente.nombres, " ").concat(prestamo.cliente.apellidos),
                                                            documento: prestamo.cliente.dni,
                                                            telefono: prestamo.cliente.telefono,
                                                            direccion: prestamo.cliente.direccion || '',
                                                        },
                                                        diasMora: diasMora,
                                                        montoMora: montoMora,
                                                        montoTotalDeuda: prestamo.saldoPendiente.toNumber(),
                                                        montoOriginal: prestamo.monto.toNumber(),
                                                        cuotasVencidas: prestamo.cuotas.length,
                                                        ruta: ((_b = asignacion === null || asignacion === void 0 ? void 0 : asignacion.ruta) === null || _b === void 0 ? void 0 : _b.nombre) || 'Sin asignar',
                                                        cobrador: ((_c = asignacion === null || asignacion === void 0 ? void 0 : asignacion.ruta) === null || _c === void 0 ? void 0 : _c.cobrador)
                                                            ? "".concat(asignacion.ruta.cobrador.nombres, " ").concat(asignacion.ruta.cobrador.apellidos)
                                                            : 'Sin asignar',
                                                        nivelRiesgo: prestamo.cliente.nivelRiesgo,
                                                        estado: prestamo.estado,
                                                        ultimoPago: ultimoPago
                                                            ? (0, date_fns_1.format)(ultimoPago.fechaPago, 'yyyy-MM-dd')
                                                            : undefined,
                                                        fechaVencimiento: (0, date_fns_1.format)(prestamo.fechaFin, 'yyyy-MM-dd'),
                                                        // Extension de pago (prorroga)
                                                        fechaProrroga: fechaProrroga,
                                                        diasProrroga: diasProrroga,
                                                        tieneProrroga: !!extension,
                                                    }];
                                        }
                                    });
                                }); }))];
                        case 8:
                            prestamosEnriquecidos = _a.sent();
                            totalMora = prestamosEnriquecidos.reduce(function (sum, p) { return sum + p.montoMora; }, 0);
                            totalDeuda = prestamosEnriquecidos.reduce(function (sum, p) { return sum + p.montoTotalDeuda; }, 0);
                            totalCasosCriticos = prestamosEnriquecidos.filter(function (p) { return p.nivelRiesgo === 'ROJO' || p.nivelRiesgo === 'LISTA_NEGRA'; }).length;
                            totales = {
                                totalMora: totalMora,
                                totalDeuda: totalDeuda,
                                totalCasosCriticos: totalCasosCriticos,
                                totalRegistros: total,
                            };
                            return [2 /*return*/, {
                                    prestamos: prestamosEnriquecidos,
                                    totales: totales,
                                    total: total,
                                    pagina: pagina,
                                    limite: limite,
                                }];
                    }
                });
            });
        };
        ReportsService_1.prototype.generarReporteMora = function (filtros, formato) {
            return __awaiter(this, void 0, void 0, function () {
                var data, prestamos, fecha, filas, totales;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.obtenerPrestamosEnMora(filtros, 1, 10000)];
                        case 1:
                            data = _a.sent();
                            prestamos = data.prestamos;
                            fecha = new Date().toISOString().split('T')[0];
                            filas = prestamos.map(function (p) {
                                var _a, _b;
                                return ({
                                    numeroPrestamo: p.numeroPrestamo || '',
                                    cliente: ((_a = p.cliente) === null || _a === void 0 ? void 0 : _a.nombre) || '',
                                    documento: ((_b = p.cliente) === null || _b === void 0 ? void 0 : _b.documento) || '',
                                    diasMora: p.diasMora || 0,
                                    montoMora: p.montoMora || 0,
                                    montoTotalDeuda: p.montoTotalDeuda || 0,
                                    cuotasVencidas: p.cuotasVencidas || 0,
                                    ruta: p.ruta || '',
                                    cobrador: p.cobrador || '',
                                    nivelRiesgo: p.nivelRiesgo || '',
                                    ultimoPago: p.ultimoPago,
                                });
                            });
                            totales = {
                                totalMora: data.totales.totalMora || 0,
                                totalDeuda: data.totales.totalDeuda || 0,
                                totalCasosCriticos: data.totales.totalCasosCriticos || 0,
                                totalRegistros: data.totales.totalRegistros || 0,
                            };
                            // 3. Delegamos al template
                            if (formato === 'excel')
                                return [2 /*return*/, (0, cuentas_mora_template_1.generarExcelMora)(filas, totales, fecha)];
                            if (formato === 'pdf')
                                return [2 /*return*/, (0, cuentas_mora_template_1.generarPDFMora)(filas, totales, fecha)];
                            throw new Error("Formato no soportado: ".concat(formato));
                    }
                });
            });
        };
        ReportsService_1.prototype.obtenerEstadisticasMora = function () {
            return __awaiter(this, void 0, void 0, function () {
                var _a, totalPrestamosMora, prestamosRojos, prestamosListaNegra, moraAcumulada, deudaTotal;
                var _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0: return [4 /*yield*/, Promise.all([
                                this.prisma.prestamo.count({
                                    where: { estado: 'EN_MORA' },
                                }),
                                this.prisma.prestamo.count({
                                    where: {
                                        estado: 'EN_MORA',
                                        cliente: {
                                            nivelRiesgo: 'ROJO',
                                        },
                                    },
                                }),
                                this.prisma.prestamo.count({
                                    where: {
                                        estado: 'EN_MORA',
                                        cliente: {
                                            nivelRiesgo: 'LISTA_NEGRA',
                                        },
                                    },
                                }),
                                this.prisma.cuota.aggregate({
                                    where: {
                                        estado: 'VENCIDA',
                                        prestamo: {
                                            estado: 'EN_MORA',
                                        },
                                    },
                                    _sum: {
                                        montoInteresMora: true,
                                    },
                                }),
                                this.prisma.prestamo.aggregate({
                                    where: { estado: 'EN_MORA' },
                                    _sum: {
                                        saldoPendiente: true,
                                    },
                                }),
                            ])];
                        case 1:
                            _a = _d.sent(), totalPrestamosMora = _a[0], prestamosRojos = _a[1], prestamosListaNegra = _a[2], moraAcumulada = _a[3], deudaTotal = _a[4];
                            return [2 /*return*/, {
                                    totalPrestamosMora: totalPrestamosMora,
                                    casosCriticos: prestamosRojos + prestamosListaNegra,
                                    moraAcumulada: ((_b = moraAcumulada._sum.montoInteresMora) === null || _b === void 0 ? void 0 : _b.toNumber()) || 0,
                                    deudaTotal: ((_c = deudaTotal._sum.saldoPendiente) === null || _c === void 0 ? void 0 : _c.toNumber()) || 0,
                                }];
                    }
                });
            });
        };
        ReportsService_1.prototype.obtenerCuentasVencidas = function (filtros_1) {
            return __awaiter(this, arguments, void 0, function (filtros, pagina, limite) {
                var skip, hoy, whereConditions, clientesRuta, clienteIds, total, prestamos, cuentasVencidas, totalVencido, totalDiasVencidos, diasPromedioVencimiento, totales;
                var _this = this;
                if (pagina === void 0) { pagina = 1; }
                if (limite === void 0) { limite = 50; }
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            skip = (pagina - 1) * limite;
                            hoy = new Date();
                            whereConditions = {
                                fechaFin: { lt: hoy },
                                estado: { in: ['EN_MORA', 'INCUMPLIDO', 'PERDIDA'] },
                                saldoPendiente: { gt: 0 },
                            };
                            // Aplicar filtros
                            if (filtros.busqueda) {
                                whereConditions.OR = [
                                    {
                                        cliente: {
                                            nombres: {
                                                contains: filtros.busqueda,
                                                mode: 'insensitive',
                                            },
                                        },
                                    },
                                    {
                                        cliente: {
                                            apellidos: {
                                                contains: filtros.busqueda,
                                                mode: 'insensitive',
                                            },
                                        },
                                    },
                                    {
                                        cliente: {
                                            dni: {
                                                contains: filtros.busqueda,
                                                mode: 'insensitive',
                                            },
                                        },
                                    },
                                    {
                                        numeroPrestamo: {
                                            contains: filtros.busqueda,
                                            mode: 'insensitive',
                                        },
                                    },
                                ];
                            }
                            if (filtros.nivelRiesgo) {
                                whereConditions.cliente = __assign(__assign({}, whereConditions.cliente), { nivelRiesgo: filtros.nivelRiesgo });
                            }
                            if (!filtros.rutaId) return [3 /*break*/, 2];
                            return [4 /*yield*/, this.prisma.asignacionRuta.findMany({
                                    where: {
                                        rutaId: filtros.rutaId,
                                        activa: true,
                                    },
                                    select: { clienteId: true },
                                })];
                        case 1:
                            clientesRuta = _a.sent();
                            clienteIds = clientesRuta.map(function (cr) { return cr.clienteId; });
                            whereConditions.clienteId = { in: clienteIds };
                            _a.label = 2;
                        case 2: return [4 /*yield*/, this.prisma.prestamo.count({
                                where: whereConditions,
                            })];
                        case 3:
                            total = _a.sent();
                            return [4 /*yield*/, this.prisma.prestamo.findMany({
                                    where: whereConditions,
                                    skip: skip,
                                    take: limite,
                                    include: {
                                        cliente: true,
                                        cuotas: {
                                            where: {
                                                estado: 'VENCIDA',
                                            },
                                        },
                                    },
                                    orderBy: [
                                        {
                                            fechaFin: 'asc',
                                        },
                                        {
                                            saldoPendiente: 'desc',
                                        },
                                    ],
                                })];
                        case 4:
                            prestamos = _a.sent();
                            return [4 /*yield*/, Promise.all(prestamos.map(function (prestamo) { return __awaiter(_this, void 0, void 0, function () {
                                    var asignacion, diasVencidos, interesesMora;
                                    var _a;
                                    return __generator(this, function (_b) {
                                        switch (_b.label) {
                                            case 0: return [4 /*yield*/, this.prisma.asignacionRuta.findFirst({
                                                    where: {
                                                        clienteId: prestamo.clienteId,
                                                        activa: true,
                                                    },
                                                    include: {
                                                        ruta: {
                                                            include: {
                                                                cobrador: true,
                                                            },
                                                        },
                                                    },
                                                })];
                                            case 1:
                                                asignacion = _b.sent();
                                                diasVencidos = (0, date_fns_1.differenceInDays)(hoy, prestamo.fechaFin);
                                                interesesMora = prestamo.cuotas.reduce(function (sum, cuota) { return sum + cuota.montoInteresMora.toNumber(); }, 0);
                                                return [2 /*return*/, {
                                                        id: prestamo.id,
                                                        numeroPrestamo: prestamo.numeroPrestamo,
                                                        cliente: {
                                                            nombre: "".concat(prestamo.cliente.nombres, " ").concat(prestamo.cliente.apellidos),
                                                            documento: prestamo.cliente.dni,
                                                            telefono: prestamo.cliente.telefono,
                                                            direccion: prestamo.cliente.direccion || '',
                                                        },
                                                        fechaVencimiento: (0, date_fns_1.format)(prestamo.fechaFin, 'yyyy-MM-dd'),
                                                        diasVencidos: diasVencidos,
                                                        saldoPendiente: prestamo.saldoPendiente.toNumber(),
                                                        montoOriginal: prestamo.monto.toNumber(),
                                                        ruta: ((_a = asignacion === null || asignacion === void 0 ? void 0 : asignacion.ruta) === null || _a === void 0 ? void 0 : _a.nombre) || 'Sin asignar',
                                                        nivelRiesgo: prestamo.cliente.nivelRiesgo,
                                                        estado: prestamo.estado,
                                                        interesesMora: interesesMora,
                                                    }];
                                        }
                                    });
                                }); }))];
                        case 5:
                            cuentasVencidas = _a.sent();
                            totalVencido = cuentasVencidas.reduce(function (sum, c) { return sum + c.saldoPendiente; }, 0);
                            totalDiasVencidos = cuentasVencidas.reduce(function (sum, c) { return sum + c.diasVencidos; }, 0);
                            diasPromedioVencimiento = cuentasVencidas.length > 0
                                ? Math.round(totalDiasVencidos / cuentasVencidas.length)
                                : 0;
                            totales = {
                                totalVencido: totalVencido,
                                totalRegistros: total,
                                diasPromedioVencimiento: diasPromedioVencimiento,
                                totalInteresesMora: cuentasVencidas.reduce(function (s, c) { return s + (c.interesesMora || 0); }, 0),
                                totalMontoOriginal: cuentasVencidas.reduce(function (s, c) { return s + (c.montoOriginal || 0); }, 0),
                            };
                            return [2 /*return*/, {
                                    cuentas: cuentasVencidas,
                                    totales: totales,
                                    total: total,
                                    pagina: pagina,
                                    limite: limite,
                                }];
                    }
                });
            });
        };
        ReportsService_1.prototype.procesarDecisionCastigo = function (decisionDto, usuarioId) {
            return __awaiter(this, void 0, void 0, function () {
                var prestamo, cuotaId, cuotaVencida, tipoAprobacion, aprobacion, nombreUsuario, u, _a, _b, _c, nuevoEstado, _d, cuotasVencidas, interesPorCuota, _i, cuotasVencidas_1, cuota;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0: return [4 /*yield*/, this.prisma.prestamo.findUnique({
                                where: { id: decisionDto.prestamoId },
                                include: { cliente: true },
                            })];
                        case 1:
                            prestamo = _e.sent();
                            if (!prestamo) {
                                throw new Error('Préstamo no encontrado');
                            }
                            cuotaId = null;
                            if (!(decisionDto.decision === 'PRORROGAR')) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.prisma.cuota.findFirst({
                                    where: {
                                        prestamoId: decisionDto.prestamoId,
                                        estado: { in: ['VENCIDA', 'PENDIENTE'] },
                                    },
                                    orderBy: { numeroCuota: 'asc' },
                                })];
                        case 2:
                            cuotaVencida = _e.sent();
                            cuotaId = (cuotaVencida === null || cuotaVencida === void 0 ? void 0 : cuotaVencida.id) || null;
                            _e.label = 3;
                        case 3:
                            tipoAprobacion = decisionDto.decision === 'PRORROGAR'
                                ? client_2.TipoAprobacion.PRORROGA_PAGO
                                : client_2.TipoAprobacion.BAJA_POR_PERDIDA;
                            return [4 /*yield*/, this.prisma.aprobacion.create({
                                    data: {
                                        tipoAprobacion: tipoAprobacion,
                                        referenciaId: decisionDto.prestamoId,
                                        tablaReferencia: 'Prestamo',
                                        solicitadoPorId: usuarioId,
                                        datosSolicitud: {
                                            decision: decisionDto.decision,
                                            montoInteres: decisionDto.montoInteres || 0,
                                            comentarios: decisionDto.comentarios,
                                            nuevaFechaVencimiento: decisionDto.nuevaFechaVencimiento,
                                            prestamoId: decisionDto.prestamoId,
                                            cuotaId: cuotaId,
                                            fechaVencimientoOriginal: prestamo.fechaFin,
                                            clienteNombre: "".concat(prestamo.cliente.nombres, " ").concat(prestamo.cliente.apellidos),
                                            saldoPendiente: prestamo.saldoPendiente.toNumber(),
                                            numeroPrestamo: prestamo.numeroPrestamo,
                                            diasGracia: decisionDto.diasGracia,
                                        },
                                        montoSolicitud: decisionDto.montoInteres || 0,
                                    },
                                })];
                        case 4:
                            aprobacion = _e.sent();
                            nombreUsuario = 'Usuario';
                            _e.label = 5;
                        case 5:
                            _e.trys.push([5, 7, , 8]);
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: { id: usuarioId },
                                    select: { nombres: true, apellidos: true },
                                })];
                        case 6:
                            u = _e.sent();
                            if (u)
                                nombreUsuario = "".concat(u.nombres, " ").concat(u.apellidos).trim() || nombreUsuario;
                            return [3 /*break*/, 8];
                        case 7:
                            _a = _e.sent();
                            return [3 /*break*/, 8];
                        case 8:
                            if (!(decisionDto.decision !== 'PRORROGAR')) return [3 /*break*/, 15];
                            _e.label = 9;
                        case 9:
                            _e.trys.push([9, 11, , 12]);
                            return [4 /*yield*/, this.notificacionesService.notifyApprovers({
                                    titulo: 'Solicitud requiere aprobacion',
                                    mensaje: "".concat(nombreUsuario, " solicito ").concat(decisionDto.decision.toLowerCase(), " para el prestamo ").concat(prestamo.numeroPrestamo, " (").concat(prestamo.cliente.nombres, " ").concat(prestamo.cliente.apellidos, ")."),
                                    tipo: 'WARNING',
                                    entidad: 'Aprobacion',
                                    entidadId: aprobacion.id,
                                    metadata: {
                                        tipoAprobacion: 'BAJA_POR_PERDIDA',
                                        prestamoId: decisionDto.prestamoId,
                                        decision: decisionDto.decision,
                                        montoInteres: decisionDto.montoInteres || 0,
                                    },
                                })];
                        case 10:
                            _e.sent();
                            return [3 /*break*/, 12];
                        case 11:
                            _b = _e.sent();
                            return [3 /*break*/, 12];
                        case 12:
                            _e.trys.push([12, 14, , 15]);
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: usuarioId,
                                    titulo: 'Solicitud enviada',
                                    mensaje: 'Tu solicitud fue enviada y quedo pendiente de aprobacion.',
                                    tipo: 'INFORMATIVO',
                                    entidad: 'Aprobacion',
                                    entidadId: aprobacion.id,
                                    metadata: {
                                        tipoAprobacion: 'BAJA_POR_PERDIDA',
                                        prestamoId: decisionDto.prestamoId,
                                        decision: decisionDto.decision,
                                    },
                                })];
                        case 13:
                            _e.sent();
                            return [3 /*break*/, 15];
                        case 14:
                            _c = _e.sent();
                            return [3 /*break*/, 15];
                        case 15:
                            nuevoEstado = prestamo.estado;
                            _d = decisionDto.decision;
                            switch (_d) {
                                case 'CASTIGAR': return [3 /*break*/, 16];
                                case 'JURIDICO': return [3 /*break*/, 17];
                                case 'PRORROGAR': return [3 /*break*/, 18];
                            }
                            return [3 /*break*/, 21];
                        case 16:
                            nuevoEstado = 'PERDIDA';
                            return [3 /*break*/, 21];
                        case 17:
                            nuevoEstado = 'INCUMPLIDO';
                            return [3 /*break*/, 21];
                        case 18:
                            if (!decisionDto.nuevaFechaVencimiento) return [3 /*break*/, 20];
                            // Actualizar fecha de vencimiento del préstamo
                            return [4 /*yield*/, this.prisma.prestamo.update({
                                    where: { id: decisionDto.prestamoId },
                                    data: {
                                        fechaFin: new Date(decisionDto.nuevaFechaVencimiento),
                                        estado: 'EN_MORA',
                                    },
                                })];
                        case 19:
                            // Actualizar fecha de vencimiento del préstamo
                            _e.sent();
                            _e.label = 20;
                        case 20: return [3 /*break*/, 21];
                        case 21:
                            if (!(decisionDto.decision !== 'PRORROGAR')) return [3 /*break*/, 23];
                            return [4 /*yield*/, this.prisma.prestamo.update({
                                    where: { id: decisionDto.prestamoId },
                                    data: { estado: nuevoEstado },
                                })];
                        case 22:
                            _e.sent();
                            _e.label = 23;
                        case 23:
                            if (!(decisionDto.montoInteres && decisionDto.montoInteres > 0)) return [3 /*break*/, 28];
                            return [4 /*yield*/, this.prisma.cuota.findMany({
                                    where: {
                                        prestamoId: decisionDto.prestamoId,
                                        estado: 'VENCIDA',
                                    },
                                })];
                        case 24:
                            cuotasVencidas = _e.sent();
                            interesPorCuota = decisionDto.montoInteres / cuotasVencidas.length;
                            _i = 0, cuotasVencidas_1 = cuotasVencidas;
                            _e.label = 25;
                        case 25:
                            if (!(_i < cuotasVencidas_1.length)) return [3 /*break*/, 28];
                            cuota = cuotasVencidas_1[_i];
                            return [4 /*yield*/, this.prisma.cuota.update({
                                    where: { id: cuota.id },
                                    data: {
                                        montoInteresMora: { increment: interesPorCuota },
                                    },
                                })];
                        case 26:
                            _e.sent();
                            _e.label = 27;
                        case 27:
                            _i++;
                            return [3 /*break*/, 25];
                        case 28: return [2 /*return*/, {
                                mensaje: "Decisi\u00F3n de ".concat(decisionDto.decision.toLowerCase(), " procesada exitosamente"),
                                aprobacionId: aprobacion.id,
                                nuevoEstado: nuevoEstado,
                            }];
                    }
                });
            });
        };
        ReportsService_1.prototype.exportarCuentasVencidas = function (formato, filtros) {
            return __awaiter(this, void 0, void 0, function () {
                var data, cuentas, fecha, filas, totales;
                var _a, _b, _c, _d, _e;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0: return [4 /*yield*/, this.obtenerCuentasVencidas(filtros, 1, 10000)];
                        case 1:
                            data = _f.sent();
                            cuentas = data.cuentas;
                            fecha = new Date().toISOString().split('T')[0];
                            filas = cuentas.map(function (c) {
                                var _a, _b;
                                return ({
                                    numeroPrestamo: c.numeroPrestamo || '',
                                    cliente: typeof c.cliente === 'string' ? c.cliente : (((_a = c.cliente) === null || _a === void 0 ? void 0 : _a.nombre) || ''),
                                    documento: typeof c.cliente === 'object' ? (((_b = c.cliente) === null || _b === void 0 ? void 0 : _b.documento) || '') : '',
                                    fechaVencimiento: c.fechaVencimiento || '',
                                    diasVencidos: Number(c.diasVencidos || 0),
                                    saldoPendiente: Number(c.saldoPendiente || 0),
                                    montoOriginal: Number(c.montoOriginal || 0),
                                    interesesMora: Number(c.interesesMora || 0),
                                    nivelRiesgo: c.nivelRiesgo || '',
                                    ruta: c.ruta || '',
                                    estado: c.estado || '',
                                });
                            });
                            totales = {
                                totalVencido: Number(((_a = data.totales) === null || _a === void 0 ? void 0 : _a.totalVencido) || 0),
                                diasPromedioVencimiento: Number(((_b = data.totales) === null || _b === void 0 ? void 0 : _b.diasPromedioVencimiento) || 0),
                                totalRegistros: Number(((_c = data.totales) === null || _c === void 0 ? void 0 : _c.totalRegistros) || 0),
                                totalInteresesMora: Number(((_d = data.totales) === null || _d === void 0 ? void 0 : _d.totalInteresesMora) || 0),
                                totalMontoOriginal: Number(((_e = data.totales) === null || _e === void 0 ? void 0 : _e.totalMontoOriginal) || 0),
                            };
                            // 3. Delegamos al template
                            if (formato === 'excel')
                                return [2 /*return*/, (0, cuentas_vencidas_template_1.generarExcelVencidas)(filas, totales, fecha)];
                            if (formato === 'pdf')
                                return [2 /*return*/, (0, cuentas_vencidas_template_1.generarPDFVencidas)(filas, totales, fecha)];
                            throw new Error("Formato no soportado: ".concat(formato));
                    }
                });
            });
        };
        ReportsService_1.prototype.getOperationalReport = function (filters) {
            return __awaiter(this, void 0, void 0, function () {
                var period, routeId, startDate, endDate, dateRange, routes, routePerformancePromises, routePerformance, globalPayments, globalNewLoansStats, totalRecaudo, totalMontoPrestamosNuevos, totalPrestamosNuevos, globalDuePayments, totalMeta, porcentajeGlobal, totalAfiliaciones, efectividadPromedio;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            period = filters.period, routeId = filters.routeId, startDate = filters.startDate, endDate = filters.endDate;
                            dateRange = (0, date_utils_1.calculateDateRange)(period, startDate, endDate);
                            return [4 /*yield*/, this.prisma.ruta.findMany({
                                    where: __assign(__assign({}, (routeId && { id: routeId })), { activa: true }),
                                    include: {
                                        cobrador: {
                                            select: {
                                                id: true,
                                                nombres: true,
                                                apellidos: true,
                                            },
                                        },
                                        asignaciones: {
                                            include: {
                                                cliente: true,
                                            },
                                        },
                                    },
                                })];
                        case 1:
                            routes = _a.sent();
                            routePerformancePromises = routes.map(function (route) { return __awaiter(_this, void 0, void 0, function () {
                                var clientIds, routePayments, collected, routeNewLoansStats, newLoans, newLoansAmount, collectedFromCuotaInicial, newClients, routeDuePayments, target, efficiency;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            clientIds = route.asignaciones.map(function (a) { return a.cliente.id; });
                                            return [4 /*yield*/, this.prisma.pago.aggregate({
                                                    where: {
                                                        clienteId: { in: clientIds },
                                                        fechaPago: {
                                                            gte: dateRange.startDate,
                                                            lte: dateRange.endDate,
                                                        },
                                                    },
                                                    _sum: { montoTotal: true },
                                                })];
                                        case 1:
                                            routePayments = _a.sent();
                                            collected = Number(routePayments._sum.montoTotal || 0);
                                            return [4 /*yield*/, this.prisma.prestamo.aggregate({
                                                    where: {
                                                        clienteId: { in: clientIds },
                                                        creadoEn: {
                                                            gte: dateRange.startDate,
                                                            lte: dateRange.endDate,
                                                        },
                                                        estado: { in: ['ACTIVO', 'EN_MORA', 'PAGADO'] },
                                                    },
                                                    _sum: {
                                                        monto: true,
                                                        cuotaInicial: true,
                                                    },
                                                    _count: { id: true },
                                                })];
                                        case 2:
                                            routeNewLoansStats = _a.sent();
                                            newLoans = routeNewLoansStats._count.id || 0;
                                            newLoansAmount = Number(routeNewLoansStats._sum.monto || 0);
                                            collectedFromCuotaInicial = Number(routeNewLoansStats._sum.cuotaInicial || 0);
                                            return [4 /*yield*/, this.prisma.cliente.count({
                                                    where: {
                                                        asignacionesRuta: {
                                                            some: { rutaId: route.id },
                                                        },
                                                        creadoEn: {
                                                            gte: dateRange.startDate,
                                                            lte: dateRange.endDate,
                                                        },
                                                    },
                                                })];
                                        case 3:
                                            newClients = _a.sent();
                                            return [4 /*yield*/, this.prisma.cuota.aggregate({
                                                    where: {
                                                        prestamo: {
                                                            clienteId: { in: clientIds },
                                                            estado: { in: ['ACTIVO', 'EN_MORA'] },
                                                        },
                                                        OR: [
                                                            {
                                                                // Caso 1: Vence en este periodo
                                                                fechaVencimiento: {
                                                                    gte: dateRange.startDate,
                                                                    lte: dateRange.endDate,
                                                                },
                                                            },
                                                            {
                                                                // Caso 2: Pendiente/Vencido de antes
                                                                estado: { in: ['PENDIENTE', 'PARCIAL', 'VENCIDA'] },
                                                                fechaVencimiento: { lt: dateRange.startDate },
                                                            },
                                                            {
                                                                // Caso 3: Era de antes pero se pagó hoy (fija la meta retrospectivamente para eficiencia)
                                                                estado: 'PAGADA',
                                                                fechaVencimiento: { lt: dateRange.startDate },
                                                                fechaPago: {
                                                                    gte: dateRange.startDate,
                                                                    lte: dateRange.endDate,
                                                                },
                                                            },
                                                        ],
                                                    },
                                                    _sum: {
                                                        monto: true,
                                                        montoInteresMora: true,
                                                    },
                                                })];
                                        case 4:
                                            routeDuePayments = _a.sent();
                                            target = Number(routeDuePayments._sum.monto || 0) +
                                                Number(routeDuePayments._sum.montoInteresMora || 0) +
                                                collectedFromCuotaInicial;
                                            efficiency = target > 0 ? Math.round(((collected + collectedFromCuotaInicial) / target) * 100) : 0;
                                            return [2 /*return*/, {
                                                    id: route.id,
                                                    ruta: route.nombre,
                                                    cobrador: "".concat(route.cobrador.nombres, " ").concat(route.cobrador.apellidos),
                                                    cobradorId: route.cobrador.id,
                                                    meta: target,
                                                    recaudado: collected + collectedFromCuotaInicial,
                                                    eficiencia: efficiency,
                                                    nuevosPrestamos: newLoans,
                                                    nuevosClientes: newClients,
                                                    montoNuevosPrestamos: newLoansAmount,
                                                }];
                                    }
                                });
                            }); });
                            return [4 /*yield*/, Promise.all(routePerformancePromises)];
                        case 2:
                            routePerformance = _a.sent();
                            return [4 /*yield*/, this.prisma.pago.aggregate({
                                    where: {
                                        fechaPago: {
                                            gte: dateRange.startDate,
                                            lte: dateRange.endDate,
                                        },
                                    },
                                    _sum: { montoTotal: true },
                                })];
                        case 3:
                            globalPayments = _a.sent();
                            return [4 /*yield*/, this.prisma.prestamo.aggregate({
                                    where: {
                                        creadoEn: {
                                            gte: dateRange.startDate,
                                            lte: dateRange.endDate,
                                        },
                                        estado: { in: ['ACTIVO', 'EN_MORA', 'PAGADO'] },
                                    },
                                    _sum: {
                                        monto: true,
                                        cuotaInicial: true,
                                    },
                                    _count: { id: true }
                                })];
                        case 4:
                            globalNewLoansStats = _a.sent();
                            totalRecaudo = Number(globalPayments._sum.montoTotal || 0) + Number(globalNewLoansStats._sum.cuotaInicial || 0);
                            totalMontoPrestamosNuevos = Number(globalNewLoansStats._sum.monto || 0);
                            totalPrestamosNuevos = globalNewLoansStats._count.id || 0;
                            return [4 /*yield*/, this.prisma.cuota.aggregate({
                                    where: {
                                        prestamo: {
                                            estado: { in: ['ACTIVO', 'EN_MORA'] },
                                        },
                                        OR: [
                                            {
                                                fechaVencimiento: {
                                                    gte: dateRange.startDate,
                                                    lte: dateRange.endDate,
                                                },
                                            },
                                            {
                                                estado: { in: ['PENDIENTE', 'PARCIAL', 'VENCIDA'] },
                                                fechaVencimiento: { lt: dateRange.startDate },
                                            },
                                            {
                                                estado: 'PAGADA',
                                                fechaVencimiento: { lt: dateRange.startDate },
                                                fechaPago: {
                                                    gte: dateRange.startDate,
                                                    lte: dateRange.endDate,
                                                },
                                            },
                                        ],
                                    },
                                    _sum: {
                                        monto: true,
                                        montoInteresMora: true,
                                    },
                                })];
                        case 5:
                            globalDuePayments = _a.sent();
                            totalMeta = Number(globalDuePayments._sum.monto || 0) +
                                Number(globalDuePayments._sum.montoInteresMora || 0) +
                                Number(globalNewLoansStats._sum.cuotaInicial || 0);
                            porcentajeGlobal = totalMeta > 0 ? Math.round((totalRecaudo / totalMeta) * 100) : 0;
                            return [4 /*yield*/, this.prisma.cliente.count({
                                    where: {
                                        creadoEn: {
                                            gte: dateRange.startDate,
                                            lte: dateRange.endDate,
                                        },
                                    },
                                })];
                        case 6:
                            totalAfiliaciones = _a.sent();
                            efectividadPromedio = routePerformance.length > 0
                                ? Math.round(routePerformance.reduce(function (sum, r) { return sum + (r.eficiencia || 0); }, 0) /
                                    routePerformance.length)
                                : 0;
                            return [2 /*return*/, {
                                    totalRecaudo: totalRecaudo,
                                    totalMeta: totalMeta,
                                    porcentajeGlobal: porcentajeGlobal,
                                    totalPrestamosNuevos: totalPrestamosNuevos,
                                    totalAfiliaciones: totalAfiliaciones,
                                    efectividadPromedio: efectividadPromedio,
                                    totalMontoPrestamosNuevos: totalMontoPrestamosNuevos,
                                    rendimientoRutas: routePerformance,
                                    periodo: period,
                                    fechaInicio: dateRange.startDate,
                                    fechaFin: dateRange.endDate,
                                }];
                    }
                });
            });
        };
        ReportsService_1.prototype.getRouteDetail = function (routeId, filters) {
            return __awaiter(this, void 0, void 0, function () {
                var route, dateRange, assignments, clientIds, payments, totalCollected, paymentCount, paymentsByDay;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.ruta.findUnique({
                                where: { id: routeId },
                                include: {
                                    cobrador: {
                                        select: {
                                            id: true,
                                            nombres: true,
                                            apellidos: true,
                                            telefono: true,
                                        },
                                    },
                                    supervisor: {
                                        select: {
                                            id: true,
                                            nombres: true,
                                            apellidos: true,
                                        },
                                    },
                                },
                            })];
                        case 1:
                            route = _a.sent();
                            if (!route) {
                                throw new common_1.NotFoundException("Ruta con ID ".concat(routeId, " no encontrada"));
                            }
                            dateRange = (0, date_utils_1.calculateDateRange)(filters.period, filters.startDate, filters.endDate);
                            return [4 /*yield*/, this.prisma.asignacionRuta.findMany({
                                    where: {
                                        rutaId: routeId,
                                        activa: true,
                                    },
                                    include: {
                                        cliente: {
                                            include: {
                                                prestamos: {
                                                    where: {
                                                        estado: 'ACTIVO',
                                                    },
                                                    include: {
                                                        cuotas: {
                                                            where: {
                                                                fechaVencimiento: {
                                                                    gte: dateRange.startDate,
                                                                    lte: dateRange.endDate,
                                                                },
                                                            },
                                                            orderBy: {
                                                                fechaVencimiento: 'asc',
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                })];
                        case 2:
                            assignments = _a.sent();
                            clientIds = assignments.map(function (a) { return a.cliente.id; });
                            return [4 /*yield*/, this.prisma.pago.findMany({
                                    where: {
                                        clienteId: { in: clientIds },
                                        fechaPago: {
                                            gte: dateRange.startDate,
                                            lte: dateRange.endDate,
                                        },
                                    },
                                    include: {
                                        cliente: {
                                            select: {
                                                nombres: true,
                                                apellidos: true,
                                            },
                                        },
                                        detalles: {
                                            include: {
                                                cuota: true,
                                            },
                                        },
                                    },
                                    orderBy: {
                                        fechaPago: 'desc',
                                    },
                                })];
                        case 3:
                            payments = _a.sent();
                            totalCollected = payments.reduce(function (sum, p) { return sum + Number(p.montoTotal); }, 0);
                            paymentCount = payments.length;
                            return [4 /*yield*/, this.prisma.$queryRaw(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      SELECT \n        DATE(\"fechaPago\") as dia,\n        COUNT(*) as cantidad,\n        SUM(\"montoTotal\") as total\n      FROM \"pagos\"\n      WHERE \"clienteId\" IN (", ")\n        AND \"fechaPago\" >= ", "\n        AND \"fechaPago\" <= ", "\n      GROUP BY DATE(\"fechaPago\")\n      ORDER BY dia\n    "], ["\n      SELECT \n        DATE(\"fechaPago\") as dia,\n        COUNT(*) as cantidad,\n        SUM(\"montoTotal\") as total\n      FROM \"pagos\"\n      WHERE \"clienteId\" IN (", ")\n        AND \"fechaPago\" >= ", "\n        AND \"fechaPago\" <= ", "\n      GROUP BY DATE(\"fechaPago\")\n      ORDER BY dia\n    "])), clientIds.join(','), dateRange.startDate, dateRange.endDate)];
                        case 4:
                            paymentsByDay = _a.sent();
                            return [2 /*return*/, {
                                    ruta: {
                                        id: route.id,
                                        nombre: route.nombre,
                                        codigo: route.codigo,
                                        zona: route.zona,
                                        cobrador: route.cobrador,
                                        supervisor: route.supervisor,
                                    },
                                    periodo: {
                                        tipo: filters.period,
                                        inicio: dateRange.startDate,
                                        fin: dateRange.endDate,
                                    },
                                    estadisticas: {
                                        totalClientes: assignments.length,
                                        totalRecaudado: totalCollected,
                                        totalPagos: paymentCount,
                                        promedioDiario: totalCollected / Math.max(1, dateRange.days),
                                        pagosPorDia: paymentsByDay,
                                    },
                                    pagosRecientes: payments.slice(0, 10).map(function (p) { return ({
                                        id: p.id,
                                        numeroPago: p.numeroPago,
                                        cliente: "".concat(p.cliente.nombres, " ").concat(p.cliente.apellidos),
                                        fecha: p.fechaPago,
                                        monto: p.montoTotal,
                                        metodo: p.metodoPago,
                                    }); }),
                                    clientesConPrestamos: assignments
                                        .filter(function (a) { return a.cliente.prestamos.length > 0; })
                                        .map(function (a) {
                                        var _a;
                                        return ({
                                            id: a.cliente.id,
                                            nombre: "".concat(a.cliente.nombres, " ").concat(a.cliente.apellidos),
                                            telefono: a.cliente.telefono,
                                            prestamosActivos: a.cliente.prestamos.length,
                                            proximaCuota: ((_a = a.cliente.prestamos[0]) === null || _a === void 0 ? void 0 : _a.cuotas[0]) || null,
                                        });
                                    }),
                                }];
                    }
                });
            });
        };
        ReportsService_1.prototype.exportOperationalReport = function (filters, format) {
            return __awaiter(this, void 0, void 0, function () {
                var reportData, fecha, filas, resumen;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getOperationalReport(filters)];
                        case 1:
                            reportData = _a.sent();
                            fecha = new Date().toISOString().split('T')[0];
                            filas = (reportData.rendimientoRutas || []).map(function (r) { return ({
                                ruta: r.ruta || '',
                                cobrador: r.cobrador || '',
                                meta: Number(r.meta || 0),
                                recaudado: Number(r.recaudado || 0),
                                eficiencia: Number(r.eficiencia || 0),
                                nuevosPrestamos: Number(r.nuevosPrestamos || 0),
                                nuevosClientes: Number(r.nuevosClientes || 0),
                            }); });
                            resumen = {
                                totalRecaudo: Number(reportData.totalRecaudo || 0),
                                totalMeta: Number(reportData.totalMeta || 0),
                                porcentajeGlobal: Number(reportData.porcentajeGlobal || 0),
                                totalPrestamosNuevos: Number(reportData.totalPrestamosNuevos || 0),
                                totalAfiliaciones: Number(reportData.totalAfiliaciones || 0),
                                efectividadPromedio: Number(reportData.efectividadPromedio || 0),
                                periodo: String(reportData.periodo || filters.period || ''),
                                fechaInicio: String(reportData.fechaInicio || filters.startDate || ''),
                                fechaFin: String(reportData.fechaFin || filters.endDate || ''),
                            };
                            // 3. Delegamos al template
                            if (format === 'excel')
                                return [2 /*return*/, (0, reporte_operativo_template_1.generarExcelOperativo)(filas, resumen, fecha)];
                            if (format === 'pdf')
                                return [2 /*return*/, (0, reporte_operativo_template_1.generarPDFOperativo)(filas, resumen, fecha)];
                            throw new Error("Formato no soportado: ".concat(format));
                    }
                });
            });
        };
        ReportsService_1.prototype.exportFinancialReport = function (startDate, endDate, format) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, summary, monthly, expenses, fecha;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, Promise.all([
                                this.getFinancialSummary(startDate, endDate),
                                this.getMonthlyEvolution(startDate.getFullYear()),
                                this.getExpenseDistribution(startDate, endDate),
                            ])];
                        case 1:
                            _a = _b.sent(), summary = _a[0], monthly = _a[1], expenses = _a[2];
                            fecha = new Date().toISOString().split('T')[0];
                            // 2. Delegamos al template (datos ya procesados por los mÃ©todos del servicio)
                            if (format === 'excel')
                                return [2 /*return*/, (0, reporte_financiero_template_1.generarExcelFinanciero)(summary, monthly, expenses, fecha)];
                            if (format === 'pdf')
                                return [2 /*return*/, (0, reporte_financiero_template_1.generarPDFFinanciero)(summary, monthly, expenses, fecha)];
                            throw new Error("Formato no soportado: ".concat(format));
                    }
                });
            });
        };
        return ReportsService_1;
    }());
    __setFunctionName(_classThis, "ReportsService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ReportsService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ReportsService = _classThis;
}();
exports.ReportsService = ReportsService;
var templateObject_1;
