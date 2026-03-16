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
exports.ClientsController = void 0;
var common_1 = require("@nestjs/common");
var swagger_1 = require("@nestjs/swagger");
var jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
var roles_guard_1 = require("../auth/guards/roles.guard");
var client_1 = require("@prisma/client");
var roles_decorator_1 = require("../auth/decorators/roles.decorator");
var ClientsController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('clients'), (0, common_1.Controller)('clients'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard)];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _update_decorators;
    var _remove_decorators;
    var _restore_decorators;
    var _getAllClients_decorators;
    var _getClientById_decorators;
    var _createClient_decorators;
    var _approveClient_decorators;
    var _rejectClient_decorators;
    var _updateClient_decorators;
    var _addToBlacklist_decorators;
    var _removeFromBlacklist_decorators;
    var _assignToRoute_decorators;
    var _exportarClientes_decorators;
    var ClientsController = _classThis = /** @class */ (function () {
        function ClientsController_1(clientsService) {
            this.clientsService = (__runInitializers(this, _instanceExtraInitializers), clientsService);
            this.logger = new common_1.Logger(ClientsController.name);
        }
        ClientsController_1.prototype.update = function (id, updateClientDto) {
            return this.clientsService.update(id, updateClientDto);
        };
        ClientsController_1.prototype.remove = function (id, req) {
            var userId = req.user.id;
            return this.clientsService.remove(id, userId);
        };
        ClientsController_1.prototype.restore = function (id, req) {
            var userId = req.user.id;
            return this.clientsService.restore(id, userId);
        };
        ClientsController_1.prototype.getAllClients = function (nivelRiesgo, ruta, search) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.clientsService.getAllClients({
                            nivelRiesgo: nivelRiesgo || 'all',
                            ruta: ruta || '',
                            search: search || '',
                        })];
                });
            });
        };
        ClientsController_1.prototype.getClientById = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.clientsService.getClientById(id)];
                });
            });
        };
        ClientsController_1.prototype.createClient = function (body) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    this.logger.log("Creando cliente con datos: ".concat(JSON.stringify(body)));
                    // Si viene creadoPorId en el body, lo usamos, si no el service intentará buscar uno (hack actual)
                    return [2 /*return*/, this.clientsService.createClient(body)];
                });
            });
        };
        ClientsController_1.prototype.approveClient = function (id, body) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.clientsService.approveClient(id, body.aprobadoPorId, body.datosAprobados)];
                });
            });
        };
        ClientsController_1.prototype.rejectClient = function (id, body) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.clientsService.rejectClient(id, body.rechazadoPorId, body.razon)];
                });
            });
        };
        ClientsController_1.prototype.updateClient = function (id, body) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.clientsService.updateClient(id, {
                            nombres: body.nombres,
                            apellidos: body.apellidos,
                            telefono: body.telefono,
                            correo: body.correo,
                            direccion: body.direccion,
                            referencia: body.referencia,
                            nivelRiesgo: body.nivelRiesgo,
                            archivos: body.archivos,
                        })];
                });
            });
        };
        ClientsController_1.prototype.addToBlacklist = function (id, body) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.clientsService.addToBlacklist(id, body.razon, body.agregadoPorId)];
                });
            });
        };
        ClientsController_1.prototype.removeFromBlacklist = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.clientsService.removeFromBlacklist(id)];
                });
            });
        };
        ClientsController_1.prototype.assignToRoute = function (clienteId, body) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.clientsService.assignToRoute(clienteId, body.rutaId, body.cobradorId, body.diaSemana)];
                });
            });
        };
        /**
         * GET /clients/export?format=excel|pdf
         * Exporta el listado completo de clientes con filtros opcionales.
         */
        ClientsController_1.prototype.exportarClientes = function (res, format, nivelRiesgo, ruta, search) {
            return __awaiter(this, void 0, void 0, function () {
                var result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.clientsService.exportarClientes(format === 'pdf' ? 'pdf' : 'excel', { nivelRiesgo: nivelRiesgo, ruta: ruta, search: search })];
                        case 1:
                            result = _a.sent();
                            res.setHeader('Content-Type', result.contentType);
                            res.setHeader('Content-Disposition', "attachment; filename=\"".concat(result.filename, "\""));
                            res.send(result.data);
                            return [2 /*return*/];
                    }
                });
            });
        };
        return ClientsController_1;
    }());
    __setFunctionName(_classThis, "ClientsController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _update_decorators = [(0, common_1.Patch)(':id')];
        _remove_decorators = [(0, common_1.Delete)(':id'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR)];
        _restore_decorators = [(0, common_1.Patch)(':id/restore'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR)];
        _getAllClients_decorators = [(0, common_1.Get)(), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COBRADOR, client_1.RolUsuario.CONTADOR, client_1.RolUsuario.PUNTO_DE_VENTA)];
        _getClientById_decorators = [(0, common_1.Get)(':id'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COBRADOR, client_1.RolUsuario.CONTADOR, client_1.RolUsuario.PUNTO_DE_VENTA)];
        _createClient_decorators = [(0, common_1.Post)(), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.PUNTO_DE_VENTA)];
        _approveClient_decorators = [(0, common_1.Post)('approve/:id'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR)];
        _rejectClient_decorators = [(0, common_1.Post)('reject/:id'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR)];
        _updateClient_decorators = [(0, common_1.Put)(':id'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR)];
        _addToBlacklist_decorators = [(0, common_1.Post)(':id/blacklist'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.COORDINADOR)];
        _removeFromBlacklist_decorators = [(0, common_1.Delete)(':id/blacklist'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.COORDINADOR)];
        _assignToRoute_decorators = [(0, common_1.Post)(':id/assign-route'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.COORDINADOR)];
        _exportarClientes_decorators = [(0, common_1.Get)('export'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.CONTADOR), (0, swagger_1.ApiOperation)({ summary: 'Exportar listado de clientes en Excel o PDF' }), (0, swagger_1.ApiQuery)({ name: 'format', enum: ['excel', 'pdf'], required: true }), (0, swagger_1.ApiQuery)({ name: 'nivelRiesgo', required: false }), (0, swagger_1.ApiQuery)({ name: 'ruta', required: false }), (0, swagger_1.ApiQuery)({ name: 'search', required: false }), (0, common_1.HttpCode)(common_1.HttpStatus.OK)];
        __esDecorate(_classThis, null, _update_decorators, { kind: "method", name: "update", static: false, private: false, access: { has: function (obj) { return "update" in obj; }, get: function (obj) { return obj.update; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _remove_decorators, { kind: "method", name: "remove", static: false, private: false, access: { has: function (obj) { return "remove" in obj; }, get: function (obj) { return obj.remove; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _restore_decorators, { kind: "method", name: "restore", static: false, private: false, access: { has: function (obj) { return "restore" in obj; }, get: function (obj) { return obj.restore; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getAllClients_decorators, { kind: "method", name: "getAllClients", static: false, private: false, access: { has: function (obj) { return "getAllClients" in obj; }, get: function (obj) { return obj.getAllClients; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getClientById_decorators, { kind: "method", name: "getClientById", static: false, private: false, access: { has: function (obj) { return "getClientById" in obj; }, get: function (obj) { return obj.getClientById; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _createClient_decorators, { kind: "method", name: "createClient", static: false, private: false, access: { has: function (obj) { return "createClient" in obj; }, get: function (obj) { return obj.createClient; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _approveClient_decorators, { kind: "method", name: "approveClient", static: false, private: false, access: { has: function (obj) { return "approveClient" in obj; }, get: function (obj) { return obj.approveClient; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _rejectClient_decorators, { kind: "method", name: "rejectClient", static: false, private: false, access: { has: function (obj) { return "rejectClient" in obj; }, get: function (obj) { return obj.rejectClient; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateClient_decorators, { kind: "method", name: "updateClient", static: false, private: false, access: { has: function (obj) { return "updateClient" in obj; }, get: function (obj) { return obj.updateClient; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _addToBlacklist_decorators, { kind: "method", name: "addToBlacklist", static: false, private: false, access: { has: function (obj) { return "addToBlacklist" in obj; }, get: function (obj) { return obj.addToBlacklist; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _removeFromBlacklist_decorators, { kind: "method", name: "removeFromBlacklist", static: false, private: false, access: { has: function (obj) { return "removeFromBlacklist" in obj; }, get: function (obj) { return obj.removeFromBlacklist; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _assignToRoute_decorators, { kind: "method", name: "assignToRoute", static: false, private: false, access: { has: function (obj) { return "assignToRoute" in obj; }, get: function (obj) { return obj.assignToRoute; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _exportarClientes_decorators, { kind: "method", name: "exportarClientes", static: false, private: false, access: { has: function (obj) { return "exportarClientes" in obj; }, get: function (obj) { return obj.exportarClientes; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ClientsController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ClientsController = _classThis;
}();
exports.ClientsController = ClientsController;
