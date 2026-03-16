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
exports.LoansService = void 0;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var cartera_creditos_template_1 = require("../templates/exports/cartera-creditos.template");
var exports_1 = require("../templates/exports");
var LoansService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var LoansService = _classThis = /** @class */ (function () {
        function LoansService_1(prisma, notificacionesService, auditService, pushService, notificacionesGateway, configuracionService) {
            this.prisma = prisma;
            this.notificacionesService = notificacionesService;
            this.auditService = auditService;
            this.pushService = pushService;
            this.notificacionesGateway = notificacionesGateway;
            this.configuracionService = configuracionService;
            this.logger = new common_1.Logger(LoansService.name);
        }
        LoansService_1.prototype.onModuleInit = function () {
            return __awaiter(this, void 0, void 0, function () {
                var result, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            // Ejecutar automáticamente la corrección de intereses al arrancar (Deploy en Render)
                            this.logger.log('🔄 [AUTO-FIX] Verificando e iniciando corrección de intereses al arranque...');
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, this.fixInterestCalculations()];
                        case 2:
                            result = _a.sent();
                            this.logger.log("\u2705 [AUTO-FIX] Proceso completado. ".concat(result.corrected, " pr\u00E9stamos corregidos de ").concat(result.processed, " verificados."));
                            return [3 /*break*/, 4];
                        case 3:
                            error_1 = _a.sent();
                            this.logger.error("\u274C [AUTO-FIX] Error durante la correcci\u00F3n autom\u00E1tica: ".concat(error_1));
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        LoansService_1.prototype.generarContrato = function (prestamoId) {
            return __awaiter(this, void 0, void 0, function () {
                var prestamo, fmtFecha, clienteNombre, vendedorNombre, precioContado, abonoInicial, montoFinanciado, interesTotal, totalAPagar, cuotaPromedio, frecuencia, saldo, cuotas, data;
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
                return __generator(this, function (_w) {
                    switch (_w.label) {
                        case 0: return [4 /*yield*/, this.prisma.prestamo.findUnique({
                                where: { id: prestamoId },
                                include: {
                                    cliente: true,
                                    producto: true,
                                    precioProducto: true,
                                    creadoPor: { select: { nombres: true, apellidos: true } },
                                    cuotas: { orderBy: { numeroCuota: 'asc' } },
                                },
                            })];
                        case 1:
                            prestamo = _w.sent();
                            if (!prestamo) {
                                throw new common_1.NotFoundException('Préstamo no encontrado');
                            }
                            if (prestamo.tipoPrestamo !== 'ARTICULO') {
                                throw new common_1.BadRequestException('Este préstamo no corresponde a un crédito de artículo');
                            }
                            fmtFecha = function (d) {
                                return d ? new Date(d).toLocaleDateString('es-CO') : '';
                            };
                            clienteNombre = "".concat(((_a = prestamo.cliente) === null || _a === void 0 ? void 0 : _a.nombres) || '', " ").concat(((_b = prestamo.cliente) === null || _b === void 0 ? void 0 : _b.apellidos) || '').trim();
                            vendedorNombre = "".concat(((_c = prestamo.creadoPor) === null || _c === void 0 ? void 0 : _c.nombres) || '', " ").concat(((_d = prestamo.creadoPor) === null || _d === void 0 ? void 0 : _d.apellidos) || '').trim();
                            precioContado = ((_e = prestamo.precioProducto) === null || _e === void 0 ? void 0 : _e.precio)
                                ? Number(prestamo.precioProducto.precio)
                                : 0;
                            abonoInicial = prestamo.cuotaInicial ? Number(prestamo.cuotaInicial) : 0;
                            montoFinanciado = prestamo.monto ? Number(prestamo.monto) : 0;
                            interesTotal = prestamo.interesTotal ? Number(prestamo.interesTotal) : 0;
                            totalAPagar = montoFinanciado + interesTotal;
                            cuotaPromedio = ((_f = prestamo.cuotas) === null || _f === void 0 ? void 0 : _f.length)
                                ? Number(prestamo.cuotas[0].monto)
                                : 0;
                            frecuencia = (function () {
                                switch (prestamo.frecuenciaPago) {
                                    case 'SEMANAL': return 'SEMANAL';
                                    case 'QUINCENAL': return 'QUINCENAL';
                                    case 'MENSUAL': return 'MENSUAL';
                                    default: return undefined;
                                }
                            })();
                            saldo = totalAPagar;
                            cuotas = (prestamo.cuotas || []).map(function (c) {
                                var _a, _b;
                                var valorCuota = Number(c.monto);
                                saldo = Math.max(0, saldo - valorCuota);
                                return {
                                    numero: Number(c.numeroCuota),
                                    fechaVenc: fmtFecha(c.fechaVencimiento),
                                    capital: Number((_a = c.montoCapital) !== null && _a !== void 0 ? _a : 0),
                                    interes: Number((_b = c.montoInteres) !== null && _b !== void 0 ? _b : 0),
                                    valorCuota: valorCuota,
                                    saldo: saldo,
                                };
                            });
                            data = {
                                numeroPrestamo: prestamo.numeroPrestamo,
                                tipo: 'CREDITO',
                                fechaContrato: fmtFecha((_g = prestamo.fechaInicio) !== null && _g !== void 0 ? _g : prestamo.creadoEn),
                                clienteNombre: clienteNombre,
                                clienteCedula: String((_j = (_h = prestamo.cliente) === null || _h === void 0 ? void 0 : _h.dni) !== null && _j !== void 0 ? _j : ''),
                                clienteTelefono: ((_k = prestamo.cliente) === null || _k === void 0 ? void 0 : _k.telefono) ? String((_l = prestamo.cliente) === null || _l === void 0 ? void 0 : _l.telefono) : undefined,
                                clienteDireccion: ((_m = prestamo.cliente) === null || _m === void 0 ? void 0 : _m.direccion) ? String((_o = prestamo.cliente) === null || _o === void 0 ? void 0 : _o.direccion) : undefined,
                                articulo: ((_p = prestamo.producto) === null || _p === void 0 ? void 0 : _p.nombre) || 'Artículo',
                                marca: ((_q = prestamo.producto) === null || _q === void 0 ? void 0 : _q.marca) ? String((_r = prestamo.producto) === null || _r === void 0 ? void 0 : _r.marca) : undefined,
                                modelo: ((_s = prestamo.producto) === null || _s === void 0 ? void 0 : _s.modelo) ? String((_t = prestamo.producto) === null || _t === void 0 ? void 0 : _t.modelo) : undefined,
                                precioContado: precioContado,
                                abonoInicial: abonoInicial,
                                montoFinanciado: montoFinanciado,
                                tasaInteres: prestamo.tasaInteres ? Number(prestamo.tasaInteres) : 0,
                                interesTotal: interesTotal,
                                totalAPagar: totalAPagar,
                                numeroCuotas: prestamo.cantidadCuotas ? Number(prestamo.cantidadCuotas) : undefined,
                                frecuencia: frecuencia,
                                valorCuota: cuotaPromedio,
                                fechaPrimerPago: ((_u = prestamo.cuotas) === null || _u === void 0 ? void 0 : _u.length) ? fmtFecha(prestamo.cuotas[0].fechaVencimiento) : undefined,
                                fechaUltimoPago: ((_v = prestamo.cuotas) === null || _v === void 0 ? void 0 : _v.length) ? fmtFecha(prestamo.cuotas[prestamo.cuotas.length - 1].fechaVencimiento) : undefined,
                                cuotas: cuotas,
                                vendedorNombre: vendedorNombre || undefined,
                            };
                            return [2 /*return*/, (0, exports_1.generarContratoPDF)(data)];
                    }
                });
            });
        };
        /**
         * Genera tabla de amortización francesa (cuota fija).
         * La tasa que recibe es la tasa MENSUAL del crédito (ej: 10 = 10% mensual).
         * La conversión a tasa por período se hace de forma compuesta:
         * i_periodo = (1 + i_mensual)^(fracción del mes) - 1
         *
         * @param capital      Monto a financiar
         * @param tasaTotal    Tasa de interés mensual del crédito (%)
         * @param numCuotas    Cantidad de cuotas
         * @param plazoMeses   Plazo en meses (no afecta el cálculo de i_periodo)
         * @param frecuencia   Frecuencia de pago
         * @returns { cuotaFija, interesTotal, tabla[] }
         */
        LoansService_1.prototype.calcularAmortizacionFrancesa = function (capital, tasaTotal, numCuotas, plazoMeses, frecuencia) {
            if (numCuotas <= 0 || capital <= 0) {
                return { cuotaFija: 0, interesTotal: 0, tabla: [] };
            }
            // Convertir tasa mensual (%) a tasa mensual decimal
            var tasaMensual = tasaTotal / 100;
            // Convertir a tasa por período de forma compuesta
            // (1 + i_m)^(fracción) - 1
            var fraccionMes = 1;
            switch (frecuencia) {
                case client_1.FrecuenciaPago.DIARIO:
                    fraccionMes = 1 / 30;
                    break;
                case client_1.FrecuenciaPago.SEMANAL:
                    fraccionMes = 1 / 4;
                    break;
                case client_1.FrecuenciaPago.QUINCENAL:
                    fraccionMes = 1 / 2;
                    break;
                case client_1.FrecuenciaPago.MENSUAL:
                default:
                    fraccionMes = 1;
                    break;
            }
            var tasaPeriodo = Math.pow(1 + tasaMensual, fraccionMes) - 1;
            // Si la tasa es 0, amortización lineal pura
            if (tasaPeriodo === 0) {
                var cuotaFija_1 = capital / numCuotas;
                return {
                    cuotaFija: Math.round(cuotaFija_1 * 100) / 100,
                    interesTotal: 0,
                    tabla: Array.from({ length: numCuotas }, function (_, i) { return ({
                        numeroCuota: i + 1,
                        montoCapital: Math.round((capital / numCuotas) * 100) / 100,
                        montoInteres: 0,
                        monto: Math.round(cuotaFija_1 * 100) / 100,
                        saldoRestante: Math.round((capital - (capital / numCuotas) * (i + 1)) * 100) / 100,
                    }); }),
                };
            }
            // Fórmula francesa: C = P × r / (1 - (1+r)^-n)
            var cuotaFija = (capital * tasaPeriodo) / (1 - Math.pow(1 + tasaPeriodo, -numCuotas));
            var saldo = capital;
            var interesTotalAcumulado = 0;
            var tabla = [];
            for (var i = 0; i < numCuotas; i++) {
                var interesPeriodo = saldo * tasaPeriodo;
                var capitalPeriodo = cuotaFija - interesPeriodo;
                // Última cuota: ajustar para cerrar el saldo exacto
                if (i === numCuotas - 1) {
                    capitalPeriodo = saldo;
                }
                saldo = Math.max(0, saldo - capitalPeriodo);
                interesTotalAcumulado += interesPeriodo;
                var montoCuota = capitalPeriodo + interesPeriodo;
                tabla.push({
                    numeroCuota: i + 1,
                    montoCapital: Math.round(capitalPeriodo * 100) / 100,
                    montoInteres: Math.round(interesPeriodo * 100) / 100,
                    monto: Math.round(montoCuota * 100) / 100,
                    saldoRestante: Math.round(saldo * 100) / 100,
                });
            }
            return {
                cuotaFija: Math.round(cuotaFija * 100) / 100,
                interesTotal: Math.round(interesTotalAcumulado * 100) / 100,
                tabla: tabla,
            };
        };
        LoansService_1.prototype.calcularFechaVencimiento = function (fechaBase, numeroCuota, frecuencia) {
            var fecha = new Date(fechaBase);
            var offset = Math.max(0, numeroCuota - 1);
            switch (frecuencia) {
                case client_1.FrecuenciaPago.DIARIO:
                    fecha.setDate(fecha.getDate() + offset);
                    break;
                case client_1.FrecuenciaPago.SEMANAL:
                    fecha.setDate(fecha.getDate() + offset * 7);
                    break;
                case client_1.FrecuenciaPago.QUINCENAL:
                    fecha.setDate(fecha.getDate() + offset * 15);
                    break;
                case client_1.FrecuenciaPago.MENSUAL:
                    fecha.setMonth(fecha.getMonth() + offset);
                    break;
            }
            return fecha;
        };
        LoansService_1.prototype.getAllLoans = function (filters) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, estado, _b, ruta, _c, search, _d, tipo, _e, page, _f, limit, skip, where, estadosValidos, searchTerm, _g, prestamos, total, whereStats, _h, totalPrestamos, activos, enMora, incumplidos, perdida, pagados, totales, moraTotal, prestamosTransformados, error_2;
                var _this = this;
                var _j, _k, _l;
                return __generator(this, function (_m) {
                    switch (_m.label) {
                        case 0:
                            _m.trys.push([0, 3, , 4]);
                            this.logger.log("Getting loans with filters: ".concat(JSON.stringify(filters)));
                            _a = filters.estado, estado = _a === void 0 ? 'todos' : _a, _b = filters.ruta, ruta = _b === void 0 ? 'todas' : _b, _c = filters.search, search = _c === void 0 ? '' : _c, _d = filters.tipo, tipo = _d === void 0 ? 'todos' : _d, _e = filters.page, page = _e === void 0 ? 1 : _e, _f = filters.limit, limit = _f === void 0 ? 8 : _f;
                            skip = (page - 1) * limit;
                            where = {
                                eliminadoEn: null, // Solo préstamos no eliminados
                            };
                            // Filtro por tipo de préstamo
                            if (tipo !== 'todos' && tipo !== '') {
                                where.tipoPrestamo = tipo;
                            }
                            // Filtro por estado
                            if (estado !== 'todos') {
                                estadosValidos = Object.values(client_1.EstadoPrestamo);
                                if (estadosValidos.includes(estado)) {
                                    where.estado = estado;
                                }
                                else {
                                    this.logger.warn("Estado inv\u00E1lido recibido: ".concat(estado));
                                }
                            }
                            // Filtro por ruta (usando asignaciones de ruta)
                            if (ruta !== 'todas' && ruta !== '') {
                                where.cliente = {
                                    asignacionesRuta: {
                                        some: {
                                            rutaId: ruta,
                                            activa: true,
                                        },
                                    },
                                };
                            }
                            // Filtro por búsqueda
                            if (search && search.trim() !== '') {
                                searchTerm = search.trim();
                                where.OR = [
                                    {
                                        numeroPrestamo: {
                                            contains: searchTerm,
                                            mode: 'insensitive',
                                        },
                                    },
                                    {
                                        cliente: {
                                            OR: [
                                                {
                                                    nombres: {
                                                        contains: searchTerm,
                                                        mode: client_1.Prisma.QueryMode.insensitive,
                                                    },
                                                },
                                                {
                                                    apellidos: {
                                                        contains: searchTerm,
                                                        mode: client_1.Prisma.QueryMode.insensitive,
                                                    },
                                                },
                                                {
                                                    dni: {
                                                        contains: searchTerm,
                                                        mode: client_1.Prisma.QueryMode.insensitive,
                                                    },
                                                },
                                            ],
                                        },
                                    },
                                    {
                                        producto: {
                                            nombre: {
                                                contains: searchTerm,
                                                mode: client_1.Prisma.QueryMode.insensitive,
                                            },
                                        },
                                    },
                                ];
                            }
                            this.logger.log("Query where clause: ".concat(JSON.stringify(where)));
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.prestamo.findMany({
                                        where: where,
                                        include: {
                                            cliente: {
                                                select: {
                                                    id: true,
                                                    nombres: true,
                                                    apellidos: true,
                                                    dni: true,
                                                    telefono: true,
                                                    nivelRiesgo: true,
                                                    // Incluir asignaciones de ruta dentro del mismo select del cliente
                                                    asignacionesRuta: {
                                                        where: { activa: true },
                                                        select: {
                                                            ruta: {
                                                                select: {
                                                                    id: true,
                                                                    nombre: true,
                                                                    codigo: true,
                                                                },
                                                            },
                                                        },
                                                        take: 1,
                                                    },
                                                },
                                            },
                                            producto: {
                                                select: {
                                                    id: true,
                                                    nombre: true,
                                                    categoria: true,
                                                },
                                            },
                                            precioProducto: {
                                                select: {
                                                    id: true,
                                                    meses: true,
                                                    precio: true,
                                                },
                                            },
                                            cuotas: {
                                                select: {
                                                    id: true,
                                                    numeroCuota: true,
                                                    estado: true,
                                                    fechaVencimiento: true,
                                                    monto: true,
                                                    montoPagado: true,
                                                    montoInteresMora: true,
                                                },
                                            },
                                            creadoPor: {
                                                select: {
                                                    id: true,
                                                    nombres: true,
                                                    apellidos: true,
                                                },
                                            },
                                        },
                                        skip: skip,
                                        take: limit,
                                        orderBy: { creadoEn: 'desc' },
                                    }),
                                    this.prisma.prestamo.count({ where: where }),
                                ])];
                        case 1:
                            _g = _m.sent(), prestamos = _g[0], total = _g[1];
                            this.logger.log("Found ".concat(prestamos.length, " loans, total: ").concat(total));
                            whereStats = { eliminadoEn: null };
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.prestamo.count({ where: whereStats }),
                                    this.prisma.prestamo.count({
                                        where: __assign(__assign({}, whereStats), { estado: client_1.EstadoPrestamo.ACTIVO }),
                                    }),
                                    this.prisma.prestamo.count({
                                        where: __assign(__assign({}, whereStats), { estado: client_1.EstadoPrestamo.EN_MORA }),
                                    }),
                                    this.prisma.prestamo.count({
                                        where: __assign(__assign({}, whereStats), { estado: client_1.EstadoPrestamo.INCUMPLIDO }),
                                    }),
                                    this.prisma.prestamo.count({
                                        where: __assign(__assign({}, whereStats), { estado: client_1.EstadoPrestamo.PERDIDA }),
                                    }),
                                    this.prisma.prestamo.count({
                                        where: __assign(__assign({}, whereStats), { estado: client_1.EstadoPrestamo.PAGADO }),
                                    }),
                                    this.prisma.prestamo.aggregate({
                                        where: whereStats,
                                        _sum: {
                                            monto: true,
                                            saldoPendiente: true,
                                        },
                                    }),
                                    this.prisma.prestamo.aggregate({
                                        where: __assign(__assign({}, whereStats), { estado: client_1.EstadoPrestamo.EN_MORA }),
                                        _sum: {
                                            saldoPendiente: true,
                                        },
                                    }),
                                ])];
                        case 2:
                            _h = _m.sent(), totalPrestamos = _h[0], activos = _h[1], enMora = _h[2], incumplidos = _h[3], perdida = _h[4], pagados = _h[5], totales = _h[6], moraTotal = _h[7];
                            prestamosTransformados = prestamos.map(function (prestamo) {
                                var _a, _b;
                                try {
                                    // Calcular campos adicionales
                                    var cuotas = prestamo.cuotas || [];
                                    var cuotasPagadas = cuotas.filter(function (c) { return c.estado === client_1.EstadoCuota.PAGADA; }).length;
                                    var cuotasTotales = cuotas.length;
                                    var cuotasVencidas = cuotas.filter(function (c) { return c.estado === client_1.EstadoCuota.VENCIDA; }).length;
                                    // Manejar valores numéricos de forma segura
                                    var monto = Number(prestamo.monto) || 0;
                                    var interesTotal = Number(prestamo.interesTotal) || 0;
                                    var saldoPendiente = Number(prestamo.saldoPendiente) || 0;
                                    var totalPagado = Number(prestamo.totalPagado) || 0;
                                    var montoTotal = monto + interesTotal;
                                    var montoPendiente = saldoPendiente;
                                    var montoPagado = totalPagado;
                                    // Calcular mora acumulada de forma segura
                                    var moraAcumulada = cuotas.reduce(function (sum, cuota) {
                                        if (cuota.estado === client_1.EstadoCuota.VENCIDA) {
                                            return sum + (Number(cuota.montoInteresMora) || 0);
                                        }
                                        return sum;
                                    }, 0);
                                    // Determinar tipo de producto
                                    var tipoProducto = 'efectivo';
                                    if (prestamo.producto) {
                                        var categoria = (prestamo.producto.categoria || '').toLowerCase();
                                        if (categoria.includes('electrodoméstico') ||
                                            categoria.includes('electro')) {
                                            tipoProducto = 'electrodomestico';
                                        }
                                        else if (categoria.includes('mueble')) {
                                            tipoProducto = 'mueble';
                                        }
                                        else {
                                            tipoProducto = categoria;
                                        }
                                    }
                                    // Obtener ruta del cliente (si existe) - CORREGIDO
                                    var rutaAsignada = 'Sin asignar';
                                    var rutaNombre = 'Sin asignar';
                                    if (prestamo.cliente &&
                                        prestamo.cliente.asignacionesRuta &&
                                        prestamo.cliente.asignacionesRuta.length > 0) {
                                        var asignacion = prestamo.cliente.asignacionesRuta[0];
                                        if (asignacion.ruta) {
                                            rutaAsignada = asignacion.ruta.codigo || asignacion.ruta.id;
                                            rutaNombre = asignacion.ruta.nombre || 'Ruta asignada';
                                        }
                                    }
                                    return {
                                        id: prestamo.id || '',
                                        numeroPrestamo: prestamo.numeroPrestamo || 'N/A',
                                        clienteId: prestamo.clienteId || '',
                                        cliente: "".concat(prestamo.cliente.nombres || '', " ").concat(prestamo.cliente.apellidos || '').trim(),
                                        clienteDni: prestamo.cliente.dni || '',
                                        clienteTelefono: prestamo.cliente.telefono || '',
                                        producto: ((_a = prestamo.producto) === null || _a === void 0 ? void 0 : _a.nombre) || 'Préstamo en efectivo',
                                        tipoProducto: tipoProducto,
                                        tipoPrestamo: prestamo.tipoPrestamo,
                                        montoTotal: montoTotal,
                                        montoPendiente: montoPendiente,
                                        montoPagado: montoPagado,
                                        cuotaInicial: Number(prestamo.cuotaInicial) || 0,
                                        valorCuota: cuotas.length > 0 ? Number(cuotas[0].monto) : 0,
                                        tasaInteres: Number(prestamo.tasaInteres) || 0,
                                        frecuenciaPago: prestamo.frecuenciaPago,
                                        moraAcumulada: moraAcumulada,
                                        cuotasPagadas: cuotasPagadas,
                                        cuotasTotales: cuotasTotales,
                                        cuotasVencidas: cuotasVencidas,
                                        estado: prestamo.estado || client_1.EstadoPrestamo.BORRADOR,
                                        riesgo: prestamo.cliente.nivelRiesgo || client_1.NivelRiesgo.VERDE,
                                        ruta: rutaAsignada,
                                        rutaNombre: rutaNombre,
                                        vendedor: ((_b = prestamo.creadoPor) === null || _b === void 0 ? void 0 : _b.nombres) || 'Sin asignar',
                                        fechaInicio: prestamo.fechaInicio || new Date(),
                                        fechaFin: prestamo.fechaFin || new Date(),
                                        creadoEn: prestamo.creadoEn || new Date(),
                                        progreso: cuotasTotales > 0 ? (cuotasPagadas / cuotasTotales) * 100 : 0,
                                    };
                                }
                                catch (error) {
                                    _this.logger.error("Error transforming loan ".concat(prestamo.id, ":"), error);
                                    // Devolver un objeto seguro en caso de error
                                    return {
                                        id: prestamo.id || 'error',
                                        numeroPrestamo: prestamo.numeroPrestamo || 'ERROR',
                                        clienteId: '',
                                        cliente: 'Error al cargar',
                                        clienteDni: '',
                                        clienteTelefono: '',
                                        producto: 'Error',
                                        tipoProducto: 'efectivo',
                                        montoTotal: 0,
                                        montoPendiente: 0,
                                        montoPagado: 0,
                                        moraAcumulada: 0,
                                        cuotasPagadas: 0,
                                        cuotasTotales: 0,
                                        cuotasVencidas: 0,
                                        estado: client_1.EstadoPrestamo.BORRADOR,
                                        riesgo: client_1.NivelRiesgo.VERDE,
                                        ruta: 'Error',
                                        rutaNombre: 'Error',
                                        fechaInicio: new Date(),
                                        fechaFin: new Date(),
                                        progreso: 0,
                                    };
                                }
                            });
                            return [2 /*return*/, {
                                    prestamos: prestamosTransformados,
                                    estadisticas: {
                                        total: totalPrestamos || 0,
                                        activos: activos || 0,
                                        atrasados: enMora || 0,
                                        morosos: (incumplidos || 0) + (perdida || 0),
                                        pagados: pagados || 0,
                                        cancelados: perdida || 0,
                                        montoTotal: Number(((_j = totales._sum) === null || _j === void 0 ? void 0 : _j.monto) || 0),
                                        montoPendiente: Number(((_k = totales._sum) === null || _k === void 0 ? void 0 : _k.saldoPendiente) || 0),
                                        moraTotal: Number(((_l = moraTotal._sum) === null || _l === void 0 ? void 0 : _l.saldoPendiente) || 0),
                                    },
                                    paginacion: {
                                        total: total || 0,
                                        pagina: page,
                                        limite: limit,
                                        totalPaginas: Math.ceil((total || 0) / limit),
                                    },
                                }];
                        case 3:
                            error_2 = _m.sent();
                            this.logger.error('Error in getAllLoans:', error_2);
                            // Devolver respuesta segura en caso de error
                            return [2 /*return*/, {
                                    prestamos: [],
                                    estadisticas: {
                                        total: 0,
                                        activos: 0,
                                        atrasados: 0,
                                        morosos: 0,
                                        pagados: 0,
                                        cancelados: 0,
                                        montoTotal: 0,
                                        montoPendiente: 0,
                                        moraTotal: 0,
                                    },
                                    paginacion: {
                                        total: 0,
                                        pagina: filters.page || 1,
                                        limite: filters.limit || 8,
                                        totalPaginas: 0,
                                    },
                                }];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        LoansService_1.prototype.getLoanById = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var prestamo, error_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, this.prisma.prestamo.findUnique({
                                    where: {
                                        id: id,
                                        eliminadoEn: null, // Solo si no está eliminado
                                    },
                                    include: {
                                        archivos: {
                                            where: { estado: 'ACTIVO' },
                                        },
                                        cliente: {
                                            include: {
                                                archivos: true,
                                                asignacionesRuta: {
                                                    where: { activa: true },
                                                    include: {
                                                        ruta: true,
                                                    },
                                                },
                                            },
                                        },
                                        producto: true,
                                        precioProducto: true,
                                        cuotas: {
                                            orderBy: { numeroCuota: 'asc' },
                                        },
                                        pagos: {
                                            include: {
                                                detalles: true,
                                            },
                                            orderBy: { fechaPago: 'desc' },
                                        },
                                        extensiones: {
                                            orderBy: { creadoEn: 'desc' },
                                        },
                                        creadoPor: {
                                            select: {
                                                id: true,
                                                nombres: true,
                                                apellidos: true,
                                                rol: true,
                                            },
                                        },
                                        aprobadoPor: {
                                            select: {
                                                id: true,
                                                nombres: true,
                                                apellidos: true,
                                                rol: true,
                                            },
                                        },
                                    },
                                })];
                        case 1:
                            prestamo = _a.sent();
                            if (!prestamo) {
                                throw new common_1.NotFoundException('Préstamo no encontrado');
                            }
                            return [2 /*return*/, prestamo];
                        case 2:
                            error_3 = _a.sent();
                            this.logger.error("Error getting loan ".concat(id, ":"), error_3);
                            throw error_3;
                        case 3: return [2 /*return*/];
                    }
                });
            });
        };
        LoansService_1.prototype.getLoanByIdIncludingArchived = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var prestamo, error_4;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, this.prisma.prestamo.findUnique({
                                    where: {
                                        id: id,
                                    },
                                    include: {
                                        archivos: {
                                            where: { estado: 'ACTIVO' },
                                        },
                                        cliente: {
                                            include: {
                                                archivos: true,
                                                asignacionesRuta: {
                                                    where: { activa: true },
                                                    include: {
                                                        ruta: true,
                                                    },
                                                },
                                            },
                                        },
                                        producto: true,
                                        precioProducto: true,
                                        cuotas: {
                                            orderBy: { numeroCuota: 'asc' },
                                        },
                                        pagos: {
                                            include: {
                                                detalles: true,
                                            },
                                            orderBy: { fechaPago: 'desc' },
                                        },
                                        extensiones: {
                                            orderBy: { creadoEn: 'desc' },
                                        },
                                        creadoPor: {
                                            select: {
                                                id: true,
                                                nombres: true,
                                                apellidos: true,
                                                rol: true,
                                            },
                                        },
                                        aprobadoPor: {
                                            select: {
                                                id: true,
                                                nombres: true,
                                                apellidos: true,
                                                rol: true,
                                            },
                                        },
                                    },
                                })];
                        case 1:
                            prestamo = _a.sent();
                            if (!prestamo) {
                                throw new common_1.NotFoundException('Préstamo no encontrado');
                            }
                            return [2 /*return*/, prestamo];
                        case 2:
                            error_4 = _a.sent();
                            this.logger.error("Error getting archived loan ".concat(id, ":"), error_4);
                            throw error_4;
                        case 3: return [2 /*return*/];
                    }
                });
            });
        };
        LoansService_1.prototype.deleteLoan = function (id, userId) {
            return __awaiter(this, void 0, void 0, function () {
                var prestamo, prestamoEliminado, error_5;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 5, , 6]);
                            return [4 /*yield*/, this.prisma.prestamo.findUnique({
                                    where: {
                                        id: id,
                                        eliminadoEn: null, // Solo si no está eliminado
                                    },
                                })];
                        case 1:
                            prestamo = _a.sent();
                            if (!prestamo) {
                                throw new common_1.NotFoundException('Préstamo no encontrado');
                            }
                            return [4 /*yield*/, this.prisma.prestamo.update({
                                    where: { id: id },
                                    data: {
                                        estado: client_1.EstadoPrestamo.PERDIDA,
                                        eliminadoEn: new Date(),
                                        estadoSincronizacion: 'PENDIENTE',
                                    },
                                })];
                        case 2:
                            prestamoEliminado = _a.sent();
                            // Eliminar o anular aprobaciones pendientes para este préstamo
                            // Esto asegura que desaparezca del módulo de revisiones
                            return [4 /*yield*/, this.prisma.aprobacion.updateMany({
                                    where: {
                                        referenciaId: id,
                                        estado: client_1.EstadoAprobacion.PENDIENTE,
                                    },
                                    data: {
                                        estado: client_1.EstadoAprobacion.RECHAZADO,
                                        comentarios: 'Crédito archivado antes de aprobación',
                                        revisadoEn: new Date(),
                                    },
                                })];
                        case 3:
                            // Eliminar o anular aprobaciones pendientes para este préstamo
                            // Esto asegura que desaparezca del módulo de revisiones
                            _a.sent();
                            // Auditoría
                            return [4 /*yield*/, this.auditService.create({
                                    usuarioId: userId,
                                    accion: 'ELIMINAR_PRESTAMO',
                                    entidad: 'Prestamo',
                                    entidadId: prestamo.id,
                                    datosAnteriores: {
                                        eliminadoEn: null,
                                        estado: prestamo.estado,
                                        numeroPrestamo: prestamo.numeroPrestamo
                                    },
                                    datosNuevos: {
                                        eliminadoEn: prestamoEliminado.eliminadoEn,
                                        estado: prestamoEliminado.estado,
                                    },
                                })];
                        case 4:
                            // Auditoría
                            _a.sent();
                            return [2 /*return*/, prestamoEliminado];
                        case 5:
                            error_5 = _a.sent();
                            this.logger.error("Error deleting loan ".concat(id, ":"), error_5);
                            throw error_5;
                        case 6: return [2 /*return*/];
                    }
                });
            });
        };
        LoansService_1.prototype.updateLoan = function (id, updateData, userId) {
            return __awaiter(this, void 0, void 0, function () {
                var prestamo_1, datosAnteriores, archivos, data, estadosValidos, newMonto, newTasa, newInteresTotal, shouldRecalculateFinancing, shouldRegenerateCuotas, cantidadCuotas, frecuenciaPago_1, tipoAmortizacion, cuotasData, amortizacion, montoTotalSimple, montoCuota_1, montoCapitalCuota_1, montoInteresCuota_1, prestamoActualizado_1, activos, cloudName_1, nuevosArchivos, estadoAnterior, estadoNuevo, cambioEstado, clienteNombre, tituloBase, msgBase, actorNombre, usuario, _a, metadataBase, e_1, error_6;
                var _this = this;
                var _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            _e.trys.push([0, 23, , 24]);
                            return [4 /*yield*/, this.prisma.prestamo.findUnique({
                                    where: { id: id, eliminadoEn: null },
                                })];
                        case 1:
                            prestamo_1 = _e.sent();
                            if (!prestamo_1) {
                                throw new common_1.NotFoundException('Préstamo no encontrado');
                            }
                            datosAnteriores = {
                                monto: prestamo_1.monto,
                                tasaInteres: prestamo_1.tasaInteres,
                                plazoMeses: prestamo_1.plazoMeses,
                                frecuenciaPago: prestamo_1.frecuenciaPago,
                                estado: prestamo_1.estado,
                            };
                            archivos = updateData === null || updateData === void 0 ? void 0 : updateData.archivos;
                            data = { estadoSincronizacion: 'PENDIENTE' };
                            if (updateData.monto !== undefined)
                                data.monto = updateData.monto;
                            if (updateData.tasaInteres !== undefined)
                                data.tasaInteres = updateData.tasaInteres;
                            if (updateData.plazoMeses !== undefined)
                                data.plazoMeses = updateData.plazoMeses;
                            if (updateData.cantidadCuotas !== undefined)
                                data.cantidadCuotas = updateData.cantidadCuotas;
                            if (updateData.frecuenciaPago !== undefined)
                                data.frecuenciaPago = updateData.frecuenciaPago;
                            if (updateData.estado !== undefined) {
                                estadosValidos = Object.values(client_1.EstadoPrestamo);
                                if (estadosValidos.includes(updateData.estado)) {
                                    data.estado = updateData.estado;
                                }
                            }
                            if (updateData.notas !== undefined)
                                data.notas = updateData.notas;
                            if (updateData.garantia !== undefined)
                                data.garantia = updateData.garantia;
                            if (updateData.tasaInteresMora !== undefined)
                                data.tasaInteresMora = updateData.tasaInteresMora;
                            if (updateData.cuotaInicial !== undefined)
                                data.cuotaInicial = updateData.cuotaInicial;
                            if (updateData.tipoAmortizacion !== undefined)
                                data.tipoAmortizacion = updateData.tipoAmortizacion;
                            if (updateData.fechaInicio !== undefined)
                                data.fechaInicio = new Date(updateData.fechaInicio);
                            newMonto = data.monto !== undefined ? Number(data.monto) : Number(prestamo_1.monto);
                            newTasa = data.tasaInteres !== undefined ? Number(data.tasaInteres) : Number(prestamo_1.tasaInteres);
                            newInteresTotal = (newMonto * newTasa) / 100;
                            shouldRecalculateFinancing = data.monto !== undefined ||
                                data.tasaInteres !== undefined;
                            if (shouldRecalculateFinancing) {
                                data.interesTotal = newInteresTotal;
                                data.saldoPendiente = (newMonto + newInteresTotal) - Number(prestamo_1.totalPagado || 0);
                            }
                            shouldRegenerateCuotas = (data.cantidadCuotas !== undefined ||
                                data.monto !== undefined ||
                                data.tasaInteres !== undefined ||
                                data.frecuenciaPago !== undefined ||
                                data.tipoAmortizacion !== undefined);
                            if (!shouldRegenerateCuotas) return [3 /*break*/, 4];
                            cantidadCuotas = data.cantidadCuotas !== undefined
                                ? Number(data.cantidadCuotas)
                                : ((_b = prestamo_1.cantidadCuotas) !== null && _b !== void 0 ? _b : 0);
                            frecuenciaPago_1 = (data.frecuenciaPago !== undefined
                                ? data.frecuenciaPago
                                : prestamo_1.frecuenciaPago);
                            tipoAmortizacion = (data.tipoAmortizacion !== undefined
                                ? data.tipoAmortizacion
                                : (prestamo_1.tipoAmortizacion || client_1.TipoAmortizacion.INTERES_SIMPLE));
                            // Delete existing cuotas
                            return [4 /*yield*/, this.prisma.cuota.deleteMany({
                                    where: { prestamoId: id }
                                })];
                        case 2:
                            // Delete existing cuotas
                            _e.sent();
                            cuotasData = void 0;
                            if (tipoAmortizacion === client_1.TipoAmortizacion.FRANCESA) {
                                amortizacion = this.calcularAmortizacionFrancesa(newMonto, newTasa, cantidadCuotas, prestamo_1.plazoMeses, frecuenciaPago_1);
                                cuotasData = amortizacion.tabla.map(function (cuota) {
                                    var fechaBase = prestamo_1.fechaPrimerCobro || prestamo_1.fechaInicio;
                                    var fechaVencimiento = _this.calcularFechaVencimiento(fechaBase, cuota.numeroCuota, frecuenciaPago_1);
                                    return {
                                        prestamoId: id,
                                        numeroCuota: cuota.numeroCuota,
                                        fechaVencimiento: fechaVencimiento,
                                        monto: cuota.monto,
                                        montoCapital: cuota.montoCapital,
                                        montoInteres: cuota.montoInteres,
                                        estado: client_1.EstadoCuota.PENDIENTE,
                                    };
                                });
                            }
                            else {
                                montoTotalSimple = newMonto + newInteresTotal;
                                montoCuota_1 = cantidadCuotas > 0 ? montoTotalSimple / cantidadCuotas : 0;
                                montoCapitalCuota_1 = cantidadCuotas > 0 ? newMonto / cantidadCuotas : 0;
                                montoInteresCuota_1 = cantidadCuotas > 0 ? newInteresTotal / cantidadCuotas : 0;
                                cuotasData = Array.from({ length: cantidadCuotas }, function (_, i) {
                                    var fechaBase = prestamo_1.fechaPrimerCobro || prestamo_1.fechaInicio;
                                    var fechaVencimiento = _this.calcularFechaVencimiento(fechaBase, i + 1, frecuenciaPago_1);
                                    return {
                                        prestamoId: id,
                                        numeroCuota: i + 1,
                                        fechaVencimiento: fechaVencimiento,
                                        monto: Math.round(montoCuota_1 * 100) / 100,
                                        montoCapital: Math.round(montoCapitalCuota_1 * 100) / 100,
                                        montoInteres: Math.round(montoInteresCuota_1 * 100) / 100,
                                        estado: client_1.EstadoCuota.PENDIENTE,
                                    };
                                });
                            }
                            // Create new cuotas
                            return [4 /*yield*/, this.prisma.cuota.createMany({
                                    data: cuotasData
                                })];
                        case 3:
                            // Create new cuotas
                            _e.sent();
                            data.cantidadCuotas = cantidadCuotas;
                            _e.label = 4;
                        case 4: return [4 /*yield*/, this.prisma.prestamo.update({
                                where: { id: id },
                                data: data,
                                include: {
                                    cliente: true,
                                    producto: true,
                                    cuotas: true,
                                },
                            })];
                        case 5:
                            prestamoActualizado_1 = _e.sent();
                            if (!(archivos !== undefined)) return [3 /*break*/, 10];
                            this.logger.log("[DEBUG] Actualizando archivos para pr\u00E9stamo ".concat(id, ". Archivos recibidos: ").concat(Array.isArray(archivos) ? archivos.length : 'N/A'));
                            return [4 /*yield*/, this.prisma.multimedia.findMany({
                                    where: {
                                        prestamoId: id,
                                        estado: 'ACTIVO',
                                    },
                                    select: { id: true },
                                })];
                        case 6:
                            activos = _e.sent();
                            if (!(activos.length > 0)) return [3 /*break*/, 8];
                            return [4 /*yield*/, this.prisma.multimedia.updateMany({
                                    where: { id: { in: activos.map(function (a) { return a.id; }) } },
                                    data: {
                                        estado: 'ELIMINADO',
                                        eliminadoEn: new Date(),
                                    },
                                })];
                        case 7:
                            _e.sent();
                            _e.label = 8;
                        case 8:
                            if (!(Array.isArray(archivos) && archivos.length > 0)) return [3 /*break*/, 10];
                            cloudName_1 = process.env.CLOUDINARY_CLOUD_NAME;
                            nuevosArchivos = archivos.map(function (archivo) {
                                var _a;
                                var url = archivo.url || archivo.path || archivo.ruta;
                                var urlFinal = typeof url === 'string' && url.startsWith('http') ? url : undefined;
                                var rutaValue = String(archivo.ruta || archivo.path || archivo.nombreAlmacenamiento || '').trim();
                                var tipoArchivoValue = String(archivo.tipoArchivo || '').toLowerCase();
                                var isVideo = tipoArchivoValue.startsWith('video/');
                                var urlDerivada = (!urlFinal && cloudName_1 && rutaValue)
                                    ? "https://res.cloudinary.com/".concat(cloudName_1, "/").concat(isVideo ? 'video' : 'image', "/upload/").concat(rutaValue)
                                    : undefined;
                                return {
                                    prestamoId: id,
                                    tipoContenido: archivo.tipoContenido,
                                    tipoArchivo: archivo.tipoArchivo,
                                    formato: archivo.formato || ((_a = archivo.tipoArchivo) === null || _a === void 0 ? void 0 : _a.split('/')[1]) || 'jpg',
                                    nombreOriginal: archivo.nombreOriginal,
                                    nombreAlmacenamiento: archivo.nombreAlmacenamiento || archivo.nombreOriginal,
                                    ruta: archivo.ruta || archivo.path,
                                    url: urlFinal || urlDerivada,
                                    tamanoBytes: archivo.tamanoBytes || 0,
                                    subidoPorId: archivo.subidoPorId || userId || prestamoActualizado_1.creadoPorId,
                                    estado: 'ACTIVO',
                                };
                            });
                            return [4 /*yield*/, this.prisma.multimedia.createMany({
                                    data: nuevosArchivos,
                                })];
                        case 9:
                            _e.sent();
                            _e.label = 10;
                        case 10:
                            _e.trys.push([10, 20, , 21]);
                            estadoAnterior = prestamo_1.estado;
                            estadoNuevo = prestamoActualizado_1.estado;
                            cambioEstado = data.estado !== undefined && estadoAnterior !== estadoNuevo;
                            if (!cambioEstado) return [3 /*break*/, 19];
                            clienteNombre = "".concat(((_c = prestamoActualizado_1.cliente) === null || _c === void 0 ? void 0 : _c.nombres) || '', " ").concat(((_d = prestamoActualizado_1.cliente) === null || _d === void 0 ? void 0 : _d.apellidos) || '').trim();
                            tituloBase = "Cr\u00E9dito ".concat(prestamoActualizado_1.numeroPrestamo || '', " actualizado");
                            msgBase = "El cr\u00E9dito ".concat(prestamoActualizado_1.numeroPrestamo || '', " del cliente ").concat(clienteNombre || '', " cambi\u00F3 de ").concat(estadoAnterior, " a ").concat(estadoNuevo, ".");
                            actorNombre = '';
                            _e.label = 11;
                        case 11:
                            _e.trys.push([11, 13, , 14]);
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: { id: userId },
                                    select: { nombres: true, apellidos: true },
                                })];
                        case 12:
                            usuario = _e.sent();
                            if (usuario) {
                                actorNombre = "".concat(usuario.nombres || '', " ").concat(usuario.apellidos || '').trim();
                            }
                            return [3 /*break*/, 14];
                        case 13:
                            _a = _e.sent();
                            return [3 /*break*/, 14];
                        case 14:
                            metadataBase = {
                                estadoAnterior: estadoAnterior,
                                estadoNuevo: estadoNuevo,
                                solicitadoPor: actorNombre || undefined,
                                solicitadoPorId: userId,
                                cliente: clienteNombre || undefined,
                                numeroPrestamo: prestamoActualizado_1.numeroPrestamo || undefined,
                            };
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: userId,
                                    titulo: tituloBase,
                                    mensaje: msgBase,
                                    tipo: 'PRESTAMO',
                                    entidad: 'Prestamo',
                                    entidadId: prestamoActualizado_1.id,
                                    metadata: metadataBase,
                                })];
                        case 15:
                            _e.sent();
                            if (!(estadoNuevo === client_1.EstadoPrestamo.PENDIENTE_APROBACION)) return [3 /*break*/, 17];
                            return [4 /*yield*/, this.notificacionesService.notifyApprovers({
                                    titulo: "Cr\u00E9dito marcado como PENDIENTE",
                                    mensaje: msgBase,
                                    tipo: 'PRESTAMO',
                                    entidad: 'Prestamo',
                                    entidadId: prestamoActualizado_1.id,
                                    metadata: metadataBase,
                                })];
                        case 16:
                            _e.sent();
                            _e.label = 17;
                        case 17:
                            if (!(estadoNuevo === client_1.EstadoPrestamo.ACTIVO)) return [3 /*break*/, 19];
                            if (!(prestamo_1.creadoPorId && prestamo_1.creadoPorId !== userId)) return [3 /*break*/, 19];
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: prestamo_1.creadoPorId,
                                    titulo: "Cr\u00E9dito activado",
                                    mensaje: msgBase,
                                    tipo: 'PRESTAMO',
                                    entidad: 'Prestamo',
                                    entidadId: prestamoActualizado_1.id,
                                    metadata: metadataBase,
                                })];
                        case 18:
                            _e.sent();
                            _e.label = 19;
                        case 19: return [3 /*break*/, 21];
                        case 20:
                            e_1 = _e.sent();
                            this.logger.error('Error enviando notificaciones de cambio de estado:', e_1);
                            return [3 /*break*/, 21];
                        case 21: 
                        // Auditoría
                        return [4 /*yield*/, this.auditService.create({
                                usuarioId: userId,
                                accion: 'ACTUALIZAR_PRESTAMO',
                                entidad: 'Prestamo',
                                entidadId: prestamo_1.id,
                                datosAnteriores: datosAnteriores,
                                datosNuevos: data,
                            })];
                        case 22:
                            // Auditoría
                            _e.sent();
                            this.logger.log("Loan ".concat(id, " updated by user ").concat(userId));
                            return [2 /*return*/, prestamoActualizado_1];
                        case 23:
                            error_6 = _e.sent();
                            this.logger.error("Error updating loan ".concat(id, ":"), error_6);
                            throw error_6;
                        case 24: return [2 /*return*/];
                    }
                });
            });
        };
        LoansService_1.prototype.restoreLoan = function (id, userId) {
            return __awaiter(this, void 0, void 0, function () {
                var prestamo, prestamoRestaurado, error_7;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 4, , 5]);
                            return [4 /*yield*/, this.prisma.prestamo.findUnique({
                                    where: { id: id },
                                })];
                        case 1:
                            prestamo = _a.sent();
                            if (!prestamo) {
                                throw new common_1.NotFoundException('Préstamo no encontrado');
                            }
                            if (!prestamo.eliminadoEn) {
                                throw new Error('El préstamo no está eliminado');
                            }
                            return [4 /*yield*/, this.prisma.prestamo.update({
                                    where: { id: id },
                                    data: {
                                        estado: client_1.EstadoPrestamo.ACTIVO,
                                        eliminadoEn: null,
                                        estadoSincronizacion: 'PENDIENTE',
                                    },
                                })];
                        case 2:
                            prestamoRestaurado = _a.sent();
                            // Auditoría
                            return [4 /*yield*/, this.auditService.create({
                                    usuarioId: userId,
                                    accion: 'RESTAURAR_PRESTAMO',
                                    entidad: 'Prestamo',
                                    entidadId: prestamo.id,
                                    datosAnteriores: { eliminadoEn: prestamo.eliminadoEn },
                                    datosNuevos: { eliminadoEn: null },
                                })];
                        case 3:
                            // Auditoría
                            _a.sent();
                            return [2 /*return*/, prestamoRestaurado];
                        case 4:
                            error_7 = _a.sent();
                            this.logger.error("Error restoring loan ".concat(id, ":"), error_7);
                            throw error_7;
                        case 5: return [2 /*return*/];
                    }
                });
            });
        };
        LoansService_1.prototype.createLoan_ = function (createLoanDto) {
            return __awaiter(this, void 0, void 0, function () {
                var cliente, count, numeroPrestamo, fechaInicio_1, fechaFin, fechaPrimerCobroParsed, cantidadCuotas, tipoAmort, tasaInteres, interesTotal, cuotasData, amortizacion, montoTotal, montoCuota_2, montoCapitalCuota_2, montoInteresCuota_2, prestamo, aprobacion, error_8;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 6, , 7]);
                            this.logger.log("Creating loan for client ".concat(createLoanDto.clienteId));
                            return [4 /*yield*/, this.prisma.cliente.findUnique({
                                    where: { id: createLoanDto.clienteId },
                                })];
                        case 1:
                            cliente = _a.sent();
                            if (!cliente) {
                                throw new common_1.NotFoundException('Cliente no encontrado');
                            }
                            return [4 /*yield*/, this.prisma.prestamo.count()];
                        case 2:
                            count = _a.sent();
                            numeroPrestamo = "PRES-".concat(String(count + 1).padStart(6, '0'));
                            fechaInicio_1 = new Date(createLoanDto.fechaInicio);
                            fechaInicio_1.setHours(0, 0, 0, 0);
                            fechaFin = new Date(fechaInicio_1);
                            fechaFin.setMonth(fechaFin.getMonth() + createLoanDto.plazoMeses);
                            fechaPrimerCobroParsed = createLoanDto.fechaPrimerCobro
                                ? new Date(createLoanDto.fechaPrimerCobro)
                                : undefined;
                            if (fechaPrimerCobroParsed) {
                                fechaPrimerCobroParsed.setHours(0, 0, 0, 0);
                            }
                            cantidadCuotas = 0;
                            switch (createLoanDto.frecuenciaPago) {
                                case client_1.FrecuenciaPago.DIARIO:
                                    cantidadCuotas = createLoanDto.plazoMeses * 30;
                                    break;
                                case client_1.FrecuenciaPago.SEMANAL:
                                    cantidadCuotas = createLoanDto.plazoMeses * 4;
                                    break;
                                case client_1.FrecuenciaPago.QUINCENAL:
                                    cantidadCuotas = createLoanDto.plazoMeses * 2;
                                    break;
                                case client_1.FrecuenciaPago.MENSUAL:
                                    cantidadCuotas = createLoanDto.plazoMeses;
                                    break;
                            }
                            tipoAmort = createLoanDto.tipoAmortizacion || client_1.TipoAmortizacion.INTERES_SIMPLE;
                            tasaInteres = createLoanDto.tasaInteres || 0;
                            interesTotal = void 0;
                            cuotasData = void 0;
                            if (tipoAmort === client_1.TipoAmortizacion.FRANCESA) {
                                amortizacion = this.calcularAmortizacionFrancesa(createLoanDto.monto, tasaInteres, cantidadCuotas, createLoanDto.plazoMeses, createLoanDto.frecuenciaPago);
                                interesTotal = amortizacion.interesTotal;
                                cuotasData = amortizacion.tabla.map(function (cuota) {
                                    var fechaBase = createLoanDto.fechaPrimerCobro ? new Date(createLoanDto.fechaPrimerCobro) : fechaInicio_1;
                                    var fechaVencimiento = _this.calcularFechaVencimiento(fechaBase, cuota.numeroCuota, createLoanDto.frecuenciaPago);
                                    return {
                                        numeroCuota: cuota.numeroCuota,
                                        fechaVencimiento: fechaVencimiento,
                                        monto: cuota.monto,
                                        montoCapital: cuota.montoCapital,
                                        montoInteres: cuota.montoInteres,
                                        estado: client_1.EstadoCuota.PENDIENTE,
                                    };
                                });
                            }
                            else {
                                // Interés simple (flat): capital × tasa mensual × plazoMeses (simple)
                                interesTotal = (createLoanDto.monto * tasaInteres * createLoanDto.plazoMeses) / 100;
                                montoTotal = createLoanDto.monto + interesTotal;
                                montoCuota_2 = cantidadCuotas > 0 ? montoTotal / cantidadCuotas : 0;
                                montoCapitalCuota_2 = cantidadCuotas > 0 ? createLoanDto.monto / cantidadCuotas : 0;
                                montoInteresCuota_2 = cantidadCuotas > 0 ? interesTotal / cantidadCuotas : 0;
                                cuotasData = Array.from({ length: cantidadCuotas }, function (_, i) {
                                    var fechaBase = createLoanDto.fechaPrimerCobro ? new Date(createLoanDto.fechaPrimerCobro) : fechaInicio_1;
                                    var fechaVencimiento = _this.calcularFechaVencimiento(fechaBase, i + 1, createLoanDto.frecuenciaPago);
                                    return {
                                        numeroCuota: i + 1,
                                        fechaVencimiento: fechaVencimiento,
                                        monto: Math.round(montoCuota_2 * 100) / 100,
                                        montoCapital: Math.round(montoCapitalCuota_2 * 100) / 100,
                                        montoInteres: Math.round(montoInteresCuota_2 * 100) / 100,
                                        estado: client_1.EstadoCuota.PENDIENTE,
                                    };
                                });
                            }
                            return [4 /*yield*/, this.prisma.prestamo.create({
                                    data: {
                                        numeroPrestamo: numeroPrestamo,
                                        clienteId: createLoanDto.clienteId,
                                        productoId: createLoanDto.productoId,
                                        precioProductoId: createLoanDto.precioProductoId,
                                        tipoPrestamo: createLoanDto.tipoPrestamo,
                                        tipoAmortizacion: tipoAmort,
                                        monto: createLoanDto.monto,
                                        cuotaInicial: createLoanDto.cuotaInicial || 0,
                                        tasaInteres: tasaInteres,
                                        tasaInteresMora: createLoanDto.tasaInteresMora || 2,
                                        plazoMeses: createLoanDto.plazoMeses,
                                        frecuenciaPago: createLoanDto.frecuenciaPago,
                                        cantidadCuotas: cantidadCuotas,
                                        fechaInicio: fechaInicio_1,
                                        fechaPrimerCobro: fechaPrimerCobroParsed,
                                        fechaFin: fechaFin,
                                        estado: client_1.EstadoPrestamo.PENDIENTE_APROBACION,
                                        estadoAprobacion: client_1.EstadoAprobacion.PENDIENTE,
                                        creadoPorId: createLoanDto.creadoPorId,
                                        interesTotal: interesTotal,
                                        saldoPendiente: createLoanDto.monto + interesTotal - (createLoanDto.cuotaInicial || 0),
                                        notas: createLoanDto.notas ? String(createLoanDto.notas) : undefined,
                                        garantia: createLoanDto.garantia ? String(createLoanDto.garantia) : undefined,
                                        cuotas: {
                                            create: cuotasData,
                                        },
                                    },
                                    include: {
                                        cliente: true,
                                        producto: true,
                                        cuotas: true,
                                        creadoPor: {
                                            select: {
                                                id: true,
                                                nombres: true,
                                                apellidos: true,
                                                rol: true,
                                            },
                                        },
                                    },
                                })];
                        case 3:
                            prestamo = _a.sent();
                            this.logger.log("Loan created successfully: ".concat(prestamo.id, " (").concat(tipoAmort, ")"));
                            return [4 /*yield*/, this.prisma.aprobacion.create({
                                    data: {
                                        tipoAprobacion: client_1.TipoAprobacion.NUEVO_PRESTAMO,
                                        referenciaId: prestamo.id,
                                        tablaReferencia: 'Prestamo',
                                        solicitadoPorId: createLoanDto.creadoPorId,
                                        datosSolicitud: {
                                            prestamoId: prestamo.id,
                                            clienteId: prestamo.clienteId,
                                            monto: prestamo.monto,
                                            plazoMeses: prestamo.plazoMeses,
                                            tasaInteres: prestamo.tasaInteres,
                                            frecuenciaPago: prestamo.frecuenciaPago,
                                            fechaInicio: prestamo.fechaInicio,
                                            fechaFin: prestamo.fechaFin,
                                        },
                                        montoSolicitud: Number(prestamo.monto),
                                    },
                                })];
                        case 4:
                            aprobacion = _a.sent();
                            /*
                            // Notificar a coordinadores, admins y superadmins sobre nuevo préstamo pendiente de aprobación
                            await this.notificacionesService.notifyApprovers({
                              titulo: 'Nuevo Préstamo Requiere Aprobación',
                              mensaje: `El usuario ha creado un préstamo para el cliente ${cliente.nombres} ${cliente.apellidos} por valor de ${createLoanDto.monto}`,
                              tipo: 'APROBACION',
                              entidad: 'Aprobacion',
                              entidadId: aprobacion.id,
                              metadata: {
                                 // ...
                              },
                            });
                            */
                            // Registrar Auditoría
                            return [4 /*yield*/, this.auditService.create({
                                    usuarioId: createLoanDto.creadoPorId,
                                    accion: 'CREAR_PRESTAMO',
                                    entidad: 'Prestamo',
                                    entidadId: prestamo.id,
                                    datosNuevos: prestamo,
                                    metadata: { clienteId: createLoanDto.clienteId },
                                })];
                        case 5:
                            /*
                            // Notificar a coordinadores, admins y superadmins sobre nuevo préstamo pendiente de aprobación
                            await this.notificacionesService.notifyApprovers({
                              titulo: 'Nuevo Préstamo Requiere Aprobación',
                              mensaje: `El usuario ha creado un préstamo para el cliente ${cliente.nombres} ${cliente.apellidos} por valor de ${createLoanDto.monto}`,
                              tipo: 'APROBACION',
                              entidad: 'Aprobacion',
                              entidadId: aprobacion.id,
                              metadata: {
                                 // ...
                              },
                            });
                            */
                            // Registrar Auditoría
                            _a.sent();
                            this.notificacionesGateway.broadcastPrestamosActualizados({
                                accion: 'CREAR',
                                prestamoId: prestamo.id,
                            });
                            this.notificacionesGateway.broadcastDashboardsActualizados({});
                            return [2 /*return*/, prestamo];
                        case 6:
                            error_8 = _a.sent();
                            this.logger.error('Error creating loan:', error_8);
                            throw error_8;
                        case 7: return [2 /*return*/];
                    }
                });
            });
        };
        LoansService_1.prototype.approveLoan = function (id, aprobadoPorId) {
            return __awaiter(this, void 0, void 0, function () {
                var prestamo, prestamoActualizado, admins, cliente, _i, admins_1, admin, error_9;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 12, , 13]);
                            return [4 /*yield*/, this.prisma.prestamo.findUnique({
                                    where: { id: id },
                                })];
                        case 1:
                            prestamo = _a.sent();
                            if (!prestamo) {
                                throw new common_1.NotFoundException('Préstamo no encontrado');
                            }
                            if (prestamo.estado !== client_1.EstadoPrestamo.PENDIENTE_APROBACION) {
                                throw new Error('El préstamo no está en estado pendiente de aprobación');
                            }
                            return [4 /*yield*/, this.prisma.prestamo.update({
                                    where: { id: id },
                                    data: {
                                        estado: client_1.EstadoPrestamo.ACTIVO,
                                        estadoAprobacion: client_1.EstadoAprobacion.APROBADO,
                                        aprobadoPorId: aprobadoPorId,
                                        estadoSincronizacion: 'PENDIENTE',
                                    },
                                    include: {
                                        cliente: true,
                                        producto: true,
                                        cuotas: true,
                                    },
                                })];
                        case 2:
                            prestamoActualizado = _a.sent();
                            // Actualizar la aprobación
                            return [4 /*yield*/, this.prisma.aprobacion.updateMany({
                                    where: {
                                        referenciaId: id,
                                        tipoAprobacion: client_1.TipoAprobacion.NUEVO_PRESTAMO,
                                        estado: client_1.EstadoAprobacion.PENDIENTE,
                                    },
                                    data: {
                                        estado: client_1.EstadoAprobacion.APROBADO,
                                        aprobadoPorId: aprobadoPorId,
                                        revisadoEn: new Date(),
                                    },
                                })];
                        case 3:
                            // Actualizar la aprobación
                            _a.sent();
                            // Notificar al Coordinador (INFO)
                            return [4 /*yield*/, this.notificacionesService.notifyCoordinator({
                                    titulo: 'Préstamo Aprobado',
                                    mensaje: "El pr\u00E9stamo ".concat(prestamo.numeroPrestamo, " ha sido aprobado y activado."),
                                    tipo: 'EXITO',
                                    entidad: 'PRESTAMO',
                                    entidadId: prestamo.id,
                                    metadata: { aprobadoPor: aprobadoPorId },
                                })];
                        case 4:
                            // Notificar al Coordinador (INFO)
                            _a.sent();
                            return [4 /*yield*/, this.prisma.usuario.findMany({
                                    where: {
                                        rol: { in: [client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR] },
                                        estado: 'ACTIVO'
                                    },
                                })];
                        case 5:
                            admins = _a.sent();
                            return [4 /*yield*/, this.prisma.cliente.findUnique({
                                    where: { id: prestamo.clienteId },
                                })];
                        case 6:
                            cliente = _a.sent();
                            _i = 0, admins_1 = admins;
                            _a.label = 7;
                        case 7:
                            if (!(_i < admins_1.length)) return [3 /*break*/, 10];
                            admin = admins_1[_i];
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: admin.id,
                                    titulo: 'Préstamo Aprobado',
                                    mensaje: "El pr\u00E9stamo ".concat(prestamo.numeroPrestamo, " para el cliente ").concat((cliente === null || cliente === void 0 ? void 0 : cliente.nombres) || '', " ").concat((cliente === null || cliente === void 0 ? void 0 : cliente.apellidos) || '', " ha sido aprobado y activado."),
                                    tipo: 'EXITO',
                                    entidad: 'PRESTAMO',
                                    entidadId: prestamo.id,
                                    metadata: {
                                        prestamoId: prestamo.id,
                                        clienteId: prestamo.clienteId,
                                        monto: prestamo.monto,
                                        aprobadoPor: aprobadoPorId,
                                    },
                                })];
                        case 8:
                            _a.sent();
                            _a.label = 9;
                        case 9:
                            _i++;
                            return [3 /*break*/, 7];
                        case 10: 
                        // Auditoría
                        return [4 /*yield*/, this.auditService.create({
                                usuarioId: aprobadoPorId,
                                accion: 'APROBAR_PRESTAMO',
                                entidad: 'Prestamo',
                                entidadId: prestamo.id,
                                datosAnteriores: {
                                    estado: prestamo.estado,
                                    estadoAprobacion: prestamo.estadoAprobacion,
                                },
                                datosNuevos: { estado: 'ACTIVO', estadoAprobacion: 'APROBADO' },
                            })];
                        case 11:
                            // Auditoría
                            _a.sent();
                            this.notificacionesGateway.broadcastPrestamosActualizados({
                                accion: 'APROBAR',
                                prestamoId: prestamoActualizado.id,
                            });
                            this.notificacionesGateway.broadcastDashboardsActualizados({});
                            return [2 /*return*/, prestamoActualizado];
                        case 12:
                            error_9 = _a.sent();
                            this.logger.error("Error approving loan ".concat(id, ":"), error_9);
                            throw error_9;
                        case 13: return [2 /*return*/];
                    }
                });
            });
        };
        LoansService_1.prototype.rejectLoan = function (id, rechazadoPorId, motivo) {
            return __awaiter(this, void 0, void 0, function () {
                var prestamo, prestamoRechazado, error_10;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 6, , 7]);
                            return [4 /*yield*/, this.prisma.prestamo.findUnique({
                                    where: { id: id },
                                })];
                        case 1:
                            prestamo = _a.sent();
                            if (!prestamo) {
                                throw new common_1.NotFoundException('Préstamo no encontrado');
                            }
                            return [4 /*yield*/, this.prisma.prestamo.update({
                                    where: { id: id },
                                    data: {
                                        estadoAprobacion: client_1.EstadoAprobacion.RECHAZADO,
                                        aprobadoPorId: rechazadoPorId,
                                        estadoSincronizacion: 'PENDIENTE',
                                    },
                                    include: {
                                        cliente: true,
                                        producto: true,
                                    },
                                })];
                        case 2:
                            prestamoRechazado = _a.sent();
                            // Actualizar la aprobación
                            return [4 /*yield*/, this.prisma.aprobacion.updateMany({
                                    where: {
                                        referenciaId: id,
                                        tipoAprobacion: client_1.TipoAprobacion.NUEVO_PRESTAMO,
                                        estado: client_1.EstadoAprobacion.PENDIENTE,
                                    },
                                    data: {
                                        estado: client_1.EstadoAprobacion.RECHAZADO,
                                        aprobadoPorId: rechazadoPorId,
                                        revisadoEn: new Date(),
                                        comentarios: motivo,
                                    },
                                })];
                        case 3:
                            // Actualizar la aprobación
                            _a.sent();
                            // Notificar al Coordinador (ALERTA)
                            return [4 /*yield*/, this.notificacionesService.notifyCoordinator({
                                    titulo: 'Préstamo Rechazado',
                                    mensaje: "El pr\u00E9stamo ".concat(prestamo.numeroPrestamo, " ha sido rechazado. Motivo: ").concat(motivo || 'No especificado'),
                                    tipo: 'ALERTA',
                                    entidad: 'PRESTAMO',
                                    entidadId: prestamo.id,
                                    metadata: { rechazadoPor: rechazadoPorId, motivo: motivo },
                                })];
                        case 4:
                            // Notificar al Coordinador (ALERTA)
                            _a.sent();
                            // Auditoría
                            return [4 /*yield*/, this.auditService.create({
                                    usuarioId: rechazadoPorId,
                                    accion: 'RECHAZAR_PRESTAMO',
                                    entidad: 'Prestamo',
                                    entidadId: prestamo.id,
                                    datosAnteriores: { estadoAprobacion: prestamo.estadoAprobacion },
                                    datosNuevos: { estadoAprobacion: 'RECHAZADO', motivo: motivo },
                                })];
                        case 5:
                            // Auditoría
                            _a.sent();
                            this.notificacionesGateway.broadcastPrestamosActualizados({
                                accion: 'RECHAZAR',
                                prestamoId: prestamoRechazado.id,
                            });
                            this.notificacionesGateway.broadcastDashboardsActualizados({});
                            return [2 /*return*/, prestamoRechazado];
                        case 6:
                            error_10 = _a.sent();
                            this.logger.error("Error rejecting loan ".concat(id, ":"), error_10);
                            throw error_10;
                        case 7: return [2 /*return*/];
                    }
                });
            });
        };
        LoansService_1.prototype.getLoanCuotas = function (prestamoId) {
            return __awaiter(this, void 0, void 0, function () {
                var cuotas, error_11;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, this.prisma.cuota.findMany({
                                    where: { prestamoId: prestamoId },
                                    orderBy: { numeroCuota: 'asc' },
                                })];
                        case 1:
                            cuotas = _a.sent();
                            return [2 /*return*/, cuotas];
                        case 2:
                            error_11 = _a.sent();
                            this.logger.error("Error getting cuotas for loan ".concat(prestamoId, ":"), error_11);
                            throw error_11;
                        case 3: return [2 /*return*/];
                    }
                });
            });
        };
        LoansService_1.prototype.createLoan = function (data) {
            return __awaiter(this, void 0, void 0, function () {
                var cliente, creador, dosMinutosAtras, prestamoDuplicado, rolesAutoAprobacion, requiereAprobacion, estadoInicial, estadoAprobacionInicial, producto, precioProducto, montoFinanciar, cuotaInicial, precioTotal, count, tipo, prefix, numeroPrestamo, getVal, numCantidadCuotas, numPlazoMeses, plazoMesesPrisma, fechaInicio_2, fechaFin, diasTotales, diasFallback, fechaPrimerCobroParsed, cantidadCuotas, tipoAmort, tasaInteres, interesTotal, cuotasData, amortizacion, mesesInteres, montoTotalSimple, montoCuota_3, montoCapitalCuota_3, montoInteresCuota_3, montoTotal, autoAprobarCreditos, esAutoAprobado, prestamo, today, startDate, rutaPreferida, rutaCobrador, _a, rutaIdAsignar, cobradorIdAsignar, existenteHoy, maxOrden, articuloNombre, totalCuotasPrometidas, isFinanciamientoArticulo, safeNumber, aprobacion, _b, _c, admins, _i, admins_2, admin, error_12;
                var _this = this;
                var _d, _e, _f, _g;
                return __generator(this, function (_h) {
                    switch (_h.label) {
                        case 0:
                            _h.trys.push([0, 42, , 43]);
                            this.logger.log("Creating loan for client ".concat(data.clienteId, ", type: ").concat(data.tipoPrestamo, ". Data: ").concat(JSON.stringify(data)));
                            return [4 /*yield*/, this.prisma.cliente.findUnique({
                                    where: { id: data.clienteId },
                                    include: {
                                        asignacionesRuta: {
                                            where: { activa: true },
                                            include: { ruta: true },
                                        },
                                    },
                                })];
                        case 1:
                            cliente = _h.sent();
                            if (!cliente) {
                                throw new common_1.NotFoundException('Cliente no encontrado');
                            }
                            // Verificar que el cliente no esté en lista negra
                            if (cliente.enListaNegra) {
                                throw new common_1.BadRequestException('El cliente está en lista negra y no puede recibir créditos');
                            }
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: { id: data.creadoPorId },
                                })];
                        case 2:
                            creador = _h.sent();
                            if (!creador) {
                                throw new common_1.NotFoundException('Usuario creador no encontrado');
                            }
                            dosMinutosAtras = new Date(Date.now() - 2 * 60 * 1000);
                            return [4 /*yield*/, this.prisma.prestamo.findFirst({
                                    where: {
                                        clienteId: data.clienteId,
                                        monto: data.monto,
                                        tipoPrestamo: data.tipoPrestamo,
                                        frecuenciaPago: data.frecuenciaPago,
                                        creadoEn: { gte: dosMinutosAtras },
                                    },
                                })];
                        case 3:
                            prestamoDuplicado = _h.sent();
                            if (prestamoDuplicado) {
                                throw new common_1.BadRequestException('Se ha detectado un crédito idéntico creado hace menos de 2 minutos. Para evitar registros duplicados por problemas de conexión, la solicitud fue bloqueada.');
                            }
                            rolesAutoAprobacion = [client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR];
                            requiereAprobacion = !rolesAutoAprobacion.includes(creador.rol);
                            estadoInicial = requiereAprobacion ? client_1.EstadoPrestamo.PENDIENTE_APROBACION : client_1.EstadoPrestamo.ACTIVO;
                            estadoAprobacionInicial = requiereAprobacion ? client_1.EstadoAprobacion.PENDIENTE : client_1.EstadoAprobacion.APROBADO;
                            producto = null;
                            precioProducto = null;
                            montoFinanciar = data.monto;
                            if (!(data.tipoPrestamo === 'ARTICULO')) return [3 /*break*/, 8];
                            if (!data.productoId) {
                                throw new common_1.BadRequestException('Para crédito por artículo se requiere productoId');
                            }
                            return [4 /*yield*/, this.prisma.producto.findUnique({
                                    where: { id: data.productoId },
                                })];
                        case 4:
                            // Obtener el producto y precio del producto
                            producto = _h.sent();
                            if (!producto) {
                                throw new common_1.NotFoundException('Producto no encontrado');
                            }
                            // Verificar stock - CORREGIDO: acceso seguro a la propiedad stock
                            if (producto.stock !== undefined && producto.stock < 1) {
                                throw new common_1.BadRequestException('Producto sin stock disponible');
                            }
                            if (!(!data.esContado && data.precioProductoId)) return [3 /*break*/, 6];
                            return [4 /*yield*/, this.prisma.precioProducto.findUnique({
                                    where: { id: data.precioProductoId },
                                })];
                        case 5:
                            precioProducto = _h.sent();
                            if (!precioProducto) {
                                throw new common_1.NotFoundException('Plan de precio no encontrado');
                            }
                            // Verificar que el precioProducto corresponda al producto - CORREGIDO: acceso seguro
                            if (precioProducto.productoId &&
                                precioProducto.productoId !== data.productoId) {
                                throw new common_1.BadRequestException('El plan de precio no corresponde al producto seleccionado');
                            }
                            _h.label = 6;
                        case 6:
                            cuotaInicial = data.cuotaInicial || 0;
                            precioTotal = (data.esContado || !precioProducto)
                                ? data.monto
                                : (precioProducto.precio ? Number(precioProducto.precio) : 0);
                            montoFinanciar = Math.max(0, precioTotal - cuotaInicial);
                            if (cuotaInicial > precioTotal) {
                                throw new common_1.BadRequestException('La cuota inicial no puede ser mayor al precio total');
                            }
                            if (!(producto.stock !== undefined)) return [3 /*break*/, 8];
                            return [4 /*yield*/, this.prisma.producto.update({
                                    where: { id: data.productoId },
                                    data: { stock: { decrement: 1 } },
                                })];
                        case 7:
                            _h.sent();
                            _h.label = 8;
                        case 8: return [4 /*yield*/, this.prisma.prestamo.count()];
                        case 9:
                            count = _h.sent();
                            tipo = (data.tipoPrestamo || '').toUpperCase();
                            prefix = tipo === 'ARTICULO' ? 'ART' : 'PRES';
                            numeroPrestamo = "".concat(prefix, "-").concat(String(count + 1).padStart(6, '0'));
                            getVal = function (v) {
                                var n = Number(v);
                                return isNaN(n) || n <= 0 ? null : n;
                            };
                            numCantidadCuotas = getVal(data.cantidadCuotas) ||
                                getVal(data.cuotas) ||
                                getVal(data.cuotasTotales) ||
                                getVal(data.numCuotas) ||
                                getVal(data.totalCuotas) ||
                                0;
                            numPlazoMeses = Number(data.plazoMeses || data.plazo || data.numPlazo || 0);
                            // Si no hay plazo pero hay cuotas, derivamos el plazo (0.4 para 12 días, etc.)
                            if (numPlazoMeses === 0 && numCantidadCuotas > 0) {
                                if (data.frecuenciaPago === client_1.FrecuenciaPago.DIARIO) {
                                    numPlazoMeses = numCantidadCuotas / 30;
                                }
                                else if (data.frecuenciaPago === client_1.FrecuenciaPago.SEMANAL) {
                                    numPlazoMeses = numCantidadCuotas / 4;
                                }
                                else if (data.frecuenciaPago === client_1.FrecuenciaPago.QUINCENAL) {
                                    numPlazoMeses = numCantidadCuotas / 2;
                                }
                            }
                            plazoMesesPrisma = Math.max(1, Math.round(numPlazoMeses));
                            fechaInicio_2 = new Date(data.fechaInicio);
                            fechaInicio_2.setHours(0, 0, 0, 0);
                            fechaFin = new Date(fechaInicio_2);
                            if (Number.isInteger(numPlazoMeses) && numPlazoMeses > 0) {
                                fechaFin.setMonth(fechaFin.getMonth() + numPlazoMeses);
                            }
                            else if (numPlazoMeses > 0) {
                                diasTotales = Math.round(numPlazoMeses * 30);
                                fechaFin.setDate(fechaFin.getDate() + diasTotales);
                            }
                            else {
                                diasFallback = 0;
                                switch (data.frecuenciaPago) {
                                    case client_1.FrecuenciaPago.DIARIO:
                                        diasFallback = numCantidadCuotas;
                                        break;
                                    case client_1.FrecuenciaPago.SEMANAL:
                                        diasFallback = numCantidadCuotas * 7;
                                        break;
                                    case client_1.FrecuenciaPago.QUINCENAL:
                                        diasFallback = numCantidadCuotas * 15;
                                        break;
                                    case client_1.FrecuenciaPago.MENSUAL:
                                        diasFallback = numCantidadCuotas * 30;
                                        break;
                                }
                                fechaFin.setDate(fechaFin.getDate() + diasFallback);
                            }
                            fechaPrimerCobroParsed = data.fechaPrimerCobro
                                ? new Date(data.fechaPrimerCobro)
                                : undefined;
                            if (fechaPrimerCobroParsed) {
                                fechaPrimerCobroParsed.setHours(0, 0, 0, 0);
                            }
                            cantidadCuotas = numCantidadCuotas;
                            if (cantidadCuotas > 0) {
                                this.logger.log("[CUOTAS CALCULATION] Priorizando cuotas del usuario: ".concat(cantidadCuotas));
                            }
                            else {
                                this.logger.log("[CUOTAS CALCULATION] Calculando cuotas desde plazoMeses=".concat(numPlazoMeses, " y frecu=").concat(data.frecuenciaPago));
                                switch (data.frecuenciaPago) {
                                    case client_1.FrecuenciaPago.DIARIO:
                                        cantidadCuotas = Math.ceil(numPlazoMeses * 30);
                                        break;
                                    case client_1.FrecuenciaPago.SEMANAL:
                                        cantidadCuotas = Math.ceil(numPlazoMeses * 4);
                                        break;
                                    case client_1.FrecuenciaPago.QUINCENAL:
                                        cantidadCuotas = Math.ceil(numPlazoMeses * 2);
                                        break;
                                    case client_1.FrecuenciaPago.MENSUAL:
                                        cantidadCuotas = Math.ceil(numPlazoMeses);
                                        break;
                                    default:
                                        cantidadCuotas = Math.ceil(numPlazoMeses * 4);
                                }
                            }
                            // Aseguramos un mínimo de 1
                            if (cantidadCuotas <= 0 && numPlazoMeses > 0) {
                                cantidadCuotas = 1;
                            }
                            this.logger.log("[CUOTAS CALCULATION] Cantidad final de cuotas a crear: ".concat(cantidadCuotas));
                            tipoAmort = data.tipoAmortizacion || client_1.TipoAmortizacion.INTERES_SIMPLE;
                            tasaInteres = data.tasaInteres || 0;
                            interesTotal = void 0;
                            cuotasData = void 0;
                            if (tipoAmort === client_1.TipoAmortizacion.FRANCESA) {
                                amortizacion = this.calcularAmortizacionFrancesa(montoFinanciar, tasaInteres, cantidadCuotas, data.plazoMeses, data.frecuenciaPago);
                                interesTotal = amortizacion.interesTotal;
                                cuotasData = amortizacion.tabla.map(function (cuota) {
                                    var fechaBase = data.fechaPrimerCobro ? new Date(data.fechaPrimerCobro) : fechaInicio_2;
                                    var fechaVencimiento = _this.calcularFechaVencimiento(fechaBase, cuota.numeroCuota, data.frecuenciaPago);
                                    return {
                                        numeroCuota: cuota.numeroCuota,
                                        fechaVencimiento: fechaVencimiento,
                                        monto: cuota.monto,
                                        montoCapital: cuota.montoCapital,
                                        montoInteres: cuota.montoInteres,
                                        estado: data.esContado ? client_1.EstadoCuota.PAGADA : client_1.EstadoCuota.PENDIENTE,
                                        montoPagado: data.esContado ? cuota.monto : 0,
                                    };
                                });
                            }
                            else {
                                mesesInteres = Math.max(1, numPlazoMeses);
                                interesTotal = (montoFinanciar * tasaInteres * mesesInteres) / 100;
                                montoTotalSimple = montoFinanciar + interesTotal;
                                montoCuota_3 = cantidadCuotas > 0 ? montoTotalSimple / cantidadCuotas : 0;
                                montoCapitalCuota_3 = cantidadCuotas > 0 ? montoFinanciar / cantidadCuotas : 0;
                                montoInteresCuota_3 = cantidadCuotas > 0 ? interesTotal / cantidadCuotas : 0;
                                this.logger.log("[LOAN CALCULATION] Capital: ".concat(montoFinanciar, ", Tasa: ").concat(tasaInteres, "%, Plazo: ").concat(data.plazoMeses, " meses"));
                                this.logger.log("[LOAN CALCULATION] Inter\u00E9s Total: ".concat(interesTotal, ", Cuotas: ").concat(cantidadCuotas, ", Monto/Cuota: ").concat(montoCuota_3));
                                cuotasData = Array.from({ length: cantidadCuotas }, function (_, i) {
                                    var fechaBase = data.fechaPrimerCobro ? new Date(data.fechaPrimerCobro) : fechaInicio_2;
                                    var fechaVencimiento = _this.calcularFechaVencimiento(fechaBase, i + 1, data.frecuenciaPago);
                                    return {
                                        numeroCuota: i + 1,
                                        fechaVencimiento: fechaVencimiento,
                                        monto: Math.round(montoCuota_3 * 100) / 100,
                                        montoCapital: Math.round(montoCapitalCuota_3 * 100) / 100,
                                        montoInteres: Math.round(montoInteresCuota_3 * 100) / 100,
                                        estado: data.esContado ? client_1.EstadoCuota.PAGADA : client_1.EstadoCuota.PENDIENTE,
                                        montoPagado: data.esContado ? Math.round(montoCuota_3 * 100) / 100 : 0,
                                    };
                                });
                            }
                            montoTotal = montoFinanciar + interesTotal;
                            return [4 /*yield*/, this.configuracionService.shouldAutoApproveCredits()];
                        case 10:
                            autoAprobarCreditos = _h.sent();
                            esAutoAprobado = autoAprobarCreditos;
                            this.logger.log("[CREATE LOAN] Usuario: ".concat(creador.nombres, ", Rol: ").concat(creador.rol, ", Auto-aprobado por configuraci\u00F3n global: ").concat(esAutoAprobado));
                            return [4 /*yield*/, this.prisma.prestamo.create({
                                    data: {
                                        numeroPrestamo: numeroPrestamo,
                                        clienteId: data.clienteId,
                                        productoId: data.productoId,
                                        precioProductoId: data.precioProductoId,
                                        tipoPrestamo: data.tipoPrestamo,
                                        tipoAmortizacion: tipoAmort,
                                        monto: montoFinanciar,
                                        tasaInteres: tasaInteres,
                                        tasaInteresMora: data.tasaInteresMora || 2,
                                        plazoMeses: plazoMesesPrisma,
                                        frecuenciaPago: data.frecuenciaPago,
                                        cantidadCuotas: cantidadCuotas,
                                        cuotaInicial: data.cuotaInicial || 0,
                                        fechaInicio: fechaInicio_2,
                                        fechaPrimerCobro: fechaPrimerCobroParsed,
                                        fechaFin: fechaFin,
                                        estado: data.esContado ? client_1.EstadoPrestamo.PAGADO : (esAutoAprobado ? client_1.EstadoPrestamo.ACTIVO : client_1.EstadoPrestamo.PENDIENTE_APROBACION),
                                        estadoAprobacion: data.esContado ? client_1.EstadoAprobacion.APROBADO : (esAutoAprobado ? client_1.EstadoAprobacion.APROBADO : client_1.EstadoAprobacion.PENDIENTE),
                                        aprobadoPorId: data.esContado || esAutoAprobado ? data.creadoPorId : undefined,
                                        creadoPorId: data.creadoPorId,
                                        interesTotal: interesTotal,
                                        saldoPendiente: data.esContado ? 0 : montoTotal,
                                        totalPagado: data.esContado ? montoTotal : 0,
                                        notas: (data.notas || data.observaciones || data.comentarios || data.detalle || undefined)
                                            ? String(data.notas || data.observaciones || data.comentarios || data.detalle)
                                            : undefined,
                                        garantia: data.garantia ? String(data.garantia) : undefined,
                                        cuotas: {
                                            create: cuotasData,
                                        },
                                    },
                                    include: {
                                        cliente: true,
                                        producto: true,
                                        cuotas: true,
                                        creadoPor: {
                                            select: {
                                                id: true,
                                                nombres: true,
                                                apellidos: true,
                                                rol: true,
                                            },
                                        },
                                    },
                                })];
                        case 11:
                            prestamo = _h.sent();
                            today = new Date();
                            today.setHours(0, 0, 0, 0);
                            startDate = new Date(fechaInicio_2);
                            startDate.setHours(0, 0, 0, 0);
                            if (!(!data.esContado && startDate.getTime() === today.getTime())) return [3 /*break*/, 18];
                            rutaPreferida = (_d = cliente.asignacionesRuta) === null || _d === void 0 ? void 0 : _d.find(function (a) { var _a, _b; return (a === null || a === void 0 ? void 0 : a.activa) && ((_a = a === null || a === void 0 ? void 0 : a.ruta) === null || _a === void 0 ? void 0 : _a.activa) && !((_b = a === null || a === void 0 ? void 0 : a.ruta) === null || _b === void 0 ? void 0 : _b.eliminadoEn); });
                            if (!(!rutaPreferida && creador.rol === client_1.RolUsuario.COBRADOR)) return [3 /*break*/, 13];
                            return [4 /*yield*/, this.prisma.ruta.findFirst({
                                    where: {
                                        eliminadoEn: null,
                                        activa: true,
                                        cobradorId: creador.id,
                                    },
                                    select: { id: true, cobradorId: true },
                                })];
                        case 12:
                            _a = _h.sent();
                            return [3 /*break*/, 14];
                        case 13:
                            _a = null;
                            _h.label = 14;
                        case 14:
                            rutaCobrador = _a;
                            rutaIdAsignar = (rutaPreferida === null || rutaPreferida === void 0 ? void 0 : rutaPreferida.rutaId) || ((_e = rutaPreferida === null || rutaPreferida === void 0 ? void 0 : rutaPreferida.ruta) === null || _e === void 0 ? void 0 : _e.id) || (rutaCobrador === null || rutaCobrador === void 0 ? void 0 : rutaCobrador.id);
                            cobradorIdAsignar = (rutaPreferida === null || rutaPreferida === void 0 ? void 0 : rutaPreferida.cobradorId) || ((_f = rutaPreferida === null || rutaPreferida === void 0 ? void 0 : rutaPreferida.ruta) === null || _f === void 0 ? void 0 : _f.cobradorId) || (rutaCobrador === null || rutaCobrador === void 0 ? void 0 : rutaCobrador.cobradorId);
                            if (!(rutaIdAsignar && cobradorIdAsignar)) return [3 /*break*/, 18];
                            return [4 /*yield*/, this.prisma.asignacionRuta.findFirst({
                                    where: {
                                        rutaId: rutaIdAsignar,
                                        clienteId: cliente.id,
                                        activa: true,
                                        fechaEspecifica: today,
                                    },
                                    select: { id: true },
                                })];
                        case 15:
                            existenteHoy = _h.sent();
                            if (!!existenteHoy) return [3 /*break*/, 18];
                            return [4 /*yield*/, this.prisma.asignacionRuta.aggregate({
                                    where: { rutaId: rutaIdAsignar, activa: true },
                                    _max: { ordenVisita: true },
                                })];
                        case 16:
                            maxOrden = _h.sent();
                            return [4 /*yield*/, this.prisma.asignacionRuta.create({
                                    data: {
                                        rutaId: rutaIdAsignar,
                                        clienteId: cliente.id,
                                        cobradorId: cobradorIdAsignar,
                                        fechaEspecifica: today,
                                        ordenVisita: (maxOrden._max.ordenVisita || 0) + 1,
                                        activa: true,
                                    },
                                })];
                        case 17:
                            _h.sent();
                            this.notificacionesGateway.broadcastRutasActualizadas({
                                accion: 'ACTUALIZAR',
                                rutaId: rutaIdAsignar,
                                clienteId: cliente.id,
                            });
                            _h.label = 18;
                        case 18:
                            this.logger.log("Loan created successfully: ".concat(prestamo.id, ", requiereAprobacion: ").concat(esAutoAprobado));
                            if (!(data.esContado && prestamo.cuotas && prestamo.cuotas.length > 0)) return [3 /*break*/, 20];
                            return [4 /*yield*/, this.prisma.pago.create({
                                    data: {
                                        prestamoId: prestamo.id,
                                        registradoPorId: data.creadoPorId,
                                        montoPagado: montoTotal,
                                        fechaPago: new Date(),
                                        metodoPago: 'EFECTIVO',
                                        referenciaTx: 'VENTA_CONTADO',
                                        notas: 'Pago íntegro automático por venta de contado',
                                        estadoSincronizacion: 'PENDIENTE',
                                        detalles: {
                                            create: prestamo.cuotas.map(function (c) { return ({
                                                cuotaId: c.id,
                                                montoAsignado: Number(c.monto),
                                                montoCapitalAsignado: Number(c.montoCapital),
                                                montoInteresAsignado: Number(c.montoInteres),
                                                moraAsignada: 0,
                                            }); })
                                        }
                                    }
                                })];
                        case 19:
                            _h.sent();
                            _h.label = 20;
                        case 20:
                            articuloNombre = data.productoNombre || ((_g = prestamo.producto) === null || _g === void 0 ? void 0 : _g.nombre) || 'Artículo';
                            totalCuotasPrometidas = cantidadCuotas;
                            isFinanciamientoArticulo = data.tipoPrestamo === 'ARTICULO';
                            safeNumber = function (val) {
                                var n = Number(val);
                                return isNaN(n) ? 0 : n;
                            };
                            return [4 /*yield*/, this.prisma.aprobacion.create({
                                    data: {
                                        tipoAprobacion: client_1.TipoAprobacion.NUEVO_PRESTAMO,
                                        referenciaId: prestamo.id,
                                        tablaReferencia: 'Prestamo',
                                        solicitadoPorId: data.creadoPorId,
                                        datosSolicitud: {
                                            numeroPrestamo: prestamo.numeroPrestamo,
                                            cliente: "".concat(cliente.nombres, " ").concat(cliente.apellidos),
                                            cedula: String(cliente.dni),
                                            telefono: String(cliente.telefono),
                                            monto: safeNumber(prestamo.monto),
                                            tipo: String(data.tipoPrestamo),
                                            articulo: String(articuloNombre),
                                            valorArticulo: safeNumber(data.valorArticulo || (safeNumber(data.monto) + safeNumber(data.cuotaInicial))),
                                            cuotas: safeNumber(totalCuotasPrometidas),
                                            plazoMeses: numPlazoMeses, // GUARDAR EL FLOAT (Ej: 0.4) para que la aprobación no lo redondee a 1.
                                            porcentaje: safeNumber(isFinanciamientoArticulo ? 0 : tasaInteres),
                                            frecuenciaPago: String(data.frecuenciaPago),
                                            cuotaInicial: safeNumber(data.cuotaInicial),
                                            notas: (data.notas || data.observaciones || data.comentarios || data.detalle || undefined)
                                                ? String(data.notas || data.observaciones || data.comentarios || data.detalle)
                                                : undefined,
                                            garantia: data.garantia ? String(data.garantia) : undefined,
                                            fechaPrimerCobro: data.fechaPrimerCobro ? String(data.fechaPrimerCobro) : undefined,
                                        },
                                        montoSolicitud: prestamo.monto,
                                        estado: data.esContado || esAutoAprobado ? client_1.EstadoAprobacion.APROBADO : client_1.EstadoAprobacion.PENDIENTE,
                                        aprobadoPorId: data.esContado || esAutoAprobado ? data.creadoPorId : undefined,
                                    },
                                })];
                        case 21:
                            aprobacion = _h.sent();
                            if (!(!esAutoAprobado && !data.esContado)) return [3 /*break*/, 28];
                            _h.label = 22;
                        case 22:
                            _h.trys.push([22, 24, , 25]);
                            return [4 /*yield*/, this.notificacionesService.notifyApprovers({
                                    titulo: 'Nuevo crédito requiere aprobación',
                                    mensaje: "".concat(creador.nombres, " ").concat(creador.apellidos, " solicit\u00F3 un ").concat(data.tipoPrestamo === 'EFECTIVO' ? 'préstamo' : 'crédito por un artículo', " para ").concat(cliente.nombres, " ").concat(cliente.apellidos, " por ").concat(montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }), "."),
                                    tipo: 'PRESTAMO',
                                    entidad: 'Aprobacion',
                                    entidadId: aprobacion.id,
                                    metadata: {
                                        tipoAprobacion: 'NUEVO_PRESTAMO',
                                        prestamoId: prestamo.id,
                                        clienteId: cliente.id,
                                        numeroPrestamo: prestamo.numeroPrestamo,
                                        monto: safeNumber(prestamo.monto),
                                        tipoPrestamo: data.tipoPrestamo,
                                    },
                                })];
                        case 23:
                            _h.sent();
                            return [3 /*break*/, 25];
                        case 24:
                            _b = _h.sent();
                            return [3 /*break*/, 25];
                        case 25:
                            _h.trys.push([25, 27, , 28]);
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: data.creadoPorId,
                                    titulo: 'Solicitud enviada',
                                    mensaje: 'Tu solicitud fue enviada con éxito y quedó pendiente de aprobación.',
                                    tipo: 'INFORMATIVO',
                                    entidad: 'Aprobacion',
                                    entidadId: aprobacion.id,
                                    metadata: {
                                        tipoAprobacion: 'NUEVO_PRESTAMO',
                                        prestamoId: prestamo.id,
                                        numeroPrestamo: prestamo.numeroPrestamo,
                                    },
                                })];
                        case 26:
                            _h.sent();
                            return [3 /*break*/, 28];
                        case 27:
                            _c = _h.sent();
                            return [3 /*break*/, 28];
                        case 28:
                            if (!(esAutoAprobado || data.esContado)) return [3 /*break*/, 37];
                            return [4 /*yield*/, this.prisma.usuario.findMany({
                                    where: {
                                        rol: { in: [client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR] },
                                        estado: 'ACTIVO',
                                        id: { not: data.creadoPorId },
                                    },
                                })];
                        case 29:
                            admins = _h.sent();
                            _i = 0, admins_2 = admins;
                            _h.label = 30;
                        case 30:
                            if (!(_i < admins_2.length)) return [3 /*break*/, 33];
                            admin = admins_2[_i];
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: admin.id,
                                    titulo: 'Préstamo Aprobado Automáticamente',
                                    mensaje: "".concat(creador.nombres, " ").concat(creador.apellidos, " cre\u00F3 y aprob\u00F3 autom\u00E1ticamente un pr\u00E9stamo para ").concat(cliente.nombres, " ").concat(cliente.apellidos, " por ").concat(montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })),
                                    tipo: 'SISTEMA',
                                    entidad: 'PRESTAMO',
                                    entidadId: prestamo.id,
                                })];
                        case 31:
                            _h.sent();
                            _h.label = 32;
                        case 32:
                            _i++;
                            return [3 /*break*/, 30];
                        case 33: 
                        // Enviar notificaciones push a administradores
                        return [4 /*yield*/, this.pushService.sendPushNotification({
                                title: 'Préstamo Aprobado Automáticamente',
                                body: "".concat(creador.nombres, " ").concat(creador.apellidos, " cre\u00F3 y aprob\u00F3 un pr\u00E9stamo por ").concat(montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })),
                                roleFilter: ['ADMIN', 'SUPER_ADMINISTRADOR'],
                                data: {
                                    type: 'PRESTAMO_APROBADO',
                                    prestamoId: prestamo.id,
                                    numeroPrestamo: prestamo.numeroPrestamo
                                }
                            })];
                        case 34:
                            // Enviar notificaciones push a administradores
                            _h.sent();
                            // Notificar al creador
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: data.creadoPorId,
                                    titulo: 'Préstamo Creado y Aprobado',
                                    mensaje: "El pr\u00E9stamo ".concat(prestamo.numeroPrestamo, " ha sido creado y aprobado autom\u00E1ticamente."),
                                    tipo: 'EXITO',
                                    entidad: 'PRESTAMO',
                                    entidadId: prestamo.id,
                                })];
                        case 35:
                            // Notificar al creador
                            _h.sent();
                            // Enviar notificación push al creador
                            return [4 /*yield*/, this.pushService.sendPushNotification({
                                    title: 'Préstamo Creado y Aprobado',
                                    body: "Tu pr\u00E9stamo ".concat(prestamo.numeroPrestamo, " ha sido creado y aprobado autom\u00E1ticamente."),
                                    userId: data.creadoPorId,
                                    data: {
                                        type: 'PRESTAMO_CREADO',
                                        prestamoId: prestamo.id,
                                        numeroPrestamo: prestamo.numeroPrestamo
                                    }
                                })];
                        case 36:
                            // Enviar notificación push al creador
                            _h.sent();
                            return [3 /*break*/, 40];
                        case 37: 
                        /*
                        // Notificar a coordinadores, admins y superadmins para aprobación
                        await this.notificacionesService.notifyApprovers({
                          titulo: 'Nuevo Préstamo Requiere Aprobación',
                          mensaje: `El usuario ${creador.nombres} ${creador.apellidos} ha solicitado un ${data.tipoPrestamo === 'EFECTIVO' ? 'préstamo en efectivo' : 'crédito por un artículo'} para ${cliente.nombres} ${cliente.apellidos} por valor de ${montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`,
                          tipo: 'APROBACION',
                          entidad: 'Aprobacion',
                          entidadId: aprobacion.id,
                          metadata: {
                             // ... [Omitido para no generar ruido de notificaciones de aprobación]
                          },
                        });
                        */
                        // Enviar notificaciones push a coordinadores
                        return [4 /*yield*/, this.pushService.sendPushNotification({
                                title: 'Nuevo Préstamo Requiere Aprobación',
                                body: "".concat(creador.nombres, " ").concat(creador.apellidos, " ha solicitado un ").concat(data.tipoPrestamo === 'EFECTIVO' ? 'préstamo' : 'crédito de artículo', " por ").concat(montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })),
                                roleFilter: ['COORDINADOR'],
                                data: {
                                    type: 'PRESTAMO_PENDIENTE',
                                    prestamoId: prestamo.id,
                                    numeroPrestamo: prestamo.numeroPrestamo
                                }
                            })];
                        case 38:
                            /*
                            // Notificar a coordinadores, admins y superadmins para aprobación
                            await this.notificacionesService.notifyApprovers({
                              titulo: 'Nuevo Préstamo Requiere Aprobación',
                              mensaje: `El usuario ${creador.nombres} ${creador.apellidos} ha solicitado un ${data.tipoPrestamo === 'EFECTIVO' ? 'préstamo en efectivo' : 'crédito por un artículo'} para ${cliente.nombres} ${cliente.apellidos} por valor de ${montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`,
                              tipo: 'APROBACION',
                              entidad: 'Aprobacion',
                              entidadId: aprobacion.id,
                              metadata: {
                                 // ... [Omitido para no generar ruido de notificaciones de aprobación]
                              },
                            });
                            */
                            // Enviar notificaciones push a coordinadores
                            _h.sent();
                            // Notificar al creador
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: data.creadoPorId,
                                    titulo: 'Préstamo Solicitado Exitosamente',
                                    mensaje: "Tu solicitud de pr\u00E9stamo ".concat(prestamo.numeroPrestamo, " ha sido creada exitosamente y est\u00E1 pendiente de aprobaci\u00F3n."),
                                    tipo: 'EXITO',
                                    entidad: 'PRESTAMO',
                                    entidadId: prestamo.id,
                                })];
                        case 39:
                            // Notificar al creador
                            _h.sent();
                            _h.label = 40;
                        case 40: 
                        // Auditoría
                        return [4 /*yield*/, this.auditService.create({
                                usuarioId: data.creadoPorId,
                                accion: 'CREAR_PRESTAMO',
                                entidad: 'Prestamo',
                                entidadId: prestamo.id,
                                datosNuevos: {
                                    numeroPrestamo: prestamo.numeroPrestamo,
                                    clienteId: prestamo.clienteId,
                                    tipoPrestamo: prestamo.tipoPrestamo,
                                    monto: prestamo.monto,
                                    plazoMeses: prestamo.plazoMeses,
                                    frecuenciaPago: prestamo.frecuenciaPago,
                                    autoAprobado: esAutoAprobado,
                                },
                                metadata: { notas: data.notas || null },
                            })];
                        case 41:
                            // Auditoría
                            _h.sent();
                            this.notificacionesGateway.broadcastPrestamosActualizados({
                                accion: 'CREAR',
                                prestamoId: prestamo.id,
                            });
                            this.notificacionesGateway.broadcastDashboardsActualizados({});
                            return [2 /*return*/, __assign(__assign({}, prestamo), { mensaje: esAutoAprobado
                                        ? 'Préstamo creado y aprobado automáticamente.'
                                        : 'Préstamo creado exitosamente. Pendiente de aprobación.', requiereAprobacion: !esAutoAprobado })];
                        case 42:
                            error_12 = _h.sent();
                            this.logger.error('Error creating loan:', error_12);
                            throw error_12;
                        case 43: return [2 /*return*/];
                    }
                });
            });
        };
        /**
         * Archivar préstamo como pérdida y agregar cliente a blacklist
         */
        LoansService_1.prototype.archiveLoan = function (prestamoId, data) {
            return __awaiter(this, void 0, void 0, function () {
                var prestamo, asignacion, cobradorId, _a;
                var _this = this;
                var _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: return [4 /*yield*/, this.prisma.prestamo.findUnique({
                                where: { id: prestamoId },
                                include: { cliente: true },
                            })];
                        case 1:
                            prestamo = _c.sent();
                            if (!prestamo) {
                                throw new common_1.NotFoundException('Préstamo no encontrado');
                            }
                            if (prestamo.estado === 'PERDIDA') {
                                throw new common_1.BadRequestException('Este préstamo ya está archivado como pérdida');
                            }
                            // Realizar operaciones en transacción
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    var err_1;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: 
                                            // 1. Marcar préstamo como PERDIDA
                                            return [4 /*yield*/, tx.prestamo.update({
                                                    where: { id: prestamoId },
                                                    data: {
                                                        estado: 'PERDIDA',
                                                        eliminadoEn: new Date(),
                                                    },
                                                })];
                                            case 1:
                                                // 1. Marcar préstamo como PERDIDA
                                                _a.sent();
                                                // 2. Agregar cliente a blacklist
                                                return [4 /*yield*/, tx.cliente.update({
                                                        where: { id: prestamo.clienteId },
                                                        data: {
                                                            enListaNegra: true,
                                                            razonListaNegra: data.motivo,
                                                            fechaListaNegra: new Date(),
                                                            agregadoListaNegraPorId: data.archivarPorId,
                                                            nivelRiesgo: 'LISTA_NEGRA',
                                                        },
                                                    })];
                                            case 2:
                                                // 2. Agregar cliente a blacklist
                                                _a.sent();
                                                // 3. Marcar aprobaciones pendientes como RECHAZADAS (específicamente las de este préstamo)
                                                return [4 /*yield*/, tx.aprobacion.updateMany({
                                                        where: {
                                                            referenciaId: prestamoId,
                                                            estado: 'PENDIENTE',
                                                        },
                                                        data: {
                                                            estado: 'RECHAZADO',
                                                            comentarios: "Archivado autom\u00E1ticamente: ".concat(data.motivo),
                                                            revisadoEn: new Date(),
                                                        },
                                                    })];
                                            case 3:
                                                // 3. Marcar aprobaciones pendientes como RECHAZADAS (específicamente las de este préstamo)
                                                _a.sent();
                                                // 3. Registrar en auditoría
                                                return [4 /*yield*/, this.auditService.create({
                                                        usuarioId: data.archivarPorId,
                                                        accion: 'ARCHIVAR_PRESTAMO',
                                                        entidad: 'Prestamo',
                                                        entidadId: prestamoId,
                                                        datosAnteriores: {
                                                            estado: prestamo.estado,
                                                            numeroPrestamo: prestamo.numeroPrestamo,
                                                            nombres: prestamo.cliente.nombres,
                                                            apellidos: prestamo.cliente.apellidos
                                                        },
                                                        datosNuevos: { estado: 'PERDIDA', motivo: data.motivo },
                                                    })];
                                            case 4:
                                                // 3. Registrar en auditoría
                                                _a.sent();
                                                _a.label = 5;
                                            case 5:
                                                _a.trys.push([5, 7, , 8]);
                                                return [4 /*yield*/, tx.notificacion.create({
                                                        data: {
                                                            usuarioId: data.archivarPorId,
                                                            titulo: 'Cuenta Archivada',
                                                            mensaje: "Pr\u00E9stamo ".concat(prestamo.numeroPrestamo, " archivado como p\u00E9rdida. Cliente ").concat(prestamo.cliente.nombres, " ").concat(prestamo.cliente.apellidos, " agregado a lista negra."),
                                                            tipo: 'ALERTA',
                                                            entidad: 'Prestamo',
                                                            entidadId: prestamoId,
                                                        },
                                                    })];
                                            case 6:
                                                _a.sent();
                                                return [3 /*break*/, 8];
                                            case 7:
                                                err_1 = _a.sent();
                                                return [3 /*break*/, 8];
                                            case 8: return [2 /*return*/];
                                        }
                                    });
                                }); })];
                        case 2:
                            // Realizar operaciones en transacción
                            _c.sent();
                            _c.label = 3;
                        case 3:
                            _c.trys.push([3, 7, , 8]);
                            return [4 /*yield*/, this.prisma.asignacionRuta.findFirst({
                                    where: { clienteId: prestamo.clienteId, activa: true },
                                    select: { ruta: { select: { cobradorId: true } } },
                                })];
                        case 4:
                            asignacion = _c.sent();
                            cobradorId = (_b = asignacion === null || asignacion === void 0 ? void 0 : asignacion.ruta) === null || _b === void 0 ? void 0 : _b.cobradorId;
                            if (!cobradorId) return [3 /*break*/, 6];
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: cobradorId,
                                    titulo: "Cuenta gestionada \u2014 Reportada como p\u00E9rdida (".concat(prestamo.numeroPrestamo, ")"),
                                    mensaje: "El cliente ".concat(prestamo.cliente.nombres, " ").concat(prestamo.cliente.apellidos, " fue gestionado en Cuentas Vencidas y se report\u00F3 como p\u00E9rdida.").concat(data.motivo ? " Motivo: ".concat(data.motivo) : ''),
                                    tipo: 'ADVERTENCIA',
                                    entidad: 'Prestamo',
                                    entidadId: prestamoId,
                                    metadata: {
                                        tipo: 'GESTION_VENCIDA',
                                        decision: 'CASTIGAR',
                                        prestamoId: prestamoId,
                                        clienteId: prestamo.clienteId,
                                        numeroPrestamo: prestamo.numeroPrestamo,
                                        motivo: data.motivo,
                                        archivarPorId: data.archivarPorId,
                                    },
                                })];
                        case 5:
                            _c.sent();
                            _c.label = 6;
                        case 6: return [3 /*break*/, 8];
                        case 7:
                            _a = _c.sent();
                            return [3 /*break*/, 8];
                        case 8: return [2 /*return*/, {
                                message: 'Préstamo archivado exitosamente',
                                prestamoId: prestamoId,
                                clienteId: prestamo.clienteId,
                                montoPerdida: Number(prestamo.saldoPendiente),
                            }];
                    }
                });
            });
        };
        LoansService_1.prototype.reprogramarCuota = function (prestamoId, numeroCuota, data) {
            return __awaiter(this, void 0, void 0, function () {
                var prestamo, cuota, nuevaFecha, cuotaActualizada;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.prestamo.findUnique({
                                where: { id: prestamoId },
                                include: { cuotas: true },
                            })];
                        case 1:
                            prestamo = _a.sent();
                            if (!prestamo) {
                                throw new common_1.NotFoundException('Préstamo no encontrado');
                            }
                            cuota = prestamo.cuotas.find(function (c) { return c.numeroCuota === numeroCuota; });
                            if (!cuota) {
                                throw new common_1.NotFoundException("Cuota #".concat(numeroCuota, " no encontrada"));
                            }
                            // Validar que la cuota esté pendiente
                            if (cuota.estado !== 'PENDIENTE') {
                                throw new common_1.BadRequestException('Solo se pueden reprogramar cuotas pendientes');
                            }
                            nuevaFecha = new Date(data.nuevaFecha);
                            if (isNaN(nuevaFecha.getTime())) {
                                throw new common_1.BadRequestException('Fecha inválida');
                            }
                            return [4 /*yield*/, this.prisma.cuota.update({
                                    where: { id: cuota.id },
                                    data: __assign(__assign({ fechaVencimiento: nuevaFecha }, (data.montoParcial && { monto: data.montoParcial })), { actualizadoEn: new Date() }),
                                })];
                        case 2:
                            cuotaActualizada = _a.sent();
                            // Registrar auditoría
                            return [4 /*yield*/, this.auditService.create({
                                    usuarioId: data.reprogramadoPorId,
                                    accion: 'REPROGRAMAR_CUOTA',
                                    entidad: 'Cuota',
                                    entidadId: cuota.id,
                                    datosNuevos: {
                                        prestamoId: prestamoId,
                                        numeroCuota: numeroCuota,
                                        fechaAnterior: cuota.fechaVencimiento,
                                        fechaNueva: data.nuevaFecha,
                                        motivo: data.motivo,
                                        montoParcial: data.montoParcial,
                                    },
                                })];
                        case 3:
                            // Registrar auditoría
                            _a.sent();
                            // Notificar al cliente (opcional)
                            // TODO: Implementar notificación al cliente sobre reprogramación
                            this.logger.log("Cuota #".concat(numeroCuota, " del pr\u00E9stamo ").concat(prestamoId, " reprogramada a ").concat(data.nuevaFecha));
                            return [2 /*return*/, {
                                    mensaje: 'Cuota reprogramada exitosamente',
                                    cuota: cuotaActualizada,
                                }];
                    }
                });
            });
        };
        /**
         * ADMIN: Corrige cálculos de intereses en préstamos existentes.
         * Recalcula el interés total basándose en Interés Simple Correcto (Capital * Tasa * PlazoMeses / 100).
         * Ajusta el saldo pendiente y distribuye la diferencia en las cuotas pendientes.
         */
        LoansService_1.prototype.fixInterestCalculations = function () {
            return __awaiter(this, void 0, void 0, function () {
                var results, loans, _i, loans_1, loan, capital, tasaMensual, plazoMeses, factor, interesCorrecto, interesActual, diferenciaInteres, deudaTotalVieja, pagado, nuevoMontoTotal, nuevoSaldoPendiente, cuotasAjustables, ajustePorCuota, _a, cuotasAjustables_1, cuota, error_13;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            this.logger.log('Iniciando corrección masiva de intereses...');
                            results = {
                                processed: 0,
                                corrected: 0,
                                details: []
                            };
                            return [4 /*yield*/, this.prisma.prestamo.findMany({
                                    where: {
                                        tipoAmortizacion: client_1.TipoAmortizacion.INTERES_SIMPLE,
                                        estado: { in: [client_1.EstadoPrestamo.ACTIVO, client_1.EstadoPrestamo.EN_MORA] },
                                    },
                                    include: {
                                        cuotas: true
                                    },
                                })];
                        case 1:
                            loans = _b.sent();
                            results.processed = loans.length;
                            _i = 0, loans_1 = loans;
                            _b.label = 2;
                        case 2:
                            if (!(_i < loans_1.length)) return [3 /*break*/, 12];
                            loan = loans_1[_i];
                            // Ordenar cuotas en memoria para evitar fallos de driver con orderBy en include
                            loan.cuotas.sort(function (a, b) { return a.numeroCuota - b.numeroCuota; });
                            _b.label = 3;
                        case 3:
                            _b.trys.push([3, 10, , 11]);
                            capital = Number(loan.monto);
                            tasaMensual = Number(loan.tasaInteres);
                            plazoMeses = loan.plazoMeses;
                            if (!plazoMeses || plazoMeses === 0) {
                                factor = loan.frecuenciaPago === 'MENSUAL' ? 1 :
                                    loan.frecuenciaPago === 'QUINCENAL' ? 2 :
                                        loan.frecuenciaPago === 'SEMANAL' ? 4 : 30;
                                plazoMeses = Math.ceil(loan.cantidadCuotas / factor);
                            }
                            interesCorrecto = Math.round((capital * (tasaMensual / 100) * plazoMeses) * 100) / 100;
                            interesActual = Number(loan.interesTotal);
                            if (!(interesCorrecto > interesActual && (interesCorrecto - interesActual) > 100)) return [3 /*break*/, 9];
                            diferenciaInteres = interesCorrecto - interesActual;
                            this.logger.log("Corrigiendo Pr\u00E9stamo ".concat(loan.numeroPrestamo, ": Inter\u00E9s Actual ").concat(interesActual, " -> Nuevo ").concat(interesCorrecto, " (Dif: ").concat(diferenciaInteres, ")"));
                            deudaTotalVieja = Number(loan.monto) + Number(loan.interesTotal);
                            pagado = deudaTotalVieja - Number(loan.saldoPendiente);
                            nuevoMontoTotal = Number(loan.monto) + interesCorrecto;
                            nuevoSaldoPendiente = nuevoMontoTotal - pagado;
                            // Actualizar préstamo
                            return [4 /*yield*/, this.prisma.prestamo.update({
                                    where: { id: loan.id },
                                    data: {
                                        interesTotal: interesCorrecto,
                                        saldoPendiente: nuevoSaldoPendiente,
                                    }
                                })];
                        case 4:
                            // Actualizar préstamo
                            _b.sent();
                            cuotasAjustables = loan.cuotas.filter(function (c) {
                                return c.estado === 'PENDIENTE' || c.estado === 'PARCIAL' || c.estado === 'VENCIDA';
                            });
                            if (!(cuotasAjustables.length > 0)) return [3 /*break*/, 8];
                            ajustePorCuota = Math.round((diferenciaInteres / cuotasAjustables.length) * 100) / 100;
                            _a = 0, cuotasAjustables_1 = cuotasAjustables;
                            _b.label = 5;
                        case 5:
                            if (!(_a < cuotasAjustables_1.length)) return [3 /*break*/, 8];
                            cuota = cuotasAjustables_1[_a];
                            return [4 /*yield*/, this.prisma.cuota.update({
                                    where: { id: cuota.id },
                                    data: {
                                        montoInteres: { increment: ajustePorCuota },
                                        monto: { increment: ajustePorCuota },
                                    }
                                })];
                        case 6:
                            _b.sent();
                            _b.label = 7;
                        case 7:
                            _a++;
                            return [3 /*break*/, 5];
                        case 8:
                            results.corrected++;
                            results.details.push("Pr\u00E9stamo ".concat(loan.numeroPrestamo, ": Ajuste de +").concat(diferenciaInteres));
                            _b.label = 9;
                        case 9: return [3 /*break*/, 11];
                        case 10:
                            error_13 = _b.sent();
                            this.logger.error("Error corrigiendo pr\u00E9stamo ".concat(loan.numeroPrestamo, ": ").concat(error_13));
                            return [3 /*break*/, 11];
                        case 11:
                            _i++;
                            return [3 /*break*/, 2];
                        case 12: return [2 /*return*/, results];
                    }
                });
            });
        };
        // ── FLUJO DE APROBACIÓN DE REPROGRAMACIONES ─────────────────────────────────
        /**
         * El COBRADOR solicita reprogramar una cuota. Se registra como Aprobacion
         * en estado PENDIENTE y se notifica a los aprobadores (ADMIN/COORDINADOR).
         * Valida los límites de días: semanal ≤6 días, quincenal ≤14 días.
         */
        LoansService_1.prototype.solicitarReprogramacion = function (data) {
            return __awaiter(this, void 0, void 0, function () {
                var prestamo, cuota, nuevaFecha, hoy, diasDesdeHoy, limiteDias, limite, aprobacion, usuarioSolicitante, rolesAutoAprobacion, rolNameText;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.prisma.prestamo.findUnique({
                                where: { id: data.prestamoId },
                                include: {
                                    cliente: true,
                                    cuotas: data.cuotaId
                                        ? { where: { id: data.cuotaId } }
                                        : { where: { estado: { not: 'PAGADA' } }, orderBy: { numeroCuota: 'asc' }, take: 1 },
                                },
                            })];
                        case 1:
                            prestamo = _b.sent();
                            if (!prestamo)
                                throw new common_1.NotFoundException('Préstamo no encontrado');
                            cuota = prestamo.cuotas[0];
                            if (!cuota)
                                throw new common_1.NotFoundException('Cuota no encontrada');
                            if (cuota.estado === 'PAGADA') {
                                throw new common_1.BadRequestException('La cuota ya fue pagada');
                            }
                            nuevaFecha = new Date(data.nuevaFecha + 'T00:00:00.000Z');
                            hoy = new Date();
                            hoy.setUTCHours(0, 0, 0, 0);
                            diasDesdeHoy = Math.round((nuevaFecha.getTime() - hoy.getTime()) / 86400000);
                            limiteDias = {
                                SEMANAL: 6,
                                QUINCENAL: 14,
                                MENSUAL: 30,
                                DIARIO: 8,
                            };
                            limite = (_a = limiteDias[prestamo.frecuenciaPago]) !== null && _a !== void 0 ? _a : 30;
                            if (diasDesdeHoy > limite) {
                                throw new common_1.BadRequestException("La reprogramaci\u00F3n para cr\u00E9ditos ".concat(prestamo.frecuenciaPago.toLowerCase(), " no puede ser m\u00E1s de ").concat(limite, " d\u00EDas desde hoy"));
                            }
                            if (diasDesdeHoy < 0) {
                                throw new common_1.BadRequestException('La nueva fecha no puede ser anterior a hoy');
                            }
                            return [4 /*yield*/, this.prisma.aprobacion.create({
                                    data: {
                                        tipoAprobacion: client_1.TipoAprobacion.REPROGRAMACION_CUOTA,
                                        referenciaId: cuota.id,
                                        tablaReferencia: 'cuotas',
                                        solicitadoPorId: data.solicitadoPorId,
                                        estado: client_1.EstadoAprobacion.PENDIENTE,
                                        datosSolicitud: {
                                            prestamoId: data.prestamoId,
                                            cuotaId: data.cuotaId || cuota.id,
                                            clienteNombre: "".concat(prestamo.cliente.nombres, " ").concat(prestamo.cliente.apellidos),
                                            clienteId: prestamo.clienteId,
                                            numeroPrestamo: prestamo.numeroPrestamo,
                                            numeroCuota: cuota.numeroCuota,
                                            frecuenciaPago: prestamo.frecuenciaPago,
                                            fechaVencimientoOriginal: cuota.fechaVencimiento.toISOString(),
                                            nuevaFecha: data.nuevaFecha,
                                            motivo: data.motivo,
                                            montoCuota: Number(cuota.monto),
                                        },
                                    },
                                })];
                        case 2:
                            aprobacion = _b.sent();
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: { id: data.solicitadoPorId },
                                    select: { rol: true }
                                })];
                        case 3:
                            usuarioSolicitante = _b.sent();
                            rolesAutoAprobacion = ['ADMIN', 'SUPER_ADMINISTRADOR', 'COORDINADOR'];
                            if (!(usuarioSolicitante && rolesAutoAprobacion.includes(usuarioSolicitante.rol))) return [3 /*break*/, 5];
                            return [4 /*yield*/, this.aprobarReprogramacion(aprobacion.id, data.solicitadoPorId)];
                        case 4:
                            _b.sent();
                            this.logger.log("Reprogramacion auto-aprobada: cuota ".concat(cuota.id, " del prestamo ").concat(data.prestamoId, " -> ").concat(data.nuevaFecha));
                            return [2 /*return*/, { mensaje: 'Reprogramación aprobada y aplicada automáticamente', aprobacion: aprobacion }];
                        case 5:
                            rolNameText = (usuarioSolicitante === null || usuarioSolicitante === void 0 ? void 0 : usuarioSolicitante.rol) === 'SUPERVISOR' ? 'Supervisor' : 'Cobrador Principal';
                            // Notificar a aprobadores (ADMIN / COORDINADOR / SUPERVISOR)
                            return [4 /*yield*/, this.notificacionesService.notifyApprovers({
                                    titulo: 'Reprogramaciones',
                                    mensaje: "Solicitud de reprogramaciones por ".concat(rolNameText),
                                    tipo: 'REPROGRAMACION',
                                    entidad: 'Aprobacion',
                                    entidadId: aprobacion.id,
                                    metadata: { aprobacionId: aprobacion.id, prestamoId: data.prestamoId },
                                })];
                        case 6:
                            // Notificar a aprobadores (ADMIN / COORDINADOR / SUPERVISOR)
                            _b.sent();
                            this.logger.log("Reprogramacion solicitada: cuota ".concat(cuota.id, " del prestamo ").concat(data.prestamoId, " -> ").concat(data.nuevaFecha));
                            return [2 /*return*/, { mensaje: 'Solicitud de reprogramacion enviada para revision', aprobacion: aprobacion }];
                    }
                });
            });
        };
        /**
         * Lista todas las reprogramaciones PENDIENTES para el módulo de revisiones.
         */
        LoansService_1.prototype.listarReprogramacionesPendientes = function (estado) {
            return __awaiter(this, void 0, void 0, function () {
                var where, solicitudes;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            where = {
                                tipoAprobacion: client_1.TipoAprobacion.REPROGRAMACION_CUOTA,
                            };
                            if (estado && estado !== 'TODOS') {
                                where.estado = estado;
                            }
                            else {
                                where.estado = client_1.EstadoAprobacion.PENDIENTE;
                            }
                            return [4 /*yield*/, this.prisma.aprobacion.findMany({
                                    where: where,
                                    orderBy: { creadoEn: 'desc' },
                                    include: {
                                        solicitadoPor: { select: { id: true, nombres: true, apellidos: true, rol: true } },
                                        aprobadoPor: { select: { id: true, nombres: true, apellidos: true } },
                                    },
                                })];
                        case 1:
                            solicitudes = _a.sent();
                            return [2 /*return*/, solicitudes.map(function (s) { return (__assign(__assign({}, s), { datosSolicitud: s.datosSolicitud })); })];
                    }
                });
            });
        };
        /**
         * SUPERVISOR/ADMIN aprueba una reprogramación: aplica la nueva fecha a la cuota.
         */
        LoansService_1.prototype.aprobarReprogramacion = function (aprobacionId, aprobadoPorId) {
            return __awaiter(this, void 0, void 0, function () {
                var aprobacion, datos;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.aprobacion.findUnique({ where: { id: aprobacionId } })];
                        case 1:
                            aprobacion = _a.sent();
                            if (!aprobacion)
                                throw new common_1.NotFoundException('Solicitud no encontrada');
                            if (aprobacion.estado !== client_1.EstadoAprobacion.PENDIENTE) {
                                throw new common_1.BadRequestException('Solo se pueden aprobar solicitudes pendientes');
                            }
                            datos = aprobacion.datosSolicitud;
                            // Aplicar la nueva fecha a la cuota
                            return [4 /*yield*/, this.prisma.cuota.update({
                                    where: { id: datos.cuotaId || aprobacion.referenciaId },
                                    data: { fechaVencimiento: new Date(datos.nuevaFecha.includes('T') ? datos.nuevaFecha : datos.nuevaFecha + 'T12:00:00.000Z') },
                                })];
                        case 2:
                            // Aplicar la nueva fecha a la cuota
                            _a.sent();
                            // Actualizar estado de la aprobación
                            return [4 /*yield*/, this.prisma.aprobacion.update({
                                    where: { id: aprobacionId },
                                    data: {
                                        estado: client_1.EstadoAprobacion.APROBADO,
                                        aprobadoPorId: aprobadoPorId,
                                        revisadoEn: new Date(),
                                    },
                                })];
                        case 3:
                            // Actualizar estado de la aprobación
                            _a.sent();
                            // Notificar al cobrador que solicitó
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: aprobacion.solicitadoPorId,
                                    titulo: 'Reprogramacion aprobada',
                                    mensaje: "La reprogramacion de la cuota del cliente ".concat(datos.clienteNombre, " al ").concat(datos.nuevaFecha, " fue APROBADA."),
                                    tipo: 'REPROGRAMACION_APROBADA',
                                    entidad: 'Aprobacion',
                                    entidadId: aprobacionId,
                                })];
                        case 4:
                            // Notificar al cobrador que solicitó
                            _a.sent();
                            // Avisar a todos los componentes que recarguen datos
                            this.notificacionesGateway.broadcastRutasActualizadas();
                            this.notificacionesGateway.broadcastDashboardsActualizados();
                            this.notificacionesGateway.broadcastPrestamosActualizados();
                            this.notificacionesGateway.broadcastAprobacionesActualizadas();
                            return [2 /*return*/, { mensaje: 'Reprogramación aprobada y aplicada exitosamente' }];
                    }
                });
            });
        };
        /**
         * SUPERVISOR/ADMIN rechaza una reprogramación.
         */
        LoansService_1.prototype.rechazarReprogramacion = function (aprobacionId, rechazadoPorId, comentarios) {
            return __awaiter(this, void 0, void 0, function () {
                var aprobacion, datos;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.aprobacion.findUnique({ where: { id: aprobacionId } })];
                        case 1:
                            aprobacion = _a.sent();
                            if (!aprobacion)
                                throw new common_1.NotFoundException('Solicitud no encontrada');
                            if (aprobacion.estado !== client_1.EstadoAprobacion.PENDIENTE) {
                                throw new common_1.BadRequestException('Solo se pueden rechazar solicitudes pendientes');
                            }
                            datos = aprobacion.datosSolicitud;
                            return [4 /*yield*/, this.prisma.aprobacion.update({
                                    where: { id: aprobacionId },
                                    data: {
                                        estado: client_1.EstadoAprobacion.RECHAZADO,
                                        aprobadoPorId: rechazadoPorId,
                                        revisadoEn: new Date(),
                                        comentarios: comentarios || null,
                                    },
                                })];
                        case 2:
                            _a.sent();
                            // Notificar al cobrador
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: aprobacion.solicitadoPorId,
                                    titulo: 'Reprogramacion rechazada',
                                    mensaje: "La reprogramacion de la cuota del cliente ".concat(datos.clienteNombre, " fue RECHAZADA.").concat(comentarios ? " Motivo: ".concat(comentarios) : ''),
                                    tipo: 'REPROGRAMACION_RECHAZADA',
                                    entidad: 'Aprobacion',
                                    entidadId: aprobacionId,
                                })];
                        case 3:
                            // Notificar al cobrador
                            _a.sent();
                            // Actualizar vistas (revisiones, etc)
                            this.notificacionesGateway.broadcastAprobacionesActualizadas();
                            return [2 /*return*/, { mensaje: 'Reprogramación rechazada' }];
                    }
                });
            });
        };
        /**
         * Exportar cartera de préstamos en Excel o PDF.
         * Utiliza la plantilla completa cartera-creditos.template.ts
         */
        LoansService_1.prototype.exportLoans = function (format, filters) {
            return __awaiter(this, void 0, void 0, function () {
                var rawLoans, prestamos, totales, filas, fechaStr;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getAllLoans({
                                estado: filters.estado || 'todos',
                                ruta: filters.ruta || 'todas',
                                search: filters.search || '',
                                limit: 999999, // Traer todos para exportar
                            })];
                        case 1:
                            rawLoans = _a.sent();
                            prestamos = rawLoans.prestamos;
                            totales = {
                                montoTotal: prestamos.reduce(function (sum, p) { return sum + (p.montoTotal || 0); }, 0),
                                montoPendiente: prestamos.reduce(function (sum, p) { return sum + (p.montoPendiente || 0); }, 0),
                                montoPagado: prestamos.reduce(function (sum, p) { return sum + (p.montoPagado || 0); }, 0),
                                totalAdeudado: prestamos.reduce(function (sum, p) { return sum + ((p.montoPendiente || 0) + (p.moraAcumulada || 0)); }, 0),
                                interesRecogido: 0, // Se mantiene 0 por ahora según lógica actual
                                mora: prestamos.reduce(function (sum, p) { return sum + (p.moraAcumulada || 0); }, 0),
                                recaudo: prestamos.reduce(function (sum, p) { return sum + (p.montoPagado || 0) + (p.moraAcumulada || 0); }, 0),
                                totalRegistros: prestamos.length,
                            };
                            filas = prestamos.map(function (p) { return ({
                                numeroPrestamo: p.numeroPrestamo,
                                cliente: p.cliente,
                                dni: p.clienteDni,
                                producto: p.producto,
                                estado: p.estado,
                                montoTotal: p.montoTotal,
                                montoPendiente: p.montoPendiente,
                                montoPagado: p.montoPagado,
                                interesRecogido: 0,
                                totalAdeudado: p.montoPendiente + p.moraAcumulada,
                                mora: p.moraAcumulada,
                                recaudo: p.montoPagado + p.moraAcumulada, // Consistente con el recaudo total
                                cuotasPagadas: p.cuotasPagadas,
                                cuotasTotales: p.cuotasTotales,
                                progreso: p.progreso,
                                riesgo: p.riesgo,
                                ruta: p.rutaNombre,
                                cobrador: p.vendedor,
                                fechaInicio: p.fechaInicio,
                                fechaFin: p.fechaFin,
                            }); });
                            fechaStr = new Date().toISOString().split('T')[0];
                            if (format === 'excel') {
                                return [2 /*return*/, (0, cartera_creditos_template_1.generarExcelCartera)(filas, totales, fechaStr)];
                            }
                            else {
                                return [2 /*return*/, (0, cartera_creditos_template_1.generarPDFCartera)(filas, totales, fechaStr)];
                            }
                            return [2 /*return*/];
                    }
                });
            });
        };
        return LoansService_1;
    }());
    __setFunctionName(_classThis, "LoansService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        LoansService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return LoansService = _classThis;
}();
exports.LoansService = LoansService;
