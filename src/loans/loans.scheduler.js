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
exports.LoansScheduler = void 0;
var common_1 = require("@nestjs/common");
var schedule_1 = require("@nestjs/schedule");
/**
 * Job nocturno que revisa prórrogas expiradas y vuelve a marcar los préstamos
 * como EN_MORA si el plazo de gracia venció sin pago.
 *
 * Se ejecuta todos los días a las 00:05 AM.
 */
var LoansScheduler = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _revisarProrrogasExpiradas_decorators;
    var _marcarCuotasVencidas_decorators;
    var LoansScheduler = _classThis = /** @class */ (function () {
        function LoansScheduler_1(prisma) {
            this.prisma = (__runInitializers(this, _instanceExtraInitializers), prisma);
            this.logger = new common_1.Logger(LoansScheduler.name);
        }
        LoansScheduler_1.prototype.revisarProrrogasExpiradas = function () {
            return __awaiter(this, void 0, void 0, function () {
                var ahora, prestamosConProrrogaVencida_1, error_1;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.log('Iniciando revision de prorrogas expiradas...');
                            ahora = new Date();
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 4, , 5]);
                            return [4 /*yield*/, this.prisma.prestamo.findMany({
                                    where: {
                                        estado: 'ACTIVO',
                                        cuotas: {
                                            some: {
                                                estado: 'PRORROGADA',
                                                fechaVencimientoProrroga: {
                                                    lt: ahora, // la prórroga ya venció
                                                },
                                            },
                                        },
                                    },
                                    include: {
                                        cuotas: {
                                            where: {
                                                estado: 'PRORROGADA',
                                                fechaVencimientoProrroga: { lt: ahora },
                                            },
                                        },
                                    },
                                })];
                        case 2:
                            prestamosConProrrogaVencida_1 = _a.sent();
                            if (prestamosConProrrogaVencida_1.length === 0) {
                                this.logger.log('No hay prorrogas expiradas. Todo en orden.');
                                return [2 /*return*/];
                            }
                            this.logger.warn("Encontrados ".concat(prestamosConProrrogaVencida_1.length, " prestamo(s) con prorroga expirada. Actualizando..."));
                            // 2. Para cada préstamo, revertir estado a EN_MORA y cuotas a VENCIDA
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    var _i, prestamosConProrrogaVencida_2, prestamo;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                _i = 0, prestamosConProrrogaVencida_2 = prestamosConProrrogaVencida_1;
                                                _a.label = 1;
                                            case 1:
                                                if (!(_i < prestamosConProrrogaVencida_2.length)) return [3 /*break*/, 5];
                                                prestamo = prestamosConProrrogaVencida_2[_i];
                                                // Marcar cuotas PRORROGADA (expiradas) de vuelta a VENCIDA
                                                return [4 /*yield*/, tx.cuota.updateMany({
                                                        where: {
                                                            prestamoId: prestamo.id,
                                                            estado: 'PRORROGADA',
                                                            fechaVencimientoProrroga: { lt: ahora },
                                                        },
                                                        data: {
                                                            estado: 'VENCIDA',
                                                        },
                                                    })];
                                            case 2:
                                                // Marcar cuotas PRORROGADA (expiradas) de vuelta a VENCIDA
                                                _a.sent();
                                                // Devolver el préstamo a EN_MORA
                                                return [4 /*yield*/, tx.prestamo.update({
                                                        where: { id: prestamo.id },
                                                        data: { estado: 'EN_MORA' },
                                                    })];
                                            case 3:
                                                // Devolver el préstamo a EN_MORA
                                                _a.sent();
                                                this.logger.warn("Prestamo ".concat(prestamo.numeroPrestamo, " \u2192 EN_MORA (prorroga expirada)"));
                                                _a.label = 4;
                                            case 4:
                                                _i++;
                                                return [3 /*break*/, 1];
                                            case 5: return [2 /*return*/];
                                        }
                                    });
                                }); })];
                        case 3:
                            // 2. Para cada préstamo, revertir estado a EN_MORA y cuotas a VENCIDA
                            _a.sent();
                            this.logger.log("Revision completada. ".concat(prestamosConProrrogaVencida_1.length, " prestamo(s) devueltos a EN_MORA."));
                            return [3 /*break*/, 5];
                        case 4:
                            error_1 = _a.sent();
                            this.logger.error('Error al revisar prorrogas expiradas:', error_1);
                            return [3 /*break*/, 5];
                        case 5: return [2 /*return*/];
                    }
                });
            });
        };
        /**
         * También revisa cuotas PENDIENTE cuya fecha ya pasó y las marca VENCIDA.
         * Se ejecuta a las 00:10 AM.
         */
        LoansScheduler_1.prototype.marcarCuotasVencidas = function () {
            return __awaiter(this, void 0, void 0, function () {
                var ahora, resultado, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.log('Marcando cuotas vencidas...');
                            ahora = new Date();
                            ahora.setHours(0, 0, 0, 0);
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 6, , 7]);
                            return [4 /*yield*/, this.prisma.cuota.updateMany({
                                    where: {
                                        estado: { in: ['PENDIENTE', 'PARCIAL'] },
                                        fechaVencimiento: { lt: ahora },
                                        prestamo: {
                                            estado: { in: ['ACTIVO', 'EN_MORA'] },
                                        },
                                    },
                                    data: { estado: 'VENCIDA' },
                                })];
                        case 2:
                            resultado = _a.sent();
                            if (!(resultado.count > 0)) return [3 /*break*/, 4];
                            // Marcar en mora los préstamos ACTIVO que ahora tienen cuotas VENCIDA
                            return [4 /*yield*/, this.prisma.prestamo.updateMany({
                                    where: {
                                        estado: 'ACTIVO',
                                        cuotas: {
                                            some: { estado: 'VENCIDA' },
                                        },
                                    },
                                    data: { estado: 'EN_MORA' },
                                })];
                        case 3:
                            // Marcar en mora los préstamos ACTIVO que ahora tienen cuotas VENCIDA
                            _a.sent();
                            this.logger.warn("".concat(resultado.count, " cuota(s) marcadas como VENCIDA."));
                            return [3 /*break*/, 5];
                        case 4:
                            this.logger.log('No hay cuotas vencidas nuevas.');
                            _a.label = 5;
                        case 5: return [3 /*break*/, 7];
                        case 6:
                            error_2 = _a.sent();
                            this.logger.error('Error al marcar cuotas vencidas:', error_2);
                            return [3 /*break*/, 7];
                        case 7: return [2 /*return*/];
                    }
                });
            });
        };
        return LoansScheduler_1;
    }());
    __setFunctionName(_classThis, "LoansScheduler");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _revisarProrrogasExpiradas_decorators = [(0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_1AM)];
        _marcarCuotasVencidas_decorators = [(0, schedule_1.Cron)('10 0 * * *')];
        __esDecorate(_classThis, null, _revisarProrrogasExpiradas_decorators, { kind: "method", name: "revisarProrrogasExpiradas", static: false, private: false, access: { has: function (obj) { return "revisarProrrogasExpiradas" in obj; }, get: function (obj) { return obj.revisarProrrogasExpiradas; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _marcarCuotasVencidas_decorators, { kind: "method", name: "marcarCuotasVencidas", static: false, private: false, access: { has: function (obj) { return "marcarCuotasVencidas" in obj; }, get: function (obj) { return obj.marcarCuotasVencidas; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        LoansScheduler = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return LoansScheduler = _classThis;
}();
exports.LoansScheduler = LoansScheduler;
