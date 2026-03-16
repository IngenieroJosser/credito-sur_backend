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
exports.RolesController = void 0;
var common_1 = require("@nestjs/common");
var swagger_1 = require("@nestjs/swagger");
var RolesController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('Roles'), (0, common_1.Controller)('roles')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _asignarPermisos_decorators;
    var _crear_decorators;
    var _obtenerTodos_decorators;
    var _obtenerPorId_decorators;
    var _actualizar_decorators;
    var _eliminar_decorators;
    var RolesController = _classThis = /** @class */ (function () {
        function RolesController_1(rolesService) {
            this.rolesService = (__runInitializers(this, _instanceExtraInitializers), rolesService);
        }
        RolesController_1.prototype.asignarPermisos = function (id, assignPermissionsDto) {
            return this.rolesService.asignarPermisos(id, assignPermissionsDto.permisosIds);
        };
        RolesController_1.prototype.crear = function (rolDto) {
            return this.rolesService.crear(rolDto);
        };
        RolesController_1.prototype.obtenerTodos = function () {
            return this.rolesService.obtenerTodos();
        };
        RolesController_1.prototype.obtenerPorId = function (id) {
            return this.rolesService.obtenerPorId(id);
        };
        RolesController_1.prototype.actualizar = function (id, rolDto) {
            return this.rolesService.actualizar(id, rolDto);
        };
        RolesController_1.prototype.eliminar = function (id) {
            return this.rolesService.eliminar(id);
        };
        return RolesController_1;
    }());
    __setFunctionName(_classThis, "RolesController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _asignarPermisos_decorators = [(0, common_1.Post)(':id/permisos')];
        _crear_decorators = [(0, common_1.Post)()];
        _obtenerTodos_decorators = [(0, common_1.Get)()];
        _obtenerPorId_decorators = [(0, common_1.Get)(':id')];
        _actualizar_decorators = [(0, common_1.Patch)(':id')];
        _eliminar_decorators = [(0, common_1.Delete)(':id')];
        __esDecorate(_classThis, null, _asignarPermisos_decorators, { kind: "method", name: "asignarPermisos", static: false, private: false, access: { has: function (obj) { return "asignarPermisos" in obj; }, get: function (obj) { return obj.asignarPermisos; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _crear_decorators, { kind: "method", name: "crear", static: false, private: false, access: { has: function (obj) { return "crear" in obj; }, get: function (obj) { return obj.crear; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _obtenerTodos_decorators, { kind: "method", name: "obtenerTodos", static: false, private: false, access: { has: function (obj) { return "obtenerTodos" in obj; }, get: function (obj) { return obj.obtenerTodos; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _obtenerPorId_decorators, { kind: "method", name: "obtenerPorId", static: false, private: false, access: { has: function (obj) { return "obtenerPorId" in obj; }, get: function (obj) { return obj.obtenerPorId; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _actualizar_decorators, { kind: "method", name: "actualizar", static: false, private: false, access: { has: function (obj) { return "actualizar" in obj; }, get: function (obj) { return obj.actualizar; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _eliminar_decorators, { kind: "method", name: "eliminar", static: false, private: false, access: { has: function (obj) { return "eliminar" in obj; }, get: function (obj) { return obj.eliminar; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        RolesController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return RolesController = _classThis;
}();
exports.RolesController = RolesController;
