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
exports.ReprogramarCuotaDto = void 0;
var class_validator_1 = require("class-validator");
var swagger_1 = require("@nestjs/swagger");
var ReprogramarCuotaDto = function () {
    var _a;
    var _motivo_decorators;
    var _motivo_initializers = [];
    var _motivo_extraInitializers = [];
    var _nuevaFecha_decorators;
    var _nuevaFecha_initializers = [];
    var _nuevaFecha_extraInitializers = [];
    var _montoParcial_decorators;
    var _montoParcial_initializers = [];
    var _montoParcial_extraInitializers = [];
    var _reprogramadoPorId_decorators;
    var _reprogramadoPorId_initializers = [];
    var _reprogramadoPorId_extraInitializers = [];
    return _a = /** @class */ (function () {
            function ReprogramarCuotaDto() {
                this.motivo = __runInitializers(this, _motivo_initializers, void 0);
                this.nuevaFecha = (__runInitializers(this, _motivo_extraInitializers), __runInitializers(this, _nuevaFecha_initializers, void 0));
                this.montoParcial = (__runInitializers(this, _nuevaFecha_extraInitializers), __runInitializers(this, _montoParcial_initializers, void 0));
                this.reprogramadoPorId = (__runInitializers(this, _montoParcial_extraInitializers), __runInitializers(this, _reprogramadoPorId_initializers, void 0));
                __runInitializers(this, _reprogramadoPorId_extraInitializers);
            }
            return ReprogramarCuotaDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _motivo_decorators = [(0, swagger_1.ApiProperty)({
                    description: 'Motivo de la reprogramación',
                    example: 'Cliente solicitó prórroga por dificultades económicas',
                }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _nuevaFecha_decorators = [(0, swagger_1.ApiProperty)({
                    description: 'Nueva fecha de vencimiento',
                    example: '2026-03-15',
                }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _montoParcial_decorators = [(0, swagger_1.ApiProperty)({
                    description: 'Monto parcial a pagar (opcional)',
                    example: 200000,
                }), (0, class_validator_1.IsNumber)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.Min)(0)];
            _reprogramadoPorId_decorators = [(0, swagger_1.ApiProperty)({
                    description: 'ID del usuario que realiza la reprogramación',
                    example: 'user-uuid',
                }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            __esDecorate(null, null, _motivo_decorators, { kind: "field", name: "motivo", static: false, private: false, access: { has: function (obj) { return "motivo" in obj; }, get: function (obj) { return obj.motivo; }, set: function (obj, value) { obj.motivo = value; } }, metadata: _metadata }, _motivo_initializers, _motivo_extraInitializers);
            __esDecorate(null, null, _nuevaFecha_decorators, { kind: "field", name: "nuevaFecha", static: false, private: false, access: { has: function (obj) { return "nuevaFecha" in obj; }, get: function (obj) { return obj.nuevaFecha; }, set: function (obj, value) { obj.nuevaFecha = value; } }, metadata: _metadata }, _nuevaFecha_initializers, _nuevaFecha_extraInitializers);
            __esDecorate(null, null, _montoParcial_decorators, { kind: "field", name: "montoParcial", static: false, private: false, access: { has: function (obj) { return "montoParcial" in obj; }, get: function (obj) { return obj.montoParcial; }, set: function (obj, value) { obj.montoParcial = value; } }, metadata: _metadata }, _montoParcial_initializers, _montoParcial_extraInitializers);
            __esDecorate(null, null, _reprogramadoPorId_decorators, { kind: "field", name: "reprogramadoPorId", static: false, private: false, access: { has: function (obj) { return "reprogramadoPorId" in obj; }, get: function (obj) { return obj.reprogramadoPorId; }, set: function (obj, value) { obj.reprogramadoPorId = value; } }, metadata: _metadata }, _reprogramadoPorId_initializers, _reprogramadoPorId_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.ReprogramarCuotaDto = ReprogramarCuotaDto;
