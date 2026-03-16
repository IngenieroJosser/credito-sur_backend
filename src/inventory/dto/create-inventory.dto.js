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
exports.CreateInventoryDto = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var CreatePrecioDto = function () {
    var _a;
    var _meses_decorators;
    var _meses_initializers = [];
    var _meses_extraInitializers = [];
    var _precio_decorators;
    var _precio_initializers = [];
    var _precio_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreatePrecioDto() {
                this.meses = __runInitializers(this, _meses_initializers, void 0);
                this.precio = (__runInitializers(this, _meses_extraInitializers), __runInitializers(this, _precio_initializers, void 0));
                __runInitializers(this, _precio_extraInitializers);
            }
            return CreatePrecioDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _meses_decorators = [(0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(1)];
            _precio_decorators = [(0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(0)];
            __esDecorate(null, null, _meses_decorators, { kind: "field", name: "meses", static: false, private: false, access: { has: function (obj) { return "meses" in obj; }, get: function (obj) { return obj.meses; }, set: function (obj, value) { obj.meses = value; } }, metadata: _metadata }, _meses_initializers, _meses_extraInitializers);
            __esDecorate(null, null, _precio_decorators, { kind: "field", name: "precio", static: false, private: false, access: { has: function (obj) { return "precio" in obj; }, get: function (obj) { return obj.precio; }, set: function (obj, value) { obj.precio = value; } }, metadata: _metadata }, _precio_initializers, _precio_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
var CreateInventoryDto = function () {
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
    var _categoria_decorators;
    var _categoria_initializers = [];
    var _categoria_extraInitializers = [];
    var _categoriaId_decorators;
    var _categoriaId_initializers = [];
    var _categoriaId_extraInitializers = [];
    var _marca_decorators;
    var _marca_initializers = [];
    var _marca_extraInitializers = [];
    var _modelo_decorators;
    var _modelo_initializers = [];
    var _modelo_extraInitializers = [];
    var _costo_decorators;
    var _costo_initializers = [];
    var _costo_extraInitializers = [];
    var _precioContado_decorators;
    var _precioContado_initializers = [];
    var _precioContado_extraInitializers = [];
    var _stock_decorators;
    var _stock_initializers = [];
    var _stock_extraInitializers = [];
    var _stockMinimo_decorators;
    var _stockMinimo_initializers = [];
    var _stockMinimo_extraInitializers = [];
    var _activo_decorators;
    var _activo_initializers = [];
    var _activo_extraInitializers = [];
    var _precios_decorators;
    var _precios_initializers = [];
    var _precios_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateInventoryDto() {
                this.codigo = __runInitializers(this, _codigo_initializers, void 0);
                this.nombre = (__runInitializers(this, _codigo_extraInitializers), __runInitializers(this, _nombre_initializers, void 0));
                this.descripcion = (__runInitializers(this, _nombre_extraInitializers), __runInitializers(this, _descripcion_initializers, void 0));
                this.categoria = (__runInitializers(this, _descripcion_extraInitializers), __runInitializers(this, _categoria_initializers, void 0));
                this.categoriaId = (__runInitializers(this, _categoria_extraInitializers), __runInitializers(this, _categoriaId_initializers, void 0));
                this.marca = (__runInitializers(this, _categoriaId_extraInitializers), __runInitializers(this, _marca_initializers, void 0));
                this.modelo = (__runInitializers(this, _marca_extraInitializers), __runInitializers(this, _modelo_initializers, void 0));
                this.costo = (__runInitializers(this, _modelo_extraInitializers), __runInitializers(this, _costo_initializers, void 0));
                this.precioContado = (__runInitializers(this, _costo_extraInitializers), __runInitializers(this, _precioContado_initializers, void 0)); // Optional until schema supports it or we use logic
                this.stock = (__runInitializers(this, _precioContado_extraInitializers), __runInitializers(this, _stock_initializers, void 0));
                this.stockMinimo = (__runInitializers(this, _stock_extraInitializers), __runInitializers(this, _stockMinimo_initializers, void 0));
                this.activo = (__runInitializers(this, _stockMinimo_extraInitializers), __runInitializers(this, _activo_initializers, void 0));
                this.precios = (__runInitializers(this, _activo_extraInitializers), __runInitializers(this, _precios_initializers, void 0));
                __runInitializers(this, _precios_extraInitializers);
            }
            return CreateInventoryDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _codigo_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _nombre_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _descripcion_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _categoria_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _categoriaId_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _marca_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _modelo_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _costo_decorators = [(0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(0)];
            _precioContado_decorators = [(0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(0), (0, class_validator_1.IsOptional)()];
            _stock_decorators = [(0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(0)];
            _stockMinimo_decorators = [(0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(0)];
            _activo_decorators = [(0, class_validator_1.IsBoolean)(), (0, class_validator_1.IsOptional)()];
            _precios_decorators = [(0, class_validator_1.IsArray)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.ValidateNested)({ each: true }), (0, class_transformer_1.Type)(function () { return CreatePrecioDto; })];
            __esDecorate(null, null, _codigo_decorators, { kind: "field", name: "codigo", static: false, private: false, access: { has: function (obj) { return "codigo" in obj; }, get: function (obj) { return obj.codigo; }, set: function (obj, value) { obj.codigo = value; } }, metadata: _metadata }, _codigo_initializers, _codigo_extraInitializers);
            __esDecorate(null, null, _nombre_decorators, { kind: "field", name: "nombre", static: false, private: false, access: { has: function (obj) { return "nombre" in obj; }, get: function (obj) { return obj.nombre; }, set: function (obj, value) { obj.nombre = value; } }, metadata: _metadata }, _nombre_initializers, _nombre_extraInitializers);
            __esDecorate(null, null, _descripcion_decorators, { kind: "field", name: "descripcion", static: false, private: false, access: { has: function (obj) { return "descripcion" in obj; }, get: function (obj) { return obj.descripcion; }, set: function (obj, value) { obj.descripcion = value; } }, metadata: _metadata }, _descripcion_initializers, _descripcion_extraInitializers);
            __esDecorate(null, null, _categoria_decorators, { kind: "field", name: "categoria", static: false, private: false, access: { has: function (obj) { return "categoria" in obj; }, get: function (obj) { return obj.categoria; }, set: function (obj, value) { obj.categoria = value; } }, metadata: _metadata }, _categoria_initializers, _categoria_extraInitializers);
            __esDecorate(null, null, _categoriaId_decorators, { kind: "field", name: "categoriaId", static: false, private: false, access: { has: function (obj) { return "categoriaId" in obj; }, get: function (obj) { return obj.categoriaId; }, set: function (obj, value) { obj.categoriaId = value; } }, metadata: _metadata }, _categoriaId_initializers, _categoriaId_extraInitializers);
            __esDecorate(null, null, _marca_decorators, { kind: "field", name: "marca", static: false, private: false, access: { has: function (obj) { return "marca" in obj; }, get: function (obj) { return obj.marca; }, set: function (obj, value) { obj.marca = value; } }, metadata: _metadata }, _marca_initializers, _marca_extraInitializers);
            __esDecorate(null, null, _modelo_decorators, { kind: "field", name: "modelo", static: false, private: false, access: { has: function (obj) { return "modelo" in obj; }, get: function (obj) { return obj.modelo; }, set: function (obj, value) { obj.modelo = value; } }, metadata: _metadata }, _modelo_initializers, _modelo_extraInitializers);
            __esDecorate(null, null, _costo_decorators, { kind: "field", name: "costo", static: false, private: false, access: { has: function (obj) { return "costo" in obj; }, get: function (obj) { return obj.costo; }, set: function (obj, value) { obj.costo = value; } }, metadata: _metadata }, _costo_initializers, _costo_extraInitializers);
            __esDecorate(null, null, _precioContado_decorators, { kind: "field", name: "precioContado", static: false, private: false, access: { has: function (obj) { return "precioContado" in obj; }, get: function (obj) { return obj.precioContado; }, set: function (obj, value) { obj.precioContado = value; } }, metadata: _metadata }, _precioContado_initializers, _precioContado_extraInitializers);
            __esDecorate(null, null, _stock_decorators, { kind: "field", name: "stock", static: false, private: false, access: { has: function (obj) { return "stock" in obj; }, get: function (obj) { return obj.stock; }, set: function (obj, value) { obj.stock = value; } }, metadata: _metadata }, _stock_initializers, _stock_extraInitializers);
            __esDecorate(null, null, _stockMinimo_decorators, { kind: "field", name: "stockMinimo", static: false, private: false, access: { has: function (obj) { return "stockMinimo" in obj; }, get: function (obj) { return obj.stockMinimo; }, set: function (obj, value) { obj.stockMinimo = value; } }, metadata: _metadata }, _stockMinimo_initializers, _stockMinimo_extraInitializers);
            __esDecorate(null, null, _activo_decorators, { kind: "field", name: "activo", static: false, private: false, access: { has: function (obj) { return "activo" in obj; }, get: function (obj) { return obj.activo; }, set: function (obj, value) { obj.activo = value; } }, metadata: _metadata }, _activo_initializers, _activo_extraInitializers);
            __esDecorate(null, null, _precios_decorators, { kind: "field", name: "precios", static: false, private: false, access: { has: function (obj) { return "precios" in obj; }, get: function (obj) { return obj.precios; }, set: function (obj, value) { obj.precios = value; } }, metadata: _metadata }, _precios_initializers, _precios_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateInventoryDto = CreateInventoryDto;
