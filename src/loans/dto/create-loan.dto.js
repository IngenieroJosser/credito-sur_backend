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
exports.CreateLoanDto = void 0;
var class_validator_1 = require("class-validator");
var client_1 = require("@prisma/client");
var class_transformer_1 = require("class-transformer");
var CreateLoanDto = function () {
    var _a;
    var _clienteId_decorators;
    var _clienteId_initializers = [];
    var _clienteId_extraInitializers = [];
    var _productoId_decorators;
    var _productoId_initializers = [];
    var _productoId_extraInitializers = [];
    var _precioProductoId_decorators;
    var _precioProductoId_initializers = [];
    var _precioProductoId_extraInitializers = [];
    var _tipoPrestamo_decorators;
    var _tipoPrestamo_initializers = [];
    var _tipoPrestamo_extraInitializers = [];
    var _monto_decorators;
    var _monto_initializers = [];
    var _monto_extraInitializers = [];
    var _tasaInteres_decorators;
    var _tasaInteres_initializers = [];
    var _tasaInteres_extraInitializers = [];
    var _tasaInteresMora_decorators;
    var _tasaInteresMora_initializers = [];
    var _tasaInteresMora_extraInitializers = [];
    var _plazoMeses_decorators;
    var _plazoMeses_initializers = [];
    var _plazoMeses_extraInitializers = [];
    var _cantidadCuotas_decorators;
    var _cantidadCuotas_initializers = [];
    var _cantidadCuotas_extraInitializers = [];
    var _cuotas_decorators;
    var _cuotas_initializers = [];
    var _cuotas_extraInitializers = [];
    var _cuotasTotales_decorators;
    var _cuotasTotales_initializers = [];
    var _cuotasTotales_extraInitializers = [];
    var _frecuenciaPago_decorators;
    var _frecuenciaPago_initializers = [];
    var _frecuenciaPago_extraInitializers = [];
    var _fechaInicio_decorators;
    var _fechaInicio_initializers = [];
    var _fechaInicio_extraInitializers = [];
    var _creadoPorId_decorators;
    var _creadoPorId_initializers = [];
    var _creadoPorId_extraInitializers = [];
    var _cuotaInicial_decorators;
    var _cuotaInicial_initializers = [];
    var _cuotaInicial_extraInitializers = [];
    var _notas_decorators;
    var _notas_initializers = [];
    var _notas_extraInitializers = [];
    var _fechaPrimerCobro_decorators;
    var _fechaPrimerCobro_initializers = [];
    var _fechaPrimerCobro_extraInitializers = [];
    var _tipoAmortizacion_decorators;
    var _tipoAmortizacion_initializers = [];
    var _tipoAmortizacion_extraInitializers = [];
    var _garantia_decorators;
    var _garantia_initializers = [];
    var _garantia_extraInitializers = [];
    var _esContado_decorators;
    var _esContado_initializers = [];
    var _esContado_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateLoanDto() {
                this.clienteId = __runInitializers(this, _clienteId_initializers, void 0);
                this.productoId = (__runInitializers(this, _clienteId_extraInitializers), __runInitializers(this, _productoId_initializers, void 0));
                this.precioProductoId = (__runInitializers(this, _productoId_extraInitializers), __runInitializers(this, _precioProductoId_initializers, void 0));
                this.tipoPrestamo = (__runInitializers(this, _precioProductoId_extraInitializers), __runInitializers(this, _tipoPrestamo_initializers, void 0)); // 'prestamo' o 'articulo'
                this.monto = (__runInitializers(this, _tipoPrestamo_extraInitializers), __runInitializers(this, _monto_initializers, void 0));
                this.tasaInteres = (__runInitializers(this, _monto_extraInitializers), __runInitializers(this, _tasaInteres_initializers, void 0));
                this.tasaInteresMora = (__runInitializers(this, _tasaInteres_extraInitializers), __runInitializers(this, _tasaInteresMora_initializers, void 0));
                this.plazoMeses = (__runInitializers(this, _tasaInteresMora_extraInitializers), __runInitializers(this, _plazoMeses_initializers, void 0));
                this.cantidadCuotas = (__runInitializers(this, _plazoMeses_extraInitializers), __runInitializers(this, _cantidadCuotas_initializers, void 0));
                this.cuotas = (__runInitializers(this, _cantidadCuotas_extraInitializers), __runInitializers(this, _cuotas_initializers, void 0));
                this.cuotasTotales = (__runInitializers(this, _cuotas_extraInitializers), __runInitializers(this, _cuotasTotales_initializers, void 0));
                this.frecuenciaPago = (__runInitializers(this, _cuotasTotales_extraInitializers), __runInitializers(this, _frecuenciaPago_initializers, void 0));
                this.fechaInicio = (__runInitializers(this, _frecuenciaPago_extraInitializers), __runInitializers(this, _fechaInicio_initializers, void 0));
                this.creadoPorId = (__runInitializers(this, _fechaInicio_extraInitializers), __runInitializers(this, _creadoPorId_initializers, void 0));
                this.cuotaInicial = (__runInitializers(this, _creadoPorId_extraInitializers), __runInitializers(this, _cuotaInicial_initializers, void 0));
                this.notas = (__runInitializers(this, _cuotaInicial_extraInitializers), __runInitializers(this, _notas_initializers, void 0));
                this.fechaPrimerCobro = (__runInitializers(this, _notas_extraInitializers), __runInitializers(this, _fechaPrimerCobro_initializers, void 0));
                this.tipoAmortizacion = (__runInitializers(this, _fechaPrimerCobro_extraInitializers), __runInitializers(this, _tipoAmortizacion_initializers, void 0));
                this.garantia = (__runInitializers(this, _tipoAmortizacion_extraInitializers), __runInitializers(this, _garantia_initializers, void 0));
                this.esContado = (__runInitializers(this, _garantia_extraInitializers), __runInitializers(this, _esContado_initializers, void 0));
                __runInitializers(this, _esContado_extraInitializers);
            }
            return CreateLoanDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _clienteId_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _productoId_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _precioProductoId_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _tipoPrestamo_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _monto_decorators = [(0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return (value === null || value === undefined || value === '') ? undefined : parseFloat(value);
                }), (0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(0)];
            _tasaInteres_decorators = [(0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return (value === null || value === undefined || value === '') ? undefined : parseFloat(value);
                }), (0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(0), (0, class_validator_1.ValidateIf)(function (o) { return o.tipoPrestamo === 'prestamo'; })];
            _tasaInteresMora_decorators = [(0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return (value === null || value === undefined || value === '') ? undefined : parseFloat(value);
                }), (0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(0)];
            _plazoMeses_decorators = [(0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return (value === null || value === undefined || value === '') ? undefined : parseFloat(value);
                }), (0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(0.01)];
            _cantidadCuotas_decorators = [(0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return (value === null || value === undefined || value === '') ? undefined : parseInt(value);
                }), (0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(1), (0, class_validator_1.IsOptional)()];
            _cuotas_decorators = [(0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return (value === null || value === undefined || value === '') ? undefined : parseInt(value);
                }), (0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(1), (0, class_validator_1.IsOptional)()];
            _cuotasTotales_decorators = [(0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return (value === null || value === undefined || value === '') ? undefined : parseInt(value);
                }), (0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(1), (0, class_validator_1.IsOptional)()];
            _frecuenciaPago_decorators = [(0, class_validator_1.IsEnum)(client_1.FrecuenciaPago)];
            _fechaInicio_decorators = [(0, class_validator_1.IsDateString)()];
            _creadoPorId_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _cuotaInicial_decorators = [(0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return (value === null || value === undefined || value === '') ? undefined : parseFloat(value);
                }), (0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(0), (0, class_validator_1.IsOptional)()];
            _notas_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _fechaPrimerCobro_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _tipoAmortizacion_decorators = [(0, class_validator_1.IsEnum)(client_1.TipoAmortizacion), (0, class_validator_1.IsOptional)()];
            _garantia_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _esContado_decorators = [(0, class_validator_1.IsOptional)()];
            __esDecorate(null, null, _clienteId_decorators, { kind: "field", name: "clienteId", static: false, private: false, access: { has: function (obj) { return "clienteId" in obj; }, get: function (obj) { return obj.clienteId; }, set: function (obj, value) { obj.clienteId = value; } }, metadata: _metadata }, _clienteId_initializers, _clienteId_extraInitializers);
            __esDecorate(null, null, _productoId_decorators, { kind: "field", name: "productoId", static: false, private: false, access: { has: function (obj) { return "productoId" in obj; }, get: function (obj) { return obj.productoId; }, set: function (obj, value) { obj.productoId = value; } }, metadata: _metadata }, _productoId_initializers, _productoId_extraInitializers);
            __esDecorate(null, null, _precioProductoId_decorators, { kind: "field", name: "precioProductoId", static: false, private: false, access: { has: function (obj) { return "precioProductoId" in obj; }, get: function (obj) { return obj.precioProductoId; }, set: function (obj, value) { obj.precioProductoId = value; } }, metadata: _metadata }, _precioProductoId_initializers, _precioProductoId_extraInitializers);
            __esDecorate(null, null, _tipoPrestamo_decorators, { kind: "field", name: "tipoPrestamo", static: false, private: false, access: { has: function (obj) { return "tipoPrestamo" in obj; }, get: function (obj) { return obj.tipoPrestamo; }, set: function (obj, value) { obj.tipoPrestamo = value; } }, metadata: _metadata }, _tipoPrestamo_initializers, _tipoPrestamo_extraInitializers);
            __esDecorate(null, null, _monto_decorators, { kind: "field", name: "monto", static: false, private: false, access: { has: function (obj) { return "monto" in obj; }, get: function (obj) { return obj.monto; }, set: function (obj, value) { obj.monto = value; } }, metadata: _metadata }, _monto_initializers, _monto_extraInitializers);
            __esDecorate(null, null, _tasaInteres_decorators, { kind: "field", name: "tasaInteres", static: false, private: false, access: { has: function (obj) { return "tasaInteres" in obj; }, get: function (obj) { return obj.tasaInteres; }, set: function (obj, value) { obj.tasaInteres = value; } }, metadata: _metadata }, _tasaInteres_initializers, _tasaInteres_extraInitializers);
            __esDecorate(null, null, _tasaInteresMora_decorators, { kind: "field", name: "tasaInteresMora", static: false, private: false, access: { has: function (obj) { return "tasaInteresMora" in obj; }, get: function (obj) { return obj.tasaInteresMora; }, set: function (obj, value) { obj.tasaInteresMora = value; } }, metadata: _metadata }, _tasaInteresMora_initializers, _tasaInteresMora_extraInitializers);
            __esDecorate(null, null, _plazoMeses_decorators, { kind: "field", name: "plazoMeses", static: false, private: false, access: { has: function (obj) { return "plazoMeses" in obj; }, get: function (obj) { return obj.plazoMeses; }, set: function (obj, value) { obj.plazoMeses = value; } }, metadata: _metadata }, _plazoMeses_initializers, _plazoMeses_extraInitializers);
            __esDecorate(null, null, _cantidadCuotas_decorators, { kind: "field", name: "cantidadCuotas", static: false, private: false, access: { has: function (obj) { return "cantidadCuotas" in obj; }, get: function (obj) { return obj.cantidadCuotas; }, set: function (obj, value) { obj.cantidadCuotas = value; } }, metadata: _metadata }, _cantidadCuotas_initializers, _cantidadCuotas_extraInitializers);
            __esDecorate(null, null, _cuotas_decorators, { kind: "field", name: "cuotas", static: false, private: false, access: { has: function (obj) { return "cuotas" in obj; }, get: function (obj) { return obj.cuotas; }, set: function (obj, value) { obj.cuotas = value; } }, metadata: _metadata }, _cuotas_initializers, _cuotas_extraInitializers);
            __esDecorate(null, null, _cuotasTotales_decorators, { kind: "field", name: "cuotasTotales", static: false, private: false, access: { has: function (obj) { return "cuotasTotales" in obj; }, get: function (obj) { return obj.cuotasTotales; }, set: function (obj, value) { obj.cuotasTotales = value; } }, metadata: _metadata }, _cuotasTotales_initializers, _cuotasTotales_extraInitializers);
            __esDecorate(null, null, _frecuenciaPago_decorators, { kind: "field", name: "frecuenciaPago", static: false, private: false, access: { has: function (obj) { return "frecuenciaPago" in obj; }, get: function (obj) { return obj.frecuenciaPago; }, set: function (obj, value) { obj.frecuenciaPago = value; } }, metadata: _metadata }, _frecuenciaPago_initializers, _frecuenciaPago_extraInitializers);
            __esDecorate(null, null, _fechaInicio_decorators, { kind: "field", name: "fechaInicio", static: false, private: false, access: { has: function (obj) { return "fechaInicio" in obj; }, get: function (obj) { return obj.fechaInicio; }, set: function (obj, value) { obj.fechaInicio = value; } }, metadata: _metadata }, _fechaInicio_initializers, _fechaInicio_extraInitializers);
            __esDecorate(null, null, _creadoPorId_decorators, { kind: "field", name: "creadoPorId", static: false, private: false, access: { has: function (obj) { return "creadoPorId" in obj; }, get: function (obj) { return obj.creadoPorId; }, set: function (obj, value) { obj.creadoPorId = value; } }, metadata: _metadata }, _creadoPorId_initializers, _creadoPorId_extraInitializers);
            __esDecorate(null, null, _cuotaInicial_decorators, { kind: "field", name: "cuotaInicial", static: false, private: false, access: { has: function (obj) { return "cuotaInicial" in obj; }, get: function (obj) { return obj.cuotaInicial; }, set: function (obj, value) { obj.cuotaInicial = value; } }, metadata: _metadata }, _cuotaInicial_initializers, _cuotaInicial_extraInitializers);
            __esDecorate(null, null, _notas_decorators, { kind: "field", name: "notas", static: false, private: false, access: { has: function (obj) { return "notas" in obj; }, get: function (obj) { return obj.notas; }, set: function (obj, value) { obj.notas = value; } }, metadata: _metadata }, _notas_initializers, _notas_extraInitializers);
            __esDecorate(null, null, _fechaPrimerCobro_decorators, { kind: "field", name: "fechaPrimerCobro", static: false, private: false, access: { has: function (obj) { return "fechaPrimerCobro" in obj; }, get: function (obj) { return obj.fechaPrimerCobro; }, set: function (obj, value) { obj.fechaPrimerCobro = value; } }, metadata: _metadata }, _fechaPrimerCobro_initializers, _fechaPrimerCobro_extraInitializers);
            __esDecorate(null, null, _tipoAmortizacion_decorators, { kind: "field", name: "tipoAmortizacion", static: false, private: false, access: { has: function (obj) { return "tipoAmortizacion" in obj; }, get: function (obj) { return obj.tipoAmortizacion; }, set: function (obj, value) { obj.tipoAmortizacion = value; } }, metadata: _metadata }, _tipoAmortizacion_initializers, _tipoAmortizacion_extraInitializers);
            __esDecorate(null, null, _garantia_decorators, { kind: "field", name: "garantia", static: false, private: false, access: { has: function (obj) { return "garantia" in obj; }, get: function (obj) { return obj.garantia; }, set: function (obj, value) { obj.garantia = value; } }, metadata: _metadata }, _garantia_initializers, _garantia_extraInitializers);
            __esDecorate(null, null, _esContado_decorators, { kind: "field", name: "esContado", static: false, private: false, access: { has: function (obj) { return "esContado" in obj; }, get: function (obj) { return obj.esContado; }, set: function (obj, value) { obj.esContado = value; } }, metadata: _metadata }, _esContado_initializers, _esContado_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateLoanDto = CreateLoanDto;
