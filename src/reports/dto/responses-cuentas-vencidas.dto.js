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
exports.CuentasVencidasResponseDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var cuentas_vencidas_dto_1 = require("./cuentas-vencidas.dto");
var CuentasVencidasResponseDto = function () {
    var _a;
    var _cuentas_decorators;
    var _cuentas_initializers = [];
    var _cuentas_extraInitializers = [];
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
            function CuentasVencidasResponseDto() {
                this.cuentas = __runInitializers(this, _cuentas_initializers, void 0);
                this.totales = (__runInitializers(this, _cuentas_extraInitializers), __runInitializers(this, _totales_initializers, void 0));
                this.total = (__runInitializers(this, _totales_extraInitializers), __runInitializers(this, _total_initializers, void 0));
                this.pagina = (__runInitializers(this, _total_extraInitializers), __runInitializers(this, _pagina_initializers, void 0));
                this.limite = (__runInitializers(this, _pagina_extraInitializers), __runInitializers(this, _limite_initializers, void 0));
                __runInitializers(this, _limite_extraInitializers);
            }
            return CuentasVencidasResponseDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _cuentas_decorators = [(0, swagger_1.ApiProperty)({ type: [cuentas_vencidas_dto_1.CuentaVencidaDto] })];
            _totales_decorators = [(0, swagger_1.ApiProperty)()];
            _total_decorators = [(0, swagger_1.ApiProperty)()];
            _pagina_decorators = [(0, swagger_1.ApiProperty)()];
            _limite_decorators = [(0, swagger_1.ApiProperty)()];
            __esDecorate(null, null, _cuentas_decorators, { kind: "field", name: "cuentas", static: false, private: false, access: { has: function (obj) { return "cuentas" in obj; }, get: function (obj) { return obj.cuentas; }, set: function (obj, value) { obj.cuentas = value; } }, metadata: _metadata }, _cuentas_initializers, _cuentas_extraInitializers);
            __esDecorate(null, null, _totales_decorators, { kind: "field", name: "totales", static: false, private: false, access: { has: function (obj) { return "totales" in obj; }, get: function (obj) { return obj.totales; }, set: function (obj, value) { obj.totales = value; } }, metadata: _metadata }, _totales_initializers, _totales_extraInitializers);
            __esDecorate(null, null, _total_decorators, { kind: "field", name: "total", static: false, private: false, access: { has: function (obj) { return "total" in obj; }, get: function (obj) { return obj.total; }, set: function (obj, value) { obj.total = value; } }, metadata: _metadata }, _total_initializers, _total_extraInitializers);
            __esDecorate(null, null, _pagina_decorators, { kind: "field", name: "pagina", static: false, private: false, access: { has: function (obj) { return "pagina" in obj; }, get: function (obj) { return obj.pagina; }, set: function (obj, value) { obj.pagina = value; } }, metadata: _metadata }, _pagina_initializers, _pagina_extraInitializers);
            __esDecorate(null, null, _limite_decorators, { kind: "field", name: "limite", static: false, private: false, access: { has: function (obj) { return "limite" in obj; }, get: function (obj) { return obj.limite; }, set: function (obj, value) { obj.limite = value; } }, metadata: _metadata }, _limite_initializers, _limite_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CuentasVencidasResponseDto = CuentasVencidasResponseDto;
