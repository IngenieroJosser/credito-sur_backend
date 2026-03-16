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
exports.CreateClientDto = exports.CreateMultimediaDto = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var client_1 = require("@prisma/client");
var CreateMultimediaDto = function () {
    var _a;
    var _tipoContenido_decorators;
    var _tipoContenido_initializers = [];
    var _tipoContenido_extraInitializers = [];
    var _tipoArchivo_decorators;
    var _tipoArchivo_initializers = [];
    var _tipoArchivo_extraInitializers = [];
    var _nombreOriginal_decorators;
    var _nombreOriginal_initializers = [];
    var _nombreOriginal_extraInitializers = [];
    var _nombreAlmacenamiento_decorators;
    var _nombreAlmacenamiento_initializers = [];
    var _nombreAlmacenamiento_extraInitializers = [];
    var _ruta_decorators;
    var _ruta_initializers = [];
    var _ruta_extraInitializers = [];
    var _url_decorators;
    var _url_initializers = [];
    var _url_extraInitializers = [];
    var _tamanoBytes_decorators;
    var _tamanoBytes_initializers = [];
    var _tamanoBytes_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateMultimediaDto() {
                this.tipoContenido = __runInitializers(this, _tipoContenido_initializers, void 0);
                this.tipoArchivo = (__runInitializers(this, _tipoContenido_extraInitializers), __runInitializers(this, _tipoArchivo_initializers, void 0));
                this.nombreOriginal = (__runInitializers(this, _tipoArchivo_extraInitializers), __runInitializers(this, _nombreOriginal_initializers, void 0));
                this.nombreAlmacenamiento = (__runInitializers(this, _nombreOriginal_extraInitializers), __runInitializers(this, _nombreAlmacenamiento_initializers, void 0));
                this.ruta = (__runInitializers(this, _nombreAlmacenamiento_extraInitializers), __runInitializers(this, _ruta_initializers, void 0));
                this.url = (__runInitializers(this, _ruta_extraInitializers), __runInitializers(this, _url_initializers, void 0));
                this.tamanoBytes = (__runInitializers(this, _url_extraInitializers), __runInitializers(this, _tamanoBytes_initializers, void 0));
                __runInitializers(this, _tamanoBytes_extraInitializers);
            }
            return CreateMultimediaDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _tipoContenido_decorators = [(0, class_validator_1.IsEnum)([
                    'FOTO_PERFIL',
                    'DOCUMENTO_IDENTIDAD_FRENTE',
                    'DOCUMENTO_IDENTIDAD_REVERSO',
                    'COMPROBANTE_DOMICILIO',
                ]), (0, class_validator_1.IsNotEmpty)()];
            _tipoArchivo_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _nombreOriginal_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _nombreAlmacenamiento_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _ruta_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _url_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _tamanoBytes_decorators = [(0, class_validator_1.IsNumber)(), (0, class_validator_1.IsOptional)()];
            __esDecorate(null, null, _tipoContenido_decorators, { kind: "field", name: "tipoContenido", static: false, private: false, access: { has: function (obj) { return "tipoContenido" in obj; }, get: function (obj) { return obj.tipoContenido; }, set: function (obj, value) { obj.tipoContenido = value; } }, metadata: _metadata }, _tipoContenido_initializers, _tipoContenido_extraInitializers);
            __esDecorate(null, null, _tipoArchivo_decorators, { kind: "field", name: "tipoArchivo", static: false, private: false, access: { has: function (obj) { return "tipoArchivo" in obj; }, get: function (obj) { return obj.tipoArchivo; }, set: function (obj, value) { obj.tipoArchivo = value; } }, metadata: _metadata }, _tipoArchivo_initializers, _tipoArchivo_extraInitializers);
            __esDecorate(null, null, _nombreOriginal_decorators, { kind: "field", name: "nombreOriginal", static: false, private: false, access: { has: function (obj) { return "nombreOriginal" in obj; }, get: function (obj) { return obj.nombreOriginal; }, set: function (obj, value) { obj.nombreOriginal = value; } }, metadata: _metadata }, _nombreOriginal_initializers, _nombreOriginal_extraInitializers);
            __esDecorate(null, null, _nombreAlmacenamiento_decorators, { kind: "field", name: "nombreAlmacenamiento", static: false, private: false, access: { has: function (obj) { return "nombreAlmacenamiento" in obj; }, get: function (obj) { return obj.nombreAlmacenamiento; }, set: function (obj, value) { obj.nombreAlmacenamiento = value; } }, metadata: _metadata }, _nombreAlmacenamiento_initializers, _nombreAlmacenamiento_extraInitializers);
            __esDecorate(null, null, _ruta_decorators, { kind: "field", name: "ruta", static: false, private: false, access: { has: function (obj) { return "ruta" in obj; }, get: function (obj) { return obj.ruta; }, set: function (obj, value) { obj.ruta = value; } }, metadata: _metadata }, _ruta_initializers, _ruta_extraInitializers);
            __esDecorate(null, null, _url_decorators, { kind: "field", name: "url", static: false, private: false, access: { has: function (obj) { return "url" in obj; }, get: function (obj) { return obj.url; }, set: function (obj, value) { obj.url = value; } }, metadata: _metadata }, _url_initializers, _url_extraInitializers);
            __esDecorate(null, null, _tamanoBytes_decorators, { kind: "field", name: "tamanoBytes", static: false, private: false, access: { has: function (obj) { return "tamanoBytes" in obj; }, get: function (obj) { return obj.tamanoBytes; }, set: function (obj, value) { obj.tamanoBytes = value; } }, metadata: _metadata }, _tamanoBytes_initializers, _tamanoBytes_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateMultimediaDto = CreateMultimediaDto;
var CreateClientDto = function () {
    var _a;
    var _dni_decorators;
    var _dni_initializers = [];
    var _dni_extraInitializers = [];
    var _nombres_decorators;
    var _nombres_initializers = [];
    var _nombres_extraInitializers = [];
    var _apellidos_decorators;
    var _apellidos_initializers = [];
    var _apellidos_extraInitializers = [];
    var _telefono_decorators;
    var _telefono_initializers = [];
    var _telefono_extraInitializers = [];
    var _direccion_decorators;
    var _direccion_initializers = [];
    var _direccion_extraInitializers = [];
    var _referencia_decorators;
    var _referencia_initializers = [];
    var _referencia_extraInitializers = [];
    var _correo_decorators;
    var _correo_initializers = [];
    var _correo_extraInitializers = [];
    var _nivelRiesgo_decorators;
    var _nivelRiesgo_initializers = [];
    var _nivelRiesgo_extraInitializers = [];
    var _puntaje_decorators;
    var _puntaje_initializers = [];
    var _puntaje_extraInitializers = [];
    var _enListaNegra_decorators;
    var _enListaNegra_initializers = [];
    var _enListaNegra_extraInitializers = [];
    var _razonListaNegra_decorators;
    var _razonListaNegra_initializers = [];
    var _razonListaNegra_extraInitializers = [];
    var _rutaId_decorators;
    var _rutaId_initializers = [];
    var _rutaId_extraInitializers = [];
    var _observaciones_decorators;
    var _observaciones_initializers = [];
    var _observaciones_extraInitializers = [];
    var _creadoPorId_decorators;
    var _creadoPorId_initializers = [];
    var _creadoPorId_extraInitializers = [];
    var _archivos_decorators;
    var _archivos_initializers = [];
    var _archivos_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateClientDto() {
                this.dni = __runInitializers(this, _dni_initializers, void 0);
                this.nombres = (__runInitializers(this, _dni_extraInitializers), __runInitializers(this, _nombres_initializers, void 0));
                this.apellidos = (__runInitializers(this, _nombres_extraInitializers), __runInitializers(this, _apellidos_initializers, void 0));
                this.telefono = (__runInitializers(this, _apellidos_extraInitializers), __runInitializers(this, _telefono_initializers, void 0));
                this.direccion = (__runInitializers(this, _telefono_extraInitializers), __runInitializers(this, _direccion_initializers, void 0));
                this.referencia = (__runInitializers(this, _direccion_extraInitializers), __runInitializers(this, _referencia_initializers, void 0));
                this.correo = (__runInitializers(this, _referencia_extraInitializers), __runInitializers(this, _correo_initializers, void 0));
                this.nivelRiesgo = (__runInitializers(this, _correo_extraInitializers), __runInitializers(this, _nivelRiesgo_initializers, void 0));
                this.puntaje = (__runInitializers(this, _nivelRiesgo_extraInitializers), __runInitializers(this, _puntaje_initializers, void 0));
                this.enListaNegra = (__runInitializers(this, _puntaje_extraInitializers), __runInitializers(this, _enListaNegra_initializers, void 0));
                this.razonListaNegra = (__runInitializers(this, _enListaNegra_extraInitializers), __runInitializers(this, _razonListaNegra_initializers, void 0));
                this.rutaId = (__runInitializers(this, _razonListaNegra_extraInitializers), __runInitializers(this, _rutaId_initializers, void 0));
                this.observaciones = (__runInitializers(this, _rutaId_extraInitializers), __runInitializers(this, _observaciones_initializers, void 0));
                this.creadoPorId = (__runInitializers(this, _observaciones_extraInitializers), __runInitializers(this, _creadoPorId_initializers, void 0));
                this.archivos = (__runInitializers(this, _creadoPorId_extraInitializers), __runInitializers(this, _archivos_initializers, void 0));
                __runInitializers(this, _archivos_extraInitializers);
            }
            return CreateClientDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _dni_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.Matches)(/^\d+$/, { message: 'La Cédula debe contener solo números.' }), (0, class_validator_1.Length)(6, 10, { message: 'La Cédula debe tener entre 6 y 10 dígitos.' })];
            _nombres_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _apellidos_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _telefono_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _direccion_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _referencia_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _correo_decorators = [(0, class_validator_1.IsEmail)(), (0, class_validator_1.IsOptional)()];
            _nivelRiesgo_decorators = [(0, class_validator_1.IsEnum)(client_1.NivelRiesgo), (0, class_validator_1.IsOptional)()];
            _puntaje_decorators = [(0, class_validator_1.IsNumber)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.Min)(0), (0, class_validator_1.Max)(100)];
            _enListaNegra_decorators = [(0, class_validator_1.IsBoolean)(), (0, class_validator_1.IsOptional)()];
            _razonListaNegra_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _rutaId_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _observaciones_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _creadoPorId_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _archivos_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.ValidateNested)({ each: true }), (0, class_transformer_1.Type)(function () { return CreateMultimediaDto; })];
            __esDecorate(null, null, _dni_decorators, { kind: "field", name: "dni", static: false, private: false, access: { has: function (obj) { return "dni" in obj; }, get: function (obj) { return obj.dni; }, set: function (obj, value) { obj.dni = value; } }, metadata: _metadata }, _dni_initializers, _dni_extraInitializers);
            __esDecorate(null, null, _nombres_decorators, { kind: "field", name: "nombres", static: false, private: false, access: { has: function (obj) { return "nombres" in obj; }, get: function (obj) { return obj.nombres; }, set: function (obj, value) { obj.nombres = value; } }, metadata: _metadata }, _nombres_initializers, _nombres_extraInitializers);
            __esDecorate(null, null, _apellidos_decorators, { kind: "field", name: "apellidos", static: false, private: false, access: { has: function (obj) { return "apellidos" in obj; }, get: function (obj) { return obj.apellidos; }, set: function (obj, value) { obj.apellidos = value; } }, metadata: _metadata }, _apellidos_initializers, _apellidos_extraInitializers);
            __esDecorate(null, null, _telefono_decorators, { kind: "field", name: "telefono", static: false, private: false, access: { has: function (obj) { return "telefono" in obj; }, get: function (obj) { return obj.telefono; }, set: function (obj, value) { obj.telefono = value; } }, metadata: _metadata }, _telefono_initializers, _telefono_extraInitializers);
            __esDecorate(null, null, _direccion_decorators, { kind: "field", name: "direccion", static: false, private: false, access: { has: function (obj) { return "direccion" in obj; }, get: function (obj) { return obj.direccion; }, set: function (obj, value) { obj.direccion = value; } }, metadata: _metadata }, _direccion_initializers, _direccion_extraInitializers);
            __esDecorate(null, null, _referencia_decorators, { kind: "field", name: "referencia", static: false, private: false, access: { has: function (obj) { return "referencia" in obj; }, get: function (obj) { return obj.referencia; }, set: function (obj, value) { obj.referencia = value; } }, metadata: _metadata }, _referencia_initializers, _referencia_extraInitializers);
            __esDecorate(null, null, _correo_decorators, { kind: "field", name: "correo", static: false, private: false, access: { has: function (obj) { return "correo" in obj; }, get: function (obj) { return obj.correo; }, set: function (obj, value) { obj.correo = value; } }, metadata: _metadata }, _correo_initializers, _correo_extraInitializers);
            __esDecorate(null, null, _nivelRiesgo_decorators, { kind: "field", name: "nivelRiesgo", static: false, private: false, access: { has: function (obj) { return "nivelRiesgo" in obj; }, get: function (obj) { return obj.nivelRiesgo; }, set: function (obj, value) { obj.nivelRiesgo = value; } }, metadata: _metadata }, _nivelRiesgo_initializers, _nivelRiesgo_extraInitializers);
            __esDecorate(null, null, _puntaje_decorators, { kind: "field", name: "puntaje", static: false, private: false, access: { has: function (obj) { return "puntaje" in obj; }, get: function (obj) { return obj.puntaje; }, set: function (obj, value) { obj.puntaje = value; } }, metadata: _metadata }, _puntaje_initializers, _puntaje_extraInitializers);
            __esDecorate(null, null, _enListaNegra_decorators, { kind: "field", name: "enListaNegra", static: false, private: false, access: { has: function (obj) { return "enListaNegra" in obj; }, get: function (obj) { return obj.enListaNegra; }, set: function (obj, value) { obj.enListaNegra = value; } }, metadata: _metadata }, _enListaNegra_initializers, _enListaNegra_extraInitializers);
            __esDecorate(null, null, _razonListaNegra_decorators, { kind: "field", name: "razonListaNegra", static: false, private: false, access: { has: function (obj) { return "razonListaNegra" in obj; }, get: function (obj) { return obj.razonListaNegra; }, set: function (obj, value) { obj.razonListaNegra = value; } }, metadata: _metadata }, _razonListaNegra_initializers, _razonListaNegra_extraInitializers);
            __esDecorate(null, null, _rutaId_decorators, { kind: "field", name: "rutaId", static: false, private: false, access: { has: function (obj) { return "rutaId" in obj; }, get: function (obj) { return obj.rutaId; }, set: function (obj, value) { obj.rutaId = value; } }, metadata: _metadata }, _rutaId_initializers, _rutaId_extraInitializers);
            __esDecorate(null, null, _observaciones_decorators, { kind: "field", name: "observaciones", static: false, private: false, access: { has: function (obj) { return "observaciones" in obj; }, get: function (obj) { return obj.observaciones; }, set: function (obj, value) { obj.observaciones = value; } }, metadata: _metadata }, _observaciones_initializers, _observaciones_extraInitializers);
            __esDecorate(null, null, _creadoPorId_decorators, { kind: "field", name: "creadoPorId", static: false, private: false, access: { has: function (obj) { return "creadoPorId" in obj; }, get: function (obj) { return obj.creadoPorId; }, set: function (obj, value) { obj.creadoPorId = value; } }, metadata: _metadata }, _creadoPorId_initializers, _creadoPorId_extraInitializers);
            __esDecorate(null, null, _archivos_decorators, { kind: "field", name: "archivos", static: false, private: false, access: { has: function (obj) { return "archivos" in obj; }, get: function (obj) { return obj.archivos; }, set: function (obj, value) { obj.archivos = value; } }, metadata: _metadata }, _archivos_initializers, _archivos_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateClientDto = CreateClientDto;
