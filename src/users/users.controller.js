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
exports.UsersController = void 0;
var common_1 = require("@nestjs/common");
var swagger_1 = require("@nestjs/swagger");
var jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
var roles_guard_1 = require("../auth/guards/roles.guard");
var roles_decorator_1 = require("../auth/decorators/roles.decorator");
var client_1 = require("@prisma/client");
var UsersController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('Usuarios'), (0, swagger_1.ApiBearerAuth)(), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard), (0, common_1.Controller)('usuarios')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _crear_decorators;
    var _obtenerTodos_decorators;
    var _obtenerPorId_decorators;
    var _actualizar_decorators;
    var _eliminar_decorators;
    var _restaurar_decorators;
    var _cambiarContrasena_decorators;
    var _resetearContrasena_decorators;
    var _asignarPermisos_decorators;
    var UsersController = _classThis = /** @class */ (function () {
        function UsersController_1(usersService) {
            this.usersService = (__runInitializers(this, _instanceExtraInitializers), usersService);
        }
        UsersController_1.prototype.crear = function (usuarioDto, req) {
            var _a;
            return this.usersService.crear(usuarioDto, (_a = req.user) === null || _a === void 0 ? void 0 : _a.id);
        };
        UsersController_1.prototype.obtenerTodos = function () {
            return this.usersService.obtenerTodos();
        };
        UsersController_1.prototype.obtenerPorId = function (id) {
            return this.usersService.obtenerPorId(id);
        };
        UsersController_1.prototype.actualizar = function (id, usuarioDto, req) {
            var _a;
            return this.usersService.actualizar(id, usuarioDto, (_a = req.user) === null || _a === void 0 ? void 0 : _a.id);
        };
        UsersController_1.prototype.eliminar = function (id, req) {
            var _a;
            return this.usersService.eliminar(id, (_a = req.user) === null || _a === void 0 ? void 0 : _a.id);
        };
        UsersController_1.prototype.restaurar = function (id, req) {
            var _a;
            return this.usersService.restaurar(id, (_a = req.user) === null || _a === void 0 ? void 0 : _a.id);
        };
        UsersController_1.prototype.cambiarContrasena = function (id, dto, req) {
            var _a, _b;
            console.log("[CONTROLLER] cambiarContrasena llamado para usuario ".concat(id));
            console.log("[CONTROLLER] DTO recibido:", JSON.stringify(dto));
            console.log("[CONTROLLER] Usuario solicitante:", (_a = req.user) === null || _a === void 0 ? void 0 : _a.id, (_b = req.user) === null || _b === void 0 ? void 0 : _b.rol);
            return this.usersService.changePassword(id, dto);
        };
        UsersController_1.prototype.resetearContrasena = function (id, req) {
            var _a, _b;
            return this.usersService.resetearContrasena(id, (_a = req.user) === null || _a === void 0 ? void 0 : _a.rol, (_b = req.user) === null || _b === void 0 ? void 0 : _b.id);
        };
        UsersController_1.prototype.asignarPermisos = function (id, permisos) {
            return this.usersService.asignarPermisos(id, permisos);
        };
        return UsersController_1;
    }());
    __setFunctionName(_classThis, "UsersController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _crear_decorators = [(0, common_1.Post)(), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR)];
        _obtenerTodos_decorators = [(0, common_1.Get)(), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR)];
        _obtenerPorId_decorators = [(0, common_1.Get)(':id'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN)];
        _actualizar_decorators = [(0, common_1.Patch)(':id'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN)];
        _eliminar_decorators = [(0, common_1.Delete)(':id'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR)];
        _restaurar_decorators = [(0, common_1.Patch)(':id/restore'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR)];
        _cambiarContrasena_decorators = [(0, common_1.Patch)(':id/password'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN)];
        _resetearContrasena_decorators = [(0, common_1.Post)(':id/reset-password'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN)];
        _asignarPermisos_decorators = [(0, common_1.Post)(':id/permisos'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR)];
        __esDecorate(_classThis, null, _crear_decorators, { kind: "method", name: "crear", static: false, private: false, access: { has: function (obj) { return "crear" in obj; }, get: function (obj) { return obj.crear; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _obtenerTodos_decorators, { kind: "method", name: "obtenerTodos", static: false, private: false, access: { has: function (obj) { return "obtenerTodos" in obj; }, get: function (obj) { return obj.obtenerTodos; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _obtenerPorId_decorators, { kind: "method", name: "obtenerPorId", static: false, private: false, access: { has: function (obj) { return "obtenerPorId" in obj; }, get: function (obj) { return obj.obtenerPorId; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _actualizar_decorators, { kind: "method", name: "actualizar", static: false, private: false, access: { has: function (obj) { return "actualizar" in obj; }, get: function (obj) { return obj.actualizar; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _eliminar_decorators, { kind: "method", name: "eliminar", static: false, private: false, access: { has: function (obj) { return "eliminar" in obj; }, get: function (obj) { return obj.eliminar; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _restaurar_decorators, { kind: "method", name: "restaurar", static: false, private: false, access: { has: function (obj) { return "restaurar" in obj; }, get: function (obj) { return obj.restaurar; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _cambiarContrasena_decorators, { kind: "method", name: "cambiarContrasena", static: false, private: false, access: { has: function (obj) { return "cambiarContrasena" in obj; }, get: function (obj) { return obj.cambiarContrasena; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _resetearContrasena_decorators, { kind: "method", name: "resetearContrasena", static: false, private: false, access: { has: function (obj) { return "resetearContrasena" in obj; }, get: function (obj) { return obj.resetearContrasena; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _asignarPermisos_decorators, { kind: "method", name: "asignarPermisos", static: false, private: false, access: { has: function (obj) { return "asignarPermisos" in obj; }, get: function (obj) { return obj.asignarPermisos; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        UsersController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return UsersController = _classThis;
}();
exports.UsersController = UsersController;
