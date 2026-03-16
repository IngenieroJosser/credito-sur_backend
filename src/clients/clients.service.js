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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientsService = void 0;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var client_2 = require("@prisma/client");
var clientes_template_1 = require("../templates/exports/clientes.template");
var ClientsService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var ClientsService = _classThis = /** @class */ (function () {
        function ClientsService_1(prisma, auditService, notificacionesService, notificacionesGateway, configuracionService) {
            this.prisma = prisma;
            this.auditService = auditService;
            this.notificacionesService = notificacionesService;
            this.notificacionesGateway = notificacionesGateway;
            this.configuracionService = configuracionService;
            this.logger = new common_1.Logger(ClientsService.name);
        }
        ClientsService_1.prototype.create = function (createClientDto) {
            return __awaiter(this, void 0, void 0, function () {
                var clienteExistente, count, codigo, creador, _rutaId, _observaciones, _archivos, clientData, cliente;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.cliente.findFirst({
                                where: { dni: createClientDto.dni },
                            })];
                        case 1:
                            clienteExistente = _a.sent();
                            if (clienteExistente) {
                                if (!clienteExistente.eliminadoEn) {
                                    throw new common_1.ConflictException("Ya existe un cliente activo con ese n\u00FAmero de documento: ".concat(createClientDto.dni));
                                }
                                else {
                                    throw new common_1.ConflictException("El cliente con documento ".concat(createClientDto.dni, " ya existe pero est\u00E1 archivado. Rest\u00E1uralo desde la secci\u00F3n de Archivados."));
                                }
                            }
                            return [4 /*yield*/, this.prisma.cliente.count()];
                        case 2:
                            count = _a.sent();
                            codigo = "C-".concat((count + 1).toString().padStart(4, '0'));
                            return [4 /*yield*/, this.prisma.usuario.findFirst()];
                        case 3:
                            creador = _a.sent();
                            if (!creador) {
                                throw new Error('No existen usuarios en el sistema para asignar la creación');
                            }
                            _rutaId = createClientDto.rutaId, _observaciones = createClientDto.observaciones, _archivos = createClientDto.archivos, clientData = __rest(createClientDto, ["rutaId", "observaciones", "archivos"]);
                            return [4 /*yield*/, this.prisma.cliente.create({
                                    data: __assign(__assign({}, clientData), { codigo: codigo, creadoPorId: creador.id }),
                                })];
                        case 4:
                            cliente = _a.sent();
                            this.notificacionesGateway.broadcastClientesActualizados({
                                accion: 'CREAR',
                                clienteId: cliente.id,
                            });
                            return [2 /*return*/, cliente];
                    }
                });
            });
        };
        ClientsService_1.prototype.findAll = function () {
            return this.prisma.cliente.findMany({
                where: { eliminadoEn: null },
                orderBy: { creadoEn: 'desc' },
            });
        };
        ClientsService_1.prototype.findOne = function (id) {
            return this.prisma.cliente.findUnique({
                where: { id: id },
                include: {
                    prestamos: true,
                    pagos: true,
                    archivos: {
                        where: { estado: 'ACTIVO' },
                    },
                },
            });
        };
        ClientsService_1.prototype.update = function (id, updateClientDto) {
            return __awaiter(this, void 0, void 0, function () {
                var _rutaId, _observaciones, archivos, clientData, clienteActualizado, archivosExistentes, nuevosArchivos, clienteConArchivos;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _rutaId = updateClientDto.rutaId, _observaciones = updateClientDto.observaciones, archivos = updateClientDto.archivos, clientData = __rest(updateClientDto, ["rutaId", "observaciones", "archivos"]);
                            return [4 /*yield*/, this.prisma.cliente.update({
                                    where: { id: id },
                                    data: clientData,
                                })];
                        case 1:
                            clienteActualizado = _a.sent();
                            if (!(archivos !== undefined)) return [3 /*break*/, 6];
                            this.logger.log("[DEBUG] Actualizando archivos para cliente ".concat(id, ". Archivos recibidos: ").concat(archivos.length));
                            return [4 /*yield*/, this.prisma.multimedia.findMany({
                                    where: {
                                        clienteId: id,
                                        estado: 'ACTIVO'
                                    },
                                    select: { id: true, tipoContenido: true },
                                })];
                        case 2:
                            archivosExistentes = _a.sent();
                            if (!(archivosExistentes.length > 0)) return [3 /*break*/, 4];
                            this.logger.log("[DEBUG] Marcando ".concat(archivosExistentes.length, " archivos antiguos como ELIMINADOS"));
                            return [4 /*yield*/, this.prisma.multimedia.updateMany({
                                    where: {
                                        id: { in: archivosExistentes.map(function (a) { return a.id; }) }
                                    },
                                    data: {
                                        estado: 'ELIMINADO',
                                        eliminadoEn: new Date()
                                    }
                                })];
                        case 3:
                            _a.sent();
                            _a.label = 4;
                        case 4:
                            nuevosArchivos = archivos.map(function (archivo) {
                                var _a;
                                // Asegurar que la URL sea correcta
                                var url = archivo.url || archivo.path || archivo.ruta;
                                var urlFinal = typeof url === 'string' && url.startsWith('http') ? url : undefined;
                                var cloudName = process.env.CLOUDINARY_CLOUD_NAME;
                                var rutaValue = String(archivo.ruta || archivo.path || archivo.nombreAlmacenamiento || '').trim();
                                var tipoArchivoValue = String(archivo.tipoArchivo || '').toLowerCase();
                                var isVideo = tipoArchivoValue.startsWith('video/');
                                var urlDerivada = (!urlFinal && cloudName && rutaValue)
                                    ? "https://res.cloudinary.com/".concat(cloudName, "/").concat(isVideo ? 'video' : 'image', "/upload/").concat(rutaValue)
                                    : undefined;
                                return {
                                    clienteId: id,
                                    tipoContenido: archivo.tipoContenido,
                                    tipoArchivo: archivo.tipoArchivo,
                                    formato: archivo.formato || ((_a = archivo.tipoArchivo) === null || _a === void 0 ? void 0 : _a.split('/')[1]) || 'jpg',
                                    nombreOriginal: archivo.nombreOriginal,
                                    nombreAlmacenamiento: archivo.nombreAlmacenamiento || archivo.nombreOriginal,
                                    ruta: archivo.ruta || archivo.path,
                                    url: urlFinal || urlDerivada,
                                    tamanoBytes: archivo.tamanoBytes || 0,
                                    subidoPorId: archivo.subidoPorId || clienteActualizado.creadoPorId,
                                    estado: 'ACTIVO',
                                };
                            });
                            return [4 /*yield*/, this.prisma.multimedia.createMany({
                                    data: nuevosArchivos,
                                })];
                        case 5:
                            _a.sent();
                            this.logger.log("[DEBUG] Archivos actualizados para cliente ".concat(id, ":"));
                            this.logger.log("  - Eliminados: ".concat(archivosExistentes.length, " archivos antiguos"));
                            this.logger.log("  - Creados: ".concat(nuevosArchivos.length, " archivos nuevos"));
                            nuevosArchivos.forEach(function (a, i) {
                                _this.logger.log("    [".concat(i, "] ").concat(a.tipoContenido, " - ").concat(a.tipoArchivo, " - ").concat(a.url));
                            });
                            _a.label = 6;
                        case 6: return [4 /*yield*/, this.prisma.cliente.findUnique({
                                where: { id: id },
                                include: {
                                    archivos: {
                                        where: { estado: 'ACTIVO' },
                                    },
                                },
                            })];
                        case 7:
                            clienteConArchivos = _a.sent();
                            this.notificacionesGateway.broadcastClientesActualizados({
                                accion: 'ACTUALIZAR',
                                clienteId: id,
                            });
                            return [2 /*return*/, clienteConArchivos];
                    }
                });
            });
        };
        ClientsService_1.prototype.remove = function (id, userId) {
            return __awaiter(this, void 0, void 0, function () {
                var cliente, clienteEliminado;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.cliente.findUnique({ where: { id: id } })];
                        case 1:
                            cliente = _a.sent();
                            if (!cliente)
                                throw new common_1.NotFoundException('Cliente no encontrado');
                            return [4 /*yield*/, this.prisma.cliente.update({
                                    where: { id: id },
                                    data: { eliminadoEn: new Date() },
                                })];
                        case 2:
                            clienteEliminado = _a.sent();
                            this.notificacionesGateway.broadcastClientesActualizados({
                                accion: 'ELIMINAR',
                                clienteId: id,
                            });
                            // Registrar en auditoría
                            return [4 /*yield*/, this.auditService.create({
                                    usuarioId: userId,
                                    accion: 'ELIMINAR_CLIENTE',
                                    entidad: 'Cliente',
                                    entidadId: id,
                                    datosAnteriores: {
                                        nombres: cliente.nombres,
                                        apellidos: cliente.apellidos,
                                        dni: cliente.dni
                                    },
                                    datosNuevos: { eliminadoEn: clienteEliminado.eliminadoEn },
                                })];
                        case 3:
                            // Registrar en auditoría
                            _a.sent();
                            return [2 /*return*/, clienteEliminado];
                    }
                });
            });
        };
        ClientsService_1.prototype.restore = function (id, userId) {
            return __awaiter(this, void 0, void 0, function () {
                var cliente, clienteRestaurado;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.cliente.findUnique({ where: { id: id } })];
                        case 1:
                            cliente = _a.sent();
                            if (!cliente)
                                throw new common_1.NotFoundException('Cliente no encontrado');
                            return [4 /*yield*/, this.prisma.cliente.update({
                                    where: { id: id },
                                    data: { eliminadoEn: null },
                                })];
                        case 2:
                            clienteRestaurado = _a.sent();
                            this.notificacionesGateway.broadcastClientesActualizados({
                                accion: 'RESTAURAR',
                                clienteId: id,
                            });
                            // Registrar en auditoría
                            return [4 /*yield*/, this.auditService.create({
                                    usuarioId: userId,
                                    accion: 'RESTAURAR_CLIENTE',
                                    entidad: 'Cliente',
                                    entidadId: id,
                                    datosAnteriores: { eliminadoEn: cliente.eliminadoEn },
                                    datosNuevos: { eliminadoEn: null },
                                })];
                        case 3:
                            // Registrar en auditoría
                            _a.sent();
                            return [2 /*return*/, clienteRestaurado];
                    }
                });
            });
        };
        ClientsService_1.prototype.getAllClients = function (filters) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, nivelRiesgo, _b, ruta, _c, search, where, nivelesValidos, searchTerm, clientesRaw, aprobacionesPendientes, totalClientes, buenComportamiento, enRiesgo, promedioScore, clientesTransformados, aprobacionesTransformadas, todosLosClientes, error_1;
                var _this = this;
                var _d, _e;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0:
                            _f.trys.push([0, 6, , 7]);
                            this.logger.log("Getting clients with filters: ".concat(JSON.stringify(filters)));
                            _a = filters.nivelRiesgo, nivelRiesgo = _a === void 0 ? 'all' : _a, _b = filters.ruta, ruta = _b === void 0 ? '' : _b, _c = filters.search, search = _c === void 0 ? '' : _c;
                            where = {
                                eliminadoEn: null, // Solo clientes no eliminados
                            };
                            // Filtro por nivel de riesgo
                            if (nivelRiesgo !== 'all') {
                                nivelesValidos = Object.values(client_1.NivelRiesgo);
                                if (nivelesValidos.includes(nivelRiesgo)) {
                                    where.nivelRiesgo = nivelRiesgo;
                                }
                                else {
                                    this.logger.warn("Nivel de riesgo inv\u00E1lido recibido: ".concat(nivelRiesgo));
                                }
                            }
                            // Filtro por ruta
                            if (ruta && ruta !== '') {
                                where.asignacionesRuta = {
                                    some: {
                                        rutaId: ruta,
                                        activa: true,
                                    },
                                };
                            }
                            // Filtro por búsqueda
                            if (search && search.trim() !== '') {
                                searchTerm = search.trim();
                                where.OR = [
                                    {
                                        dni: {
                                            contains: searchTerm,
                                            mode: 'insensitive',
                                        },
                                    },
                                    {
                                        nombres: {
                                            contains: searchTerm,
                                            mode: 'insensitive',
                                        },
                                    },
                                    {
                                        apellidos: {
                                            contains: searchTerm,
                                            mode: 'insensitive',
                                        },
                                    },
                                    {
                                        telefono: {
                                            contains: searchTerm,
                                            mode: 'insensitive',
                                        },
                                    },
                                    {
                                        codigo: {
                                            contains: searchTerm,
                                            mode: 'insensitive',
                                        },
                                    },
                                ];
                            }
                            this.logger.log("Query where clause: ".concat(JSON.stringify(where)));
                            return [4 /*yield*/, this.prisma.cliente.findMany({
                                    where: where,
                                    include: {
                                        asignacionesRuta: {
                                            where: { activa: true },
                                            include: {
                                                ruta: {
                                                    select: {
                                                        id: true,
                                                        nombre: true,
                                                        codigo: true,
                                                    },
                                                },
                                            },
                                            take: 1,
                                        },
                                        prestamos: {
                                            where: { eliminadoEn: null },
                                            select: {
                                                id: true,
                                                estado: true,
                                                saldoPendiente: true,
                                            },
                                        },
                                        pagos: {
                                            select: {
                                                fechaPago: true,
                                            },
                                            orderBy: { fechaPago: 'desc' },
                                            take: 1,
                                        },
                                    },
                                    orderBy: { creadoEn: 'desc' },
                                })];
                        case 1:
                            clientesRaw = _f.sent();
                            aprobacionesPendientes = [];
                            return [4 /*yield*/, this.prisma.cliente.count({
                                    where: { eliminadoEn: null },
                                })];
                        case 2:
                            totalClientes = _f.sent();
                            return [4 /*yield*/, this.prisma.cliente.count({
                                    where: {
                                        eliminadoEn: null,
                                        nivelRiesgo: 'VERDE',
                                        puntaje: { gte: 80 },
                                    },
                                })];
                        case 3:
                            buenComportamiento = _f.sent();
                            return [4 /*yield*/, this.prisma.cliente.count({
                                    where: {
                                        eliminadoEn: null,
                                        OR: [{ nivelRiesgo: 'ROJO' }, { nivelRiesgo: 'LISTA_NEGRA' }],
                                    },
                                })];
                        case 4:
                            enRiesgo = _f.sent();
                            return [4 /*yield*/, this.prisma.cliente.aggregate({
                                    where: { eliminadoEn: null },
                                    _avg: {
                                        puntaje: true,
                                    },
                                })];
                        case 5:
                            promedioScore = _f.sent();
                            this.logger.log("Found ".concat(clientesRaw.length, " active clients and ").concat(aprobacionesPendientes.length, " pending approvals"));
                            clientesTransformados = clientesRaw.map(function (cliente) {
                                try {
                                    // Calcular score basado en múltiples factores
                                    var score = cliente.puntaje || 100;
                                    var tendencia = 'ESTABLE';
                                    // Ajustar score basado en préstamos
                                    var prestamosActivos = cliente.prestamos.filter(function (p) { return p.estado === 'ACTIVO'; });
                                    var prestamosEnMora = cliente.prestamos.filter(function (p) { return p.estado === 'EN_MORA'; });
                                    if (prestamosEnMora.length > 0) {
                                        score -= 20;
                                        tendencia = 'BAJA';
                                    }
                                    else if (prestamosActivos.length > 0) {
                                        score += 5;
                                        tendencia = 'SUBE';
                                    }
                                    // Ajustar basado en tiempo desde el último pago
                                    if (cliente.pagos && cliente.pagos.length > 0) {
                                        var ultimoPago = cliente.pagos[0].fechaPago;
                                        var diasDesdeUltimoPago = Math.floor((Date.now() - new Date(ultimoPago).getTime()) /
                                            (1000 * 60 * 60 * 24));
                                        if (diasDesdeUltimoPago > 30) {
                                            score -= 10;
                                        }
                                        else if (diasDesdeUltimoPago <= 7) {
                                            score += 5;
                                        }
                                    }
                                    // Limitar score entre 0 y 100
                                    score = Math.max(0, Math.min(100, score));
                                    // Obtener ruta asignada
                                    var rutaAsignada = '';
                                    var rutaNombre = '';
                                    if (cliente.asignacionesRuta && cliente.asignacionesRuta.length > 0) {
                                        var asignacion = cliente.asignacionesRuta[0];
                                        if (asignacion.ruta) {
                                            rutaAsignada = asignacion.ruta.id;
                                            rutaNombre = asignacion.ruta.nombre;
                                        }
                                    }
                                    // Obtener última visita (basado en último pago o última interacción)
                                    var ultimaVisita = 'Nunca';
                                    if (cliente.pagos && cliente.pagos.length > 0) {
                                        var fecha = new Date(cliente.pagos[0].fechaPago);
                                        ultimaVisita = fecha.toISOString().split('T')[0];
                                    }
                                    // Calcular deuda total y mora
                                    var montoTotal = cliente.prestamos.reduce(function (sum, p) { return sum + Number(p.saldoPendiente || 0); }, 0);
                                    var montoMora = cliente.prestamos
                                        .filter(function (p) { return p.estado === 'EN_MORA'; })
                                        .reduce(function (sum, p) { return sum + Number(p.saldoPendiente || 0); }, 0);
                                    return {
                                        id: cliente.id,
                                        codigo: cliente.codigo,
                                        dni: cliente.dni,
                                        nombres: cliente.nombres,
                                        apellidos: cliente.apellidos,
                                        telefono: cliente.telefono,
                                        correo: cliente.correo,
                                        direccion: cliente.direccion,
                                        referencia: cliente.referencia,
                                        nivelRiesgo: cliente.nivelRiesgo,
                                        puntaje: cliente.puntaje,
                                        enListaNegra: cliente.enListaNegra,
                                        estadoAprobacion: cliente.estadoAprobacion,
                                        score: Math.round(score),
                                        tendencia: tendencia,
                                        ultimaVisita: ultimaVisita,
                                        rutaId: rutaAsignada,
                                        rutaNombre: rutaNombre,
                                        montoTotal: montoTotal,
                                        montoMora: montoMora,
                                        prestamosActivos: prestamosActivos.length,
                                    };
                                }
                                catch (error) {
                                    _this.logger.error("Error transforming client ".concat(cliente.id, ":"), error);
                                    return {
                                        id: cliente.id,
                                        codigo: cliente.codigo || 'ERROR',
                                        dni: cliente.dni || '',
                                        nombres: cliente.nombres || 'Error',
                                        apellidos: cliente.apellidos || '',
                                        telefono: cliente.telefono || '',
                                        correo: cliente.correo || '',
                                        direccion: cliente.direccion || '',
                                        referencia: cliente.referencia || '',
                                        nivelRiesgo: cliente.nivelRiesgo || 'VERDE',
                                        puntaje: cliente.puntaje || 50,
                                        enListaNegra: cliente.enListaNegra || false,
                                        estadoAprobacion: cliente.estadoAprobacion || 'APROBADO',
                                        score: 50,
                                        tendencia: 'ESTABLE',
                                        ultimaVisita: 'Nunca',
                                        rutaId: '',
                                        rutaNombre: '',
                                        montoTotal: 0,
                                        montoMora: 0,
                                        prestamosActivos: 0,
                                    };
                                }
                            });
                            aprobacionesTransformadas = aprobacionesPendientes.map(function (aprob) {
                                var datos = JSON.parse(aprob.datosSolicitud);
                                return {
                                    id: aprob.id,
                                    codigo: aprob.referenciaId || 'PENDIENTE',
                                    dni: datos.dni || '',
                                    nombres: datos.nombres || 'Pendiente',
                                    apellidos: datos.apellidos || '',
                                    telefono: datos.telefono || '',
                                    correo: datos.correo || '',
                                    direccion: datos.direccion || '',
                                    referencia: datos.referencia || '',
                                    nivelRiesgo: 'VERDE',
                                    puntaje: 100,
                                    enListaNegra: false,
                                    estadoAprobacion: aprob.estado,
                                    score: 100,
                                    tendencia: 'ESTABLE',
                                    ultimaVisita: 'Pendiente',
                                    rutaId: '',
                                    rutaNombre: 'Sin ruta',
                                    montoTotal: 0,
                                    montoMora: 0,
                                    prestamosActivos: 0,
                                    creadoEn: aprob.creadoEn,
                                };
                            });
                            todosLosClientes = __spreadArray(__spreadArray([], aprobacionesTransformadas, true), clientesTransformados, true).sort(function (a, b) {
                                var dateA = new Date(a.creadoEn || 0).getTime();
                                var dateB = new Date(b.creadoEn || 0).getTime();
                                return dateB - dateA;
                            });
                            return [2 /*return*/, {
                                    clientes: todosLosClientes,
                                    estadisticas: {
                                        total: totalClientes || 0,
                                        buenComportamiento: buenComportamiento || 0,
                                        enRiesgo: enRiesgo || 0,
                                        scorePromedio: Number(((_e = (_d = promedioScore._avg) === null || _d === void 0 ? void 0 : _d.puntaje) === null || _e === void 0 ? void 0 : _e.toFixed(1)) || 0),
                                    },
                                }];
                        case 6:
                            error_1 = _f.sent();
                            this.logger.error('Error in getAllClients:', error_1);
                            return [2 /*return*/, {
                                    clientes: [],
                                    estadisticas: {
                                        total: 0,
                                        buenComportamiento: 0,
                                        enRiesgo: 0,
                                        scorePromedio: 0,
                                    },
                                }];
                        case 7: return [2 /*return*/];
                    }
                });
            });
        };
        ClientsService_1.prototype.getClientById = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var cliente, aprobacion, datos, error_2;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.log("[DEBUG] getClientById called with ID: ".concat(id));
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 5, , 6]);
                            return [4 /*yield*/, this.prisma.cliente.findUnique({
                                    where: {
                                        id: id,
                                        eliminadoEn: null,
                                    },
                                    include: {
                                        asignacionesRuta: {
                                            include: {
                                                ruta: true,
                                                cobrador: {
                                                    select: {
                                                        id: true,
                                                        nombres: true,
                                                        apellidos: true,
                                                        telefono: true,
                                                    },
                                                },
                                            },
                                        },
                                        prestamos: {
                                            where: { eliminadoEn: null },
                                            include: {
                                                producto: true,
                                                cuotas: true,
                                                pagos: {
                                                    include: {
                                                        detalles: true,
                                                    },
                                                },
                                            },
                                            orderBy: { creadoEn: 'desc' },
                                        },
                                        pagos: {
                                            include: {
                                                prestamo: true,
                                                cobrador: true,
                                                detalles: {
                                                    include: {
                                                        cuota: true,
                                                    },
                                                },
                                            },
                                            orderBy: { fechaPago: 'desc' },
                                            take: 10,
                                        },
                                        creadoPor: {
                                            select: {
                                                id: true,
                                                nombres: true,
                                                apellidos: true,
                                                rol: true,
                                            },
                                        },
                                        aprobadoPor: {
                                            select: {
                                                id: true,
                                                nombres: true,
                                                apellidos: true,
                                                rol: true,
                                            },
                                        },
                                        archivos: {
                                            where: { estado: 'ACTIVO' },
                                        },
                                    },
                                })];
                        case 2:
                            cliente = _a.sent();
                            // Log de archivos devueltos
                            if (cliente && cliente.archivos) {
                                this.logger.log("[DEBUG] Cliente ".concat(id, " - Archivos ACTIVOS devueltos: ").concat(cliente.archivos.length));
                                cliente.archivos.forEach(function (a, i) {
                                    _this.logger.log("  [".concat(i, "] ").concat(a.tipoContenido, " - ").concat(a.tipoArchivo, " - Estado: ").concat(a.estado, " - URL: ").concat(a.url));
                                });
                            }
                            if (!!cliente) return [3 /*break*/, 4];
                            this.logger.log("[DEBUG] Cliente no encontrado en tabla principal, buscando en aprobaciones: ".concat(id));
                            return [4 /*yield*/, this.prisma.aprobacion.findUnique({
                                    where: { id: id },
                                    include: { solicitadoPor: true },
                                })];
                        case 3:
                            aprobacion = _a.sent();
                            if (aprobacion) {
                                this.logger.log("[DEBUG] Aprobaci\u00F3n encontrada. Tipo: ".concat(aprobacion.tipoAprobacion, ", Estado: ").concat(aprobacion.estado));
                                if (aprobacion.tipoAprobacion === 'NUEVO_CLIENTE') {
                                    datos = JSON.parse(aprobacion.datosSolicitud);
                                    return [2 /*return*/, __assign(__assign({ id: aprobacion.id, codigo: aprobacion.referenciaId || 'PENDIENTE' }, datos), { estadoAprobacion: aprobacion.estado, creadoEn: aprobacion.creadoEn, creadoPor: aprobacion.solicitadoPor })];
                                }
                            }
                            else {
                                this.logger.warn("[DEBUG] No se encontr\u00F3 la aprobaci\u00F3n con ID: ".concat(id));
                            }
                            throw new common_1.NotFoundException('Cliente no encontrado');
                        case 4: return [2 /*return*/, cliente];
                        case 5:
                            error_2 = _a.sent();
                            this.logger.error("Error getting client ".concat(id, ":"), error_2);
                            throw error_2;
                        case 6: return [2 /*return*/];
                    }
                });
            });
        };
        ClientsService_1.prototype.createClient = function (data) {
            return __awaiter(this, void 0, void 0, function () {
                var clienteExistente, solicitadoPorId_1, creador, solicitante_1, autoAprobar_1, estadoInicial_1, clienteRestaurado_1, aprobacion_1, _a, _b, solicitadoPorId_2, creador, solicitante, codigo, autoAprobar, estadoInicial, cliente_1, aprobacion, nombreSolicitante, solicitante_2, _c, _d, _e, error_3;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0:
                            this.logger.log("[DEBUG] createClient llamado para documento: ".concat(data.dni));
                            _f.label = 1;
                        case 1:
                            _f.trys.push([1, 39, , 40]);
                            return [4 /*yield*/, this.prisma.cliente.findFirst({
                                    where: { dni: data.dni },
                                })];
                        case 2:
                            clienteExistente = _f.sent();
                            if (!clienteExistente) return [3 /*break*/, 20];
                            // Si está activo, no permitimos duplicar
                            if (!clienteExistente.eliminadoEn) {
                                throw new common_1.ConflictException("Ya existe un cliente activo con ese n\u00FAmero de documento: ".concat(data.dni));
                            }
                            if (!(clienteExistente.estadoAprobacion === 'RECHAZADO')) return [3 /*break*/, 19];
                            solicitadoPorId_1 = data.creadoPorId;
                            if (!!solicitadoPorId_1) return [3 /*break*/, 4];
                            return [4 /*yield*/, this.prisma.usuario.findFirst()];
                        case 3:
                            creador = _f.sent();
                            if (!creador) {
                                throw new common_1.NotFoundException('No existen usuarios en el sistema para asignar la creación');
                            }
                            solicitadoPorId_1 = creador.id;
                            _f.label = 4;
                        case 4: return [4 /*yield*/, this.prisma.usuario.findUnique({
                                where: { id: solicitadoPorId_1 },
                                select: { id: true, rol: true },
                            })];
                        case 5:
                            solicitante_1 = _f.sent();
                            if (!solicitante_1) {
                                throw new common_1.NotFoundException('Usuario solicitante no encontrado');
                            }
                            return [4 /*yield*/, this.configuracionService.shouldAutoApproveClients()];
                        case 6:
                            autoAprobar_1 = _f.sent();
                            estadoInicial_1 = autoAprobar_1 ? 'APROBADO' : 'PENDIENTE';
                            return [4 /*yield*/, this.prisma.cliente.update({
                                    where: { id: clienteExistente.id },
                                    data: {
                                        eliminadoEn: null,
                                        estadoAprobacion: estadoInicial_1,
                                        nombres: data.nombres,
                                        apellidos: data.apellidos,
                                        telefono: data.telefono,
                                        correo: data.correo,
                                        direccion: data.direccion,
                                        referencia: data.referencia,
                                        creadoPorId: solicitadoPorId_1,
                                    },
                                })];
                        case 7:
                            clienteRestaurado_1 = _f.sent();
                            if (!(data.archivos &&
                                Array.isArray(data.archivos) &&
                                data.archivos.length > 0)) return [3 /*break*/, 10];
                            return [4 /*yield*/, this.prisma.multimedia.updateMany({
                                    where: {
                                        clienteId: clienteRestaurado_1.id,
                                        estado: 'ACTIVO',
                                    },
                                    data: {
                                        estado: 'ELIMINADO',
                                    },
                                })];
                        case 8:
                            _f.sent();
                            return [4 /*yield*/, this.prisma.multimedia.createMany({
                                    data: data.archivos.map(function (archivo) {
                                        var _a;
                                        return ({
                                            clienteId: clienteRestaurado_1.id,
                                            tipoContenido: archivo.tipoContenido,
                                            tipoArchivo: archivo.tipoArchivo,
                                            formato: ((_a = archivo.nombreOriginal) === null || _a === void 0 ? void 0 : _a.split('.').pop()) || 'bin',
                                            nombreOriginal: archivo.nombreOriginal,
                                            nombreAlmacenamiento: archivo.nombreAlmacenamiento,
                                            ruta: archivo.ruta || archivo.path || '',
                                            url: archivo.url ||
                                                archivo.path ||
                                                (archivo.nombreAlmacenamiento
                                                    ? "/uploads/".concat(archivo.nombreAlmacenamiento)
                                                    : null),
                                            tamanoBytes: archivo.tamanoBytes,
                                            subidoPorId: solicitadoPorId_1,
                                            esPrincipal: archivo.tipoContenido === 'FOTO_PERFIL',
                                            estado: 'ACTIVO',
                                        });
                                    }),
                                })];
                        case 9:
                            _f.sent();
                            _f.label = 10;
                        case 10: return [4 /*yield*/, this.prisma.aprobacion.create({
                                data: __assign({ tipoAprobacion: 'NUEVO_CLIENTE', referenciaId: clienteRestaurado_1.id, tablaReferencia: 'Cliente', solicitadoPorId: solicitadoPorId_1, estado: estadoInicial_1, datosSolicitud: JSON.stringify({
                                        dni: data.dni,
                                        nombres: data.nombres,
                                        apellidos: data.apellidos,
                                        telefono: data.telefono,
                                        correo: data.correo,
                                        direccion: data.direccion,
                                        referencia: data.referencia,
                                        archivos: data.archivos || [],
                                    }) }, (autoAprobar_1 ? { aprobadoPorId: solicitadoPorId_1, revisadoEn: new Date() } : {})),
                            })];
                        case 11:
                            aprobacion_1 = _f.sent();
                            if (!!autoAprobar_1) return [3 /*break*/, 18];
                            _f.label = 12;
                        case 12:
                            _f.trys.push([12, 14, , 15]);
                            return [4 /*yield*/, this.notificacionesService.notifyApprovers({
                                    titulo: 'Nuevo cliente requiere aprobación',
                                    mensaje: "Se reenvi\0f3 la solicitud del cliente (".concat(data.nombres, " ").concat(data.apellidos, "). Requiere revisi\0f3n."),
                                    tipo: 'CLIENTE',
                                    entidad: 'Aprobacion',
                                    entidadId: aprobacion_1.id,
                                    metadata: {
                                        tipoAprobacion: 'NUEVO_CLIENTE',
                                        clienteId: clienteRestaurado_1.id,
                                        solicitanteId: solicitadoPorId_1,
                                        dni: data.dni,
                                        nombres: data.nombres,
                                        apellidos: data.apellidos,
                                        reenviado: true,
                                    },
                                })];
                        case 13:
                            _f.sent();
                            return [3 /*break*/, 15];
                        case 14:
                            _a = _f.sent();
                            return [3 /*break*/, 15];
                        case 15:
                            _f.trys.push([15, 17, , 18]);
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: solicitadoPorId_1,
                                    titulo: 'Solicitud reenviada',
                                    mensaje: 'Tu solicitud fue reenviada con  e9xito y qued f3 pendiente de aprobaci f3n.',
                                    tipo: 'INFORMATIVO',
                                    entidad: 'Aprobacion',
                                    entidadId: aprobacion_1.id,
                                    metadata: {
                                        tipoAprobacion: 'NUEVO_CLIENTE',
                                        clienteId: clienteRestaurado_1.id,
                                        reenviado: true,
                                    },
                                })];
                        case 16:
                            _f.sent();
                            return [3 /*break*/, 18];
                        case 17:
                            _b = _f.sent();
                            return [3 /*break*/, 18];
                        case 18:
                            this.notificacionesGateway.broadcastClientesActualizados({
                                accion: 'REENVIAR',
                                clienteId: clienteRestaurado_1.id,
                            });
                            return [2 /*return*/, {
                                    mensaje: autoAprobar_1
                                        ? 'Cliente restaurado y aprobado autom e1ticamente.'
                                        : 'Cliente restaurado y solicitud reenviada. Pendiente de aprobaci f3n.',
                                    aprobacionId: aprobacion_1.id,
                                    clienteId: clienteRestaurado_1.id,
                                    clienteCodigo: clienteRestaurado_1.codigo,
                                    reenviado: true,
                                }];
                        case 19: 
                        // Otros casos archivados (archivado manual, etc.) deben restaurarse desde Archivados
                        throw new common_1.ConflictException("El cliente con documento ".concat(data.dni, " ya existe pero est\u00E1 archivado. Rest\u00E1uralo desde la secci\u00F3n de Archivados."));
                        case 20:
                            solicitadoPorId_2 = data.creadoPorId;
                            if (!!solicitadoPorId_2) return [3 /*break*/, 22];
                            return [4 /*yield*/, this.prisma.usuario.findFirst()];
                        case 21:
                            creador = _f.sent();
                            if (!creador) {
                                throw new common_1.NotFoundException('No existen usuarios en el sistema para asignar la creación');
                            }
                            solicitadoPorId_2 = creador.id;
                            _f.label = 22;
                        case 22: return [4 /*yield*/, this.prisma.usuario.findUnique({
                                where: { id: solicitadoPorId_2 },
                                select: { id: true, rol: true },
                            })];
                        case 23:
                            solicitante = _f.sent();
                            if (!solicitante) {
                                throw new common_1.NotFoundException('Usuario solicitante no encontrado');
                            }
                            codigo = "CLI-".concat(Date.now().toString().slice(-6));
                            return [4 /*yield*/, this.configuracionService.shouldAutoApproveClients()];
                        case 24:
                            autoAprobar = _f.sent();
                            estadoInicial = autoAprobar ? 'APROBADO' : 'PENDIENTE';
                            return [4 /*yield*/, this.prisma.cliente.create({
                                    data: {
                                        codigo: codigo,
                                        dni: data.dni,
                                        nombres: data.nombres,
                                        apellidos: data.apellidos,
                                        telefono: data.telefono,
                                        correo: data.correo,
                                        direccion: data.direccion,
                                        referencia: data.referencia,
                                        creadoPorId: solicitadoPorId_2,
                                        estadoAprobacion: estadoInicial,
                                        nivelRiesgo: 'VERDE',
                                        puntaje: 100,
                                    },
                                })];
                        case 25:
                            cliente_1 = _f.sent();
                            if (!(data.archivos &&
                                Array.isArray(data.archivos) &&
                                data.archivos.length > 0)) return [3 /*break*/, 27];
                            return [4 /*yield*/, this.prisma.multimedia.createMany({
                                    data: data.archivos.map(function (archivo) {
                                        var _a;
                                        return ({
                                            clienteId: cliente_1.id,
                                            tipoContenido: archivo.tipoContenido,
                                            tipoArchivo: archivo.tipoArchivo,
                                            formato: ((_a = archivo.nombreOriginal) === null || _a === void 0 ? void 0 : _a.split('.').pop()) || 'bin',
                                            nombreOriginal: archivo.nombreOriginal,
                                            nombreAlmacenamiento: archivo.nombreAlmacenamiento,
                                            ruta: archivo.ruta || archivo.path || '',
                                            url: archivo.url ||
                                                archivo.path ||
                                                (archivo.nombreAlmacenamiento
                                                    ? "/uploads/".concat(archivo.nombreAlmacenamiento)
                                                    : null),
                                            tamanoBytes: archivo.tamanoBytes,
                                            subidoPorId: solicitadoPorId_2,
                                            esPrincipal: archivo.tipoContenido === 'FOTO_PERFIL',
                                            estado: 'ACTIVO',
                                        });
                                    }),
                                })];
                        case 26:
                            _f.sent();
                            _f.label = 27;
                        case 27: return [4 /*yield*/, this.prisma.aprobacion.create({
                                data: __assign({ tipoAprobacion: 'NUEVO_CLIENTE', referenciaId: cliente_1.id, tablaReferencia: 'Cliente', solicitadoPorId: solicitadoPorId_2, estado: estadoInicial, datosSolicitud: JSON.stringify({
                                        dni: data.dni,
                                        nombres: data.nombres,
                                        apellidos: data.apellidos,
                                        telefono: data.telefono,
                                        correo: data.correo,
                                        direccion: data.direccion,
                                        referencia: data.referencia,
                                        archivos: data.archivos || [],
                                    }) }, (autoAprobar ? { aprobadoPorId: solicitadoPorId_2, revisadoEn: new Date() } : {})),
                            })];
                        case 28:
                            aprobacion = _f.sent();
                            if (!!autoAprobar) return [3 /*break*/, 38];
                            nombreSolicitante = 'Usuario';
                            _f.label = 29;
                        case 29:
                            _f.trys.push([29, 31, , 32]);
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: { id: solicitadoPorId_2 },
                                    select: { nombres: true, apellidos: true },
                                })];
                        case 30:
                            solicitante_2 = _f.sent();
                            if (solicitante_2) {
                                nombreSolicitante = "".concat(solicitante_2.nombres, " ").concat(solicitante_2.apellidos).trim() || nombreSolicitante;
                            }
                            return [3 /*break*/, 32];
                        case 31:
                            _c = _f.sent();
                            return [3 /*break*/, 32];
                        case 32:
                            _f.trys.push([32, 34, , 35]);
                            return [4 /*yield*/, this.notificacionesService.notifyApprovers({
                                    titulo: 'Nuevo cliente requiere aprobación',
                                    mensaje: "".concat(nombreSolicitante, " cre\u00F3 un nuevo cliente (").concat(data.nombres, " ").concat(data.apellidos, "). Requiere revisi\u00F3n."),
                                    tipo: 'CLIENTE',
                                    entidad: 'Aprobacion',
                                    entidadId: aprobacion.id,
                                    metadata: {
                                        tipoAprobacion: 'NUEVO_CLIENTE',
                                        clienteId: cliente_1.id,
                                        solicitanteId: solicitadoPorId_2,
                                        dni: data.dni,
                                        nombres: data.nombres,
                                        apellidos: data.apellidos,
                                    },
                                })];
                        case 33:
                            _f.sent();
                            return [3 /*break*/, 35];
                        case 34:
                            _d = _f.sent();
                            return [3 /*break*/, 35];
                        case 35:
                            _f.trys.push([35, 37, , 38]);
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: solicitadoPorId_2,
                                    titulo: 'Solicitud enviada',
                                    mensaje: 'Tu solicitud fue enviada con éxito y quedó pendiente de aprobación.',
                                    tipo: 'INFORMATIVO',
                                    entidad: 'Aprobacion',
                                    entidadId: aprobacion.id,
                                    metadata: {
                                        tipoAprobacion: 'NUEVO_CLIENTE',
                                        clienteId: cliente_1.id,
                                    },
                                })];
                        case 36:
                            _f.sent();
                            return [3 /*break*/, 38];
                        case 37:
                            _e = _f.sent();
                            return [3 /*break*/, 38];
                        case 38:
                            this.notificacionesGateway.broadcastClientesActualizados({
                                accion: 'CREAR',
                                clienteId: cliente_1.id,
                            });
                            this.logger.log("[DEBUG] Cliente creado con estado ".concat(estadoInicial, " (ID: ").concat(cliente_1.id, ") y aprobaci\u00F3n creada (ID: ").concat(aprobacion.id, ")."));
                            return [2 /*return*/, {
                                    mensaje: autoAprobar ? 'Cliente creado y aprobado automáticamente.' : 'Cliente creado exitosamente. Pendiente de aprobación.',
                                    aprobacionId: aprobacion.id,
                                    clienteId: cliente_1.id,
                                    clienteCodigo: codigo,
                                }];
                        case 39:
                            error_3 = _f.sent();
                            // Prisma errors (DB constraints, invalid relations, etc.)
                            if (error_3 instanceof client_2.Prisma.PrismaClientKnownRequestError) {
                                this.logger.error("[CLIENTS] Prisma error creating client (code=".concat(error_3.code, "): ").concat(error_3.message));
                                // Unique constraint (e.g. dni/codigo)
                                if (error_3.code === 'P2002') {
                                    throw new common_1.ConflictException('Ya existe un cliente con esos datos.');
                                }
                                // FK constraint (e.g. creadoPorId/aprobadoPorId/subidoPorId)
                                if (error_3.code === 'P2003') {
                                    throw new common_1.BadRequestException('Datos inválidos: referencia relacionada no existe (usuario/relación).');
                                }
                                throw new common_1.BadRequestException({
                                    message: 'Datos inválidos para crear el cliente.',
                                    code: error_3.code,
                                    meta: error_3.meta,
                                });
                            }
                            if (error_3 instanceof client_2.Prisma.PrismaClientValidationError) {
                                this.logger.error("[CLIENTS] Prisma validation error creating client: ".concat(error_3.message));
                                throw new common_1.BadRequestException({
                                    message: 'Datos inválidos para crear el cliente.',
                                    details: error_3.message,
                                });
                            }
                            this.logger.error('Error creating client:', error_3);
                            throw new common_1.InternalServerErrorException('Error interno del servidor');
                        case 40: return [2 /*return*/];
                    }
                });
            });
        };
        ClientsService_1.prototype.approveClient = function (id, aprobadoPorId, datosAprobados) {
            return __awaiter(this, void 0, void 0, function () {
                var aprobacion, datosSolicitud, cliente, aprobadorInfo, error_4;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 6, , 7]);
                            return [4 /*yield*/, this.prisma.aprobacion.findUnique({
                                    where: { id: id },
                                })];
                        case 1:
                            aprobacion = _a.sent();
                            if (!aprobacion) {
                                throw new common_1.NotFoundException('Aprobación no encontrada');
                            }
                            if (aprobacion.tipoAprobacion !== 'NUEVO_CLIENTE') {
                                throw new Error('Tipo de aprobación inválido');
                            }
                            datosSolicitud = JSON.parse(aprobacion.datosSolicitud);
                            return [4 /*yield*/, this.prisma.cliente.update({
                                    where: { id: aprobacion.referenciaId },
                                    data: {
                                        estadoAprobacion: 'APROBADO',
                                        aprobadoPorId: aprobadoPorId,
                                        // Actualizar datos si cambiaron durante la aprobación
                                        dni: (datosAprobados === null || datosAprobados === void 0 ? void 0 : datosAprobados.dni) || datosSolicitud.dni,
                                        nombres: (datosAprobados === null || datosAprobados === void 0 ? void 0 : datosAprobados.nombres) || datosSolicitud.nombres,
                                        apellidos: (datosAprobados === null || datosAprobados === void 0 ? void 0 : datosAprobados.apellidos) || datosSolicitud.apellidos,
                                        telefono: (datosAprobados === null || datosAprobados === void 0 ? void 0 : datosAprobados.telefono) || datosSolicitud.telefono,
                                        correo: (datosAprobados === null || datosAprobados === void 0 ? void 0 : datosAprobados.correo) || datosSolicitud.correo,
                                        direccion: (datosAprobados === null || datosAprobados === void 0 ? void 0 : datosAprobados.direccion) || datosSolicitud.direccion,
                                        referencia: (datosAprobados === null || datosAprobados === void 0 ? void 0 : datosAprobados.referencia) || datosSolicitud.referencia,
                                    },
                                })];
                        case 2:
                            cliente = _a.sent();
                            // Los archivos ya fueron creados en createClient, no es necesario volver a crearlos aquí
                            // Actualizar la aprobación
                            return [4 /*yield*/, this.prisma.aprobacion.update({
                                    where: { id: id },
                                    data: {
                                        aprobadoPorId: aprobadoPorId,
                                        estado: 'APROBADO',
                                        datosAprobados: datosAprobados
                                            ? JSON.stringify(datosAprobados)
                                            : undefined,
                                        revisadoEn: new Date(),
                                    },
                                })];
                        case 3:
                            // Los archivos ya fueron creados en createClient, no es necesario volver a crearlos aquí
                            // Actualizar la aprobación
                            _a.sent();
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: { id: aprobadoPorId },
                                    select: { nombres: true, apellidos: true },
                                })];
                        case 4:
                            aprobadorInfo = _a.sent();
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: aprobacion.solicitadoPorId,
                                    titulo: 'Cliente Aprobado',
                                    mensaje: "Tu solicitud de cliente ".concat(datosSolicitud.nombres, " ").concat(datosSolicitud.apellidos, " (DNI: ").concat(datosSolicitud.dni, ") ha sido aprobada por ").concat(aprobadorInfo === null || aprobadorInfo === void 0 ? void 0 : aprobadorInfo.nombres, " ").concat(aprobadorInfo === null || aprobadorInfo === void 0 ? void 0 : aprobadorInfo.apellidos),
                                    tipo: 'APROBACION',
                                    entidad: 'Cliente',
                                    entidadId: cliente.id,
                                    metadata: {
                                        accion: 'APROBADO',
                                        clienteNombre: "".concat(datosSolicitud.nombres, " ").concat(datosSolicitud.apellidos),
                                        clienteDni: datosSolicitud.dni,
                                        aprobadoPor: "".concat(aprobadorInfo === null || aprobadorInfo === void 0 ? void 0 : aprobadorInfo.nombres, " ").concat(aprobadorInfo === null || aprobadorInfo === void 0 ? void 0 : aprobadorInfo.apellidos),
                                    },
                                })];
                        case 5:
                            _a.sent();
                            return [2 /*return*/, cliente];
                        case 6:
                            error_4 = _a.sent();
                            this.logger.error("Error approving client ".concat(id, ":"), error_4);
                            throw error_4;
                        case 7: return [2 /*return*/];
                    }
                });
            });
        };
        ClientsService_1.prototype.rejectClient = function (id, rechazadoPorId, razon) {
            return __awaiter(this, void 0, void 0, function () {
                var aprobacion, datosSolicitud, clienteRechazado, rechazadorInfo, error_5;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 7, , 8]);
                            return [4 /*yield*/, this.prisma.aprobacion.findUnique({
                                    where: { id: id },
                                })];
                        case 1:
                            aprobacion = _a.sent();
                            if (!aprobacion) {
                                throw new common_1.NotFoundException('Aprobación no encontrada');
                            }
                            if (aprobacion.tipoAprobacion !== 'NUEVO_CLIENTE') {
                                throw new Error('Tipo de aprobación inválido');
                            }
                            datosSolicitud = JSON.parse(aprobacion.datosSolicitud);
                            // Actualizar la aprobación como rechazada
                            return [4 /*yield*/, this.prisma.aprobacion.update({
                                    where: { id: id },
                                    data: {
                                        aprobadoPorId: rechazadoPorId,
                                        estado: 'RECHAZADO',
                                        datosAprobados: razon ? JSON.stringify({ razon: razon }) : undefined,
                                        revisadoEn: new Date(),
                                    },
                                })];
                        case 2:
                            // Actualizar la aprobación como rechazada
                            _a.sent();
                            return [4 /*yield*/, this.prisma.cliente.update({
                                    where: { id: aprobacion.referenciaId },
                                    data: {
                                        estadoAprobacion: 'RECHAZADO',
                                        eliminadoEn: new Date(), // Lo ocultamos de la lista normal
                                    },
                                })];
                        case 3:
                            clienteRechazado = _a.sent();
                            // Registrar en auditoría
                            return [4 /*yield*/, this.auditService.create({
                                    usuarioId: rechazadoPorId,
                                    accion: 'RECHAZAR_CLIENTE',
                                    entidad: 'Cliente',
                                    entidadId: clienteRechazado.id,
                                    datosAnteriores: {
                                        nombres: clienteRechazado.nombres,
                                        apellidos: clienteRechazado.apellidos,
                                        dni: clienteRechazado.dni
                                    },
                                    datosNuevos: {
                                        estadoAprobacion: 'RECHAZADO',
                                        razon: razon
                                    },
                                })];
                        case 4:
                            // Registrar en auditoría
                            _a.sent();
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: { id: rechazadoPorId },
                                    select: { nombres: true, apellidos: true },
                                })];
                        case 5:
                            rechazadorInfo = _a.sent();
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: aprobacion.solicitadoPorId,
                                    titulo: 'Cliente Rechazado',
                                    mensaje: "Tu solicitud de cliente ".concat(datosSolicitud.nombres, " ").concat(datosSolicitud.apellidos, " (DNI: ").concat(datosSolicitud.dni, ") ha sido rechazada por ").concat(rechazadorInfo === null || rechazadorInfo === void 0 ? void 0 : rechazadorInfo.nombres, " ").concat(rechazadorInfo === null || rechazadorInfo === void 0 ? void 0 : rechazadorInfo.apellidos).concat(razon ? ". Raz\u00F3n: ".concat(razon) : ''),
                                    tipo: 'APROBACION',
                                    entidad: 'Aprobacion',
                                    entidadId: id,
                                    metadata: {
                                        accion: 'RECHAZADO',
                                        clienteNombre: "".concat(datosSolicitud.nombres, " ").concat(datosSolicitud.apellidos),
                                        clienteDni: datosSolicitud.dni,
                                        rechazadoPor: "".concat(rechazadorInfo === null || rechazadorInfo === void 0 ? void 0 : rechazadorInfo.nombres, " ").concat(rechazadorInfo === null || rechazadorInfo === void 0 ? void 0 : rechazadorInfo.apellidos),
                                        razon: razon || 'No especificada',
                                    },
                                })];
                        case 6:
                            _a.sent();
                            return [2 /*return*/, {
                                    mensaje: 'Solicitud de cliente rechazada exitosamente',
                                    aprobacionId: id,
                                }];
                        case 7:
                            error_5 = _a.sent();
                            this.logger.error("Error rejecting client ".concat(id, ":"), error_5);
                            throw error_5;
                        case 8: return [2 /*return*/];
                    }
                });
            });
        };
        ClientsService_1.prototype.updateClient = function (id, data) {
            return __awaiter(this, void 0, void 0, function () {
                var cliente_2, archivos, clientData, clienteActualizado, eliminados, error_6;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 6, , 7]);
                            return [4 /*yield*/, this.prisma.cliente.findUnique({
                                    where: {
                                        id: id,
                                        eliminadoEn: null,
                                    },
                                })];
                        case 1:
                            cliente_2 = _a.sent();
                            if (!cliente_2) {
                                throw new common_1.NotFoundException('Cliente no encontrado');
                            }
                            archivos = data.archivos, clientData = __rest(data, ["archivos"]);
                            return [4 /*yield*/, this.prisma.cliente.update({
                                    where: { id: id },
                                    data: __assign(__assign({}, clientData), { ultimaActualizacionRiesgo: clientData.nivelRiesgo || clientData.puntaje ? new Date() : undefined }),
                                })];
                        case 2:
                            clienteActualizado = _a.sent();
                            if (!(archivos && Array.isArray(archivos))) return [3 /*break*/, 5];
                            this.logger.log("[UPDATE] Procesando ".concat(archivos.length, " archivos para cliente ").concat(id));
                            return [4 /*yield*/, this.prisma.multimedia.updateMany({
                                    where: {
                                        clienteId: id,
                                        estado: 'ACTIVO',
                                    },
                                    data: {
                                        estado: 'ELIMINADO',
                                        eliminadoEn: new Date(),
                                    },
                                })];
                        case 3:
                            eliminados = _a.sent();
                            this.logger.log("[UPDATE] ".concat(eliminados.count, " archivos antiguos marcados como ELIMINADOS"));
                            if (!(archivos.length > 0)) return [3 /*break*/, 5];
                            return [4 /*yield*/, this.prisma.multimedia.createMany({
                                    data: archivos.map(function (archivo) {
                                        var _a, _b;
                                        return ({
                                            clienteId: id,
                                            tipoContenido: archivo.tipoContenido,
                                            tipoArchivo: archivo.tipoArchivo || 'image/jpeg',
                                            formato: archivo.formato || ((_a = archivo.tipoArchivo) === null || _a === void 0 ? void 0 : _a.split('/')[1]) || ((_b = archivo.nombreOriginal) === null || _b === void 0 ? void 0 : _b.split('.').pop()) || 'jpg',
                                            nombreOriginal: archivo.nombreOriginal,
                                            nombreAlmacenamiento: archivo.nombreAlmacenamiento || archivo.nombreOriginal,
                                            ruta: archivo.ruta || archivo.path || '',
                                            url: archivo.url || archivo.ruta || archivo.path || '',
                                            tamanoBytes: archivo.tamanoBytes || 0,
                                            subidoPorId: cliente_2.creadoPorId,
                                            estado: 'ACTIVO',
                                        });
                                    }),
                                })];
                        case 4:
                            _a.sent();
                            this.logger.log("[UPDATE] ".concat(archivos.length, " archivos nuevos creados"));
                            _a.label = 5;
                        case 5: 
                        // Devolver cliente con archivos actualizados
                        return [2 /*return*/, this.prisma.cliente.findUnique({
                                where: { id: id },
                                include: {
                                    archivos: {
                                        where: { estado: 'ACTIVO' },
                                    },
                                },
                            })];
                        case 6:
                            error_6 = _a.sent();
                            this.logger.error("Error updating client ".concat(id, ":"), error_6);
                            throw error_6;
                        case 7: return [2 /*return*/];
                    }
                });
            });
        };
        ClientsService_1.prototype.addToBlacklist = function (id, razon, agregadoPorId) {
            return __awaiter(this, void 0, void 0, function () {
                var cliente, clienteActualizado, error_7;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 4, , 5]);
                            return [4 /*yield*/, this.prisma.cliente.findUnique({
                                    where: {
                                        id: id,
                                        eliminadoEn: null,
                                    },
                                })];
                        case 1:
                            cliente = _a.sent();
                            if (!cliente) {
                                throw new common_1.NotFoundException('Cliente no encontrado');
                            }
                            return [4 /*yield*/, this.prisma.cliente.update({
                                    where: { id: id },
                                    data: {
                                        enListaNegra: true,
                                        razonListaNegra: razon,
                                        fechaListaNegra: new Date(),
                                        agregadoListaNegraPorId: agregadoPorId,
                                        nivelRiesgo: 'LISTA_NEGRA',
                                        puntaje: 0,
                                    },
                                })];
                        case 2:
                            clienteActualizado = _a.sent();
                            // Registrar en auditoría
                            return [4 /*yield*/, this.auditService.create({
                                    usuarioId: agregadoPorId,
                                    accion: 'ARCHIVAR_CLIENTE',
                                    entidad: 'Cliente',
                                    entidadId: id,
                                    datosAnteriores: {
                                        nombres: cliente.nombres,
                                        apellidos: cliente.apellidos,
                                        dni: cliente.dni
                                    },
                                    datosNuevos: {
                                        enListaNegra: true,
                                        razon: razon
                                    },
                                })];
                        case 3:
                            // Registrar en auditoría
                            _a.sent();
                            return [2 /*return*/, clienteActualizado];
                        case 4:
                            error_7 = _a.sent();
                            this.logger.error("Error adding client ".concat(id, " to blacklist:"), error_7);
                            throw error_7;
                        case 5: return [2 /*return*/];
                    }
                });
            });
        };
        ClientsService_1.prototype.removeFromBlacklist = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var cliente, error_8;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            return [4 /*yield*/, this.prisma.cliente.findUnique({
                                    where: {
                                        id: id,
                                        eliminadoEn: null,
                                    },
                                })];
                        case 1:
                            cliente = _a.sent();
                            if (!cliente) {
                                throw new common_1.NotFoundException('Cliente no encontrado');
                            }
                            return [4 /*yield*/, this.prisma.cliente.update({
                                    where: { id: id },
                                    data: {
                                        enListaNegra: false,
                                        razonListaNegra: null,
                                        fechaListaNegra: null,
                                        agregadoListaNegraPorId: null,
                                        nivelRiesgo: 'VERDE',
                                        puntaje: 80, // Puntaje base después de salir de lista negra
                                    },
                                })];
                        case 2: return [2 /*return*/, _a.sent()];
                        case 3:
                            error_8 = _a.sent();
                            this.logger.error("Error removing client ".concat(id, " from blacklist:"), error_8);
                            throw error_8;
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        ClientsService_1.prototype.assignToRoute = function (clienteId, rutaId, cobradorId, diaSemana) {
            return __awaiter(this, void 0, void 0, function () {
                var asignacionExistente, error_9;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 5, , 6]);
                            return [4 /*yield*/, this.prisma.asignacionRuta.findFirst({
                                    where: {
                                        clienteId: clienteId,
                                        activa: true,
                                    },
                                })];
                        case 1:
                            asignacionExistente = _a.sent();
                            if (!asignacionExistente) return [3 /*break*/, 3];
                            // Desactivar asignación anterior
                            return [4 /*yield*/, this.prisma.asignacionRuta.update({
                                    where: { id: asignacionExistente.id },
                                    data: { activa: false },
                                })];
                        case 2:
                            // Desactivar asignación anterior
                            _a.sent();
                            _a.label = 3;
                        case 3: return [4 /*yield*/, this.prisma.asignacionRuta.create({
                                data: {
                                    rutaId: rutaId,
                                    clienteId: clienteId,
                                    cobradorId: cobradorId,
                                    diaSemana: diaSemana,
                                    ordenVisita: 0,
                                    activa: true,
                                },
                            })];
                        case 4: 
                        // Crear nueva asignación
                        return [2 /*return*/, _a.sent()];
                        case 5:
                            error_9 = _a.sent();
                            this.logger.error("Error assigning client ".concat(clienteId, " to route:"), error_9);
                            throw error_9;
                        case 6: return [2 /*return*/];
                    }
                });
            });
        };
        /**
         * Exportar listado de clientes en Excel o PDF.
         * Reutiliza la misma consulta de getAllClients pero sin transformaciones de score.
         */
        ClientsService_1.prototype.exportarClientes = function (formato, filtros) {
            return __awaiter(this, void 0, void 0, function () {
                var where, s, clientes, filas, fecha;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            where = { eliminadoEn: null };
                            if ((filtros === null || filtros === void 0 ? void 0 : filtros.nivelRiesgo) && filtros.nivelRiesgo !== 'all') {
                                where.nivelRiesgo = filtros.nivelRiesgo;
                            }
                            if (filtros === null || filtros === void 0 ? void 0 : filtros.ruta) {
                                where.asignacionesRuta = { some: { rutaId: filtros.ruta, activa: true } };
                            }
                            if ((_a = filtros === null || filtros === void 0 ? void 0 : filtros.search) === null || _a === void 0 ? void 0 : _a.trim()) {
                                s = filtros.search.trim();
                                where.OR = [
                                    { nombres: { contains: s, mode: 'insensitive' } },
                                    { apellidos: { contains: s, mode: 'insensitive' } },
                                    { dni: { contains: s, mode: 'insensitive' } },
                                    { telefono: { contains: s, mode: 'insensitive' } },
                                    { codigo: { contains: s, mode: 'insensitive' } },
                                ];
                            }
                            return [4 /*yield*/, this.prisma.cliente.findMany({
                                    where: where,
                                    include: {
                                        asignacionesRuta: {
                                            where: { activa: true },
                                            include: { ruta: { select: { id: true, nombre: true } } },
                                            take: 1,
                                        },
                                        prestamos: {
                                            where: { eliminadoEn: null },
                                            select: { id: true, estado: true, saldoPendiente: true },
                                        },
                                    },
                                    orderBy: { creadoEn: 'desc' },
                                })];
                        case 1:
                            clientes = _b.sent();
                            filas = clientes.map(function (c) {
                                var _a, _b, _c, _d;
                                var prestamosActivos = c.prestamos.filter(function (p) { return p.estado === 'ACTIVO'; }).length;
                                var montoTotal = c.prestamos.reduce(function (s, p) { var _a; return s + Number((_a = p.saldoPendiente) !== null && _a !== void 0 ? _a : 0); }, 0);
                                var montoMora = c.prestamos
                                    .filter(function (p) { return p.estado === 'EN_MORA'; })
                                    .reduce(function (s, p) { var _a; return s + Number((_a = p.saldoPendiente) !== null && _a !== void 0 ? _a : 0); }, 0);
                                var rutaNombre = (_d = (_c = (_b = (_a = c.asignacionesRuta) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.ruta) === null || _c === void 0 ? void 0 : _c.nombre) !== null && _d !== void 0 ? _d : '';
                                return {
                                    codigo: c.codigo,
                                    nombres: c.nombres,
                                    apellidos: c.apellidos,
                                    dni: c.dni,
                                    telefono: c.telefono,
                                    correo: c.correo,
                                    direccion: c.direccion,
                                    nivelRiesgo: c.nivelRiesgo,
                                    estadoAprobacion: c.estadoAprobacion,
                                    prestamosActivos: prestamosActivos,
                                    montoTotal: montoTotal,
                                    montoMora: montoMora,
                                    rutaNombre: rutaNombre,
                                    creadoEn: c.creadoEn,
                                };
                            });
                            fecha = new Date().toISOString().split('T')[0];
                            return [2 /*return*/, formato === 'pdf'
                                    ? (0, clientes_template_1.generarPDFClientes)(filas, fecha)
                                    : (0, clientes_template_1.generarExcelClientes)(filas, fecha)];
                    }
                });
            });
        };
        return ClientsService_1;
    }());
    __setFunctionName(_classThis, "ClientsService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ClientsService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ClientsService = _classThis;
}();
exports.ClientsService = ClientsService;
