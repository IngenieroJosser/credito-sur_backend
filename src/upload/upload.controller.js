"use strict";
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadController = void 0;
var common_1 = require("@nestjs/common");
var platform_express_1 = require("@nestjs/platform-express");
var multer_1 = require("multer");
var swagger_1 = require("@nestjs/swagger");
var jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
var roles_guard_1 = require("../auth/guards/roles.guard");
var roles_decorator_1 = require("../auth/decorators/roles.decorator");
var client_1 = require("@prisma/client");
// ─── Tipos de archivos permitidos ─────────────────────────────────────────────
var EXTENSIONES_PERMITIDAS = /\.(jpg|jpeg|png|gif|mp4|webm|pdf)$/i;
var TAMANO_MAX_BYTES = 50 * 1024 * 1024; // 50 MB
var UploadController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('Uploads'), (0, common_1.Controller)('uploads'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard)];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _uploadFile_decorators;
    var _serveFile_decorators;
    var UploadController = _classThis = /** @class */ (function () {
        function UploadController_1(cloudinaryService) {
            this.cloudinaryService = (__runInitializers(this, _instanceExtraInitializers), cloudinaryService);
        }
        UploadController_1.prototype.uploadFile = function (file, body) {
            return __awaiter(this, void 0, void 0, function () {
                var sanitize, nombres, apellidos, dni, dniLast4, clientPart, clientLabel, groupFolder, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!file)
                                throw new common_1.BadRequestException('El archivo es requerido');
                            sanitize = function (v) {
                                return (v || '').toLowerCase()
                                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                                    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
                            };
                            nombres = sanitize(body === null || body === void 0 ? void 0 : body.nombres);
                            apellidos = sanitize(body === null || body === void 0 ? void 0 : body.apellidos);
                            dni = ((body === null || body === void 0 ? void 0 : body.dni) || '').replace(/\D/g, '');
                            dniLast4 = dni ? dni.slice(-4) : '';
                            clientPart = (body === null || body === void 0 ? void 0 : body.clienteId) ? body.clienteId : dni ? "cc-".concat(dni) : 'tmp';
                            clientLabel = [clientPart, nombres, apellidos, dniLast4].filter(Boolean).join('-');
                            groupFolder = (body === null || body === void 0 ? void 0 : body.tipoContenido) === 'FOTO_PERFIL' ? 'perfil'
                                : file.mimetype.startsWith('video/') ? 'videos'
                                    : 'documentos';
                            return [4 /*yield*/, this.cloudinaryService.subirArchivo(file, {
                                    folder: "clientes/".concat(clientLabel, "/").concat(groupFolder),
                                })];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/, {
                                    filename: result.publicId,
                                    originalName: file.originalname,
                                    publicId: result.publicId,
                                    path: result.url,
                                    mimetype: file.mimetype,
                                    size: result.tamanoBytes,
                                }];
                    }
                });
            });
        };
        UploadController_1.prototype.serveFile = function (filename, res) {
            res.sendFile(filename, { root: './uploads' });
        };
        return UploadController_1;
    }());
    __setFunctionName(_classThis, "UploadController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _uploadFile_decorators = [(0, common_1.Post)(), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR), (0, swagger_1.ApiOperation)({ summary: 'Subir un archivo (imagen, video o PDF) a Cloudinary' }), (0, swagger_1.ApiConsumes)('multipart/form-data'), (0, swagger_1.ApiBody)({
                schema: {
                    type: 'object',
                    properties: {
                        file: { type: 'string', format: 'binary' },
                        clienteId: { type: 'string' },
                        dni: { type: 'string' },
                        nombres: { type: 'string' },
                        apellidos: { type: 'string' },
                        tipoContenido: { type: 'string' },
                    },
                },
            }), (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
                storage: (0, multer_1.memoryStorage)(),
                fileFilter: function (_req, file, cb) {
                    if (!file.originalname.match(EXTENSIONES_PERMITIDAS)) {
                        return cb(new common_1.BadRequestException('Solo se permiten archivos de imagen, video o PDF'), false);
                    }
                    cb(null, true);
                },
                limits: { fileSize: TAMANO_MAX_BYTES },
            }))];
        _serveFile_decorators = [(0, common_1.Get)(':filename'), (0, swagger_1.ApiOperation)({ summary: 'Obtener un archivo subido localmente' })];
        __esDecorate(_classThis, null, _uploadFile_decorators, { kind: "method", name: "uploadFile", static: false, private: false, access: { has: function (obj) { return "uploadFile" in obj; }, get: function (obj) { return obj.uploadFile; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _serveFile_decorators, { kind: "method", name: "serveFile", static: false, private: false, access: { has: function (obj) { return "serveFile" in obj; }, get: function (obj) { return obj.serveFile; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        UploadController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return UploadController = _classThis;
}();
exports.UploadController = UploadController;
