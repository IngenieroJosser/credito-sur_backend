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
exports.MirrorSyncController = void 0;
var common_1 = require("@nestjs/common");
var MirrorSyncController = function () {
    var _classDecorators = [(0, common_1.Controller)('mirror-sync')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _receiveSync_decorators;
    var MirrorSyncController = _classThis = /** @class */ (function () {
        function MirrorSyncController_1(configService, prisma) {
            this.configService = (__runInitializers(this, _instanceExtraInitializers), configService);
            this.prisma = prisma;
            this.logger = new common_1.Logger(MirrorSyncController.name);
        }
        MirrorSyncController_1.prototype.receiveSync = function (model, action, authHeader, engineHeader, timestampHeader, body) {
            return __awaiter(this, void 0, void 0, function () {
                var expectedToken, requestTime, currentTime, toleranceWindowMs, prismaModelProp, prismaModel, payload, id, existing, e_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            expectedToken = this.configService.get('MIRROR_SYNC_TOKEN');
                            if (!expectedToken || authHeader !== "Bearer ".concat(expectedToken) || engineHeader !== 'BullMQ-Engine-v1') {
                                this.logger.warn("Intento bloqueado de sincronizaci\u00F3n no autorizada en el Espejo.");
                                throw new common_1.UnauthorizedException('Token de sincronización de espejo inválido o faltante');
                            }
                            // Prevención de Replay Attack (Daño permanente si se roba el Token estático)
                            if (!timestampHeader) {
                                this.logger.warn("Petici\u00F3n rechazada: Falta el Timestamp de seguridad.");
                                throw new common_1.UnauthorizedException('Firma de tiempo requerida para evitar Replay Attacks');
                            }
                            requestTime = parseInt(timestampHeader, 10);
                            currentTime = Date.now();
                            toleranceWindowMs = 5 * 60 * 1000;
                            if (isNaN(requestTime) || Math.abs(currentTime - requestTime) > toleranceWindowMs) {
                                this.logger.error("Ataque de Repetici\u00F3n detectado (Replay Attack) o relojes desincronizados. Petici\u00F3n expirada.");
                                throw new common_1.UnauthorizedException('El token dinámico temporal ha expirado. Sincronía rechazada.');
                            }
                            // 2. Ejecutar la acción cruda en el Prisma del VPS
                            this.logger.log("Recibiendo Mirror Sync: Modelo=".concat(model, ", Accion=").concat(action));
                            prismaModelProp = model.charAt(0).toLowerCase() + model.slice(1);
                            prismaModel = this.prisma[prismaModelProp];
                            if (!prismaModel) {
                                this.logger.warn("Modelo desconocido ignorado en el servidor espejo: ".concat(model));
                                return [2 /*return*/, { status: 'ignored', reason: 'unknown model' }];
                            }
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 15, , 16]);
                            payload = body.payload;
                            if (!(action === 'create' || action === 'update' || action === 'upsert')) return [3 /*break*/, 10];
                            id = payload.id;
                            if (!id) return [3 /*break*/, 7];
                            return [4 /*yield*/, prismaModel.findUnique({ where: { id: id } })];
                        case 2:
                            existing = _a.sent();
                            if (!existing) return [3 /*break*/, 4];
                            return [4 /*yield*/, prismaModel.update({
                                    where: { id: id },
                                    data: payload,
                                })];
                        case 3:
                            _a.sent();
                            this.logger.debug("[Mirror VPS] Row actualizado exitosamente: ".concat(model, " - ").concat(id));
                            return [3 /*break*/, 6];
                        case 4: 
                        // No existe localmente en el Espejo, lo creamos
                        return [4 /*yield*/, prismaModel.create({
                                data: payload,
                            })];
                        case 5:
                            // No existe localmente en el Espejo, lo creamos
                            _a.sent();
                            this.logger.debug("[Mirror VPS] Row replicado exitosamente: ".concat(model, " - ").concat(id));
                            _a.label = 6;
                        case 6: return [3 /*break*/, 9];
                        case 7: 
                        // Si no vino un ID en el payload (raro en modelos Prisma UUID, pero posible)
                        return [4 /*yield*/, prismaModel.create({ data: payload })];
                        case 8:
                            // Si no vino un ID en el payload (raro en modelos Prisma UUID, pero posible)
                            _a.sent();
                            this.logger.debug("[Mirror VPS] Row an\u00F3nimo replicado en: ".concat(model));
                            _a.label = 9;
                        case 9: return [3 /*break*/, 14];
                        case 10:
                            if (!(action === 'delete')) return [3 /*break*/, 13];
                            if (!payload.id) return [3 /*break*/, 12];
                            return [4 /*yield*/, prismaModel.delete({ where: { id: payload.id } }).catch(function () { return null; })];
                        case 11:
                            _a.sent(); // Silencioso si ya no existía
                            this.logger.debug("[Mirror VPS] Row eliminado de la r\u00E9plica: ".concat(model, " - ").concat(payload.id));
                            _a.label = 12;
                        case 12: return [3 /*break*/, 14];
                        case 13:
                            if (action === 'deleteMany' || action === 'updateMany') {
                                // En réplicas espejo complejas o puras, podríamos omitir bulk si manejamos cada tupla por separado o procesarlo en crudo.
                                this.logger.warn("Instrucci\u00F3n de Bulk [".concat(action, "] recibida y auditada en el espejo para modelo: ").concat(model));
                            }
                            _a.label = 14;
                        case 14: return [2 /*return*/, { status: 'success', synced: true }];
                        case 15:
                            e_1 = _a.sent();
                            this.logger.error("Error cr\u00EDtico procesando r\u00E9plica en VPS Espejo -> ".concat(e_1.message), e_1.stack);
                            throw new common_1.InternalServerErrorException("Fallo de persistencia en el VPS: ".concat(e_1.message));
                        case 16: return [2 /*return*/];
                    }
                });
            });
        };
        return MirrorSyncController_1;
    }());
    __setFunctionName(_classThis, "MirrorSyncController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _receiveSync_decorators = [(0, common_1.Post)('receiver/:model/:action')];
        __esDecorate(_classThis, null, _receiveSync_decorators, { kind: "method", name: "receiveSync", static: false, private: false, access: { has: function (obj) { return "receiveSync" in obj; }, get: function (obj) { return obj.receiveSync; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        MirrorSyncController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return MirrorSyncController = _classThis;
}();
exports.MirrorSyncController = MirrorSyncController;
