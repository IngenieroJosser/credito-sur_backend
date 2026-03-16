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
exports.AuditController = void 0;
var common_1 = require("@nestjs/common");
var jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
var roles_guard_1 = require("../auth/guards/roles.guard");
var roles_decorator_1 = require("../auth/decorators/roles.decorator");
var client_1 = require("@prisma/client");
/**
 * Controlador de Auditoría
 * Los registros de auditoría NO deben ser editables ni eliminables por diseño
 * Solo se pueden crear y consultar
 */
var AuditController = function () {
    var _classDecorators = [(0, common_1.Controller)('audit'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard)];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _create_decorators;
    var _findAll_decorators;
    var _findByUser_decorators;
    var _exportAuditLog_decorators;
    var _listHiddenArchived_decorators;
    var _hideArchived_decorators;
    var _findOne_decorators;
    var AuditController = _classThis = /** @class */ (function () {
        function AuditController_1(auditService) {
            this.auditService = (__runInitializers(this, _instanceExtraInitializers), auditService);
        }
        /**
         * Crear un registro de auditoría manualmente (poco común)
         * Normalmente se crean automáticamente desde otros servicios
         */
        AuditController_1.prototype.create = function (data) {
            return this.auditService.create(data);
        };
        /**
         * Listar todos los registros de auditoría (con paginación opcional)
         */
        AuditController_1.prototype.findAll = function (pagina, limite) {
            if (pagina || limite) {
                var p = pagina ? parseInt(pagina) : 1;
                var l = limite ? parseInt(limite) : 50;
                return this.auditService.findAllPaginated(p, l);
            }
            return this.auditService.findAll();
        };
        /**
         * Obtener historial de auditoría por usuario
         */
        AuditController_1.prototype.findByUser = function (id, page, limit, startDate, endDate) {
            var p = page ? parseInt(page) : 1;
            var l = limit ? parseInt(limit) : 20;
            var start = startDate ? new Date(startDate) : undefined;
            var end = endDate ? new Date(endDate) : undefined;
            return this.auditService.findByUserId(id, l, p, start, end);
        };
        /**
         * Obtener un registro de auditoría por ID
         */
        AuditController_1.prototype.exportAuditLog = function (format, startDate, endDate, res) {
            return __awaiter(this, void 0, void 0, function () {
                var result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.auditService.exportAuditLog(format, {
                                startDate: startDate || undefined,
                                endDate: endDate || undefined,
                            })];
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
        AuditController_1.prototype.listHiddenArchived = function () {
            return this.auditService.listHiddenArchivedItems();
        };
        AuditController_1.prototype.hideArchived = function (body) {
            return this.auditService.hideArchivedItem(body);
        };
        AuditController_1.prototype.findOne = function (id) {
            return this.auditService.findOne(id);
        };
        return AuditController_1;
    }());
    __setFunctionName(_classThis, "AuditController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _create_decorators = [(0, common_1.Post)()];
        _findAll_decorators = [(0, common_1.Get)()];
        _findByUser_decorators = [(0, common_1.Get)('user/:id')];
        _exportAuditLog_decorators = [(0, common_1.Get)('export'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPERVISOR), (0, common_1.HttpCode)(common_1.HttpStatus.OK)];
        _listHiddenArchived_decorators = [(0, common_1.Get)('hidden-archived'), (0, common_1.HttpCode)(common_1.HttpStatus.OK)];
        _hideArchived_decorators = [(0, common_1.Post)('hide-archived'), (0, common_1.HttpCode)(common_1.HttpStatus.OK)];
        _findOne_decorators = [(0, common_1.Get)(':id')];
        __esDecorate(_classThis, null, _create_decorators, { kind: "method", name: "create", static: false, private: false, access: { has: function (obj) { return "create" in obj; }, get: function (obj) { return obj.create; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findAll_decorators, { kind: "method", name: "findAll", static: false, private: false, access: { has: function (obj) { return "findAll" in obj; }, get: function (obj) { return obj.findAll; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findByUser_decorators, { kind: "method", name: "findByUser", static: false, private: false, access: { has: function (obj) { return "findByUser" in obj; }, get: function (obj) { return obj.findByUser; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _exportAuditLog_decorators, { kind: "method", name: "exportAuditLog", static: false, private: false, access: { has: function (obj) { return "exportAuditLog" in obj; }, get: function (obj) { return obj.exportAuditLog; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _listHiddenArchived_decorators, { kind: "method", name: "listHiddenArchived", static: false, private: false, access: { has: function (obj) { return "listHiddenArchived" in obj; }, get: function (obj) { return obj.listHiddenArchived; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _hideArchived_decorators, { kind: "method", name: "hideArchived", static: false, private: false, access: { has: function (obj) { return "hideArchived" in obj; }, get: function (obj) { return obj.hideArchived; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findOne_decorators, { kind: "method", name: "findOne", static: false, private: false, access: { has: function (obj) { return "findOne" in obj; }, get: function (obj) { return obj.findOne; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AuditController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AuditController = _classThis;
}();
exports.AuditController = AuditController;
