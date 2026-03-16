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
exports.ApprovalsController = void 0;
var common_1 = require("@nestjs/common");
var jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
var roles_guard_1 = require("../auth/guards/roles.guard");
var roles_decorator_1 = require("../auth/decorators/roles.decorator");
var client_1 = require("@prisma/client");
var ApprovalsController = function () {
    var _classDecorators = [(0, common_1.Controller)('approvals'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard)];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _getPending_decorators;
    var _getSuperadminReview_decorators;
    var _approveItem_decorators;
    var _rejectItem_decorators;
    var _confirmDeletion_decorators;
    var _getHistory_decorators;
    var ApprovalsController = _classThis = /** @class */ (function () {
        function ApprovalsController_1(approvalsService) {
            this.approvalsService = (__runInitializers(this, _instanceExtraInitializers), approvalsService);
        }
        /**
         * Obtener todas las aprobaciones pendientes, agrupadas por tipo.
         * Alimenta el módulo de Revisiones del frontend.
         */
        ApprovalsController_1.prototype.getPending = function (tipo) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.approvalsService.getPendingApprovals(tipo)];
                });
            });
        };
        /**
         * Obtener items escalados para revisión final del SuperAdmin.
         * Incluye rechazos y eliminaciones que requieren confirmación.
         */
        ApprovalsController_1.prototype.getSuperadminReview = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.approvalsService.getSuperadminReviewItems()];
                });
            });
        };
        ApprovalsController_1.prototype.approveItem = function (id, body, req) {
            return __awaiter(this, void 0, void 0, function () {
                var aprobadoPorId;
                var _a, _b;
                return __generator(this, function (_c) {
                    aprobadoPorId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.sub);
                    return [2 /*return*/, this.approvalsService.approveItem(id, body.type, aprobadoPorId, body.notas, body.editedData)];
                });
            });
        };
        ApprovalsController_1.prototype.rejectItem = function (id, body, req) {
            return __awaiter(this, void 0, void 0, function () {
                var rechazadoPorId;
                var _a, _b;
                return __generator(this, function (_c) {
                    rechazadoPorId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.sub);
                    return [2 /*return*/, this.approvalsService.rejectItem(id, body.type, rechazadoPorId, body.motivoRechazo)];
                });
            });
        };
        ApprovalsController_1.prototype.confirmDeletion = function (id, body, req) {
            return __awaiter(this, void 0, void 0, function () {
                var userId;
                var _a, _b;
                return __generator(this, function (_c) {
                    userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.sub);
                    return [2 /*return*/, this.approvalsService.confirmSuperadminAction(id, body.accion, userId, body.notas)];
                });
            });
        };
        ApprovalsController_1.prototype.getHistory = function (body) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.approvalsService.getHistory(body.entidadId, body.tabla)];
                });
            });
        };
        return ApprovalsController_1;
    }());
    __setFunctionName(_classThis, "ApprovalsController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _getPending_decorators = [(0, common_1.Get)('pending'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPERVISOR)];
        _getSuperadminReview_decorators = [(0, common_1.Get)('superadmin-review'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN)];
        _approveItem_decorators = [(0, common_1.Post)(':id/approve'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPERVISOR)];
        _rejectItem_decorators = [(0, common_1.Post)(':id/reject'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPERVISOR)];
        _confirmDeletion_decorators = [(0, common_1.Post)(':id/confirm-deletion'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN)];
        _getHistory_decorators = [(0, common_1.Post)('history'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.CONTADOR)];
        __esDecorate(_classThis, null, _getPending_decorators, { kind: "method", name: "getPending", static: false, private: false, access: { has: function (obj) { return "getPending" in obj; }, get: function (obj) { return obj.getPending; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getSuperadminReview_decorators, { kind: "method", name: "getSuperadminReview", static: false, private: false, access: { has: function (obj) { return "getSuperadminReview" in obj; }, get: function (obj) { return obj.getSuperadminReview; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _approveItem_decorators, { kind: "method", name: "approveItem", static: false, private: false, access: { has: function (obj) { return "approveItem" in obj; }, get: function (obj) { return obj.approveItem; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _rejectItem_decorators, { kind: "method", name: "rejectItem", static: false, private: false, access: { has: function (obj) { return "rejectItem" in obj; }, get: function (obj) { return obj.rejectItem; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _confirmDeletion_decorators, { kind: "method", name: "confirmDeletion", static: false, private: false, access: { has: function (obj) { return "confirmDeletion" in obj; }, get: function (obj) { return obj.confirmDeletion; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getHistory_decorators, { kind: "method", name: "getHistory", static: false, private: false, access: { has: function (obj) { return "getHistory" in obj; }, get: function (obj) { return obj.getHistory; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ApprovalsController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ApprovalsController = _classThis;
}();
exports.ApprovalsController = ApprovalsController;
