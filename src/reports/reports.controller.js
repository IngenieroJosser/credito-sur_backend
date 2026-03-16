"use strict";
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
exports.ReportsController = void 0;
var common_1 = require("@nestjs/common");
var swagger_1 = require("@nestjs/swagger");
var jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
var roles_guard_1 = require("../auth/guards/roles.guard");
var roles_decorator_1 = require("../auth/decorators/roles.decorator");
var client_1 = require("@prisma/client");
var responses_dto_1 = require("./dto/responses.dto");
var responses_cuentas_vencidas_dto_1 = require("./dto/responses-cuentas-vencidas.dto");
var ReportsController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('reports'), (0, common_1.Controller)('reports'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard)];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _getFinancialSummary_decorators;
    var _getMonthlyEvolution_decorators;
    var _getExpenseDistribution_decorators;
    var _getFinancialTargets_decorators;
    var _obtenerPrestamosMora_decorators;
    var _exportarReporteMora_decorators;
    var _obtenerEstadisticasMora_decorators;
    var _obtenerCuentasVencidas_decorators;
    var _procesarDecisionCastigo_decorators;
    var _exportarCuentasVencidas_decorators;
    var _getOperationalReport_decorators;
    var _getRouteDetail_decorators;
    var _exportFinancialReport_decorators;
    var _exportOperationalReport_decorators;
    var ReportsController = _classThis = /** @class */ (function () {
        function ReportsController_1(reportsService) {
            this.reportsService = (__runInitializers(this, _instanceExtraInitializers), reportsService);
        }
        ReportsController_1.prototype.getFinancialSummary = function (startDate, endDate) {
            var start = startDate
                ? new Date(startDate)
                : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
            var end = endDate ? new Date(endDate) : new Date();
            return this.reportsService.getFinancialSummary(start, end);
        };
        ReportsController_1.prototype.getMonthlyEvolution = function (year) {
            var y = year ? parseInt(year) : new Date().getFullYear();
            return this.reportsService.getMonthlyEvolution(y);
        };
        ReportsController_1.prototype.getExpenseDistribution = function (startDate, endDate) {
            var start = startDate
                ? new Date(startDate)
                : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
            var end = endDate ? new Date(endDate) : new Date();
            return this.reportsService.getExpenseDistribution(start, end);
        };
        ReportsController_1.prototype.getFinancialTargets = function () {
            return this.reportsService.getFinancialTargets();
        };
        ReportsController_1.prototype.obtenerPrestamosMora = function (filtros, pagina, limite) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.reportsService.obtenerPrestamosEnMora(filtros, pagina, limite)];
                });
            });
        };
        ReportsController_1.prototype.exportarReporteMora = function (exportRequest, res) {
            return __awaiter(this, void 0, void 0, function () {
                var result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.reportsService.generarReporteMora(exportRequest.filtros, exportRequest.formato)];
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
        ReportsController_1.prototype.obtenerEstadisticasMora = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.reportsService.obtenerEstadisticasMora()];
                });
            });
        };
        ReportsController_1.prototype.obtenerCuentasVencidas = function (filtros) {
            return __awaiter(this, void 0, void 0, function () {
                var pagina, limite;
                return __generator(this, function (_a) {
                    pagina = filtros.pagina || 1;
                    limite = filtros.limite || 50;
                    return [2 /*return*/, this.reportsService.obtenerCuentasVencidas(filtros, pagina, limite)];
                });
            });
        };
        ReportsController_1.prototype.procesarDecisionCastigo = function (decisionDto, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.reportsService.procesarDecisionCastigo(decisionDto, req.user.id)];
                });
            });
        };
        ReportsController_1.prototype.exportarCuentasVencidas = function (exportRequest, res) {
            return __awaiter(this, void 0, void 0, function () {
                var result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.reportsService.exportarCuentasVencidas(exportRequest.formato, exportRequest.filtros)];
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
        ReportsController_1.prototype.getOperationalReport = function (query) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.reportsService.getOperationalReport(query)];
                });
            });
        };
        ReportsController_1.prototype.getRouteDetail = function (routeId, period, startDate, endDate) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.reportsService.getRouteDetail(routeId, {
                            period: period,
                            startDate: startDate,
                            endDate: endDate,
                        })];
                });
            });
        };
        ReportsController_1.prototype.exportFinancialReport = function (format, startDate, endDate, res) {
            return __awaiter(this, void 0, void 0, function () {
                var start, end, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            start = startDate
                                ? new Date(startDate)
                                : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                            end = endDate ? new Date(endDate) : new Date();
                            return [4 /*yield*/, this.reportsService.exportFinancialReport(start, end, format)];
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
        ReportsController_1.prototype.exportOperationalReport = function (filters, format, res) {
            return __awaiter(this, void 0, void 0, function () {
                var result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.reportsService.exportOperationalReport(filters, format)];
                        case 1:
                            result = _a.sent();
                            // Configurar headers para la descarga
                            res.setHeader('Content-Type', result.contentType);
                            res.setHeader('Content-Disposition', "attachment; filename=\"".concat(result.filename, "\""));
                            // Enviar el buffer como respuesta
                            res.send(result.data);
                            return [2 /*return*/];
                    }
                });
            });
        };
        return ReportsController_1;
    }());
    __setFunctionName(_classThis, "ReportsController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _getFinancialSummary_decorators = [(0, common_1.Get)('financial/summary'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.CONTADOR)];
        _getMonthlyEvolution_decorators = [(0, common_1.Get)('financial/monthly'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.CONTADOR)];
        _getExpenseDistribution_decorators = [(0, common_1.Get)('financial/expenses'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.CONTADOR)];
        _getFinancialTargets_decorators = [(0, common_1.Get)('financial/targets'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.CONTADOR)];
        _obtenerPrestamosMora_decorators = [(0, common_1.Get)('prestamos-mora'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.CONTADOR), (0, swagger_1.ApiOperation)({ summary: 'Obtener préstamos en mora' }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.OK,
                description: 'Lista de préstamos en mora',
                type: responses_dto_1.PrestamosMoraResponseDto,
            }), (0, swagger_1.ApiQuery)({ name: 'pagina', required: false, type: Number }), (0, swagger_1.ApiQuery)({ name: 'limite', required: false, type: Number })];
        _exportarReporteMora_decorators = [(0, common_1.Post)('exportar-mora'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.CONTADOR), (0, swagger_1.ApiOperation)({ summary: 'Exportar reporte de mora' }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.CREATED,
                description: 'Reporte exportado exitosamente',
            })];
        _obtenerEstadisticasMora_decorators = [(0, common_1.Get)('estadisticas-mora'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.CONTADOR), (0, swagger_1.ApiOperation)({ summary: 'Obtener estadísticas de mora' }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.OK,
                description: 'Estadísticas de préstamos en mora',
            })];
        _obtenerCuentasVencidas_decorators = [(0, common_1.Get)('cuentas-vencidas'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.CONTADOR), (0, swagger_1.ApiOperation)({ summary: 'Obtener cuentas vencidas' }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.OK,
                description: 'Lista de cuentas vencidas',
                type: responses_cuentas_vencidas_dto_1.CuentasVencidasResponseDto,
            })];
        _procesarDecisionCastigo_decorators = [(0, common_1.Post)('cuentas-vencidas/decision'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.CONTADOR), (0, swagger_1.ApiOperation)({ summary: 'Procesar decisión sobre cuenta vencida' }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.CREATED,
                description: 'Decisión procesada exitosamente',
            })];
        _exportarCuentasVencidas_decorators = [(0, common_1.Post)('cuentas-vencidas/exportar'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.CONTADOR), (0, swagger_1.ApiOperation)({ summary: 'Exportar reporte de cuentas vencidas' }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.CREATED,
                description: 'Reporte exportado exitosamente',
            })];
        _getOperationalReport_decorators = [(0, common_1.Get)('operational/coordinator'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR), (0, swagger_1.ApiOperation)({
                summary: 'Obtener reporte operativo para coordinador',
                description: 'Retorna métricas de rendimiento por ruta, recaudo, préstamos nuevos y eficiencia',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.OK,
                description: 'Reporte operativo obtenido exitosamente',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.UNAUTHORIZED,
                description: 'No autorizado',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.FORBIDDEN,
                description: 'Permisos insuficientes',
            }), (0, common_1.HttpCode)(common_1.HttpStatus.OK)];
        _getRouteDetail_decorators = [(0, common_1.Get)('operational/route-detail/:routeId'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.SUPERVISOR), (0, swagger_1.ApiOperation)({
                summary: 'Obtener detalle de reporte por ruta',
                description: 'Retorna el detalle completo de una ruta específica',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.OK,
                description: 'Detalle de ruta obtenido exitosamente',
            }), (0, swagger_1.ApiResponse)({
                status: common_1.HttpStatus.NOT_FOUND,
                description: 'Ruta no encontrada',
            }), (0, common_1.HttpCode)(common_1.HttpStatus.OK)];
        _exportFinancialReport_decorators = [(0, common_1.Get)('financial/export'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.CONTADOR), (0, swagger_1.ApiOperation)({ summary: 'Exportar reporte financiero' }), (0, common_1.HttpCode)(common_1.HttpStatus.OK)];
        _exportOperationalReport_decorators = [(0, common_1.Get)('operational/export'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR), (0, swagger_1.ApiOperation)({
                summary: 'Exportar reporte operativo',
                description: 'Exporta el reporte operativo en formato Excel o PDF',
            }), (0, common_1.HttpCode)(common_1.HttpStatus.OK)];
        __esDecorate(_classThis, null, _getFinancialSummary_decorators, { kind: "method", name: "getFinancialSummary", static: false, private: false, access: { has: function (obj) { return "getFinancialSummary" in obj; }, get: function (obj) { return obj.getFinancialSummary; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getMonthlyEvolution_decorators, { kind: "method", name: "getMonthlyEvolution", static: false, private: false, access: { has: function (obj) { return "getMonthlyEvolution" in obj; }, get: function (obj) { return obj.getMonthlyEvolution; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getExpenseDistribution_decorators, { kind: "method", name: "getExpenseDistribution", static: false, private: false, access: { has: function (obj) { return "getExpenseDistribution" in obj; }, get: function (obj) { return obj.getExpenseDistribution; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getFinancialTargets_decorators, { kind: "method", name: "getFinancialTargets", static: false, private: false, access: { has: function (obj) { return "getFinancialTargets" in obj; }, get: function (obj) { return obj.getFinancialTargets; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _obtenerPrestamosMora_decorators, { kind: "method", name: "obtenerPrestamosMora", static: false, private: false, access: { has: function (obj) { return "obtenerPrestamosMora" in obj; }, get: function (obj) { return obj.obtenerPrestamosMora; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _exportarReporteMora_decorators, { kind: "method", name: "exportarReporteMora", static: false, private: false, access: { has: function (obj) { return "exportarReporteMora" in obj; }, get: function (obj) { return obj.exportarReporteMora; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _obtenerEstadisticasMora_decorators, { kind: "method", name: "obtenerEstadisticasMora", static: false, private: false, access: { has: function (obj) { return "obtenerEstadisticasMora" in obj; }, get: function (obj) { return obj.obtenerEstadisticasMora; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _obtenerCuentasVencidas_decorators, { kind: "method", name: "obtenerCuentasVencidas", static: false, private: false, access: { has: function (obj) { return "obtenerCuentasVencidas" in obj; }, get: function (obj) { return obj.obtenerCuentasVencidas; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _procesarDecisionCastigo_decorators, { kind: "method", name: "procesarDecisionCastigo", static: false, private: false, access: { has: function (obj) { return "procesarDecisionCastigo" in obj; }, get: function (obj) { return obj.procesarDecisionCastigo; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _exportarCuentasVencidas_decorators, { kind: "method", name: "exportarCuentasVencidas", static: false, private: false, access: { has: function (obj) { return "exportarCuentasVencidas" in obj; }, get: function (obj) { return obj.exportarCuentasVencidas; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getOperationalReport_decorators, { kind: "method", name: "getOperationalReport", static: false, private: false, access: { has: function (obj) { return "getOperationalReport" in obj; }, get: function (obj) { return obj.getOperationalReport; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getRouteDetail_decorators, { kind: "method", name: "getRouteDetail", static: false, private: false, access: { has: function (obj) { return "getRouteDetail" in obj; }, get: function (obj) { return obj.getRouteDetail; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _exportFinancialReport_decorators, { kind: "method", name: "exportFinancialReport", static: false, private: false, access: { has: function (obj) { return "exportFinancialReport" in obj; }, get: function (obj) { return obj.exportFinancialReport; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _exportOperationalReport_decorators, { kind: "method", name: "exportOperationalReport", static: false, private: false, access: { has: function (obj) { return "exportOperationalReport" in obj; }, get: function (obj) { return obj.exportOperationalReport; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ReportsController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ReportsController = _classThis;
}();
exports.ReportsController = ReportsController;
