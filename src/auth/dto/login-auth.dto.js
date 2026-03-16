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
exports.LoginAuthDto = void 0;
var class_validator_1 = require("class-validator");
var swagger_1 = require("@nestjs/swagger");
var LoginAuthDto = function () {
    var _a;
    var _nombres_decorators;
    var _nombres_initializers = [];
    var _nombres_extraInitializers = [];
    var _contrasena_decorators;
    var _contrasena_initializers = [];
    var _contrasena_extraInitializers = [];
    return _a = /** @class */ (function () {
            function LoginAuthDto() {
                this.nombres = __runInitializers(this, _nombres_initializers, void 0);
                this.contrasena = (__runInitializers(this, _nombres_extraInitializers), __runInitializers(this, _contrasena_initializers, void 0));
                __runInitializers(this, _contrasena_extraInitializers);
            }
            return LoginAuthDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _nombres_decorators = [(0, swagger_1.ApiProperty)({
                    example: 'Erick Manuel',
                    description: 'Nombres del usuario (campo "nombres" del registro)',
                }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _contrasena_decorators = [(0, swagger_1.ApiProperty)({
                    example: 'miContrasena123',
                    description: 'Contraseña del usuario',
                }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            __esDecorate(null, null, _nombres_decorators, { kind: "field", name: "nombres", static: false, private: false, access: { has: function (obj) { return "nombres" in obj; }, get: function (obj) { return obj.nombres; }, set: function (obj, value) { obj.nombres = value; } }, metadata: _metadata }, _nombres_initializers, _nombres_extraInitializers);
            __esDecorate(null, null, _contrasena_decorators, { kind: "field", name: "contrasena", static: false, private: false, access: { has: function (obj) { return "contrasena" in obj; }, get: function (obj) { return obj.contrasena; }, set: function (obj, value) { obj.contrasena = value; } }, metadata: _metadata }, _contrasena_initializers, _contrasena_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.LoginAuthDto = LoginAuthDto;
