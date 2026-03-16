"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.NotificacionesGateway = void 0;
var websockets_1 = require("@nestjs/websockets");
var common_1 = require("@nestjs/common");
var NotificacionesGateway = function () {
    var _classDecorators = [(0, websockets_1.WebSocketGateway)({
            cors: {
                origin: [
                    'http://localhost:3000',
                    'http://127.0.0.1:3000',
                    'https://credito-sur-frontend.onrender.com',
                    'https://creditos-del-sur.vercel.app',
                ],
                credentials: true,
            },
            transports: ['websocket', 'polling'],
        })];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _server_decorators;
    var _server_initializers = [];
    var _server_extraInitializers = [];
    var _handleRegister_decorators;
    var _handleRutaCompletadaEmit_decorators;
    var NotificacionesGateway = _classThis = /** @class */ (function () {
        function NotificacionesGateway_1(notificacionesService) {
            this.notificacionesService = (__runInitializers(this, _instanceExtraInitializers), notificacionesService);
            this.server = __runInitializers(this, _server_initializers, void 0);
            this.logger = (__runInitializers(this, _server_extraInitializers), new common_1.Logger('NotificacionesGateway'));
            // Almacenar el mapeo de userId -> socketId(s)
            this.userSockets = new Map();
        }
        NotificacionesGateway_1.prototype.afterInit = function (server) {
            this.logger.log('WebSocket Gateway Inicializado');
        };
        NotificacionesGateway_1.prototype.handleConnection = function (client) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            // Al principio, no sabemos quién es. Esperamos a que el cliente lo diga.
            this.logger.log("Cliente conectado: ".concat(client.id));
        };
        NotificacionesGateway_1.prototype.handleDisconnect = function (client) {
            this.logger.log("Cliente desconectado: ".concat(client.id));
            // Limpiar el socket de los registros de usuario
            for (var _i = 0, _a = this.userSockets.entries(); _i < _a.length; _i++) {
                var _b = _a[_i], userId = _b[0], sockets = _b[1];
                if (sockets.has(client.id)) {
                    sockets.delete(client.id);
                    if (sockets.size === 0) {
                        this.userSockets.delete(userId);
                    }
                    break;
                }
            }
        };
        /**
         * El frontend debe emitir esto al conectar, pasándole su ID de usuario
         */
        NotificacionesGateway_1.prototype.handleRegister = function (data, client) {
            var userId = data.userId;
            if (!userId)
                return;
            if (!this.userSockets.has(userId)) {
                this.userSockets.set(userId, new Set());
            }
            this.userSockets.get(userId).add(client.id);
            // Opcional: unirlo a una sala con su propio ID para emisiones directas
            client.join("user_".concat(userId));
            this.logger.log("Usuario ".concat(userId, " registrado con socket ").concat(client.id));
            return { success: true };
        };
        /**
         * Recibir evento del cobrador al finalizar ruta y alertar a todos
         */
        NotificacionesGateway_1.prototype.handleRutaCompletadaEmit = function (data, client) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.log("El cobrador complet\u00F3 la ruta: ".concat(data.rutaNombre));
                            // Alerta al Coordinador/Supervisor a través del servicio (Sistematizado + Push)
                            return [4 /*yield*/, this.notificacionesService.notifyApprovers({
                                    titulo: 'Cierre de Ruta Completo',
                                    mensaje: "Cobrador: ".concat(data.cobradorNombre, " cerr\u00F3 la ruta ").concat(data.rutaNombre, ". Recaudo Final: $").concat(data.recaudo.toLocaleString('es-CO'), " (").concat(data.efectividad, "% META). ").concat(data.clientesFaltantes > 0 ? 'Faltaron ' + data.clientesFaltantes + ' clientes' : 'Todos visitados', "."),
                                    tipo: 'SISTEMA',
                                })];
                        case 1:
                            // Alerta al Coordinador/Supervisor a través del servicio (Sistematizado + Push)
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        /**
         * Enviar notificación a un usuario específico
         */
        NotificacionesGateway_1.prototype.enviarNotificacionAUsuario = function (userId, notificacion) {
            this.logger.log("Emitiendo notificaci\u00F3n a user_".concat(userId, ": ").concat(notificacion.titulo));
            // Emitimos a la sala específica del usuario
            this.server.to("user_".concat(userId)).emit('nueva_notificacion', notificacion);
        };
        /**
         * Enviar evento estructurado a un usuario para indicar que la cuenta de notificaciones no leidas cambió
         */
        NotificacionesGateway_1.prototype.notificarActualizacion = function (userId) {
            this.server.to("user_".concat(userId)).emit('notificaciones_actualizadas', { timestamp: new Date() });
        };
        /**
         * Enviar a todos los usuarios
         */
        NotificacionesGateway_1.prototype.enviarNotificacionATodos = function (notificacion) {
            this.server.emit('nueva_notificacion_global', notificacion);
        };
        NotificacionesGateway_1.prototype.broadcastUsuariosActualizados = function (payload) {
            this.logger.log('Emitiendo evento usuarios_actualizados');
            this.server.emit('usuarios_actualizados', __assign({ timestamp: new Date() }, (payload || {})));
        };
        NotificacionesGateway_1.prototype.broadcastClientesActualizados = function (payload) {
            this.logger.log('Emitiendo evento clientes_actualizados');
            this.server.emit('clientes_actualizados', __assign({ timestamp: new Date() }, (payload || {})));
        };
        NotificacionesGateway_1.prototype.broadcastAprobacionesActualizadas = function (payload) {
            this.logger.log('Emitiendo evento aprobaciones_actualizadas');
            this.server.emit('aprobaciones_actualizadas', __assign({ timestamp: new Date() }, (payload || {})));
        };
        NotificacionesGateway_1.prototype.broadcastPrestamosActualizados = function (payload) {
            this.logger.log('Emitiendo evento prestamos_actualizados');
            this.server.emit('prestamos_actualizados', __assign({ timestamp: new Date() }, (payload || {})));
        };
        NotificacionesGateway_1.prototype.broadcastPagosActualizados = function (payload) {
            this.logger.log('Emitiendo evento pagos_actualizados');
            this.server.emit('pagos_actualizados', __assign({ timestamp: new Date() }, (payload || {})));
        };
        NotificacionesGateway_1.prototype.broadcastRutasActualizadas = function (payload) {
            this.logger.log('Emitiendo evento rutas_actualizadas');
            this.server.emit('rutas_actualizadas', __assign({ timestamp: new Date() }, (payload || {})));
        };
        NotificacionesGateway_1.prototype.broadcastDashboardsActualizados = function (payload) {
            this.logger.log('Emitiendo evento dashboards_actualizados');
            this.server.emit('dashboards_actualizados', __assign({ timestamp: new Date() }, (payload || {})));
        };
        NotificacionesGateway_1.prototype.broadcastInventarioActualizado = function (payload) {
            this.logger.log('Emitiendo evento inventario_actualizado');
            this.server.emit('inventario_actualizado', __assign({ timestamp: new Date() }, (payload || {})));
        };
        return NotificacionesGateway_1;
    }());
    __setFunctionName(_classThis, "NotificacionesGateway");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _server_decorators = [(0, websockets_1.WebSocketServer)()];
        _handleRegister_decorators = [(0, websockets_1.SubscribeMessage)('register')];
        _handleRutaCompletadaEmit_decorators = [(0, websockets_1.SubscribeMessage)('ruta_completada_emit')];
        __esDecorate(_classThis, null, _handleRegister_decorators, { kind: "method", name: "handleRegister", static: false, private: false, access: { has: function (obj) { return "handleRegister" in obj; }, get: function (obj) { return obj.handleRegister; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _handleRutaCompletadaEmit_decorators, { kind: "method", name: "handleRutaCompletadaEmit", static: false, private: false, access: { has: function (obj) { return "handleRutaCompletadaEmit" in obj; }, get: function (obj) { return obj.handleRutaCompletadaEmit; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, null, _server_decorators, { kind: "field", name: "server", static: false, private: false, access: { has: function (obj) { return "server" in obj; }, get: function (obj) { return obj.server; }, set: function (obj, value) { obj.server = value; } }, metadata: _metadata }, _server_initializers, _server_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        NotificacionesGateway = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return NotificacionesGateway = _classThis;
}();
exports.NotificacionesGateway = NotificacionesGateway;
