"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.OperationalReportResponse = exports.OperationalMetrics = exports.RoutePerformanceDetail = void 0;
var swagger_1 = require("@nestjs/swagger");
var RoutePerformanceDetail = function () {
    var _a;
    var _id_decorators;
    var _id_initializers = [];
    var _id_extraInitializers = [];
    var _ruta_decorators;
    var _ruta_initializers = [];
    var _ruta_extraInitializers = [];
    var _cobrador_decorators;
    var _cobrador_initializers = [];
    var _cobrador_extraInitializers = [];
    var _cobradorId_decorators;
    var _cobradorId_initializers = [];
    var _cobradorId_extraInitializers = [];
    var _meta_decorators;
    var _meta_initializers = [];
    var _meta_extraInitializers = [];
    var _recaudado_decorators;
    var _recaudado_initializers = [];
    var _recaudado_extraInitializers = [];
    var _eficiencia_decorators;
    var _eficiencia_initializers = [];
    var _eficiencia_extraInitializers = [];
    var _nuevosPrestamos_decorators;
    var _nuevosPrestamos_initializers = [];
    var _nuevosPrestamos_extraInitializers = [];
    var _nuevosClientes_decorators;
    var _nuevosClientes_initializers = [];
    var _nuevosClientes_extraInitializers = [];
    var _montoNuevosPrestamos_decorators;
    var _montoNuevosPrestamos_initializers = [];
    var _montoNuevosPrestamos_extraInitializers = [];
    return _a = /** @class */ (function () {
            function RoutePerformanceDetail() {
                this.id = __runInitializers(this, _id_initializers, void 0);
                this.ruta = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _ruta_initializers, void 0));
                this.cobrador = (__runInitializers(this, _ruta_extraInitializers), __runInitializers(this, _cobrador_initializers, void 0));
                this.cobradorId = (__runInitializers(this, _cobrador_extraInitializers), __runInitializers(this, _cobradorId_initializers, void 0));
                this.meta = (__runInitializers(this, _cobradorId_extraInitializers), __runInitializers(this, _meta_initializers, void 0));
                this.recaudado = (__runInitializers(this, _meta_extraInitializers), __runInitializers(this, _recaudado_initializers, void 0));
                this.eficiencia = (__runInitializers(this, _recaudado_extraInitializers), __runInitializers(this, _eficiencia_initializers, void 0));
                this.nuevosPrestamos = (__runInitializers(this, _eficiencia_extraInitializers), __runInitializers(this, _nuevosPrestamos_initializers, void 0));
                this.nuevosClientes = (__runInitializers(this, _nuevosPrestamos_extraInitializers), __runInitializers(this, _nuevosClientes_initializers, void 0));
                this.montoNuevosPrestamos = (__runInitializers(this, _nuevosClientes_extraInitializers), __runInitializers(this, _montoNuevosPrestamos_initializers, void 0));
                __runInitializers(this, _montoNuevosPrestamos_extraInitializers);
            }
            return RoutePerformanceDetail;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _id_decorators = [(0, swagger_1.ApiProperty)()];
            _ruta_decorators = [(0, swagger_1.ApiProperty)()];
            _cobrador_decorators = [(0, swagger_1.ApiProperty)()];
            _cobradorId_decorators = [(0, swagger_1.ApiProperty)()];
            _meta_decorators = [(0, swagger_1.ApiProperty)()];
            _recaudado_decorators = [(0, swagger_1.ApiProperty)()];
            _eficiencia_decorators = [(0, swagger_1.ApiProperty)()];
            _nuevosPrestamos_decorators = [(0, swagger_1.ApiProperty)()];
            _nuevosClientes_decorators = [(0, swagger_1.ApiProperty)()];
            _montoNuevosPrestamos_decorators = [(0, swagger_1.ApiProperty)()];
            __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: function (obj) { return "id" in obj; }, get: function (obj) { return obj.id; }, set: function (obj, value) { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
            __esDecorate(null, null, _ruta_decorators, { kind: "field", name: "ruta", static: false, private: false, access: { has: function (obj) { return "ruta" in obj; }, get: function (obj) { return obj.ruta; }, set: function (obj, value) { obj.ruta = value; } }, metadata: _metadata }, _ruta_initializers, _ruta_extraInitializers);
            __esDecorate(null, null, _cobrador_decorators, { kind: "field", name: "cobrador", static: false, private: false, access: { has: function (obj) { return "cobrador" in obj; }, get: function (obj) { return obj.cobrador; }, set: function (obj, value) { obj.cobrador = value; } }, metadata: _metadata }, _cobrador_initializers, _cobrador_extraInitializers);
            __esDecorate(null, null, _cobradorId_decorators, { kind: "field", name: "cobradorId", static: false, private: false, access: { has: function (obj) { return "cobradorId" in obj; }, get: function (obj) { return obj.cobradorId; }, set: function (obj, value) { obj.cobradorId = value; } }, metadata: _metadata }, _cobradorId_initializers, _cobradorId_extraInitializers);
            __esDecorate(null, null, _meta_decorators, { kind: "field", name: "meta", static: false, private: false, access: { has: function (obj) { return "meta" in obj; }, get: function (obj) { return obj.meta; }, set: function (obj, value) { obj.meta = value; } }, metadata: _metadata }, _meta_initializers, _meta_extraInitializers);
            __esDecorate(null, null, _recaudado_decorators, { kind: "field", name: "recaudado", static: false, private: false, access: { has: function (obj) { return "recaudado" in obj; }, get: function (obj) { return obj.recaudado; }, set: function (obj, value) { obj.recaudado = value; } }, metadata: _metadata }, _recaudado_initializers, _recaudado_extraInitializers);
            __esDecorate(null, null, _eficiencia_decorators, { kind: "field", name: "eficiencia", static: false, private: false, access: { has: function (obj) { return "eficiencia" in obj; }, get: function (obj) { return obj.eficiencia; }, set: function (obj, value) { obj.eficiencia = value; } }, metadata: _metadata }, _eficiencia_initializers, _eficiencia_extraInitializers);
            __esDecorate(null, null, _nuevosPrestamos_decorators, { kind: "field", name: "nuevosPrestamos", static: false, private: false, access: { has: function (obj) { return "nuevosPrestamos" in obj; }, get: function (obj) { return obj.nuevosPrestamos; }, set: function (obj, value) { obj.nuevosPrestamos = value; } }, metadata: _metadata }, _nuevosPrestamos_initializers, _nuevosPrestamos_extraInitializers);
            __esDecorate(null, null, _nuevosClientes_decorators, { kind: "field", name: "nuevosClientes", static: false, private: false, access: { has: function (obj) { return "nuevosClientes" in obj; }, get: function (obj) { return obj.nuevosClientes; }, set: function (obj, value) { obj.nuevosClientes = value; } }, metadata: _metadata }, _nuevosClientes_initializers, _nuevosClientes_extraInitializers);
            __esDecorate(null, null, _montoNuevosPrestamos_decorators, { kind: "field", name: "montoNuevosPrestamos", static: false, private: false, access: { has: function (obj) { return "montoNuevosPrestamos" in obj; }, get: function (obj) { return obj.montoNuevosPrestamos; }, set: function (obj, value) { obj.montoNuevosPrestamos = value; } }, metadata: _metadata }, _montoNuevosPrestamos_initializers, _montoNuevosPrestamos_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.RoutePerformanceDetail = RoutePerformanceDetail;
var OperationalMetrics = function () {
    var _a;
    var _totalRecaudo_decorators;
    var _totalRecaudo_initializers = [];
    var _totalRecaudo_extraInitializers = [];
    var _totalMeta_decorators;
    var _totalMeta_initializers = [];
    var _totalMeta_extraInitializers = [];
    var _porcentajeGlobal_decorators;
    var _porcentajeGlobal_initializers = [];
    var _porcentajeGlobal_extraInitializers = [];
    var _totalPrestamosNuevos_decorators;
    var _totalPrestamosNuevos_initializers = [];
    var _totalPrestamosNuevos_extraInitializers = [];
    var _totalAfiliaciones_decorators;
    var _totalAfiliaciones_initializers = [];
    var _totalAfiliaciones_extraInitializers = [];
    var _efectividadPromedio_decorators;
    var _efectividadPromedio_initializers = [];
    var _efectividadPromedio_extraInitializers = [];
    var _totalMontoPrestamosNuevos_decorators;
    var _totalMontoPrestamosNuevos_initializers = [];
    var _totalMontoPrestamosNuevos_extraInitializers = [];
    return _a = /** @class */ (function () {
            function OperationalMetrics() {
                this.totalRecaudo = __runInitializers(this, _totalRecaudo_initializers, void 0);
                this.totalMeta = (__runInitializers(this, _totalRecaudo_extraInitializers), __runInitializers(this, _totalMeta_initializers, void 0));
                this.porcentajeGlobal = (__runInitializers(this, _totalMeta_extraInitializers), __runInitializers(this, _porcentajeGlobal_initializers, void 0));
                this.totalPrestamosNuevos = (__runInitializers(this, _porcentajeGlobal_extraInitializers), __runInitializers(this, _totalPrestamosNuevos_initializers, void 0));
                this.totalAfiliaciones = (__runInitializers(this, _totalPrestamosNuevos_extraInitializers), __runInitializers(this, _totalAfiliaciones_initializers, void 0));
                this.efectividadPromedio = (__runInitializers(this, _totalAfiliaciones_extraInitializers), __runInitializers(this, _efectividadPromedio_initializers, void 0));
                this.totalMontoPrestamosNuevos = (__runInitializers(this, _efectividadPromedio_extraInitializers), __runInitializers(this, _totalMontoPrestamosNuevos_initializers, void 0));
                __runInitializers(this, _totalMontoPrestamosNuevos_extraInitializers);
            }
            return OperationalMetrics;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _totalRecaudo_decorators = [(0, swagger_1.ApiProperty)()];
            _totalMeta_decorators = [(0, swagger_1.ApiProperty)()];
            _porcentajeGlobal_decorators = [(0, swagger_1.ApiProperty)()];
            _totalPrestamosNuevos_decorators = [(0, swagger_1.ApiProperty)()];
            _totalAfiliaciones_decorators = [(0, swagger_1.ApiProperty)()];
            _efectividadPromedio_decorators = [(0, swagger_1.ApiProperty)()];
            _totalMontoPrestamosNuevos_decorators = [(0, swagger_1.ApiProperty)()];
            __esDecorate(null, null, _totalRecaudo_decorators, { kind: "field", name: "totalRecaudo", static: false, private: false, access: { has: function (obj) { return "totalRecaudo" in obj; }, get: function (obj) { return obj.totalRecaudo; }, set: function (obj, value) { obj.totalRecaudo = value; } }, metadata: _metadata }, _totalRecaudo_initializers, _totalRecaudo_extraInitializers);
            __esDecorate(null, null, _totalMeta_decorators, { kind: "field", name: "totalMeta", static: false, private: false, access: { has: function (obj) { return "totalMeta" in obj; }, get: function (obj) { return obj.totalMeta; }, set: function (obj, value) { obj.totalMeta = value; } }, metadata: _metadata }, _totalMeta_initializers, _totalMeta_extraInitializers);
            __esDecorate(null, null, _porcentajeGlobal_decorators, { kind: "field", name: "porcentajeGlobal", static: false, private: false, access: { has: function (obj) { return "porcentajeGlobal" in obj; }, get: function (obj) { return obj.porcentajeGlobal; }, set: function (obj, value) { obj.porcentajeGlobal = value; } }, metadata: _metadata }, _porcentajeGlobal_initializers, _porcentajeGlobal_extraInitializers);
            __esDecorate(null, null, _totalPrestamosNuevos_decorators, { kind: "field", name: "totalPrestamosNuevos", static: false, private: false, access: { has: function (obj) { return "totalPrestamosNuevos" in obj; }, get: function (obj) { return obj.totalPrestamosNuevos; }, set: function (obj, value) { obj.totalPrestamosNuevos = value; } }, metadata: _metadata }, _totalPrestamosNuevos_initializers, _totalPrestamosNuevos_extraInitializers);
            __esDecorate(null, null, _totalAfiliaciones_decorators, { kind: "field", name: "totalAfiliaciones", static: false, private: false, access: { has: function (obj) { return "totalAfiliaciones" in obj; }, get: function (obj) { return obj.totalAfiliaciones; }, set: function (obj, value) { obj.totalAfiliaciones = value; } }, metadata: _metadata }, _totalAfiliaciones_initializers, _totalAfiliaciones_extraInitializers);
            __esDecorate(null, null, _efectividadPromedio_decorators, { kind: "field", name: "efectividadPromedio", static: false, private: false, access: { has: function (obj) { return "efectividadPromedio" in obj; }, get: function (obj) { return obj.efectividadPromedio; }, set: function (obj, value) { obj.efectividadPromedio = value; } }, metadata: _metadata }, _efectividadPromedio_initializers, _efectividadPromedio_extraInitializers);
            __esDecorate(null, null, _totalMontoPrestamosNuevos_decorators, { kind: "field", name: "totalMontoPrestamosNuevos", static: false, private: false, access: { has: function (obj) { return "totalMontoPrestamosNuevos" in obj; }, get: function (obj) { return obj.totalMontoPrestamosNuevos; }, set: function (obj, value) { obj.totalMontoPrestamosNuevos = value; } }, metadata: _metadata }, _totalMontoPrestamosNuevos_initializers, _totalMontoPrestamosNuevos_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.OperationalMetrics = OperationalMetrics;
var OperationalReportResponse = function () {
    var _a;
    var _classSuper = OperationalMetrics;
    var _rendimientoRutas_decorators;
    var _rendimientoRutas_initializers = [];
    var _rendimientoRutas_extraInitializers = [];
    var _periodo_decorators;
    var _periodo_initializers = [];
    var _periodo_extraInitializers = [];
    var _fechaInicio_decorators;
    var _fechaInicio_initializers = [];
    var _fechaInicio_extraInitializers = [];
    var _fechaFin_decorators;
    var _fechaFin_initializers = [];
    var _fechaFin_extraInitializers = [];
    return _a = /** @class */ (function (_super) {
            __extends(OperationalReportResponse, _super);
            function OperationalReportResponse() {
                var _this = _super !== null && _super.apply(this, arguments) || this;
                _this.rendimientoRutas = __runInitializers(_this, _rendimientoRutas_initializers, void 0);
                _this.periodo = (__runInitializers(_this, _rendimientoRutas_extraInitializers), __runInitializers(_this, _periodo_initializers, void 0));
                _this.fechaInicio = (__runInitializers(_this, _periodo_extraInitializers), __runInitializers(_this, _fechaInicio_initializers, void 0));
                _this.fechaFin = (__runInitializers(_this, _fechaInicio_extraInitializers), __runInitializers(_this, _fechaFin_initializers, void 0));
                __runInitializers(_this, _fechaFin_extraInitializers);
                return _this;
            }
            return OperationalReportResponse;
        }(_classSuper)),
        (function () {
            var _b;
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create((_b = _classSuper[Symbol.metadata]) !== null && _b !== void 0 ? _b : null) : void 0;
            _rendimientoRutas_decorators = [(0, swagger_1.ApiProperty)({ type: [RoutePerformanceDetail] })];
            _periodo_decorators = [(0, swagger_1.ApiProperty)()];
            _fechaInicio_decorators = [(0, swagger_1.ApiProperty)()];
            _fechaFin_decorators = [(0, swagger_1.ApiProperty)()];
            __esDecorate(null, null, _rendimientoRutas_decorators, { kind: "field", name: "rendimientoRutas", static: false, private: false, access: { has: function (obj) { return "rendimientoRutas" in obj; }, get: function (obj) { return obj.rendimientoRutas; }, set: function (obj, value) { obj.rendimientoRutas = value; } }, metadata: _metadata }, _rendimientoRutas_initializers, _rendimientoRutas_extraInitializers);
            __esDecorate(null, null, _periodo_decorators, { kind: "field", name: "periodo", static: false, private: false, access: { has: function (obj) { return "periodo" in obj; }, get: function (obj) { return obj.periodo; }, set: function (obj, value) { obj.periodo = value; } }, metadata: _metadata }, _periodo_initializers, _periodo_extraInitializers);
            __esDecorate(null, null, _fechaInicio_decorators, { kind: "field", name: "fechaInicio", static: false, private: false, access: { has: function (obj) { return "fechaInicio" in obj; }, get: function (obj) { return obj.fechaInicio; }, set: function (obj, value) { obj.fechaInicio = value; } }, metadata: _metadata }, _fechaInicio_initializers, _fechaInicio_extraInitializers);
            __esDecorate(null, null, _fechaFin_decorators, { kind: "field", name: "fechaFin", static: false, private: false, access: { has: function (obj) { return "fechaFin" in obj; }, get: function (obj) { return obj.fechaFin; }, set: function (obj, value) { obj.fechaFin = value; } }, metadata: _metadata }, _fechaFin_initializers, _fechaFin_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.OperationalReportResponse = OperationalReportResponse;
