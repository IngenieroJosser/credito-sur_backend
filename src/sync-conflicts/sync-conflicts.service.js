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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncConflictsService = void 0;
var common_1 = require("@nestjs/common");
var SyncConflictsService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var SyncConflictsService = _classThis = /** @class */ (function () {
        function SyncConflictsService_1(prisma, configService) {
            this.prisma = prisma;
            this.configService = configService;
        }
        SyncConflictsService_1.prototype.create = function (createSyncConflictDto, userId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.prisma.syncConflict.create({
                            data: __assign(__assign({}, createSyncConflictDto), { creadoPorId: userId }),
                        })];
                });
            });
        };
        SyncConflictsService_1.prototype.findAll = function (user) {
            return __awaiter(this, void 0, void 0, function () {
                var whereClause, rutas, cobradorIds;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            whereClause = {};
                            if (!(user.rol === 'COORDINADOR')) return [3 /*break*/, 2];
                            return [4 /*yield*/, this.prisma.ruta.findMany({
                                    where: { supervisorId: user.id },
                                    select: { cobradorId: true },
                                })];
                        case 1:
                            rutas = _a.sent();
                            cobradorIds = rutas.map(function (r) { return r.cobradorId; });
                            // If no routes assigned, they can't see anything unless they are the creators
                            if (cobradorIds.length === 0) {
                                whereClause = { creadoPorId: user.id };
                            }
                            else {
                                whereClause = {
                                    creadoPorId: { in: __spreadArray(__spreadArray([], cobradorIds, true), [user.id], false) },
                                };
                            }
                            _a.label = 2;
                        case 2: return [2 /*return*/, this.prisma.syncConflict.findMany({
                                where: whereClause,
                                orderBy: { creadoEn: 'desc' },
                                include: {
                                    creadoPor: {
                                        select: { id: true, nombres: true, apellidos: true, correo: true },
                                    },
                                },
                            })];
                    }
                });
            });
        };
        SyncConflictsService_1.prototype.findOne = function (id, user) {
            return __awaiter(this, void 0, void 0, function () {
                var conflict, rutas, cobradorIds;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.syncConflict.findUnique({
                                where: { id: id },
                                include: {
                                    creadoPor: {
                                        select: { id: true, nombres: true, apellidos: true },
                                    },
                                    resueltoPor: {
                                        select: { id: true, nombres: true, apellidos: true },
                                    },
                                },
                            })];
                        case 1:
                            conflict = _a.sent();
                            if (!conflict)
                                throw new common_1.BadRequestException('Conflicto no encontrado');
                            if (!(user.rol === 'COORDINADOR')) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.prisma.ruta.findMany({
                                    where: { supervisorId: user.id },
                                    select: { cobradorId: true },
                                })];
                        case 2:
                            rutas = _a.sent();
                            cobradorIds = rutas.map(function (r) { return r.cobradorId; });
                            if (conflict.creadoPorId !== user.id && (!conflict.creadoPorId || !cobradorIds.includes(conflict.creadoPorId))) {
                                throw new common_1.UnauthorizedException('No tienes permisos para ver este conflicto');
                            }
                            _a.label = 3;
                        case 3: return [2 /*return*/, conflict];
                    }
                });
            });
        };
        SyncConflictsService_1.prototype.resolveConflict = function (id, accion, userId, token) {
            return __awaiter(this, void 0, void 0, function () {
                var conflict, success, extraError, endpoint, baseUrl, fullUrl, res, body, err_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.syncConflict.findUnique({ where: { id: id } })];
                        case 1:
                            conflict = _a.sent();
                            if (!conflict)
                                throw new common_1.BadRequestException('Conflicto no encontrado');
                            if (conflict.estadoResolucion !== 'PENDIENTE')
                                throw new common_1.BadRequestException('El conflicto ya fue resuelto');
                            success = false;
                            extraError = null;
                            if (!(accion === 'RESOLVER')) return [3 /*break*/, 8];
                            _a.label = 2;
                        case 2:
                            _a.trys.push([2, 6, , 7]);
                            endpoint = conflict.endpoint;
                            // Make sure it starts with a slash
                            if (!endpoint.startsWith('/'))
                                endpoint = '/' + endpoint;
                            baseUrl = this.configService.get('API_URL') || 'http://localhost:3000/api/v1';
                            fullUrl = "".concat(baseUrl).concat(endpoint.replace('/api/v1', ''));
                            return [4 /*yield*/, fetch(fullUrl, {
                                    method: conflict.operacion,
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': token, // Reprocesamos en nombre de quien hace click, o forzamos permisos
                                    },
                                    body: JSON.stringify(conflict.datos),
                                })];
                        case 3:
                            res = _a.sent();
                            if (!!res.ok) return [3 /*break*/, 5];
                            return [4 /*yield*/, res.text()];
                        case 4:
                            body = _a.sent();
                            throw new Error("Error ".concat(res.status, ": ").concat(body));
                        case 5:
                            success = true;
                            return [3 /*break*/, 7];
                        case 6:
                            err_1 = _a.sent();
                            extraError = err_1.message || 'Fallo automatizado';
                            return [3 /*break*/, 7];
                        case 7: return [3 /*break*/, 9];
                        case 8:
                            success = true; // Descartado siempre es éxito en la operación lógica
                            _a.label = 9;
                        case 9:
                            if (accion === 'RESOLVER' && !success) {
                                throw new common_1.BadRequestException("No se pudo reprocesar autom\u00E1ticamente: ".concat(extraError));
                            }
                            return [2 /*return*/, this.prisma.syncConflict.update({
                                    where: { id: id },
                                    data: {
                                        estadoResolucion: accion === 'RESOLVER' ? 'RESUELTO' : 'DESCARTADO',
                                        resueltoPorId: userId,
                                    },
                                })];
                    }
                });
            });
        };
        SyncConflictsService_1.prototype.remove = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.prisma.syncConflict.delete({
                            where: { id: id },
                        })];
                });
            });
        };
        return SyncConflictsService_1;
    }());
    __setFunctionName(_classThis, "SyncConflictsService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        SyncConflictsService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return SyncConflictsService = _classThis;
}();
exports.SyncConflictsService = SyncConflictsService;
