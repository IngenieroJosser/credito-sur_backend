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
exports.CreateSyncConflictDto = void 0;
var class_validator_1 = require("class-validator");
var CreateSyncConflictDto = function () {
    var _a;
    var _entidad_decorators;
    var _entidad_initializers = [];
    var _entidad_extraInitializers = [];
    var _operacion_decorators;
    var _operacion_initializers = [];
    var _operacion_extraInitializers = [];
    var _datos_decorators;
    var _datos_initializers = [];
    var _datos_extraInitializers = [];
    var _errorMotivo_decorators;
    var _errorMotivo_initializers = [];
    var _errorMotivo_extraInitializers = [];
    var _statusCode_decorators;
    var _statusCode_initializers = [];
    var _statusCode_extraInitializers = [];
    var _endpoint_decorators;
    var _endpoint_initializers = [];
    var _endpoint_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateSyncConflictDto() {
                this.entidad = __runInitializers(this, _entidad_initializers, void 0);
                this.operacion = (__runInitializers(this, _entidad_extraInitializers), __runInitializers(this, _operacion_initializers, void 0));
                this.datos = (__runInitializers(this, _operacion_extraInitializers), __runInitializers(this, _datos_initializers, void 0));
                this.errorMotivo = (__runInitializers(this, _datos_extraInitializers), __runInitializers(this, _errorMotivo_initializers, void 0));
                this.statusCode = (__runInitializers(this, _errorMotivo_extraInitializers), __runInitializers(this, _statusCode_initializers, void 0));
                this.endpoint = (__runInitializers(this, _statusCode_extraInitializers), __runInitializers(this, _endpoint_initializers, void 0));
                __runInitializers(this, _endpoint_extraInitializers);
            }
            return CreateSyncConflictDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _entidad_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _operacion_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _datos_decorators = [(0, class_validator_1.IsNotEmpty)()];
            _errorMotivo_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _statusCode_decorators = [(0, class_validator_1.IsInt)(), (0, class_validator_1.IsOptional)()];
            _endpoint_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            __esDecorate(null, null, _entidad_decorators, { kind: "field", name: "entidad", static: false, private: false, access: { has: function (obj) { return "entidad" in obj; }, get: function (obj) { return obj.entidad; }, set: function (obj, value) { obj.entidad = value; } }, metadata: _metadata }, _entidad_initializers, _entidad_extraInitializers);
            __esDecorate(null, null, _operacion_decorators, { kind: "field", name: "operacion", static: false, private: false, access: { has: function (obj) { return "operacion" in obj; }, get: function (obj) { return obj.operacion; }, set: function (obj, value) { obj.operacion = value; } }, metadata: _metadata }, _operacion_initializers, _operacion_extraInitializers);
            __esDecorate(null, null, _datos_decorators, { kind: "field", name: "datos", static: false, private: false, access: { has: function (obj) { return "datos" in obj; }, get: function (obj) { return obj.datos; }, set: function (obj, value) { obj.datos = value; } }, metadata: _metadata }, _datos_initializers, _datos_extraInitializers);
            __esDecorate(null, null, _errorMotivo_decorators, { kind: "field", name: "errorMotivo", static: false, private: false, access: { has: function (obj) { return "errorMotivo" in obj; }, get: function (obj) { return obj.errorMotivo; }, set: function (obj, value) { obj.errorMotivo = value; } }, metadata: _metadata }, _errorMotivo_initializers, _errorMotivo_extraInitializers);
            __esDecorate(null, null, _statusCode_decorators, { kind: "field", name: "statusCode", static: false, private: false, access: { has: function (obj) { return "statusCode" in obj; }, get: function (obj) { return obj.statusCode; }, set: function (obj, value) { obj.statusCode = value; } }, metadata: _metadata }, _statusCode_initializers, _statusCode_extraInitializers);
            __esDecorate(null, null, _endpoint_decorators, { kind: "field", name: "endpoint", static: false, private: false, access: { has: function (obj) { return "endpoint" in obj; }, get: function (obj) { return obj.endpoint; }, set: function (obj, value) { obj.endpoint = value; } }, metadata: _metadata }, _endpoint_initializers, _endpoint_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateSyncConflictDto = CreateSyncConflictDto;
