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
exports.TotalesMoraDto = exports.PrestamosMoraFiltrosDto = exports.PrestamoMoraDto = exports.ClienteInfoDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var client_1 = require("@prisma/client");
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var ClienteInfoDto = function () {
    var _a;
    var _id_decorators;
    var _id_initializers = [];
    var _id_extraInitializers = [];
    var _nombre_decorators;
    var _nombre_initializers = [];
    var _nombre_extraInitializers = [];
    var _documento_decorators;
    var _documento_initializers = [];
    var _documento_extraInitializers = [];
    var _telefono_decorators;
    var _telefono_initializers = [];
    var _telefono_extraInitializers = [];
    var _direccion_decorators;
    var _direccion_initializers = [];
    var _direccion_extraInitializers = [];
    return _a = /** @class */ (function () {
            function ClienteInfoDto() {
                this.id = __runInitializers(this, _id_initializers, void 0);
                this.nombre = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _nombre_initializers, void 0));
                this.documento = (__runInitializers(this, _nombre_extraInitializers), __runInitializers(this, _documento_initializers, void 0));
                this.telefono = (__runInitializers(this, _documento_extraInitializers), __runInitializers(this, _telefono_initializers, void 0));
                this.direccion = (__runInitializers(this, _telefono_extraInitializers), __runInitializers(this, _direccion_initializers, void 0));
                __runInitializers(this, _direccion_extraInitializers);
            }
            return ClienteInfoDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _id_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _nombre_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _documento_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _telefono_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _direccion_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: function (obj) { return "id" in obj; }, get: function (obj) { return obj.id; }, set: function (obj, value) { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
            __esDecorate(null, null, _nombre_decorators, { kind: "field", name: "nombre", static: false, private: false, access: { has: function (obj) { return "nombre" in obj; }, get: function (obj) { return obj.nombre; }, set: function (obj, value) { obj.nombre = value; } }, metadata: _metadata }, _nombre_initializers, _nombre_extraInitializers);
            __esDecorate(null, null, _documento_decorators, { kind: "field", name: "documento", static: false, private: false, access: { has: function (obj) { return "documento" in obj; }, get: function (obj) { return obj.documento; }, set: function (obj, value) { obj.documento = value; } }, metadata: _metadata }, _documento_initializers, _documento_extraInitializers);
            __esDecorate(null, null, _telefono_decorators, { kind: "field", name: "telefono", static: false, private: false, access: { has: function (obj) { return "telefono" in obj; }, get: function (obj) { return obj.telefono; }, set: function (obj, value) { obj.telefono = value; } }, metadata: _metadata }, _telefono_initializers, _telefono_extraInitializers);
            __esDecorate(null, null, _direccion_decorators, { kind: "field", name: "direccion", static: false, private: false, access: { has: function (obj) { return "direccion" in obj; }, get: function (obj) { return obj.direccion; }, set: function (obj, value) { obj.direccion = value; } }, metadata: _metadata }, _direccion_initializers, _direccion_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.ClienteInfoDto = ClienteInfoDto;
var PrestamoMoraDto = function () {
    var _a;
    var _id_decorators;
    var _id_initializers = [];
    var _id_extraInitializers = [];
    var _numeroPrestamo_decorators;
    var _numeroPrestamo_initializers = [];
    var _numeroPrestamo_extraInitializers = [];
    var _clienteId_decorators;
    var _clienteId_initializers = [];
    var _clienteId_extraInitializers = [];
    var _cliente_decorators;
    var _cliente_initializers = [];
    var _cliente_extraInitializers = [];
    var _diasMora_decorators;
    var _diasMora_initializers = [];
    var _diasMora_extraInitializers = [];
    var _montoMora_decorators;
    var _montoMora_initializers = [];
    var _montoMora_extraInitializers = [];
    var _montoTotalDeuda_decorators;
    var _montoTotalDeuda_initializers = [];
    var _montoTotalDeuda_extraInitializers = [];
    var _cuotasVencidas_decorators;
    var _cuotasVencidas_initializers = [];
    var _cuotasVencidas_extraInitializers = [];
    var _montoOriginal_decorators;
    var _montoOriginal_initializers = [];
    var _montoOriginal_extraInitializers = [];
    var _ruta_decorators;
    var _ruta_initializers = [];
    var _ruta_extraInitializers = [];
    var _cobrador_decorators;
    var _cobrador_initializers = [];
    var _cobrador_extraInitializers = [];
    var _nivelRiesgo_decorators;
    var _nivelRiesgo_initializers = [];
    var _nivelRiesgo_extraInitializers = [];
    var _estado_decorators;
    var _estado_initializers = [];
    var _estado_extraInitializers = [];
    var _ultimoPago_decorators;
    var _ultimoPago_initializers = [];
    var _ultimoPago_extraInitializers = [];
    var _fechaVencimiento_decorators;
    var _fechaVencimiento_initializers = [];
    var _fechaVencimiento_extraInitializers = [];
    return _a = /** @class */ (function () {
            function PrestamoMoraDto() {
                this.id = __runInitializers(this, _id_initializers, void 0);
                this.numeroPrestamo = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _numeroPrestamo_initializers, void 0));
                this.clienteId = (__runInitializers(this, _numeroPrestamo_extraInitializers), __runInitializers(this, _clienteId_initializers, void 0));
                this.cliente = (__runInitializers(this, _clienteId_extraInitializers), __runInitializers(this, _cliente_initializers, void 0));
                this.diasMora = (__runInitializers(this, _cliente_extraInitializers), __runInitializers(this, _diasMora_initializers, void 0));
                this.montoMora = (__runInitializers(this, _diasMora_extraInitializers), __runInitializers(this, _montoMora_initializers, void 0));
                this.montoTotalDeuda = (__runInitializers(this, _montoMora_extraInitializers), __runInitializers(this, _montoTotalDeuda_initializers, void 0));
                this.cuotasVencidas = (__runInitializers(this, _montoTotalDeuda_extraInitializers), __runInitializers(this, _cuotasVencidas_initializers, void 0));
                this.montoOriginal = (__runInitializers(this, _cuotasVencidas_extraInitializers), __runInitializers(this, _montoOriginal_initializers, void 0));
                this.ruta = (__runInitializers(this, _montoOriginal_extraInitializers), __runInitializers(this, _ruta_initializers, void 0));
                this.cobrador = (__runInitializers(this, _ruta_extraInitializers), __runInitializers(this, _cobrador_initializers, void 0));
                this.nivelRiesgo = (__runInitializers(this, _cobrador_extraInitializers), __runInitializers(this, _nivelRiesgo_initializers, void 0));
                this.estado = (__runInitializers(this, _nivelRiesgo_extraInitializers), __runInitializers(this, _estado_initializers, void 0));
                this.ultimoPago = (__runInitializers(this, _estado_extraInitializers), __runInitializers(this, _ultimoPago_initializers, void 0));
                this.fechaVencimiento = (__runInitializers(this, _ultimoPago_extraInitializers), __runInitializers(this, _fechaVencimiento_initializers, void 0));
                __runInitializers(this, _fechaVencimiento_extraInitializers);
            }
            return PrestamoMoraDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _id_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _numeroPrestamo_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _clienteId_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _cliente_decorators = [(0, swagger_1.ApiProperty)()];
            _diasMora_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsNumber)()];
            _montoMora_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsNumber)()];
            _montoTotalDeuda_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsNumber)()];
            _cuotasVencidas_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsNumber)()];
            _montoOriginal_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsNumber)()];
            _ruta_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _cobrador_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _nivelRiesgo_decorators = [(0, swagger_1.ApiProperty)({ enum: client_1.NivelRiesgo }), (0, class_validator_1.IsEnum)(client_1.NivelRiesgo)];
            _estado_decorators = [(0, swagger_1.ApiProperty)({ enum: client_1.EstadoPrestamo }), (0, class_validator_1.IsEnum)(client_1.EstadoPrestamo)];
            _ultimoPago_decorators = [(0, swagger_1.ApiProperty)({ required: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _fechaVencimiento_decorators = [(0, swagger_1.ApiProperty)({ required: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: function (obj) { return "id" in obj; }, get: function (obj) { return obj.id; }, set: function (obj, value) { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
            __esDecorate(null, null, _numeroPrestamo_decorators, { kind: "field", name: "numeroPrestamo", static: false, private: false, access: { has: function (obj) { return "numeroPrestamo" in obj; }, get: function (obj) { return obj.numeroPrestamo; }, set: function (obj, value) { obj.numeroPrestamo = value; } }, metadata: _metadata }, _numeroPrestamo_initializers, _numeroPrestamo_extraInitializers);
            __esDecorate(null, null, _clienteId_decorators, { kind: "field", name: "clienteId", static: false, private: false, access: { has: function (obj) { return "clienteId" in obj; }, get: function (obj) { return obj.clienteId; }, set: function (obj, value) { obj.clienteId = value; } }, metadata: _metadata }, _clienteId_initializers, _clienteId_extraInitializers);
            __esDecorate(null, null, _cliente_decorators, { kind: "field", name: "cliente", static: false, private: false, access: { has: function (obj) { return "cliente" in obj; }, get: function (obj) { return obj.cliente; }, set: function (obj, value) { obj.cliente = value; } }, metadata: _metadata }, _cliente_initializers, _cliente_extraInitializers);
            __esDecorate(null, null, _diasMora_decorators, { kind: "field", name: "diasMora", static: false, private: false, access: { has: function (obj) { return "diasMora" in obj; }, get: function (obj) { return obj.diasMora; }, set: function (obj, value) { obj.diasMora = value; } }, metadata: _metadata }, _diasMora_initializers, _diasMora_extraInitializers);
            __esDecorate(null, null, _montoMora_decorators, { kind: "field", name: "montoMora", static: false, private: false, access: { has: function (obj) { return "montoMora" in obj; }, get: function (obj) { return obj.montoMora; }, set: function (obj, value) { obj.montoMora = value; } }, metadata: _metadata }, _montoMora_initializers, _montoMora_extraInitializers);
            __esDecorate(null, null, _montoTotalDeuda_decorators, { kind: "field", name: "montoTotalDeuda", static: false, private: false, access: { has: function (obj) { return "montoTotalDeuda" in obj; }, get: function (obj) { return obj.montoTotalDeuda; }, set: function (obj, value) { obj.montoTotalDeuda = value; } }, metadata: _metadata }, _montoTotalDeuda_initializers, _montoTotalDeuda_extraInitializers);
            __esDecorate(null, null, _cuotasVencidas_decorators, { kind: "field", name: "cuotasVencidas", static: false, private: false, access: { has: function (obj) { return "cuotasVencidas" in obj; }, get: function (obj) { return obj.cuotasVencidas; }, set: function (obj, value) { obj.cuotasVencidas = value; } }, metadata: _metadata }, _cuotasVencidas_initializers, _cuotasVencidas_extraInitializers);
            __esDecorate(null, null, _montoOriginal_decorators, { kind: "field", name: "montoOriginal", static: false, private: false, access: { has: function (obj) { return "montoOriginal" in obj; }, get: function (obj) { return obj.montoOriginal; }, set: function (obj, value) { obj.montoOriginal = value; } }, metadata: _metadata }, _montoOriginal_initializers, _montoOriginal_extraInitializers);
            __esDecorate(null, null, _ruta_decorators, { kind: "field", name: "ruta", static: false, private: false, access: { has: function (obj) { return "ruta" in obj; }, get: function (obj) { return obj.ruta; }, set: function (obj, value) { obj.ruta = value; } }, metadata: _metadata }, _ruta_initializers, _ruta_extraInitializers);
            __esDecorate(null, null, _cobrador_decorators, { kind: "field", name: "cobrador", static: false, private: false, access: { has: function (obj) { return "cobrador" in obj; }, get: function (obj) { return obj.cobrador; }, set: function (obj, value) { obj.cobrador = value; } }, metadata: _metadata }, _cobrador_initializers, _cobrador_extraInitializers);
            __esDecorate(null, null, _nivelRiesgo_decorators, { kind: "field", name: "nivelRiesgo", static: false, private: false, access: { has: function (obj) { return "nivelRiesgo" in obj; }, get: function (obj) { return obj.nivelRiesgo; }, set: function (obj, value) { obj.nivelRiesgo = value; } }, metadata: _metadata }, _nivelRiesgo_initializers, _nivelRiesgo_extraInitializers);
            __esDecorate(null, null, _estado_decorators, { kind: "field", name: "estado", static: false, private: false, access: { has: function (obj) { return "estado" in obj; }, get: function (obj) { return obj.estado; }, set: function (obj, value) { obj.estado = value; } }, metadata: _metadata }, _estado_initializers, _estado_extraInitializers);
            __esDecorate(null, null, _ultimoPago_decorators, { kind: "field", name: "ultimoPago", static: false, private: false, access: { has: function (obj) { return "ultimoPago" in obj; }, get: function (obj) { return obj.ultimoPago; }, set: function (obj, value) { obj.ultimoPago = value; } }, metadata: _metadata }, _ultimoPago_initializers, _ultimoPago_extraInitializers);
            __esDecorate(null, null, _fechaVencimiento_decorators, { kind: "field", name: "fechaVencimiento", static: false, private: false, access: { has: function (obj) { return "fechaVencimiento" in obj; }, get: function (obj) { return obj.fechaVencimiento; }, set: function (obj, value) { obj.fechaVencimiento = value; } }, metadata: _metadata }, _fechaVencimiento_initializers, _fechaVencimiento_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.PrestamoMoraDto = PrestamoMoraDto;
var PrestamosMoraFiltrosDto = function () {
    var _a;
    var _busqueda_decorators;
    var _busqueda_initializers = [];
    var _busqueda_extraInitializers = [];
    var _nivelRiesgo_decorators;
    var _nivelRiesgo_initializers = [];
    var _nivelRiesgo_extraInitializers = [];
    var _rutaId_decorators;
    var _rutaId_initializers = [];
    var _rutaId_extraInitializers = [];
    var _cobradorId_decorators;
    var _cobradorId_initializers = [];
    var _cobradorId_extraInitializers = [];
    var _pagina_decorators;
    var _pagina_initializers = [];
    var _pagina_extraInitializers = [];
    var _limite_decorators;
    var _limite_initializers = [];
    var _limite_extraInitializers = [];
    return _a = /** @class */ (function () {
            function PrestamosMoraFiltrosDto() {
                this.busqueda = __runInitializers(this, _busqueda_initializers, void 0);
                this.nivelRiesgo = (__runInitializers(this, _busqueda_extraInitializers), __runInitializers(this, _nivelRiesgo_initializers, void 0));
                this.rutaId = (__runInitializers(this, _nivelRiesgo_extraInitializers), __runInitializers(this, _rutaId_initializers, void 0));
                this.cobradorId = (__runInitializers(this, _rutaId_extraInitializers), __runInitializers(this, _cobradorId_initializers, void 0));
                this.pagina = (__runInitializers(this, _cobradorId_extraInitializers), __runInitializers(this, _pagina_initializers, 1));
                this.limite = (__runInitializers(this, _pagina_extraInitializers), __runInitializers(this, _limite_initializers, 50));
                __runInitializers(this, _limite_extraInitializers);
            }
            return PrestamosMoraFiltrosDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _busqueda_decorators = [(0, swagger_1.ApiProperty)({ required: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _nivelRiesgo_decorators = [(0, swagger_1.ApiProperty)({ required: false, enum: client_1.NivelRiesgo }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(client_1.NivelRiesgo)];
            _rutaId_decorators = [(0, swagger_1.ApiProperty)({ required: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _cobradorId_decorators = [(0, swagger_1.ApiProperty)({ required: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _pagina_decorators = [(0, swagger_1.ApiProperty)({ required: false, default: 1, minimum: 1 }), (0, class_validator_1.IsOptional)(), (0, class_transformer_1.Type)(function () { return Number; }), (0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(1)];
            _limite_decorators = [(0, swagger_1.ApiProperty)({ required: false, default: 50, minimum: 1, maximum: 1000 }), (0, class_validator_1.IsOptional)(), (0, class_transformer_1.Type)(function () { return Number; }), (0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(1), (0, class_validator_1.Max)(1000)];
            __esDecorate(null, null, _busqueda_decorators, { kind: "field", name: "busqueda", static: false, private: false, access: { has: function (obj) { return "busqueda" in obj; }, get: function (obj) { return obj.busqueda; }, set: function (obj, value) { obj.busqueda = value; } }, metadata: _metadata }, _busqueda_initializers, _busqueda_extraInitializers);
            __esDecorate(null, null, _nivelRiesgo_decorators, { kind: "field", name: "nivelRiesgo", static: false, private: false, access: { has: function (obj) { return "nivelRiesgo" in obj; }, get: function (obj) { return obj.nivelRiesgo; }, set: function (obj, value) { obj.nivelRiesgo = value; } }, metadata: _metadata }, _nivelRiesgo_initializers, _nivelRiesgo_extraInitializers);
            __esDecorate(null, null, _rutaId_decorators, { kind: "field", name: "rutaId", static: false, private: false, access: { has: function (obj) { return "rutaId" in obj; }, get: function (obj) { return obj.rutaId; }, set: function (obj, value) { obj.rutaId = value; } }, metadata: _metadata }, _rutaId_initializers, _rutaId_extraInitializers);
            __esDecorate(null, null, _cobradorId_decorators, { kind: "field", name: "cobradorId", static: false, private: false, access: { has: function (obj) { return "cobradorId" in obj; }, get: function (obj) { return obj.cobradorId; }, set: function (obj, value) { obj.cobradorId = value; } }, metadata: _metadata }, _cobradorId_initializers, _cobradorId_extraInitializers);
            __esDecorate(null, null, _pagina_decorators, { kind: "field", name: "pagina", static: false, private: false, access: { has: function (obj) { return "pagina" in obj; }, get: function (obj) { return obj.pagina; }, set: function (obj, value) { obj.pagina = value; } }, metadata: _metadata }, _pagina_initializers, _pagina_extraInitializers);
            __esDecorate(null, null, _limite_decorators, { kind: "field", name: "limite", static: false, private: false, access: { has: function (obj) { return "limite" in obj; }, get: function (obj) { return obj.limite; }, set: function (obj, value) { obj.limite = value; } }, metadata: _metadata }, _limite_initializers, _limite_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.PrestamosMoraFiltrosDto = PrestamosMoraFiltrosDto;
var TotalesMoraDto = function () {
    var _a;
    var _totalMora_decorators;
    var _totalMora_initializers = [];
    var _totalMora_extraInitializers = [];
    var _totalDeuda_decorators;
    var _totalDeuda_initializers = [];
    var _totalDeuda_extraInitializers = [];
    var _totalCasosCriticos_decorators;
    var _totalCasosCriticos_initializers = [];
    var _totalCasosCriticos_extraInitializers = [];
    var _totalRegistros_decorators;
    var _totalRegistros_initializers = [];
    var _totalRegistros_extraInitializers = [];
    return _a = /** @class */ (function () {
            function TotalesMoraDto() {
                this.totalMora = __runInitializers(this, _totalMora_initializers, void 0);
                this.totalDeuda = (__runInitializers(this, _totalMora_extraInitializers), __runInitializers(this, _totalDeuda_initializers, void 0));
                this.totalCasosCriticos = (__runInitializers(this, _totalDeuda_extraInitializers), __runInitializers(this, _totalCasosCriticos_initializers, void 0));
                this.totalRegistros = (__runInitializers(this, _totalCasosCriticos_extraInitializers), __runInitializers(this, _totalRegistros_initializers, void 0));
                __runInitializers(this, _totalRegistros_extraInitializers);
            }
            return TotalesMoraDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _totalMora_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsNumber)()];
            _totalDeuda_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsNumber)()];
            _totalCasosCriticos_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsNumber)()];
            _totalRegistros_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsNumber)()];
            __esDecorate(null, null, _totalMora_decorators, { kind: "field", name: "totalMora", static: false, private: false, access: { has: function (obj) { return "totalMora" in obj; }, get: function (obj) { return obj.totalMora; }, set: function (obj, value) { obj.totalMora = value; } }, metadata: _metadata }, _totalMora_initializers, _totalMora_extraInitializers);
            __esDecorate(null, null, _totalDeuda_decorators, { kind: "field", name: "totalDeuda", static: false, private: false, access: { has: function (obj) { return "totalDeuda" in obj; }, get: function (obj) { return obj.totalDeuda; }, set: function (obj, value) { obj.totalDeuda = value; } }, metadata: _metadata }, _totalDeuda_initializers, _totalDeuda_extraInitializers);
            __esDecorate(null, null, _totalCasosCriticos_decorators, { kind: "field", name: "totalCasosCriticos", static: false, private: false, access: { has: function (obj) { return "totalCasosCriticos" in obj; }, get: function (obj) { return obj.totalCasosCriticos; }, set: function (obj, value) { obj.totalCasosCriticos = value; } }, metadata: _metadata }, _totalCasosCriticos_initializers, _totalCasosCriticos_extraInitializers);
            __esDecorate(null, null, _totalRegistros_decorators, { kind: "field", name: "totalRegistros", static: false, private: false, access: { has: function (obj) { return "totalRegistros" in obj; }, get: function (obj) { return obj.totalRegistros; }, set: function (obj, value) { obj.totalRegistros = value; } }, metadata: _metadata }, _totalRegistros_initializers, _totalRegistros_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.TotalesMoraDto = TotalesMoraDto;
