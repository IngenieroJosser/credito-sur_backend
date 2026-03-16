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
exports.ExportRequestDto = exports.PrestamosMoraResponseDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var prestamo_mora_dto_1 = require("./prestamo-mora.dto");
var class_validator_1 = require("class-validator");
var PrestamosMoraResponseDto = function () {
    var _a;
    var _prestamos_decorators;
    var _prestamos_initializers = [];
    var _prestamos_extraInitializers = [];
    var _totales_decorators;
    var _totales_initializers = [];
    var _totales_extraInitializers = [];
    var _total_decorators;
    var _total_initializers = [];
    var _total_extraInitializers = [];
    var _pagina_decorators;
    var _pagina_initializers = [];
    var _pagina_extraInitializers = [];
    var _limite_decorators;
    var _limite_initializers = [];
    var _limite_extraInitializers = [];
    return _a = /** @class */ (function () {
            function PrestamosMoraResponseDto() {
                this.prestamos = __runInitializers(this, _prestamos_initializers, void 0);
                this.totales = (__runInitializers(this, _prestamos_extraInitializers), __runInitializers(this, _totales_initializers, void 0));
                this.total = (__runInitializers(this, _totales_extraInitializers), __runInitializers(this, _total_initializers, void 0));
                this.pagina = (__runInitializers(this, _total_extraInitializers), __runInitializers(this, _pagina_initializers, void 0));
                this.limite = (__runInitializers(this, _pagina_extraInitializers), __runInitializers(this, _limite_initializers, void 0));
                __runInitializers(this, _limite_extraInitializers);
            }
            return PrestamosMoraResponseDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _prestamos_decorators = [(0, swagger_1.ApiProperty)({ type: [prestamo_mora_dto_1.PrestamoMoraDto] })];
            _totales_decorators = [(0, swagger_1.ApiProperty)()];
            _total_decorators = [(0, swagger_1.ApiProperty)()];
            _pagina_decorators = [(0, swagger_1.ApiProperty)()];
            _limite_decorators = [(0, swagger_1.ApiProperty)()];
            __esDecorate(null, null, _prestamos_decorators, { kind: "field", name: "prestamos", static: false, private: false, access: { has: function (obj) { return "prestamos" in obj; }, get: function (obj) { return obj.prestamos; }, set: function (obj, value) { obj.prestamos = value; } }, metadata: _metadata }, _prestamos_initializers, _prestamos_extraInitializers);
            __esDecorate(null, null, _totales_decorators, { kind: "field", name: "totales", static: false, private: false, access: { has: function (obj) { return "totales" in obj; }, get: function (obj) { return obj.totales; }, set: function (obj, value) { obj.totales = value; } }, metadata: _metadata }, _totales_initializers, _totales_extraInitializers);
            __esDecorate(null, null, _total_decorators, { kind: "field", name: "total", static: false, private: false, access: { has: function (obj) { return "total" in obj; }, get: function (obj) { return obj.total; }, set: function (obj, value) { obj.total = value; } }, metadata: _metadata }, _total_initializers, _total_extraInitializers);
            __esDecorate(null, null, _pagina_decorators, { kind: "field", name: "pagina", static: false, private: false, access: { has: function (obj) { return "pagina" in obj; }, get: function (obj) { return obj.pagina; }, set: function (obj, value) { obj.pagina = value; } }, metadata: _metadata }, _pagina_initializers, _pagina_extraInitializers);
            __esDecorate(null, null, _limite_decorators, { kind: "field", name: "limite", static: false, private: false, access: { has: function (obj) { return "limite" in obj; }, get: function (obj) { return obj.limite; }, set: function (obj, value) { obj.limite = value; } }, metadata: _metadata }, _limite_initializers, _limite_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.PrestamosMoraResponseDto = PrestamosMoraResponseDto;
var ExportRequestDto = function () {
    var _a;
    var _formato_decorators;
    var _formato_initializers = [];
    var _formato_extraInitializers = [];
    var _filtros_decorators;
    var _filtros_initializers = [];
    var _filtros_extraInitializers = [];
    return _a = /** @class */ (function () {
            function ExportRequestDto() {
                this.formato = __runInitializers(this, _formato_initializers, void 0);
                this.filtros = (__runInitializers(this, _formato_extraInitializers), __runInitializers(this, _filtros_initializers, void 0));
                __runInitializers(this, _filtros_extraInitializers);
            }
            return ExportRequestDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _formato_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _filtros_decorators = [(0, swagger_1.ApiProperty)({ type: prestamo_mora_dto_1.PrestamosMoraFiltrosDto })];
            __esDecorate(null, null, _formato_decorators, { kind: "field", name: "formato", static: false, private: false, access: { has: function (obj) { return "formato" in obj; }, get: function (obj) { return obj.formato; }, set: function (obj, value) { obj.formato = value; } }, metadata: _metadata }, _formato_initializers, _formato_extraInitializers);
            __esDecorate(null, null, _filtros_decorators, { kind: "field", name: "filtros", static: false, private: false, access: { has: function (obj) { return "filtros" in obj; }, get: function (obj) { return obj.filtros; }, set: function (obj, value) { obj.filtros = value; } }, metadata: _metadata }, _filtros_initializers, _filtros_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.ExportRequestDto = ExportRequestDto;
