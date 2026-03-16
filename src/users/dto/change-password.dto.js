"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangePasswordDto = void 0;
var class_validator_1 = require("class-validator");
var ChangePasswordDto = function () {
    var _a;
    var _contrasenaActual_decorators;
    var _contrasenaActual_initializers = [];
    var _contrasenaActual_extraInitializers = [];
    var _contrasenaNueva_decorators;
    var _contrasenaNueva_initializers = [];
    var _contrasenaNueva_extraInitializers = [];
    return _a = /** @class */ (function () {
            function ChangePasswordDto() {
                this.contrasenaActual = __runInitializers(this, _contrasenaActual_initializers, void 0);
                this.contrasenaNueva = (__runInitializers(this, _contrasenaActual_extraInitializers), __runInitializers(this, _contrasenaNueva_initializers, void 0));
                __runInitializers(this, _contrasenaNueva_extraInitializers);
            }
            return ChangePasswordDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _contrasenaActual_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNotEmpty)({ message: 'La contraseña actual no puede estar vacía si se proporciona' })];
            _contrasenaNueva_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.MinLength)(6, { message: 'La nueva contraseña debe tener al menos 6 caracteres' }), (0, class_validator_1.IsNotEmpty)({ message: 'La nueva contraseña es requerida' })];
            __esDecorate(null, null, _contrasenaActual_decorators, { kind: "field", name: "contrasenaActual", static: false, private: false, access: { has: function (obj) { return "contrasenaActual" in obj; }, get: function (obj) { return obj.contrasenaActual; }, set: function (obj, value) { obj.contrasenaActual = value; } }, metadata: _metadata }, _contrasenaActual_initializers, _contrasenaActual_extraInitializers);
            __esDecorate(null, null, _contrasenaNueva_decorators, { kind: "field", name: "contrasenaNueva", static: false, private: false, access: { has: function (obj) { return "contrasenaNueva" in obj; }, get: function (obj) { return obj.contrasenaNueva; }, set: function (obj, value) { obj.contrasenaNueva = value; } }, metadata: _metadata }, _contrasenaNueva_initializers, _contrasenaNueva_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.ChangePasswordDto = ChangePasswordDto;
