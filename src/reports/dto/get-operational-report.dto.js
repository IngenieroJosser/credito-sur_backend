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
exports.GetOperationalReportDto = exports.ReportPeriod = void 0;
var swagger_1 = require("@nestjs/swagger");
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var ReportPeriod;
(function (ReportPeriod) {
    ReportPeriod["TODAY"] = "today";
    ReportPeriod["WEEK"] = "week";
    ReportPeriod["MONTH"] = "month";
    ReportPeriod["YEAR"] = "year";
    ReportPeriod["CUSTOM"] = "custom";
})(ReportPeriod || (exports.ReportPeriod = ReportPeriod = {}));
var GetOperationalReportDto = function () {
    var _a;
    var _period_decorators;
    var _period_initializers = [];
    var _period_extraInitializers = [];
    var _routeId_decorators;
    var _routeId_initializers = [];
    var _routeId_extraInitializers = [];
    var _startDate_decorators;
    var _startDate_initializers = [];
    var _startDate_extraInitializers = [];
    var _endDate_decorators;
    var _endDate_initializers = [];
    var _endDate_extraInitializers = [];
    return _a = /** @class */ (function () {
            function GetOperationalReportDto() {
                this.period = __runInitializers(this, _period_initializers, ReportPeriod.MONTH);
                this.routeId = (__runInitializers(this, _period_extraInitializers), __runInitializers(this, _routeId_initializers, void 0));
                this.startDate = (__runInitializers(this, _routeId_extraInitializers), __runInitializers(this, _startDate_initializers, void 0));
                this.endDate = (__runInitializers(this, _startDate_extraInitializers), __runInitializers(this, _endDate_initializers, void 0));
                __runInitializers(this, _endDate_extraInitializers);
            }
            return GetOperationalReportDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _period_decorators = [(0, swagger_1.ApiProperty)({
                    enum: ReportPeriod,
                    default: ReportPeriod.MONTH,
                    description: 'Período del reporte',
                }), (0, class_validator_1.IsEnum)(ReportPeriod), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return value || ReportPeriod.MONTH;
                })];
            _routeId_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'ID de la ruta específica (opcional)',
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _startDate_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'Fecha de inicio para período personalizado (YYYY-MM-DD)',
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _endDate_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'Fecha de fin para período personalizado (YYYY-MM-DD)',
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            __esDecorate(null, null, _period_decorators, { kind: "field", name: "period", static: false, private: false, access: { has: function (obj) { return "period" in obj; }, get: function (obj) { return obj.period; }, set: function (obj, value) { obj.period = value; } }, metadata: _metadata }, _period_initializers, _period_extraInitializers);
            __esDecorate(null, null, _routeId_decorators, { kind: "field", name: "routeId", static: false, private: false, access: { has: function (obj) { return "routeId" in obj; }, get: function (obj) { return obj.routeId; }, set: function (obj, value) { obj.routeId = value; } }, metadata: _metadata }, _routeId_initializers, _routeId_extraInitializers);
            __esDecorate(null, null, _startDate_decorators, { kind: "field", name: "startDate", static: false, private: false, access: { has: function (obj) { return "startDate" in obj; }, get: function (obj) { return obj.startDate; }, set: function (obj, value) { obj.startDate = value; } }, metadata: _metadata }, _startDate_initializers, _startDate_extraInitializers);
            __esDecorate(null, null, _endDate_decorators, { kind: "field", name: "endDate", static: false, private: false, access: { has: function (obj) { return "endDate" in obj; }, get: function (obj) { return obj.endDate; }, set: function (obj, value) { obj.endDate = value; } }, metadata: _metadata }, _endDate_initializers, _endDate_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.GetOperationalReportDto = GetOperationalReportDto;
