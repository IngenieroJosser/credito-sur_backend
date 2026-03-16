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
exports.CreatePaymentDto = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var client_1 = require("@prisma/client");
var CreatePaymentDto = function () {
    var _a;
    var _clienteId_decorators;
    var _clienteId_initializers = [];
    var _clienteId_extraInitializers = [];
    var _prestamoId_decorators;
    var _prestamoId_initializers = [];
    var _prestamoId_extraInitializers = [];
    var _cobradorId_decorators;
    var _cobradorId_initializers = [];
    var _cobradorId_extraInitializers = [];
    var _montoTotal_decorators;
    var _montoTotal_initializers = [];
    var _montoTotal_extraInitializers = [];
    var _metodoPago_decorators;
    var _metodoPago_initializers = [];
    var _metodoPago_extraInitializers = [];
    var _fechaPago_decorators;
    var _fechaPago_initializers = [];
    var _fechaPago_extraInitializers = [];
    var _numeroReferencia_decorators;
    var _numeroReferencia_initializers = [];
    var _numeroReferencia_extraInitializers = [];
    var _notas_decorators;
    var _notas_initializers = [];
    var _notas_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreatePaymentDto() {
                this.clienteId = __runInitializers(this, _clienteId_initializers, void 0);
                this.prestamoId = (__runInitializers(this, _clienteId_extraInitializers), __runInitializers(this, _prestamoId_initializers, void 0));
                this.cobradorId = (__runInitializers(this, _prestamoId_extraInitializers), __runInitializers(this, _cobradorId_initializers, void 0));
                this.montoTotal = (__runInitializers(this, _cobradorId_extraInitializers), __runInitializers(this, _montoTotal_initializers, void 0));
                this.metodoPago = (__runInitializers(this, _montoTotal_extraInitializers), __runInitializers(this, _metodoPago_initializers, void 0));
                this.fechaPago = (__runInitializers(this, _metodoPago_extraInitializers), __runInitializers(this, _fechaPago_initializers, void 0));
                this.numeroReferencia = (__runInitializers(this, _fechaPago_extraInitializers), __runInitializers(this, _numeroReferencia_initializers, void 0));
                this.notas = (__runInitializers(this, _numeroReferencia_extraInitializers), __runInitializers(this, _notas_initializers, void 0));
                __runInitializers(this, _notas_extraInitializers);
            }
            return CreatePaymentDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _clienteId_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _prestamoId_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _cobradorId_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return value === null || value === void 0 ? void 0 : value.toString().trim();
                })];
            _montoTotal_decorators = [(0, class_validator_1.IsNumber)({}, { message: 'montoTotal debe ser un número válido' }), (0, class_validator_1.Min)(1, { message: 'montoTotal debe ser mayor a 0' }), (0, class_transformer_1.Type)(function () { return Number; }), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    if (typeof value === 'string')
                        return parseFloat(value);
                    return value;
                })];
            _metodoPago_decorators = [(0, class_validator_1.IsOptional)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return value === null || value === void 0 ? void 0 : value.toString().toUpperCase();
                }), (0, class_validator_1.IsEnum)(client_1.MetodoPago, { message: 'metodoPago debe ser EFECTIVO o TRANSFERENCIA' })];
            _fechaPago_decorators = [(0, class_validator_1.IsDateString)(), (0, class_validator_1.IsOptional)()];
            _numeroReferencia_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _notas_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            __esDecorate(null, null, _clienteId_decorators, { kind: "field", name: "clienteId", static: false, private: false, access: { has: function (obj) { return "clienteId" in obj; }, get: function (obj) { return obj.clienteId; }, set: function (obj, value) { obj.clienteId = value; } }, metadata: _metadata }, _clienteId_initializers, _clienteId_extraInitializers);
            __esDecorate(null, null, _prestamoId_decorators, { kind: "field", name: "prestamoId", static: false, private: false, access: { has: function (obj) { return "prestamoId" in obj; }, get: function (obj) { return obj.prestamoId; }, set: function (obj, value) { obj.prestamoId = value; } }, metadata: _metadata }, _prestamoId_initializers, _prestamoId_extraInitializers);
            __esDecorate(null, null, _cobradorId_decorators, { kind: "field", name: "cobradorId", static: false, private: false, access: { has: function (obj) { return "cobradorId" in obj; }, get: function (obj) { return obj.cobradorId; }, set: function (obj, value) { obj.cobradorId = value; } }, metadata: _metadata }, _cobradorId_initializers, _cobradorId_extraInitializers);
            __esDecorate(null, null, _montoTotal_decorators, { kind: "field", name: "montoTotal", static: false, private: false, access: { has: function (obj) { return "montoTotal" in obj; }, get: function (obj) { return obj.montoTotal; }, set: function (obj, value) { obj.montoTotal = value; } }, metadata: _metadata }, _montoTotal_initializers, _montoTotal_extraInitializers);
            __esDecorate(null, null, _metodoPago_decorators, { kind: "field", name: "metodoPago", static: false, private: false, access: { has: function (obj) { return "metodoPago" in obj; }, get: function (obj) { return obj.metodoPago; }, set: function (obj, value) { obj.metodoPago = value; } }, metadata: _metadata }, _metodoPago_initializers, _metodoPago_extraInitializers);
            __esDecorate(null, null, _fechaPago_decorators, { kind: "field", name: "fechaPago", static: false, private: false, access: { has: function (obj) { return "fechaPago" in obj; }, get: function (obj) { return obj.fechaPago; }, set: function (obj, value) { obj.fechaPago = value; } }, metadata: _metadata }, _fechaPago_initializers, _fechaPago_extraInitializers);
            __esDecorate(null, null, _numeroReferencia_decorators, { kind: "field", name: "numeroReferencia", static: false, private: false, access: { has: function (obj) { return "numeroReferencia" in obj; }, get: function (obj) { return obj.numeroReferencia; }, set: function (obj, value) { obj.numeroReferencia = value; } }, metadata: _metadata }, _numeroReferencia_initializers, _numeroReferencia_extraInitializers);
            __esDecorate(null, null, _notas_decorators, { kind: "field", name: "notas", static: false, private: false, access: { has: function (obj) { return "notas" in obj; }, get: function (obj) { return obj.notas; }, set: function (obj, value) { obj.notas = value; } }, metadata: _metadata }, _notas_initializers, _notas_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreatePaymentDto = CreatePaymentDto;
