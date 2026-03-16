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
exports.NotificacionesService = void 0;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var NotificacionesService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var NotificacionesService = _classThis = /** @class */ (function () {
        function NotificacionesService_1(prisma, notificacionesGateway, pushService) {
            this.prisma = prisma;
            this.notificacionesGateway = notificacionesGateway;
            this.pushService = pushService;
            this.logger = new common_1.Logger(NotificacionesService.name);
        }
        NotificacionesService_1.prototype.cleanNotificationText = function (txt) {
            if (!txt)
                return txt;
            return txt
                .replace(/préstamo por artículo/gi, 'crédito por un artículo')
                .replace(/préstamo de artículo/gi, 'crédito por un artículo')
                .replace(/préstamo por un artículo/gi, 'crédito por un artículo')
                .replace(/solicitado un préstamo por artículo/gi, 'solicitado un crédito por un artículo')
                .replace(/préstamo en efectivo/gi, 'préstamo');
        };
        /**
         * Crea una notificación persistente y la emite en tiempo real a través de WebSockets y Push.
         */
        NotificacionesService_1.prototype.create = function (data) {
            return __awaiter(this, void 0, void 0, function () {
                var cleanTitulo, cleanMensaje, map, incoming, isSeverity, tipoFinal, metadataFinal, notificacion, error_1;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            cleanTitulo = this.cleanNotificationText(data.titulo);
                            cleanMensaje = this.cleanNotificationText(data.mensaje);
                            map = {
                                INFO: 'INFORMATIVO',
                                WARNING: 'ADVERTENCIA',
                                CRITICAL: 'CRITICO',
                            };
                            incoming = (data.tipo || '').toUpperCase();
                            isSeverity = incoming in map;
                            tipoFinal = isSeverity ? 'SISTEMA' : data.tipo || 'SISTEMA';
                            metadataFinal = __assign(__assign({}, (data.metadata || {})), { nivel: isSeverity ? map[incoming] : undefined });
                            return [4 /*yield*/, this.prisma.notificacion.create({
                                    data: {
                                        usuarioId: data.usuarioId,
                                        titulo: cleanTitulo,
                                        mensaje: cleanMensaje,
                                        tipo: tipoFinal,
                                        entidad: data.entidad,
                                        entidadId: data.entidadId,
                                        metadata: metadataFinal,
                                    },
                                })];
                        case 1:
                            notificacion = _a.sent();
                            // Emitir evento en tiempo real (WebSockets)
                            this.notificacionesGateway.enviarNotificacionAUsuario(data.usuarioId, notificacion);
                            this.notificacionesGateway.notificarActualizacion(data.usuarioId);
                            // Enviar notificación Push (PWA)
                            this.pushService.sendPushNotification({
                                userId: data.usuarioId,
                                title: cleanTitulo,
                                body: cleanMensaje,
                                data: {
                                    tipo: tipoFinal,
                                    entidadId: data.entidadId,
                                    entidad: data.entidad,
                                    link: notificacion.id ? "/notificaciones" : undefined // Ajustar según necesidad
                                }
                            }).catch(function (err) { return _this.logger.error('Error enviando push:', err); });
                            return [2 /*return*/, notificacion];
                        case 2:
                            error_1 = _a.sent();
                            this.logger.error("Error creando notificaci\u00F3n para el usuario ".concat(data.usuarioId, ":"), error_1);
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            });
        };
        /**
         * Notifica a todos los coordinadores activos del sistema.
         */
        NotificacionesService_1.prototype.notifyCoordinator = function (data) {
            return __awaiter(this, void 0, void 0, function () {
                var coordinadores, error_2;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            return [4 /*yield*/, this.prisma.usuario.findMany({
                                    where: {
                                        rol: client_1.RolUsuario.COORDINADOR,
                                        estado: 'ACTIVO',
                                    },
                                })];
                        case 1:
                            coordinadores = _a.sent();
                            this.logger.log("Notificando a ".concat(coordinadores.length, " coordinadores: ").concat(data.titulo));
                            // 2. Crear notificación para cada uno (esto dispara sockets y push automáticamente en this.create)
                            return [4 /*yield*/, Promise.all(coordinadores.map(function (coord) {
                                    return _this.create(__assign({ usuarioId: coord.id }, data));
                                }))];
                        case 2:
                            // 2. Crear notificación para cada uno (esto dispara sockets y push automáticamente en this.create)
                            _a.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            error_2 = _a.sent();
                            this.logger.error('Error notifying coordinators:', error_2);
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        NotificacionesService_1.prototype.notifyApprovers = function (data) {
            return __awaiter(this, void 0, void 0, function () {
                var aprobadores, error_3;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            return [4 /*yield*/, this.prisma.usuario.findMany({
                                    where: {
                                        rol: {
                                            in: [
                                                client_1.RolUsuario.SUPER_ADMINISTRADOR,
                                                client_1.RolUsuario.ADMIN,
                                                client_1.RolUsuario.COORDINADOR,
                                                client_1.RolUsuario.SUPERVISOR,
                                            ],
                                        },
                                        estado: 'ACTIVO',
                                    },
                                })];
                        case 1:
                            aprobadores = _a.sent();
                            this.logger.log("Notifying ".concat(aprobadores.length, " approvers: ").concat(data.titulo));
                            return [4 /*yield*/, Promise.all(aprobadores.map(function (user) {
                                    return _this.create(__assign({ usuarioId: user.id }, data));
                                }))];
                        case 2:
                            _a.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            error_3 = _a.sent();
                            this.logger.error('Error notifying approvers:', error_3);
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        NotificacionesService_1.prototype.findAll = function (userId) {
            return __awaiter(this, void 0, void 0, function () {
                var notificaciones, enriquecidas;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.notificacion.findMany({
                                where: { usuarioId: userId, archivar: false },
                                orderBy: { creadoEn: 'desc' },
                                take: 50,
                            })];
                        case 1:
                            notificaciones = _a.sent();
                            return [4 /*yield*/, Promise.all(notificaciones.map(function (notif) { return __awaiter(_this, void 0, void 0, function () {
                                    var rawMeta, meta, enrichedNotif, datosExtra, aprobacionReal, aprobacion, rawDatos, datos, p, bInic, rInic, nombreSolicitante, nombreRevisor, descOriginal, enrichedMetadata, p, articuloManual, cuotaInicialManual, apAsociada, d, _a, pData, error_4;
                                    var _b, _c, _d, _e, _f, _g;
                                    return __generator(this, function (_h) {
                                        switch (_h.label) {
                                            case 0:
                                                rawMeta = notif.metadata;
                                                meta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : (rawMeta || {});
                                                enrichedNotif = __assign(__assign({}, notif), { titulo: this.cleanNotificationText(notif.titulo), mensaje: this.cleanNotificationText(notif.mensaje) });
                                                if (!notif.entidadId) return [3 /*break*/, 13];
                                                _h.label = 1;
                                            case 1:
                                                _h.trys.push([1, 12, , 13]);
                                                datosExtra = {};
                                                aprobacionReal = null;
                                                return [4 /*yield*/, this.prisma.aprobacion.findUnique({
                                                        where: { id: notif.entidadId },
                                                        select: {
                                                            estado: true,
                                                            tipoAprobacion: true,
                                                            datosSolicitud: true,
                                                            comentarios: true,
                                                            referenciaId: true,
                                                            tablaReferencia: true,
                                                            solicitadoPor: { select: { nombres: true, apellidos: true } },
                                                            aprobadoPor: { select: { nombres: true, apellidos: true } },
                                                        },
                                                    })];
                                            case 2:
                                                aprobacion = _h.sent();
                                                if (!aprobacion) return [3 /*break*/, 5];
                                                aprobacionReal = aprobacion;
                                                rawDatos = aprobacion.datosSolicitud;
                                                datos = typeof rawDatos === 'string' ? JSON.parse(rawDatos) : (rawDatos || {});
                                                if (!(aprobacion.referenciaId && (aprobacion.tablaReferencia === 'Prestamo' || aprobacion.tipoAprobacion === 'NUEVO_PRESTAMO'))) return [3 /*break*/, 4];
                                                return [4 /*yield*/, this.prisma.prestamo.findUnique({
                                                        where: { id: aprobacion.referenciaId },
                                                        include: {
                                                            cliente: true,
                                                            producto: {
                                                                select: {
                                                                    nombre: true,
                                                                    precios: true
                                                                }
                                                            }
                                                        }
                                                    })];
                                            case 3:
                                                p = _h.sent();
                                                if (p) {
                                                    bInic = Number(p.cuotaInicial || 0);
                                                    rInic = Number(datos.cuotaInicial || 0);
                                                    datosExtra = {
                                                        cedula: String(p.cliente.dni),
                                                        telefono: String(p.cliente.telefono),
                                                        cliente: "".concat(p.cliente.nombres, " ").concat(p.cliente.apellidos),
                                                        monto: Number(p.monto),
                                                        valorArticulo: Number(p.monto) + (bInic || rInic || 0),
                                                        articulo: ((_b = p.producto) === null || _b === void 0 ? void 0 : _b.nombre) || datos.articulo || 'Artículo',
                                                        frecuenciaPago: p.frecuenciaPago,
                                                        cuotas: p.cantidadCuotas || datos.cuotas || datos.numCuotas || 0,
                                                        plazoMeses: p.plazoMeses,
                                                        tipoAmortizacion: p.tipoAmortizacion,
                                                        cuotaInicial: bInic || rInic || 0,
                                                        porcentaje: Number(p.tasaInteres || 0),
                                                        notas: p.notas || datos.notas || datos.observaciones || datos.comentarios || undefined,
                                                        planesArticulo: Array.isArray((_c = p.producto) === null || _c === void 0 ? void 0 : _c.precios)
                                                            ? (_d = p.producto) === null || _d === void 0 ? void 0 : _d.precios.filter(function (pr) { return pr.activo && pr.meses > 0; }).map(function (pr) { return ({
                                                                meses: pr.meses,
                                                                precioTotal: Number(pr.precio),
                                                            }); })
                                                            : undefined,
                                                    };
                                                }
                                                _h.label = 4;
                                            case 4:
                                                nombreSolicitante = aprobacion.solicitadoPor ? "".concat(aprobacion.solicitadoPor.nombres, " ").concat(aprobacion.solicitadoPor.apellidos).trim() : undefined;
                                                nombreRevisor = aprobacion.aprobadoPor ? "".concat(aprobacion.aprobadoPor.nombres, " ").concat(aprobacion.aprobadoPor.apellidos).trim() : undefined;
                                                descOriginal = datos.descripcion || datos.motivo || datos.razon || undefined;
                                                enrichedMetadata = __assign(__assign(__assign(__assign({}, meta), datos), datosExtra), { tipoAprobacion: meta.tipoAprobacion || aprobacion.tipoAprobacion, estadoAprobacion: aprobacion.estado, solicitadoPor: meta.solicitadoPor || nombreSolicitante, revisadoPor: nombreRevisor, motivoRechazo: aprobacion.comentarios, descSolicitud: descOriginal });
                                                enrichedNotif = __assign(__assign({}, enrichedNotif), { metadata: enrichedMetadata, detalles: __assign(__assign(__assign({}, (notif.detalles || {})), datos), datosExtra) });
                                                _h.label = 5;
                                            case 5:
                                                if (!(!aprobacionReal && (notif.entidad === 'PRESTAMO' || notif.entidad === 'Prestamo'))) return [3 /*break*/, 11];
                                                return [4 /*yield*/, this.prisma.prestamo.findUnique({
                                                        where: { id: notif.entidadId },
                                                        include: {
                                                            cliente: true,
                                                            producto: {
                                                                select: {
                                                                    nombre: true,
                                                                    precios: true
                                                                }
                                                            }
                                                        }
                                                    })];
                                            case 6:
                                                p = _h.sent();
                                                if (!p) return [3 /*break*/, 11];
                                                articuloManual = '';
                                                cuotaInicialManual = 0;
                                                _h.label = 7;
                                            case 7:
                                                _h.trys.push([7, 9, , 10]);
                                                return [4 /*yield*/, this.prisma.aprobacion.findFirst({
                                                        where: { referenciaId: p.id, tablaReferencia: 'Prestamo' },
                                                        select: { datosSolicitud: true }
                                                    })];
                                            case 8:
                                                apAsociada = _h.sent();
                                                if (apAsociada) {
                                                    d = typeof apAsociada.datosSolicitud === 'string' ? JSON.parse(apAsociada.datosSolicitud) : apAsociada.datosSolicitud;
                                                    articuloManual = d.articulo || d.articuloNombre || '';
                                                    cuotaInicialManual = Number(d.cuotaInicial || 0);
                                                }
                                                return [3 /*break*/, 10];
                                            case 9:
                                                _a = _h.sent();
                                                return [3 /*break*/, 10];
                                            case 10:
                                                pData = {
                                                    cedula: String(p.cliente.dni),
                                                    telefono: String(p.cliente.telefono),
                                                    cliente: "".concat(p.cliente.nombres, " ").concat(p.cliente.apellidos),
                                                    monto: Number(p.monto),
                                                    valorArticulo: Number(p.monto) + Number(p.cuotaInicial || cuotaInicialManual || 0),
                                                    articulo: ((_e = p.producto) === null || _e === void 0 ? void 0 : _e.nombre) || articuloManual || 'Artículo',
                                                    frecuenciaPago: p.frecuenciaPago,
                                                    cuotas: p.cantidadCuotas || meta.cuotas || meta.numCuotas || 0,
                                                    plazoMeses: p.plazoMeses,
                                                    tipoAmortizacion: p.tipoAmortizacion,
                                                    cuotaInicial: Number(p.cuotaInicial || cuotaInicialManual || 0),
                                                    porcentaje: Number(p.tasaInteres || 0),
                                                    notas: p.notas || meta.notas || meta.observaciones || meta.comentarios || undefined,
                                                    planesArticulo: Array.isArray((_f = p.producto) === null || _f === void 0 ? void 0 : _f.precios)
                                                        ? (_g = p.producto) === null || _g === void 0 ? void 0 : _g.precios.filter(function (pr) { return pr.activo && pr.meses > 0; }).map(function (pr) { return ({
                                                            meses: pr.meses,
                                                            precioTotal: Number(pr.precio),
                                                        }); })
                                                        : undefined,
                                                };
                                                enrichedNotif = __assign(__assign({}, enrichedNotif), { metadata: __assign(__assign({}, meta), pData), detalles: __assign(__assign({}, (notif.detalles || {})), pData) });
                                                _h.label = 11;
                                            case 11: return [3 /*break*/, 13];
                                            case 12:
                                                error_4 = _h.sent();
                                                this.logger.error('Error in notification enrichment:', error_4);
                                                return [3 /*break*/, 13];
                                            case 13: 
                                            // Aplicamos la limpieza de texto al final para asegurarnos de que el texto enriquecido 
                                            // o el original queden estandarizados.
                                            return [2 /*return*/, __assign(__assign({}, enrichedNotif), { titulo: this.cleanNotificationText(enrichedNotif.titulo), mensaje: this.cleanNotificationText(enrichedNotif.mensaje) })];
                                        }
                                    });
                                }); }))];
                        case 2:
                            enriquecidas = _a.sent();
                            return [2 /*return*/, enriquecidas];
                    }
                });
            });
        };
        NotificacionesService_1.prototype.markAsRead = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.prisma.notificacion.update({
                            where: { id: id },
                            data: { leida: true },
                        })];
                });
            });
        };
        return NotificacionesService_1;
    }());
    __setFunctionName(_classThis, "NotificacionesService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        NotificacionesService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return NotificacionesService = _classThis;
}();
exports.NotificacionesService = NotificacionesService;
