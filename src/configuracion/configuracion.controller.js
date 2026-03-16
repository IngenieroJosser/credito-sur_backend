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
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfiguracionController = void 0;
var common_1 = require("@nestjs/common");
var jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
var roles_guard_1 = require("../auth/guards/roles.guard");
var roles_decorator_1 = require("../auth/decorators/roles.decorator");
var client_1 = require("@prisma/client");
var ConfiguracionController = function () {
    var _classDecorators = [(0, common_1.Controller)('configuracion'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard)];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _getConfiguracion_decorators;
    var _updateConfiguracion_decorators;
    var ConfiguracionController = _classThis = /** @class */ (function () {
        function ConfiguracionController_1(configuracionService) {
            this.configuracionService = (__runInitializers(this, _instanceExtraInitializers), configuracionService);
        }
        ConfiguracionController_1.prototype.getConfiguracion = function () {
            return this.configuracionService.getConfiguracion();
        };
        ConfiguracionController_1.prototype.updateConfiguracion = function (data, req) {
            var _a;
            return this.configuracionService.updateConfiguracion(data, (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId);
        };
        return ConfiguracionController_1;
    }());
    __setFunctionName(_classThis, "ConfiguracionController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _getConfiguracion_decorators = [(0, common_1.Get)(), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN)];
        _updateConfiguracion_decorators = [(0, common_1.Put)(), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN)];
        __esDecorate(_classThis, null, _getConfiguracion_decorators, { kind: "method", name: "getConfiguracion", static: false, private: false, access: { has: function (obj) { return "getConfiguracion" in obj; }, get: function (obj) { return obj.getConfiguracion; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateConfiguracion_decorators, { kind: "method", name: "updateConfiguracion", static: false, private: false, access: { has: function (obj) { return "updateConfiguracion" in obj; }, get: function (obj) { return obj.updateConfiguracion; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ConfiguracionController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ConfiguracionController = _classThis;
}();
exports.ConfiguracionController = ConfiguracionController;
