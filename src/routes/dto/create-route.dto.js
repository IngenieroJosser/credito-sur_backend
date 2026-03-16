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
exports.CreateRouteDto = void 0;
var class_validator_1 = require("class-validator");
var swagger_1 = require("@nestjs/swagger");
var CreateRouteDto = function () {
    var _a;
    var _codigo_decorators;
    var _codigo_initializers = [];
    var _codigo_extraInitializers = [];
    var _nombre_decorators;
    var _nombre_initializers = [];
    var _nombre_extraInitializers = [];
    var _descripcion_decorators;
    var _descripcion_initializers = [];
    var _descripcion_extraInitializers = [];
    var _zona_decorators;
    var _zona_initializers = [];
    var _zona_extraInitializers = [];
    var _cobradorId_decorators;
    var _cobradorId_initializers = [];
    var _cobradorId_extraInitializers = [];
    var _supervisorId_decorators;
    var _supervisorId_initializers = [];
    var _supervisorId_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateRouteDto() {
                this.codigo = __runInitializers(this, _codigo_initializers, void 0);
                this.nombre = (__runInitializers(this, _codigo_extraInitializers), __runInitializers(this, _nombre_initializers, void 0));
                this.descripcion = (__runInitializers(this, _nombre_extraInitializers), __runInitializers(this, _descripcion_initializers, void 0));
                this.zona = (__runInitializers(this, _descripcion_extraInitializers), __runInitializers(this, _zona_initializers, void 0));
                this.cobradorId = (__runInitializers(this, _zona_extraInitializers), __runInitializers(this, _cobradorId_initializers, void 0));
                this.supervisorId = (__runInitializers(this, _cobradorId_extraInitializers), __runInitializers(this, _supervisorId_initializers, void 0));
                __runInitializers(this, _supervisorId_extraInitializers);
            }
            return CreateRouteDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _codigo_decorators = [(0, swagger_1.ApiProperty)({ description: 'Código único de la ruta', example: 'RT-CEN-01' }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _nombre_decorators = [(0, swagger_1.ApiProperty)({
                    description: 'Nombre de la ruta',
                    example: 'Ruta Centro - Comercial',
                }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _descripcion_decorators = [(0, swagger_1.ApiProperty)({
                    description: 'Descripción de la ruta',
                    example: 'Zona comercial del centro',
                    required: false,
                }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _zona_decorators = [(0, swagger_1.ApiProperty)({ description: 'Zona geográfica', example: 'Centro' }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _cobradorId_decorators = [(0, swagger_1.ApiProperty)({
                    description: 'ID del cobrador asignado',
                    example: '550e8400-e29b-41d4-a716-446655440000',
                }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _supervisorId_decorators = [(0, swagger_1.ApiProperty)({
                    description: 'ID del supervisor',
                    example: '550e8400-e29b-41d4-a716-446655440001',
                    required: false,
                }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            __esDecorate(null, null, _codigo_decorators, { kind: "field", name: "codigo", static: false, private: false, access: { has: function (obj) { return "codigo" in obj; }, get: function (obj) { return obj.codigo; }, set: function (obj, value) { obj.codigo = value; } }, metadata: _metadata }, _codigo_initializers, _codigo_extraInitializers);
            __esDecorate(null, null, _nombre_decorators, { kind: "field", name: "nombre", static: false, private: false, access: { has: function (obj) { return "nombre" in obj; }, get: function (obj) { return obj.nombre; }, set: function (obj, value) { obj.nombre = value; } }, metadata: _metadata }, _nombre_initializers, _nombre_extraInitializers);
            __esDecorate(null, null, _descripcion_decorators, { kind: "field", name: "descripcion", static: false, private: false, access: { has: function (obj) { return "descripcion" in obj; }, get: function (obj) { return obj.descripcion; }, set: function (obj, value) { obj.descripcion = value; } }, metadata: _metadata }, _descripcion_initializers, _descripcion_extraInitializers);
            __esDecorate(null, null, _zona_decorators, { kind: "field", name: "zona", static: false, private: false, access: { has: function (obj) { return "zona" in obj; }, get: function (obj) { return obj.zona; }, set: function (obj, value) { obj.zona = value; } }, metadata: _metadata }, _zona_initializers, _zona_extraInitializers);
            __esDecorate(null, null, _cobradorId_decorators, { kind: "field", name: "cobradorId", static: false, private: false, access: { has: function (obj) { return "cobradorId" in obj; }, get: function (obj) { return obj.cobradorId; }, set: function (obj, value) { obj.cobradorId = value; } }, metadata: _metadata }, _cobradorId_initializers, _cobradorId_extraInitializers);
            __esDecorate(null, null, _supervisorId_decorators, { kind: "field", name: "supervisorId", static: false, private: false, access: { has: function (obj) { return "supervisorId" in obj; }, get: function (obj) { return obj.supervisorId; }, set: function (obj, value) { obj.supervisorId = value; } }, metadata: _metadata }, _supervisorId_initializers, _supervisorId_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateRouteDto = CreateRouteDto;
