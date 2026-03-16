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
exports.DecisionCastigoDto = exports.TotalesVencidasDto = exports.CuentasVencidasFiltrosDto = exports.CuentaVencidaDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var client_1 = require("@prisma/client");
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var CuentaVencidaDto = function () {
    var _a;
    var _id_decorators;
    var _id_initializers = [];
    var _id_extraInitializers = [];
    var _numeroPrestamo_decorators;
    var _numeroPrestamo_initializers = [];
    var _numeroPrestamo_extraInitializers = [];
    var _cliente_decorators;
    var _cliente_initializers = [];
    var _cliente_extraInitializers = [];
    var _fechaVencimiento_decorators;
    var _fechaVencimiento_initializers = [];
    var _fechaVencimiento_extraInitializers = [];
    var _diasVencidos_decorators;
    var _diasVencidos_initializers = [];
    var _diasVencidos_extraInitializers = [];
    var _saldoPendiente_decorators;
    var _saldoPendiente_initializers = [];
    var _saldoPendiente_extraInitializers = [];
    var _montoOriginal_decorators;
    var _montoOriginal_initializers = [];
    var _montoOriginal_extraInitializers = [];
    var _ruta_decorators;
    var _ruta_initializers = [];
    var _ruta_extraInitializers = [];
    var _nivelRiesgo_decorators;
    var _nivelRiesgo_initializers = [];
    var _nivelRiesgo_extraInitializers = [];
    var _estado_decorators;
    var _estado_initializers = [];
    var _estado_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CuentaVencidaDto() {
                this.id = __runInitializers(this, _id_initializers, void 0);
                this.numeroPrestamo = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _numeroPrestamo_initializers, void 0));
                this.cliente = (__runInitializers(this, _numeroPrestamo_extraInitializers), __runInitializers(this, _cliente_initializers, void 0));
                this.fechaVencimiento = (__runInitializers(this, _cliente_extraInitializers), __runInitializers(this, _fechaVencimiento_initializers, void 0));
                this.diasVencidos = (__runInitializers(this, _fechaVencimiento_extraInitializers), __runInitializers(this, _diasVencidos_initializers, void 0));
                this.saldoPendiente = (__runInitializers(this, _diasVencidos_extraInitializers), __runInitializers(this, _saldoPendiente_initializers, void 0));
                this.montoOriginal = (__runInitializers(this, _saldoPendiente_extraInitializers), __runInitializers(this, _montoOriginal_initializers, void 0));
                this.ruta = (__runInitializers(this, _montoOriginal_extraInitializers), __runInitializers(this, _ruta_initializers, void 0));
                this.nivelRiesgo = (__runInitializers(this, _ruta_extraInitializers), __runInitializers(this, _nivelRiesgo_initializers, void 0));
                this.estado = (__runInitializers(this, _nivelRiesgo_extraInitializers), __runInitializers(this, _estado_initializers, void 0));
                __runInitializers(this, _estado_extraInitializers);
            }
            return CuentaVencidaDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _id_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _numeroPrestamo_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _cliente_decorators = [(0, swagger_1.ApiProperty)()];
            _fechaVencimiento_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _diasVencidos_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsNumber)()];
            _saldoPendiente_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsNumber)()];
            _montoOriginal_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsNumber)()];
            _ruta_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _nivelRiesgo_decorators = [(0, swagger_1.ApiProperty)({ enum: client_1.NivelRiesgo }), (0, class_validator_1.IsEnum)(client_1.NivelRiesgo)];
            _estado_decorators = [(0, swagger_1.ApiProperty)({ enum: client_1.EstadoPrestamo }), (0, class_validator_1.IsEnum)(client_1.EstadoPrestamo)];
            __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: function (obj) { return "id" in obj; }, get: function (obj) { return obj.id; }, set: function (obj, value) { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
            __esDecorate(null, null, _numeroPrestamo_decorators, { kind: "field", name: "numeroPrestamo", static: false, private: false, access: { has: function (obj) { return "numeroPrestamo" in obj; }, get: function (obj) { return obj.numeroPrestamo; }, set: function (obj, value) { obj.numeroPrestamo = value; } }, metadata: _metadata }, _numeroPrestamo_initializers, _numeroPrestamo_extraInitializers);
            __esDecorate(null, null, _cliente_decorators, { kind: "field", name: "cliente", static: false, private: false, access: { has: function (obj) { return "cliente" in obj; }, get: function (obj) { return obj.cliente; }, set: function (obj, value) { obj.cliente = value; } }, metadata: _metadata }, _cliente_initializers, _cliente_extraInitializers);
            __esDecorate(null, null, _fechaVencimiento_decorators, { kind: "field", name: "fechaVencimiento", static: false, private: false, access: { has: function (obj) { return "fechaVencimiento" in obj; }, get: function (obj) { return obj.fechaVencimiento; }, set: function (obj, value) { obj.fechaVencimiento = value; } }, metadata: _metadata }, _fechaVencimiento_initializers, _fechaVencimiento_extraInitializers);
            __esDecorate(null, null, _diasVencidos_decorators, { kind: "field", name: "diasVencidos", static: false, private: false, access: { has: function (obj) { return "diasVencidos" in obj; }, get: function (obj) { return obj.diasVencidos; }, set: function (obj, value) { obj.diasVencidos = value; } }, metadata: _metadata }, _diasVencidos_initializers, _diasVencidos_extraInitializers);
            __esDecorate(null, null, _saldoPendiente_decorators, { kind: "field", name: "saldoPendiente", static: false, private: false, access: { has: function (obj) { return "saldoPendiente" in obj; }, get: function (obj) { return obj.saldoPendiente; }, set: function (obj, value) { obj.saldoPendiente = value; } }, metadata: _metadata }, _saldoPendiente_initializers, _saldoPendiente_extraInitializers);
            __esDecorate(null, null, _montoOriginal_decorators, { kind: "field", name: "montoOriginal", static: false, private: false, access: { has: function (obj) { return "montoOriginal" in obj; }, get: function (obj) { return obj.montoOriginal; }, set: function (obj, value) { obj.montoOriginal = value; } }, metadata: _metadata }, _montoOriginal_initializers, _montoOriginal_extraInitializers);
            __esDecorate(null, null, _ruta_decorators, { kind: "field", name: "ruta", static: false, private: false, access: { has: function (obj) { return "ruta" in obj; }, get: function (obj) { return obj.ruta; }, set: function (obj, value) { obj.ruta = value; } }, metadata: _metadata }, _ruta_initializers, _ruta_extraInitializers);
            __esDecorate(null, null, _nivelRiesgo_decorators, { kind: "field", name: "nivelRiesgo", static: false, private: false, access: { has: function (obj) { return "nivelRiesgo" in obj; }, get: function (obj) { return obj.nivelRiesgo; }, set: function (obj, value) { obj.nivelRiesgo = value; } }, metadata: _metadata }, _nivelRiesgo_initializers, _nivelRiesgo_extraInitializers);
            __esDecorate(null, null, _estado_decorators, { kind: "field", name: "estado", static: false, private: false, access: { has: function (obj) { return "estado" in obj; }, get: function (obj) { return obj.estado; }, set: function (obj, value) { obj.estado = value; } }, metadata: _metadata }, _estado_initializers, _estado_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CuentaVencidaDto = CuentaVencidaDto;
var CuentasVencidasFiltrosDto = function () {
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
    var _pagina_decorators;
    var _pagina_initializers = [];
    var _pagina_extraInitializers = [];
    var _limite_decorators;
    var _limite_initializers = [];
    var _limite_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CuentasVencidasFiltrosDto() {
                this.busqueda = __runInitializers(this, _busqueda_initializers, void 0);
                this.nivelRiesgo = (__runInitializers(this, _busqueda_extraInitializers), __runInitializers(this, _nivelRiesgo_initializers, void 0));
                this.rutaId = (__runInitializers(this, _nivelRiesgo_extraInitializers), __runInitializers(this, _rutaId_initializers, void 0));
                this.pagina = (__runInitializers(this, _rutaId_extraInitializers), __runInitializers(this, _pagina_initializers, 1));
                this.limite = (__runInitializers(this, _pagina_extraInitializers), __runInitializers(this, _limite_initializers, 50));
                __runInitializers(this, _limite_extraInitializers);
            }
            return CuentasVencidasFiltrosDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _busqueda_decorators = [(0, swagger_1.ApiProperty)({ required: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _nivelRiesgo_decorators = [(0, swagger_1.ApiProperty)({ required: false, enum: client_1.NivelRiesgo }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(client_1.NivelRiesgo)];
            _rutaId_decorators = [(0, swagger_1.ApiProperty)({ required: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _pagina_decorators = [(0, swagger_1.ApiProperty)({ required: false, default: 1, minimum: 1 }), (0, class_validator_1.IsOptional)(), (0, class_transformer_1.Type)(function () { return Number; }), (0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(1)];
            _limite_decorators = [(0, swagger_1.ApiProperty)({ required: false, default: 50, minimum: 1, maximum: 1000 }), (0, class_validator_1.IsOptional)(), (0, class_transformer_1.Type)(function () { return Number; }), (0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(1), (0, class_validator_1.Max)(1000)];
            __esDecorate(null, null, _busqueda_decorators, { kind: "field", name: "busqueda", static: false, private: false, access: { has: function (obj) { return "busqueda" in obj; }, get: function (obj) { return obj.busqueda; }, set: function (obj, value) { obj.busqueda = value; } }, metadata: _metadata }, _busqueda_initializers, _busqueda_extraInitializers);
            __esDecorate(null, null, _nivelRiesgo_decorators, { kind: "field", name: "nivelRiesgo", static: false, private: false, access: { has: function (obj) { return "nivelRiesgo" in obj; }, get: function (obj) { return obj.nivelRiesgo; }, set: function (obj, value) { obj.nivelRiesgo = value; } }, metadata: _metadata }, _nivelRiesgo_initializers, _nivelRiesgo_extraInitializers);
            __esDecorate(null, null, _rutaId_decorators, { kind: "field", name: "rutaId", static: false, private: false, access: { has: function (obj) { return "rutaId" in obj; }, get: function (obj) { return obj.rutaId; }, set: function (obj, value) { obj.rutaId = value; } }, metadata: _metadata }, _rutaId_initializers, _rutaId_extraInitializers);
            __esDecorate(null, null, _pagina_decorators, { kind: "field", name: "pagina", static: false, private: false, access: { has: function (obj) { return "pagina" in obj; }, get: function (obj) { return obj.pagina; }, set: function (obj, value) { obj.pagina = value; } }, metadata: _metadata }, _pagina_initializers, _pagina_extraInitializers);
            __esDecorate(null, null, _limite_decorators, { kind: "field", name: "limite", static: false, private: false, access: { has: function (obj) { return "limite" in obj; }, get: function (obj) { return obj.limite; }, set: function (obj, value) { obj.limite = value; } }, metadata: _metadata }, _limite_initializers, _limite_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CuentasVencidasFiltrosDto = CuentasVencidasFiltrosDto;
var TotalesVencidasDto = function () {
    var _a;
    var _totalVencido_decorators;
    var _totalVencido_initializers = [];
    var _totalVencido_extraInitializers = [];
    var _totalRegistros_decorators;
    var _totalRegistros_initializers = [];
    var _totalRegistros_extraInitializers = [];
    var _diasPromedioVencimiento_decorators;
    var _diasPromedioVencimiento_initializers = [];
    var _diasPromedioVencimiento_extraInitializers = [];
    var _totalInteresesMora_decorators;
    var _totalInteresesMora_initializers = [];
    var _totalInteresesMora_extraInitializers = [];
    var _totalMontoOriginal_decorators;
    var _totalMontoOriginal_initializers = [];
    var _totalMontoOriginal_extraInitializers = [];
    return _a = /** @class */ (function () {
            function TotalesVencidasDto() {
                this.totalVencido = __runInitializers(this, _totalVencido_initializers, void 0);
                this.totalRegistros = (__runInitializers(this, _totalVencido_extraInitializers), __runInitializers(this, _totalRegistros_initializers, void 0));
                this.diasPromedioVencimiento = (__runInitializers(this, _totalRegistros_extraInitializers), __runInitializers(this, _diasPromedioVencimiento_initializers, void 0));
                this.totalInteresesMora = (__runInitializers(this, _diasPromedioVencimiento_extraInitializers), __runInitializers(this, _totalInteresesMora_initializers, void 0));
                this.totalMontoOriginal = (__runInitializers(this, _totalInteresesMora_extraInitializers), __runInitializers(this, _totalMontoOriginal_initializers, void 0));
                __runInitializers(this, _totalMontoOriginal_extraInitializers);
            }
            return TotalesVencidasDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _totalVencido_decorators = [(0, swagger_1.ApiProperty)({ description: 'Suma total del saldo pendiente de cuentas vencidas' }), (0, class_validator_1.IsNumber)()];
            _totalRegistros_decorators = [(0, swagger_1.ApiProperty)({ description: 'Total de registros de cuentas vencidas' }), (0, class_validator_1.IsNumber)()];
            _diasPromedioVencimiento_decorators = [(0, swagger_1.ApiProperty)({ description: 'Promedio de días vencidos entre todos los registros' }), (0, class_validator_1.IsNumber)()];
            _totalInteresesMora_decorators = [(0, swagger_1.ApiProperty)({ description: 'Total acumulado de intereses de mora generados' }), (0, class_validator_1.IsNumber)()];
            _totalMontoOriginal_decorators = [(0, swagger_1.ApiProperty)({ description: 'Monto total original prestado en cuentas vencidas' }), (0, class_validator_1.IsNumber)()];
            __esDecorate(null, null, _totalVencido_decorators, { kind: "field", name: "totalVencido", static: false, private: false, access: { has: function (obj) { return "totalVencido" in obj; }, get: function (obj) { return obj.totalVencido; }, set: function (obj, value) { obj.totalVencido = value; } }, metadata: _metadata }, _totalVencido_initializers, _totalVencido_extraInitializers);
            __esDecorate(null, null, _totalRegistros_decorators, { kind: "field", name: "totalRegistros", static: false, private: false, access: { has: function (obj) { return "totalRegistros" in obj; }, get: function (obj) { return obj.totalRegistros; }, set: function (obj, value) { obj.totalRegistros = value; } }, metadata: _metadata }, _totalRegistros_initializers, _totalRegistros_extraInitializers);
            __esDecorate(null, null, _diasPromedioVencimiento_decorators, { kind: "field", name: "diasPromedioVencimiento", static: false, private: false, access: { has: function (obj) { return "diasPromedioVencimiento" in obj; }, get: function (obj) { return obj.diasPromedioVencimiento; }, set: function (obj, value) { obj.diasPromedioVencimiento = value; } }, metadata: _metadata }, _diasPromedioVencimiento_initializers, _diasPromedioVencimiento_extraInitializers);
            __esDecorate(null, null, _totalInteresesMora_decorators, { kind: "field", name: "totalInteresesMora", static: false, private: false, access: { has: function (obj) { return "totalInteresesMora" in obj; }, get: function (obj) { return obj.totalInteresesMora; }, set: function (obj, value) { obj.totalInteresesMora = value; } }, metadata: _metadata }, _totalInteresesMora_initializers, _totalInteresesMora_extraInitializers);
            __esDecorate(null, null, _totalMontoOriginal_decorators, { kind: "field", name: "totalMontoOriginal", static: false, private: false, access: { has: function (obj) { return "totalMontoOriginal" in obj; }, get: function (obj) { return obj.totalMontoOriginal; }, set: function (obj, value) { obj.totalMontoOriginal = value; } }, metadata: _metadata }, _totalMontoOriginal_initializers, _totalMontoOriginal_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.TotalesVencidasDto = TotalesVencidasDto;
var DecisionCastigoDto = function () {
    var _a;
    var _prestamoId_decorators;
    var _prestamoId_initializers = [];
    var _prestamoId_extraInitializers = [];
    var _decision_decorators;
    var _decision_initializers = [];
    var _decision_extraInitializers = [];
    var _montoInteres_decorators;
    var _montoInteres_initializers = [];
    var _montoInteres_extraInitializers = [];
    var _comentarios_decorators;
    var _comentarios_initializers = [];
    var _comentarios_extraInitializers = [];
    var _nuevaFechaVencimiento_decorators;
    var _nuevaFechaVencimiento_initializers = [];
    var _nuevaFechaVencimiento_extraInitializers = [];
    var _diasGracia_decorators;
    var _diasGracia_initializers = [];
    var _diasGracia_extraInitializers = [];
    return _a = /** @class */ (function () {
            function DecisionCastigoDto() {
                this.prestamoId = __runInitializers(this, _prestamoId_initializers, void 0);
                this.decision = (__runInitializers(this, _prestamoId_extraInitializers), __runInitializers(this, _decision_initializers, void 0));
                this.montoInteres = (__runInitializers(this, _decision_extraInitializers), __runInitializers(this, _montoInteres_initializers, void 0));
                this.comentarios = (__runInitializers(this, _montoInteres_extraInitializers), __runInitializers(this, _comentarios_initializers, void 0));
                this.nuevaFechaVencimiento = (__runInitializers(this, _comentarios_extraInitializers), __runInitializers(this, _nuevaFechaVencimiento_initializers, void 0));
                this.diasGracia = (__runInitializers(this, _nuevaFechaVencimiento_extraInitializers), __runInitializers(this, _diasGracia_initializers, void 0));
                __runInitializers(this, _diasGracia_extraInitializers);
            }
            return DecisionCastigoDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _prestamoId_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _decision_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _montoInteres_decorators = [(0, swagger_1.ApiProperty)({ required: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _comentarios_decorators = [(0, swagger_1.ApiProperty)({ required: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _nuevaFechaVencimiento_decorators = [(0, swagger_1.ApiProperty)({ required: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _diasGracia_decorators = [(0, swagger_1.ApiProperty)({ required: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            __esDecorate(null, null, _prestamoId_decorators, { kind: "field", name: "prestamoId", static: false, private: false, access: { has: function (obj) { return "prestamoId" in obj; }, get: function (obj) { return obj.prestamoId; }, set: function (obj, value) { obj.prestamoId = value; } }, metadata: _metadata }, _prestamoId_initializers, _prestamoId_extraInitializers);
            __esDecorate(null, null, _decision_decorators, { kind: "field", name: "decision", static: false, private: false, access: { has: function (obj) { return "decision" in obj; }, get: function (obj) { return obj.decision; }, set: function (obj, value) { obj.decision = value; } }, metadata: _metadata }, _decision_initializers, _decision_extraInitializers);
            __esDecorate(null, null, _montoInteres_decorators, { kind: "field", name: "montoInteres", static: false, private: false, access: { has: function (obj) { return "montoInteres" in obj; }, get: function (obj) { return obj.montoInteres; }, set: function (obj, value) { obj.montoInteres = value; } }, metadata: _metadata }, _montoInteres_initializers, _montoInteres_extraInitializers);
            __esDecorate(null, null, _comentarios_decorators, { kind: "field", name: "comentarios", static: false, private: false, access: { has: function (obj) { return "comentarios" in obj; }, get: function (obj) { return obj.comentarios; }, set: function (obj, value) { obj.comentarios = value; } }, metadata: _metadata }, _comentarios_initializers, _comentarios_extraInitializers);
            __esDecorate(null, null, _nuevaFechaVencimiento_decorators, { kind: "field", name: "nuevaFechaVencimiento", static: false, private: false, access: { has: function (obj) { return "nuevaFechaVencimiento" in obj; }, get: function (obj) { return obj.nuevaFechaVencimiento; }, set: function (obj, value) { obj.nuevaFechaVencimiento = value; } }, metadata: _metadata }, _nuevaFechaVencimiento_initializers, _nuevaFechaVencimiento_extraInitializers);
            __esDecorate(null, null, _diasGracia_decorators, { kind: "field", name: "diasGracia", static: false, private: false, access: { has: function (obj) { return "diasGracia" in obj; }, get: function (obj) { return obj.diasGracia; }, set: function (obj, value) { obj.diasGracia = value; } }, metadata: _metadata }, _diasGracia_initializers, _diasGracia_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.DecisionCastigoDto = DecisionCastigoDto;
