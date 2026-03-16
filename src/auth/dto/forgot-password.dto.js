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
exports.VerifyResetCodeDto = exports.ForgotPasswordDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var class_validator_1 = require("class-validator");
var ForgotPasswordDto = function () {
    var _a;
    var _correo_decorators;
    var _correo_initializers = [];
    var _correo_extraInitializers = [];
    return _a = /** @class */ (function () {
            function ForgotPasswordDto() {
                this.correo = __runInitializers(this, _correo_initializers, void 0);
                __runInitializers(this, _correo_extraInitializers);
            }
            return ForgotPasswordDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _correo_decorators = [(0, swagger_1.ApiProperty)({ example: 'admin@creditsur.com' }), (0, class_validator_1.IsEmail)()];
            __esDecorate(null, null, _correo_decorators, { kind: "field", name: "correo", static: false, private: false, access: { has: function (obj) { return "correo" in obj; }, get: function (obj) { return obj.correo; }, set: function (obj, value) { obj.correo = value; } }, metadata: _metadata }, _correo_initializers, _correo_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.ForgotPasswordDto = ForgotPasswordDto;
var VerifyResetCodeDto = function () {
    var _a;
    var _correo_decorators;
    var _correo_initializers = [];
    var _correo_extraInitializers = [];
    var _codigo_decorators;
    var _codigo_initializers = [];
    var _codigo_extraInitializers = [];
    var _nuevaContrasena_decorators;
    var _nuevaContrasena_initializers = [];
    var _nuevaContrasena_extraInitializers = [];
    return _a = /** @class */ (function () {
            function VerifyResetCodeDto() {
                this.correo = __runInitializers(this, _correo_initializers, void 0);
                this.codigo = (__runInitializers(this, _correo_extraInitializers), __runInitializers(this, _codigo_initializers, void 0));
                this.nuevaContrasena = (__runInitializers(this, _codigo_extraInitializers), __runInitializers(this, _nuevaContrasena_initializers, void 0));
                __runInitializers(this, _nuevaContrasena_extraInitializers);
            }
            return VerifyResetCodeDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _correo_decorators = [(0, swagger_1.ApiProperty)({ example: 'admin@creditsur.com' }), (0, class_validator_1.IsEmail)()];
            _codigo_decorators = [(0, swagger_1.ApiProperty)({ example: '123456', description: 'Codigo de 6 digitos enviado al correo' }), (0, class_validator_1.IsNumberString)(), (0, class_validator_1.Length)(6, 6)];
            _nuevaContrasena_decorators = [(0, swagger_1.ApiProperty)({ example: 'NuevaContrasena123' }), (0, class_validator_1.IsString)(), (0, class_validator_1.MinLength)(6)];
            __esDecorate(null, null, _correo_decorators, { kind: "field", name: "correo", static: false, private: false, access: { has: function (obj) { return "correo" in obj; }, get: function (obj) { return obj.correo; }, set: function (obj, value) { obj.correo = value; } }, metadata: _metadata }, _correo_initializers, _correo_extraInitializers);
            __esDecorate(null, null, _codigo_decorators, { kind: "field", name: "codigo", static: false, private: false, access: { has: function (obj) { return "codigo" in obj; }, get: function (obj) { return obj.codigo; }, set: function (obj, value) { obj.codigo = value; } }, metadata: _metadata }, _codigo_initializers, _codigo_extraInitializers);
            __esDecorate(null, null, _nuevaContrasena_decorators, { kind: "field", name: "nuevaContrasena", static: false, private: false, access: { has: function (obj) { return "nuevaContrasena" in obj; }, get: function (obj) { return obj.nuevaContrasena; }, set: function (obj, value) { obj.nuevaContrasena = value; } }, metadata: _metadata }, _nuevaContrasena_initializers, _nuevaContrasena_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.VerifyResetCodeDto = VerifyResetCodeDto;
