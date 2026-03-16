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
exports.AccountingController = void 0;
var common_1 = require("@nestjs/common");
var jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
var client_1 = require("@prisma/client");
var roles_guard_1 = require("../auth/guards/roles.guard");
var roles_decorator_1 = require("../auth/decorators/roles.decorator");
var client_2 = require("@prisma/client");
var AccountingController = function () {
    var _classDecorators = [(0, common_1.Controller)('accounting'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard)];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _getCajas_decorators;
    var _getCajaById_decorators;
    var _createCaja_decorators;
    var _updateCaja_decorators;
    var _deleteCaja_decorators;
    var _consolidarCaja_decorators;
    var _registrarArqueo_decorators;
    var _getTransacciones_decorators;
    var _createTransaccion_decorators;
    var _getResumenFinanciero_decorators;
    var _getHistorialCierres_decorators;
    var _getGastos_decorators;
    var _registrarGasto_decorators;
    var _solicitarBase_decorators;
    var _getSaldoDisponibleRuta_decorators;
    var _exportAccountingReport_decorators;
    var AccountingController = _classThis = /** @class */ (function () {
        function AccountingController_1(accountingService) {
            this.accountingService = (__runInitializers(this, _instanceExtraInitializers), accountingService);
        }
        // =====================
        // CAJAS
        // =====================
        AccountingController_1.prototype.getCajas = function () {
            return this.accountingService.getCajas();
        };
        AccountingController_1.prototype.getCajaById = function (id) {
            return this.accountingService.getCajaById(id);
        };
        AccountingController_1.prototype.createCaja = function (req, body) {
            if (!req.user || !req.user.id) {
                throw new common_1.UnauthorizedException('Usuario no autenticado o token inválido');
            }
            return this.accountingService.createCaja(body, req.user.id);
        };
        AccountingController_1.prototype.updateCaja = function (id, body) {
            return this.accountingService.updateCaja(id, body);
        };
        AccountingController_1.prototype.deleteCaja = function (id) {
            return this.accountingService.deleteCaja(id);
        };
        AccountingController_1.prototype.consolidarCaja = function (id, req, body) {
            return this.accountingService.consolidarCaja(id, req.user.id, body === null || body === void 0 ? void 0 : body.monto);
        };
        AccountingController_1.prototype.registrarArqueo = function (id, req, body) {
            if (!req.user || !req.user.id) {
                throw new common_1.UnauthorizedException('Usuario no autenticado');
            }
            return this.accountingService.registrarArqueo(id, body, req.user.id);
        };
        // =====================
        // TRANSACCIONES / MOVIMIENTOS
        // =====================
        AccountingController_1.prototype.getTransacciones = function (cajaId, tipo, fechaInicio, fechaFin, page, limit) {
            return this.accountingService.getTransacciones({
                cajaId: cajaId,
                tipo: tipo,
                fechaInicio: fechaInicio,
                fechaFin: fechaFin,
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 50,
            });
        };
        AccountingController_1.prototype.createTransaccion = function (req, body) {
            if (!req.user || !req.user.id) {
                throw new common_1.UnauthorizedException('Usuario no autenticado');
            }
            return this.accountingService.createTransaccion(__assign(__assign({}, body), { creadoPorId: req.user.id }));
        };
        // =====================
        // RESUMEN FINANCIERO
        // =====================
        // =====================
        // RESUMEN FINANCIERO
        // =====================
        AccountingController_1.prototype.getResumenFinanciero = function (fechaInicio, fechaFin) {
            return this.accountingService.getResumenFinanciero(fechaInicio, fechaFin);
        };
        // =====================
        // CIERRES (HISTORIAL)
        // =====================
        AccountingController_1.prototype.getHistorialCierres = function (tipo, cajaId, soloRutas, estado, fechaInicio, fechaFin) {
            return this.accountingService.getHistorialCierres({
                tipo: tipo,
                cajaId: cajaId,
                soloRutas: soloRutas === '1',
                estado: estado,
                fechaInicio: fechaInicio,
                fechaFin: fechaFin,
            });
        };
        // =====================
        // GASTOS
        // =====================
        AccountingController_1.prototype.getGastos = function (rutaId, estado, page, limit, fechaInicio, fechaFin) {
            return this.accountingService.getGastos({
                rutaId: rutaId,
                estado: estado,
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 50,
                fechaInicio: fechaInicio,
                fechaFin: fechaFin,
            });
        };
        AccountingController_1.prototype.registrarGasto = function (req, body) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    if (!req.user || !req.user.id) {
                        throw new common_1.UnauthorizedException('Usuario no autenticado');
                    }
                    return [2 /*return*/, this.accountingService.registrarGasto({
                            descripcion: body.descripcion,
                            monto: body.valor,
                            rutaId: body.rutaId,
                            cobradorId: body.cobradorId,
                            solicitadoPorId: req.user.id,
                            tipoAprobacion: client_1.TipoAprobacion.GASTO,
                        })];
                });
            });
        };
        AccountingController_1.prototype.solicitarBase = function (req, body) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    if (!req.user || !req.user.id) {
                        throw new common_1.UnauthorizedException('Usuario no autenticado');
                    }
                    return [2 /*return*/, this.accountingService.solicitarBase({
                            descripcion: body.descripcion,
                            monto: body.monto,
                            rutaId: body.rutaId,
                            cobradorId: body.cobradorId,
                            solicitadoPorId: req.user.id,
                        })];
                });
            });
        };
        AccountingController_1.prototype.getSaldoDisponibleRuta = function (rutaId, fecha, fechaInicio, fechaFin) {
            return this.accountingService.getSaldoDisponibleRuta(rutaId, fecha, fechaInicio, fechaFin);
        };
        AccountingController_1.prototype.exportAccountingReport = function (format, res) {
            return __awaiter(this, void 0, void 0, function () {
                var result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.accountingService.exportAccountingReport(format)];
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
        return AccountingController_1;
    }());
    __setFunctionName(_classThis, "AccountingController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _getCajas_decorators = [(0, common_1.Get)('cajas')];
        _getCajaById_decorators = [(0, common_1.Get)('cajas/:id')];
        _createCaja_decorators = [(0, common_1.Post)('cajas'), (0, roles_decorator_1.Roles)(client_2.RolUsuario.SUPER_ADMINISTRADOR, client_2.RolUsuario.ADMIN, client_2.RolUsuario.CONTADOR, client_2.RolUsuario.COORDINADOR)];
        _updateCaja_decorators = [(0, common_1.Patch)('cajas/:id'), (0, roles_decorator_1.Roles)(client_2.RolUsuario.SUPER_ADMINISTRADOR, client_2.RolUsuario.ADMIN, client_2.RolUsuario.CONTADOR, client_2.RolUsuario.COORDINADOR)];
        _deleteCaja_decorators = [(0, common_1.Delete)('cajas/:id'), (0, roles_decorator_1.Roles)(client_2.RolUsuario.SUPER_ADMINISTRADOR, client_2.RolUsuario.ADMIN)];
        _consolidarCaja_decorators = [(0, common_1.Post)('cajas/:id/consolidar'), (0, roles_decorator_1.Roles)(client_2.RolUsuario.SUPER_ADMINISTRADOR, client_2.RolUsuario.ADMIN, client_2.RolUsuario.CONTADOR, client_2.RolUsuario.COORDINADOR)];
        _registrarArqueo_decorators = [(0, common_1.Post)('cajas/:id/arqueos'), (0, roles_decorator_1.Roles)(client_2.RolUsuario.SUPER_ADMINISTRADOR, client_2.RolUsuario.ADMIN, client_2.RolUsuario.CONTADOR, client_2.RolUsuario.COORDINADOR)];
        _getTransacciones_decorators = [(0, common_1.Get)('transacciones')];
        _createTransaccion_decorators = [(0, common_1.Post)('transacciones')];
        _getResumenFinanciero_decorators = [(0, common_1.Get)('resumen')];
        _getHistorialCierres_decorators = [(0, common_1.Get)('cierres')];
        _getGastos_decorators = [(0, common_1.Get)('gastos')];
        _registrarGasto_decorators = [(0, common_1.Post)('gastos'), (0, roles_decorator_1.Roles)(client_2.RolUsuario.COBRADOR, client_2.RolUsuario.SUPERVISOR, client_2.RolUsuario.COORDINADOR, client_2.RolUsuario.SUPER_ADMINISTRADOR)];
        _solicitarBase_decorators = [(0, common_1.Post)('base-requests'), (0, roles_decorator_1.Roles)(client_2.RolUsuario.COBRADOR, client_2.RolUsuario.SUPERVISOR, client_2.RolUsuario.COORDINADOR, client_2.RolUsuario.SUPER_ADMINISTRADOR)];
        _getSaldoDisponibleRuta_decorators = [(0, common_1.Get)('rutas/:rutaId/saldo-disponible'), (0, roles_decorator_1.Roles)(client_2.RolUsuario.COBRADOR, client_2.RolUsuario.SUPERVISOR, client_2.RolUsuario.COORDINADOR, client_2.RolUsuario.SUPER_ADMINISTRADOR)];
        _exportAccountingReport_decorators = [(0, common_1.Get)('export'), (0, roles_decorator_1.Roles)(client_2.RolUsuario.SUPER_ADMINISTRADOR, client_2.RolUsuario.ADMIN, client_2.RolUsuario.CONTADOR), (0, common_1.HttpCode)(common_1.HttpStatus.OK)];
        __esDecorate(_classThis, null, _getCajas_decorators, { kind: "method", name: "getCajas", static: false, private: false, access: { has: function (obj) { return "getCajas" in obj; }, get: function (obj) { return obj.getCajas; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getCajaById_decorators, { kind: "method", name: "getCajaById", static: false, private: false, access: { has: function (obj) { return "getCajaById" in obj; }, get: function (obj) { return obj.getCajaById; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _createCaja_decorators, { kind: "method", name: "createCaja", static: false, private: false, access: { has: function (obj) { return "createCaja" in obj; }, get: function (obj) { return obj.createCaja; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateCaja_decorators, { kind: "method", name: "updateCaja", static: false, private: false, access: { has: function (obj) { return "updateCaja" in obj; }, get: function (obj) { return obj.updateCaja; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _deleteCaja_decorators, { kind: "method", name: "deleteCaja", static: false, private: false, access: { has: function (obj) { return "deleteCaja" in obj; }, get: function (obj) { return obj.deleteCaja; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _consolidarCaja_decorators, { kind: "method", name: "consolidarCaja", static: false, private: false, access: { has: function (obj) { return "consolidarCaja" in obj; }, get: function (obj) { return obj.consolidarCaja; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _registrarArqueo_decorators, { kind: "method", name: "registrarArqueo", static: false, private: false, access: { has: function (obj) { return "registrarArqueo" in obj; }, get: function (obj) { return obj.registrarArqueo; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getTransacciones_decorators, { kind: "method", name: "getTransacciones", static: false, private: false, access: { has: function (obj) { return "getTransacciones" in obj; }, get: function (obj) { return obj.getTransacciones; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _createTransaccion_decorators, { kind: "method", name: "createTransaccion", static: false, private: false, access: { has: function (obj) { return "createTransaccion" in obj; }, get: function (obj) { return obj.createTransaccion; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getResumenFinanciero_decorators, { kind: "method", name: "getResumenFinanciero", static: false, private: false, access: { has: function (obj) { return "getResumenFinanciero" in obj; }, get: function (obj) { return obj.getResumenFinanciero; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getHistorialCierres_decorators, { kind: "method", name: "getHistorialCierres", static: false, private: false, access: { has: function (obj) { return "getHistorialCierres" in obj; }, get: function (obj) { return obj.getHistorialCierres; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getGastos_decorators, { kind: "method", name: "getGastos", static: false, private: false, access: { has: function (obj) { return "getGastos" in obj; }, get: function (obj) { return obj.getGastos; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _registrarGasto_decorators, { kind: "method", name: "registrarGasto", static: false, private: false, access: { has: function (obj) { return "registrarGasto" in obj; }, get: function (obj) { return obj.registrarGasto; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _solicitarBase_decorators, { kind: "method", name: "solicitarBase", static: false, private: false, access: { has: function (obj) { return "solicitarBase" in obj; }, get: function (obj) { return obj.solicitarBase; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getSaldoDisponibleRuta_decorators, { kind: "method", name: "getSaldoDisponibleRuta", static: false, private: false, access: { has: function (obj) { return "getSaldoDisponibleRuta" in obj; }, get: function (obj) { return obj.getSaldoDisponibleRuta; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _exportAccountingReport_decorators, { kind: "method", name: "exportAccountingReport", static: false, private: false, access: { has: function (obj) { return "exportAccountingReport" in obj; }, get: function (obj) { return obj.exportAccountingReport; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AccountingController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AccountingController = _classThis;
}();
exports.AccountingController = AccountingController;
