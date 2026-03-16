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
exports.RoutesController = void 0;
var common_1 = require("@nestjs/common");
var jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
var roles_guard_1 = require("../auth/guards/roles.guard");
var roles_decorator_1 = require("../auth/decorators/roles.decorator");
var client_1 = require("@prisma/client");
var swagger_1 = require("@nestjs/swagger");
var RoutesController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('routes'), (0, swagger_1.ApiBearerAuth)(), (0, common_1.Controller)('routes'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard)];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _create_decorators;
    var _findAll_decorators;
    var _getStatistics_decorators;
    var _getCobradores_decorators;
    var _getSupervisores_decorators;
    var _listarCreditosAsignadosACobrador_decorators;
    var _findOne_decorators;
    var _update_decorators;
    var _remove_decorators;
    var _toggleActive_decorators;
    var _assignClient_decorators;
    var _removeClient_decorators;
    var _moveClient_decorators;
    var _moveLoan_decorators;
    var _getDailyVisits_decorators;
    var _updateClientOrder_decorators;
    var _exportarRutaExcel_decorators;
    var _exportarRutaPdf_decorators;
    var RoutesController = _classThis = /** @class */ (function () {
        function RoutesController_1(routesService) {
            this.routesService = (__runInitializers(this, _instanceExtraInitializers), routesService);
        }
        RoutesController_1.prototype.create = function (createRouteDto) {
            return this.routesService.create(createRouteDto);
        };
        RoutesController_1.prototype.findAll = function (page, limit, search, activa, cobradorId, supervisorId) {
            var skip = page && limit ? (parseInt(page) - 1) * parseInt(limit) : undefined;
            var take = limit ? parseInt(limit) : undefined;
            var activaBool = activa ? activa === 'true' : undefined;
            return this.routesService.findAll({
                skip: skip,
                take: take,
                search: search,
                activa: activaBool,
                cobradorId: cobradorId,
                supervisorId: supervisorId,
            });
        };
        RoutesController_1.prototype.getStatistics = function () {
            return this.routesService.getStatistics();
        };
        RoutesController_1.prototype.getCobradores = function () {
            return this.routesService.getCobradores();
        };
        RoutesController_1.prototype.getSupervisores = function () {
            return this.routesService.getSupervisores();
        };
        RoutesController_1.prototype.listarCreditosAsignadosACobrador = function (id) {
            return this.routesService.listarCreditosAsignadosACobrador(id);
        };
        RoutesController_1.prototype.findOne = function (id) {
            return this.routesService.findOne(id);
        };
        RoutesController_1.prototype.update = function (id, updateRouteDto) {
            return this.routesService.update(id, updateRouteDto);
        };
        RoutesController_1.prototype.remove = function (id) {
            return this.routesService.remove(id);
        };
        RoutesController_1.prototype.toggleActive = function (id) {
            return this.routesService.toggleActive(id);
        };
        RoutesController_1.prototype.assignClient = function (id, clienteId, cobradorId) {
            return this.routesService.assignClient(id, clienteId, cobradorId);
        };
        RoutesController_1.prototype.removeClient = function (id, clienteId) {
            return this.routesService.removeClient(id, clienteId);
        };
        RoutesController_1.prototype.moveClient = function (clienteId, fromRutaId, toRutaId) {
            return this.routesService.moveClient(clienteId, fromRutaId, toRutaId);
        };
        RoutesController_1.prototype.moveLoan = function (prestamoId, toRutaId) {
            return this.routesService.moveLoan(prestamoId, toRutaId);
        };
        RoutesController_1.prototype.getDailyVisits = function (id, fecha) {
            return this.routesService.getDailyVisits(id, fecha);
        };
        RoutesController_1.prototype.updateClientOrder = function (id, orden) {
            return this.routesService.updateClientOrder(id, orden);
        };
        // ── Exportación de ruta ────────────────────────────────────────────────────
        RoutesController_1.prototype.exportarRutaExcel = function (id, res) {
            return __awaiter(this, void 0, void 0, function () {
                var buffer;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.routesService.exportarRuta(id, 'excel')];
                        case 1:
                            buffer = _a.sent();
                            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                            res.setHeader('Content-Disposition', "attachment; filename=\"ruta_".concat(id, ".xlsx\""));
                            res.send(buffer);
                            return [2 /*return*/];
                    }
                });
            });
        };
        RoutesController_1.prototype.exportarRutaPdf = function (id, res) {
            return __awaiter(this, void 0, void 0, function () {
                var buffer;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.routesService.exportarRuta(id, 'pdf')];
                        case 1:
                            buffer = _a.sent();
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', "attachment; filename=\"ruta_".concat(id, ".pdf\""));
                            res.send(buffer);
                            return [2 /*return*/];
                    }
                });
            });
        };
        return RoutesController_1;
    }());
    __setFunctionName(_classThis, "RoutesController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _create_decorators = [(0, common_1.Post)(), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR), (0, swagger_1.ApiOperation)({ summary: 'Crear una nueva ruta' }), (0, swagger_1.ApiResponse)({ status: 201, description: 'Ruta creada exitosamente' }), (0, swagger_1.ApiResponse)({ status: 400, description: 'Datos inválidos' }), (0, swagger_1.ApiResponse)({ status: 409, description: 'El código de ruta ya existe' })];
        _findAll_decorators = [(0, common_1.Get)(), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.COBRADOR, client_1.RolUsuario.PUNTO_DE_VENTA, client_1.RolUsuario.CONTADOR), (0, swagger_1.ApiOperation)({ summary: 'Obtener todas las rutas' }), (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }), (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }), (0, swagger_1.ApiQuery)({ name: 'search', required: false, type: String }), (0, swagger_1.ApiQuery)({ name: 'activa', required: false, type: Boolean }), (0, swagger_1.ApiQuery)({ name: 'cobradorId', required: false, type: String }), (0, swagger_1.ApiQuery)({ name: 'supervisorId', required: false, type: String }), (0, swagger_1.ApiResponse)({
                status: 200,
                description: 'Lista de rutas obtenida exitosamente',
            })];
        _getStatistics_decorators = [(0, common_1.Get)('statistics'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR), (0, swagger_1.ApiOperation)({ summary: 'Obtener estadísticas de rutas' }), (0, swagger_1.ApiResponse)({
                status: 200,
                description: 'Estadísticas obtenidas exitosamente',
            })];
        _getCobradores_decorators = [(0, common_1.Get)('cobradores'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR), (0, swagger_1.ApiOperation)({ summary: 'Obtener lista de cobradores disponibles' }), (0, swagger_1.ApiResponse)({
                status: 200,
                description: 'Lista de cobradores obtenida exitosamente',
            })];
        _getSupervisores_decorators = [(0, common_1.Get)('supervisores'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR), (0, swagger_1.ApiOperation)({ summary: 'Obtener lista de supervisores disponibles' }), (0, swagger_1.ApiResponse)({
                status: 200,
                description: 'Lista de supervisores obtenida exitosamente',
            })];
        _listarCreditosAsignadosACobrador_decorators = [(0, common_1.Get)('cobradores/:id/creditos-asignados'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COBRADOR), (0, swagger_1.ApiOperation)({ summary: 'Listar créditos asignados a un cobrador (Mis clientes)' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Listado de créditos asignados' })];
        _findOne_decorators = [(0, common_1.Get)(':id'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR, client_1.RolUsuario.COBRADOR), (0, swagger_1.ApiOperation)({ summary: 'Obtener una ruta por ID' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Ruta obtenida exitosamente' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Ruta no encontrada' })];
        _update_decorators = [(0, common_1.Patch)(':id'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR), (0, swagger_1.ApiOperation)({ summary: 'Actualizar una ruta' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Ruta actualizada exitosamente' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Ruta no encontrada' })];
        _remove_decorators = [(0, common_1.Delete)(':id'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR), (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT), (0, swagger_1.ApiOperation)({ summary: 'Eliminar una ruta (soft delete)' }), (0, swagger_1.ApiResponse)({ status: 204, description: 'Ruta eliminada exitosamente' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Ruta no encontrada' }), (0, swagger_1.ApiResponse)({
                status: 400,
                description: 'No se puede eliminar una ruta con clientes asignados',
            })];
        _toggleActive_decorators = [(0, common_1.Patch)(':id/toggle-active'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR), (0, swagger_1.ApiOperation)({ summary: 'Activar/desactivar una ruta' }), (0, swagger_1.ApiResponse)({
                status: 200,
                description: 'Estado de ruta cambiado exitosamente',
            }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Ruta no encontrada' })];
        _assignClient_decorators = [(0, common_1.Post)(':id/assign-client'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR), (0, swagger_1.ApiOperation)({ summary: 'Asignar cliente a una ruta' }), (0, swagger_1.ApiResponse)({ status: 201, description: 'Cliente asignado exitosamente' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Ruta o cliente no encontrado' }), (0, swagger_1.ApiResponse)({
                status: 409,
                description: 'El cliente ya está asignado a esta ruta',
            })];
        _removeClient_decorators = [(0, common_1.Delete)(':id/remove-client/:clienteId'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR), (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT), (0, swagger_1.ApiOperation)({ summary: 'Remover cliente de una ruta' }), (0, swagger_1.ApiResponse)({ status: 204, description: 'Cliente removido exitosamente' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Asignación no encontrada' })];
        _moveClient_decorators = [(0, common_1.Post)('move-client'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR), (0, swagger_1.ApiOperation)({ summary: 'Mover cliente entre rutas' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Cliente movido exitosamente' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Ruta o cliente no encontrado' }), (0, swagger_1.ApiResponse)({
                status: 409,
                description: 'El cliente ya está asignado a la ruta destino',
            })];
        _moveLoan_decorators = [(0, common_1.Post)('move-loan'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR), (0, swagger_1.ApiOperation)({ summary: 'Asignar un crédito específico a otra ruta' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Crédito asignado a la nueva ruta' })];
        _getDailyVisits_decorators = [(0, common_1.Get)(':id/daily-visits'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.COBRADOR, client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR), (0, swagger_1.ApiOperation)({ summary: 'Obtener visitas del día para una ruta' }), (0, swagger_1.ApiQuery)({ name: 'fecha', required: false, type: String, description: 'Fecha en formato YYYY-MM-DD' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Visitas del día obtenidas exitosamente' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Ruta no encontrada' })];
        _updateClientOrder_decorators = [(0, common_1.Patch)(':id/reorder'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.COBRADOR, client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR), (0, swagger_1.ApiOperation)({ summary: 'Actualizar orden de clientes en una ruta (drag & drop)' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Orden actualizado exitosamente' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Ruta no encontrada' })];
        _exportarRutaExcel_decorators = [(0, common_1.Get)(':id/export/excel'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.COBRADOR, client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR), (0, swagger_1.ApiOperation)({ summary: 'Exportar ruta completa como Excel (.xlsx)' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Archivo Excel de la ruta' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Ruta no encontrada' })];
        _exportarRutaPdf_decorators = [(0, common_1.Get)(':id/export/pdf'), (0, roles_decorator_1.Roles)(client_1.RolUsuario.COBRADOR, client_1.RolUsuario.SUPERVISOR, client_1.RolUsuario.COORDINADOR, client_1.RolUsuario.ADMIN, client_1.RolUsuario.SUPER_ADMINISTRADOR), (0, swagger_1.ApiOperation)({ summary: 'Exportar ruta completa como PDF' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Archivo PDF de la ruta' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Ruta no encontrada' })];
        __esDecorate(_classThis, null, _create_decorators, { kind: "method", name: "create", static: false, private: false, access: { has: function (obj) { return "create" in obj; }, get: function (obj) { return obj.create; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findAll_decorators, { kind: "method", name: "findAll", static: false, private: false, access: { has: function (obj) { return "findAll" in obj; }, get: function (obj) { return obj.findAll; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getStatistics_decorators, { kind: "method", name: "getStatistics", static: false, private: false, access: { has: function (obj) { return "getStatistics" in obj; }, get: function (obj) { return obj.getStatistics; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getCobradores_decorators, { kind: "method", name: "getCobradores", static: false, private: false, access: { has: function (obj) { return "getCobradores" in obj; }, get: function (obj) { return obj.getCobradores; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getSupervisores_decorators, { kind: "method", name: "getSupervisores", static: false, private: false, access: { has: function (obj) { return "getSupervisores" in obj; }, get: function (obj) { return obj.getSupervisores; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _listarCreditosAsignadosACobrador_decorators, { kind: "method", name: "listarCreditosAsignadosACobrador", static: false, private: false, access: { has: function (obj) { return "listarCreditosAsignadosACobrador" in obj; }, get: function (obj) { return obj.listarCreditosAsignadosACobrador; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findOne_decorators, { kind: "method", name: "findOne", static: false, private: false, access: { has: function (obj) { return "findOne" in obj; }, get: function (obj) { return obj.findOne; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _update_decorators, { kind: "method", name: "update", static: false, private: false, access: { has: function (obj) { return "update" in obj; }, get: function (obj) { return obj.update; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _remove_decorators, { kind: "method", name: "remove", static: false, private: false, access: { has: function (obj) { return "remove" in obj; }, get: function (obj) { return obj.remove; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _toggleActive_decorators, { kind: "method", name: "toggleActive", static: false, private: false, access: { has: function (obj) { return "toggleActive" in obj; }, get: function (obj) { return obj.toggleActive; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _assignClient_decorators, { kind: "method", name: "assignClient", static: false, private: false, access: { has: function (obj) { return "assignClient" in obj; }, get: function (obj) { return obj.assignClient; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _removeClient_decorators, { kind: "method", name: "removeClient", static: false, private: false, access: { has: function (obj) { return "removeClient" in obj; }, get: function (obj) { return obj.removeClient; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _moveClient_decorators, { kind: "method", name: "moveClient", static: false, private: false, access: { has: function (obj) { return "moveClient" in obj; }, get: function (obj) { return obj.moveClient; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _moveLoan_decorators, { kind: "method", name: "moveLoan", static: false, private: false, access: { has: function (obj) { return "moveLoan" in obj; }, get: function (obj) { return obj.moveLoan; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getDailyVisits_decorators, { kind: "method", name: "getDailyVisits", static: false, private: false, access: { has: function (obj) { return "getDailyVisits" in obj; }, get: function (obj) { return obj.getDailyVisits; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateClientOrder_decorators, { kind: "method", name: "updateClientOrder", static: false, private: false, access: { has: function (obj) { return "updateClientOrder" in obj; }, get: function (obj) { return obj.updateClientOrder; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _exportarRutaExcel_decorators, { kind: "method", name: "exportarRutaExcel", static: false, private: false, access: { has: function (obj) { return "exportarRutaExcel" in obj; }, get: function (obj) { return obj.exportarRutaExcel; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _exportarRutaPdf_decorators, { kind: "method", name: "exportarRutaPdf", static: false, private: false, access: { has: function (obj) { return "exportarRutaPdf" in obj; }, get: function (obj) { return obj.exportarRutaPdf; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        RoutesController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return RoutesController = _classThis;
}();
exports.RoutesController = RoutesController;
