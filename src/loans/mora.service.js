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
exports.MoraService = exports.MORA_THRESHOLDS = void 0;
exports.etiquetaMora = etiquetaMora;
var common_1 = require("@nestjs/common");
/**
 * Umbrales de días en mora para cada nivel de mora.
 *
 * Mínimo    → 0 días (estado por defecto, sin retraso) → VERDE
 * Leve      → 1 a 2 días                              → VERDE
 * Precaución→ 3 a 4 días                              → AMARILLO
 * Moderado  → 5 a 7 días                              → AMARILLO
 * Crítico   → 8 o más días                            → ROJO
 */
exports.MORA_THRESHOLDS = {
    LEVE: 1, // 1 día  → Leve, sigue en VERDE
    PRECAUCION: 3, // 3 días → Precaución, sube a AMARILLO
    MODERADO: 5, // 5 días → Moderado, sigue en AMARILLO
    CRITICO: 8, // 8+ días→ Crítico, sube a ROJO
};
/**
 * Etiqueta legible de mora según días vencidos.
 * "Mínimo" es el estado base (0 días = al día, siempre VERDE).
 */
function etiquetaMora(dias) {
    if (dias >= exports.MORA_THRESHOLDS.CRITICO)
        return 'Crítico'; // 8+
    if (dias >= exports.MORA_THRESHOLDS.MODERADO)
        return 'Moderado'; // 5-7
    if (dias >= exports.MORA_THRESHOLDS.PRECAUCION)
        return 'Precaución'; // 3-4
    if (dias >= exports.MORA_THRESHOLDS.LEVE)
        return 'Leve'; // 1-2
    return 'Mínimo'; // 0 días → siempre verde, estado base
}
/** Emoji de alerta según etiqueta */
function emojiMora(etiqueta) {
    switch (etiqueta) {
        case 'Crítico': return '🔴';
        case 'Moderado': return '🟠';
        case 'Precaución': return '🟡';
        case 'Leve': return '🟢';
        default: return '✅';
    }
}
/** Nivel de riesgo del schema Prisma (VERDE / AMARILLO / ROJO) según días en mora */
function nivelRiesgoPorDias(dias) {
    if (dias >= exports.MORA_THRESHOLDS.CRITICO)
        return 'ROJO'; // 8+
    if (dias >= exports.MORA_THRESHOLDS.PRECAUCION)
        return 'AMARILLO'; // 3-7
    return 'VERDE'; // 0-2 → Mínimo / Leve, siguen en verde
}
/**
 * Determina el "nivel mora interno" (1-5) para detectar cambios de sub-nivel
 * aunque el nivelRiesgo del schema sea el mismo (ej: Precaución y Moderado son AMARILLO).
 */
function nivelMoraNumerico(dias) {
    if (dias >= exports.MORA_THRESHOLDS.CRITICO)
        return 5; // Crítico
    if (dias >= exports.MORA_THRESHOLDS.MODERADO)
        return 4; // Moderado
    if (dias >= exports.MORA_THRESHOLDS.PRECAUCION)
        return 3; // Precaución
    if (dias >= exports.MORA_THRESHOLDS.LEVE)
        return 2; // Leve
    return 1; // Mínimo
}
var MoraService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var MoraService = _classThis = /** @class */ (function () {
        function MoraService_1(prisma, notificacionesService, notificacionesGateway, pushService) {
            this.prisma = prisma;
            this.notificacionesService = notificacionesService;
            this.notificacionesGateway = notificacionesGateway;
            this.pushService = pushService;
            this.logger = new common_1.Logger(MoraService.name);
            // Cache en memoria para detectar cambios de sub-nivel entre ejecuciones
            // Estructura: clienteId → nivelMoraNumerico anterior
            this.cacheNivelesMora = new Map();
        }
        MoraService_1.prototype.onModuleInit = function () {
            return __awaiter(this, void 0, void 0, function () {
                var result, err_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.log('⏰ [MORA] Procesando mora automática al arranque...');
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, this.procesarMoraAutomatica()];
                        case 2:
                            result = _a.sent();
                            this.logger.log("\u2705 [MORA] Completado: ".concat(result.cuotasVencidas, " cuotas vencidas, ") +
                                "".concat(result.prestamosEnMoraActualizados, " pr\u00E9stamos \u2192 EN_MORA, ") +
                                "".concat(result.prestamosActivosRecuperados, " recuperados, ") +
                                "".concat(result.notificacionesEnviadas, " notificaciones enviadas"));
                            return [3 /*break*/, 4];
                        case 3:
                            err_1 = _a.sent();
                            this.logger.error("\u274C [MORA] Error al arranque: ".concat(err_1.message));
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        /**
         * Proceso principal de mora.
         * Se ejecuta al arrancar el servidor y puede llamarse manualmente vía endpoint.
         *
         * Pasos:
         * 1. Marcar cuotas PENDIENTE/PARCIAL vencidas como VENCIDA
         * 2. Préstamos ACTIVOS con cuotas VENCIDAS → EN_MORA
         * 3. Préstamos EN_MORA sin cuotas VENCIDAS → ACTIVO (ya pagaron)
         * 4. Actualizar nivelRiesgo del cliente + enviar notificaciones al cambiar de nivel
         * 5. Broadcast WebSocket para refrescar el frontend
         */
        MoraService_1.prototype.procesarMoraAutomatica = function () {
            return __awaiter(this, void 0, void 0, function () {
                var hoy, resultado, cuotasUpdate, err_2, prestamosConVencidas, _i, prestamosConVencidas_1, prest, err_3, err_4, prestamosRecuperados, _a, prestamosRecuperados_1, prest, err_5, err_6, clientesConPrestamos, _b, clientesConPrestamos_1, cliente, diasMoraMax, _c, _d, prestamo, cuota, fechaVenc, dias, nuevoNivelPrisma, nuevaEtiqueta, nuevoNivelNumerico, nivelNumericoAnterior, subioDeNivel, esNuevoEnMora, nombreCliente, asignacion, ruta, cobrador, emoji, tituloNotif, mensajeNotif, metadataNotif, err_7, err_8, err_9, err_10, err_11, err_12;
                var _e, _f;
                return __generator(this, function (_g) {
                    switch (_g.label) {
                        case 0:
                            hoy = new Date();
                            hoy.setHours(0, 0, 0, 0);
                            resultado = {
                                cuotasVencidas: 0,
                                prestamosEnMoraActualizados: 0,
                                prestamosActivosRecuperados: 0,
                                clientesRiesgoActualizado: 0,
                                notificacionesEnviadas: 0,
                                errores: [],
                                procesadoEn: new Date().toISOString(),
                            };
                            _g.label = 1;
                        case 1:
                            _g.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, this.prisma.cuota.updateMany({
                                    where: {
                                        estado: { in: ['PENDIENTE', 'PARCIAL'] },
                                        fechaVencimiento: { lt: hoy },
                                        prestamo: {
                                            estado: { in: ['ACTIVO', 'EN_MORA'] },
                                            eliminadoEn: null,
                                        },
                                    },
                                    data: { estado: 'VENCIDA' },
                                })];
                        case 2:
                            cuotasUpdate = _g.sent();
                            resultado.cuotasVencidas = cuotasUpdate.count;
                            this.logger.log("[MORA] Paso 1: ".concat(cuotasUpdate.count, " cuotas \u2192 VENCIDA"));
                            return [3 /*break*/, 4];
                        case 3:
                            err_2 = _g.sent();
                            resultado.errores.push("Paso 1: ".concat(err_2.message));
                            this.logger.error('[MORA] Error en Paso 1:', err_2.message);
                            return [3 /*break*/, 4];
                        case 4:
                            _g.trys.push([4, 12, , 13]);
                            return [4 /*yield*/, this.prisma.prestamo.findMany({
                                    where: {
                                        estado: 'ACTIVO',
                                        eliminadoEn: null,
                                        cuotas: { some: { estado: 'VENCIDA' } },
                                    },
                                    select: {
                                        id: true,
                                        numeroPrestamo: true,
                                        clienteId: true,
                                        cliente: { select: { nombres: true, apellidos: true } },
                                    },
                                })];
                        case 5:
                            prestamosConVencidas = _g.sent();
                            _i = 0, prestamosConVencidas_1 = prestamosConVencidas;
                            _g.label = 6;
                        case 6:
                            if (!(_i < prestamosConVencidas_1.length)) return [3 /*break*/, 11];
                            prest = prestamosConVencidas_1[_i];
                            _g.label = 7;
                        case 7:
                            _g.trys.push([7, 9, , 10]);
                            return [4 /*yield*/, this.prisma.prestamo.update({
                                    where: { id: prest.id },
                                    data: { estado: 'EN_MORA' },
                                })];
                        case 8:
                            _g.sent();
                            resultado.prestamosEnMoraActualizados++;
                            return [3 /*break*/, 10];
                        case 9:
                            err_3 = _g.sent();
                            resultado.errores.push("Pr\u00E9stamo ".concat(prest.numeroPrestamo, " \u2192 EN_MORA: ").concat(err_3.message));
                            return [3 /*break*/, 10];
                        case 10:
                            _i++;
                            return [3 /*break*/, 6];
                        case 11:
                            this.logger.log("[MORA] Paso 2: ".concat(resultado.prestamosEnMoraActualizados, " pr\u00E9stamos \u2192 EN_MORA"));
                            return [3 /*break*/, 13];
                        case 12:
                            err_4 = _g.sent();
                            resultado.errores.push("Paso 2: ".concat(err_4.message));
                            this.logger.error('[MORA] Error en Paso 2:', err_4.message);
                            return [3 /*break*/, 13];
                        case 13:
                            _g.trys.push([13, 21, , 22]);
                            return [4 /*yield*/, this.prisma.prestamo.findMany({
                                    where: {
                                        estado: 'EN_MORA',
                                        eliminadoEn: null,
                                        cuotas: { none: { estado: 'VENCIDA' } },
                                        saldoPendiente: { gt: 0 },
                                    },
                                    select: { id: true, numeroPrestamo: true },
                                })];
                        case 14:
                            prestamosRecuperados = _g.sent();
                            _a = 0, prestamosRecuperados_1 = prestamosRecuperados;
                            _g.label = 15;
                        case 15:
                            if (!(_a < prestamosRecuperados_1.length)) return [3 /*break*/, 20];
                            prest = prestamosRecuperados_1[_a];
                            _g.label = 16;
                        case 16:
                            _g.trys.push([16, 18, , 19]);
                            return [4 /*yield*/, this.prisma.prestamo.update({
                                    where: { id: prest.id },
                                    data: { estado: 'ACTIVO' },
                                })];
                        case 17:
                            _g.sent();
                            resultado.prestamosActivosRecuperados++;
                            return [3 /*break*/, 19];
                        case 18:
                            err_5 = _g.sent();
                            resultado.errores.push("Pr\u00E9stamo ".concat(prest.numeroPrestamo, " \u2192 ACTIVO: ").concat(err_5.message));
                            return [3 /*break*/, 19];
                        case 19:
                            _a++;
                            return [3 /*break*/, 15];
                        case 20:
                            this.logger.log("[MORA] Paso 3: ".concat(resultado.prestamosActivosRecuperados, " pr\u00E9stamos recuperados \u2192 ACTIVO"));
                            return [3 /*break*/, 22];
                        case 21:
                            err_6 = _g.sent();
                            resultado.errores.push("Paso 3: ".concat(err_6.message));
                            this.logger.error('[MORA] Error en Paso 3:', err_6.message);
                            return [3 /*break*/, 22];
                        case 22:
                            _g.trys.push([22, 48, , 49]);
                            return [4 /*yield*/, this.prisma.cliente.findMany({
                                    where: {
                                        enListaNegra: false,
                                        prestamos: {
                                            some: {
                                                estado: { in: ['ACTIVO', 'EN_MORA'] },
                                                eliminadoEn: null,
                                            },
                                        },
                                    },
                                    select: {
                                        id: true,
                                        nombres: true,
                                        apellidos: true,
                                        dni: true,
                                        telefono: true,
                                        nivelRiesgo: true,
                                        asignacionesRuta: {
                                            where: { activa: true },
                                            take: 1,
                                            select: {
                                                ruta: {
                                                    select: {
                                                        id: true,
                                                        nombre: true,
                                                        zona: true,
                                                        cobrador: {
                                                            select: {
                                                                id: true,
                                                                nombres: true,
                                                                apellidos: true,
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                        prestamos: {
                                            where: {
                                                estado: { in: ['ACTIVO', 'EN_MORA'] },
                                                eliminadoEn: null,
                                            },
                                            select: {
                                                numeroPrestamo: true,
                                                saldoPendiente: true,
                                                cuotas: {
                                                    where: { estado: 'VENCIDA' },
                                                    orderBy: { fechaVencimiento: 'asc' },
                                                    take: 1,
                                                    select: { fechaVencimiento: true, monto: true },
                                                },
                                            },
                                        },
                                    },
                                })];
                        case 23:
                            clientesConPrestamos = _g.sent();
                            _b = 0, clientesConPrestamos_1 = clientesConPrestamos;
                            _g.label = 24;
                        case 24:
                            if (!(_b < clientesConPrestamos_1.length)) return [3 /*break*/, 46];
                            cliente = clientesConPrestamos_1[_b];
                            _g.label = 25;
                        case 25:
                            _g.trys.push([25, 44, , 45]);
                            diasMoraMax = 0;
                            for (_c = 0, _d = cliente.prestamos; _c < _d.length; _c++) {
                                prestamo = _d[_c];
                                if (prestamo.cuotas.length > 0) {
                                    cuota = prestamo.cuotas[0];
                                    fechaVenc = new Date(cuota.fechaVencimiento);
                                    dias = Math.floor((hoy.getTime() - fechaVenc.getTime()) / (1000 * 60 * 60 * 24));
                                    if (dias > diasMoraMax)
                                        diasMoraMax = dias;
                                }
                            }
                            nuevoNivelPrisma = diasMoraMax > 0
                                ? nivelRiesgoPorDias(diasMoraMax)
                                : 'VERDE';
                            nuevaEtiqueta = etiquetaMora(diasMoraMax);
                            nuevoNivelNumerico = nivelMoraNumerico(diasMoraMax);
                            nivelNumericoAnterior = (_e = this.cacheNivelesMora.get(cliente.id)) !== null && _e !== void 0 ? _e : 1;
                            subioDeNivel = nuevoNivelNumerico > nivelNumericoAnterior && diasMoraMax > 0;
                            esNuevoEnMora = nivelNumericoAnterior === 1 && nuevoNivelNumerico > 1;
                            if (!(cliente.nivelRiesgo !== nuevoNivelPrisma)) return [3 /*break*/, 27];
                            return [4 /*yield*/, this.prisma.cliente.update({
                                    where: { id: cliente.id },
                                    data: {
                                        nivelRiesgo: nuevoNivelPrisma,
                                        ultimaActualizacionRiesgo: new Date(),
                                    },
                                })];
                        case 26:
                            _g.sent();
                            resultado.clientesRiesgoActualizado++;
                            _g.label = 27;
                        case 27:
                            // Actualizar cache
                            this.cacheNivelesMora.set(cliente.id, nuevoNivelNumerico);
                            if (!(subioDeNivel || esNuevoEnMora)) return [3 /*break*/, 43];
                            nombreCliente = "".concat(cliente.nombres, " ").concat(cliente.apellidos);
                            asignacion = cliente.asignacionesRuta[0];
                            ruta = asignacion === null || asignacion === void 0 ? void 0 : asignacion.ruta;
                            cobrador = ruta === null || ruta === void 0 ? void 0 : ruta.cobrador;
                            emoji = emojiMora(nuevaEtiqueta);
                            tituloNotif = "".concat(emoji, " Cliente en mora: ").concat(nuevaEtiqueta);
                            mensajeNotif = "".concat(nombreCliente, " (C.C. ").concat(cliente.dni, ") tiene ").concat(diasMoraMax, " d\u00EDa").concat(diasMoraMax !== 1 ? 's' : '', " en mora") +
                                " y est\u00E1 en nivel ".concat(nuevaEtiqueta, ".") +
                                (ruta ? " Ruta: ".concat(ruta.nombre, " (").concat(ruta.zona, ").") : ' Sin ruta asignada.') +
                                (cobrador ? " Cobrador: ".concat(cobrador.nombres, " ").concat(cobrador.apellidos, ".") : '');
                            metadataNotif = {
                                clienteId: cliente.id,
                                clienteNombre: nombreCliente,
                                clienteDni: cliente.dni,
                                diasEnMora: diasMoraMax,
                                etiquetaMora: nuevaEtiqueta,
                                nivelRiesgo: nuevoNivelPrisma,
                                rutaId: ruta === null || ruta === void 0 ? void 0 : ruta.id,
                                rutaNombre: ruta === null || ruta === void 0 ? void 0 : ruta.nombre,
                                rutaZona: ruta === null || ruta === void 0 ? void 0 : ruta.zona,
                                cobradorId: cobrador === null || cobrador === void 0 ? void 0 : cobrador.id,
                                cobradorNombre: cobrador ? "".concat(cobrador.nombres, " ").concat(cobrador.apellidos) : null,
                            };
                            _g.label = 28;
                        case 28:
                            _g.trys.push([28, 30, , 31]);
                            return [4 /*yield*/, this.notificacionesService.notifyApprovers({
                                    titulo: tituloNotif,
                                    mensaje: mensajeNotif,
                                    tipo: 'ALERTA',
                                    entidad: 'Cliente',
                                    entidadId: cliente.id,
                                    metadata: metadataNotif,
                                })];
                        case 29:
                            _g.sent();
                            resultado.notificacionesEnviadas++;
                            return [3 /*break*/, 31];
                        case 30:
                            err_7 = _g.sent();
                            this.logger.warn("[MORA] Error notif interna cliente ".concat(cliente.id, ": ").concat(err_7.message));
                            return [3 /*break*/, 31];
                        case 31:
                            if (!(cobrador === null || cobrador === void 0 ? void 0 : cobrador.id)) return [3 /*break*/, 35];
                            _g.label = 32;
                        case 32:
                            _g.trys.push([32, 34, , 35]);
                            return [4 /*yield*/, this.notificacionesService.create({
                                    usuarioId: cobrador.id,
                                    titulo: tituloNotif,
                                    mensaje: "Tu cliente ".concat(nombreCliente, " tiene ").concat(diasMoraMax, " d\u00EDa").concat(diasMoraMax !== 1 ? 's' : '', " ") +
                                        "en mora (nivel ".concat(nuevaEtiqueta, "). Por favor gestionar el cobro."),
                                    tipo: 'ALERTA',
                                    entidad: 'Cliente',
                                    entidadId: cliente.id,
                                    metadata: metadataNotif,
                                })];
                        case 33:
                            _g.sent();
                            resultado.notificacionesEnviadas++;
                            return [3 /*break*/, 35];
                        case 34:
                            err_8 = _g.sent();
                            this.logger.warn("[MORA] Error notif cobrador ".concat(cobrador.id, ": ").concat(err_8.message));
                            return [3 /*break*/, 35];
                        case 35:
                            _g.trys.push([35, 37, , 38]);
                            return [4 /*yield*/, this.pushService.sendPushNotification({
                                    title: tituloNotif,
                                    body: mensajeNotif,
                                    roleFilter: ['ADMIN', 'SUPER_ADMINISTRADOR', 'COORDINADOR', 'SUPERVISOR'],
                                    data: {
                                        type: 'MORA_NIVEL',
                                        clienteId: cliente.id,
                                        etiqueta: nuevaEtiqueta,
                                        diasEnMora: diasMoraMax,
                                        rutaNombre: (_f = ruta === null || ruta === void 0 ? void 0 : ruta.nombre) !== null && _f !== void 0 ? _f : null,
                                    },
                                })];
                        case 36:
                            _g.sent();
                            resultado.notificacionesEnviadas++;
                            return [3 /*break*/, 38];
                        case 37:
                            err_9 = _g.sent();
                            this.logger.warn("[MORA] Error push admins: ".concat(err_9.message));
                            return [3 /*break*/, 38];
                        case 38:
                            if (!(cobrador === null || cobrador === void 0 ? void 0 : cobrador.id)) return [3 /*break*/, 42];
                            _g.label = 39;
                        case 39:
                            _g.trys.push([39, 41, , 42]);
                            return [4 /*yield*/, this.pushService.sendPushNotification({
                                    title: tituloNotif,
                                    body: "".concat(nombreCliente, " lleva ").concat(diasMoraMax, " d\u00EDas sin pagar. ") +
                                        "Nivel: ".concat(nuevaEtiqueta, ". Gestiona el cobro hoy."),
                                    userId: cobrador.id,
                                    data: {
                                        type: 'MORA_NIVEL',
                                        clienteId: cliente.id,
                                        etiqueta: nuevaEtiqueta,
                                        diasEnMora: diasMoraMax,
                                    },
                                })];
                        case 40:
                            _g.sent();
                            resultado.notificacionesEnviadas++;
                            return [3 /*break*/, 42];
                        case 41:
                            err_10 = _g.sent();
                            this.logger.warn("[MORA] Error push cobrador ".concat(cobrador.id, ": ").concat(err_10.message));
                            return [3 /*break*/, 42];
                        case 42:
                            this.logger.log("[MORA] \uD83D\uDD14 Notificado: ".concat(nombreCliente, " \u2192 ").concat(nuevaEtiqueta, " (").concat(diasMoraMax, " d\u00EDas)") +
                                (ruta ? " | Ruta: ".concat(ruta.nombre) : ''));
                            _g.label = 43;
                        case 43: return [3 /*break*/, 45];
                        case 44:
                            err_11 = _g.sent();
                            resultado.errores.push("Cliente ".concat(cliente.id, ": ").concat(err_11.message));
                            return [3 /*break*/, 45];
                        case 45:
                            _b++;
                            return [3 /*break*/, 24];
                        case 46: 
                        // Clientes que ya no tienen préstamos EN_MORA → regresar a VERDE
                        return [4 /*yield*/, this.prisma.cliente.updateMany({
                                where: {
                                    nivelRiesgo: { in: ['AMARILLO', 'ROJO'] },
                                    enListaNegra: false,
                                    prestamos: {
                                        none: {
                                            estado: 'EN_MORA',
                                            eliminadoEn: null,
                                        },
                                    },
                                },
                                data: {
                                    nivelRiesgo: 'VERDE',
                                    ultimaActualizacionRiesgo: new Date(),
                                },
                            })];
                        case 47:
                            // Clientes que ya no tienen préstamos EN_MORA → regresar a VERDE
                            _g.sent();
                            this.logger.log("[MORA] Paso 4: ".concat(resultado.clientesRiesgoActualizado, " clientes riesgo actualizado, ") +
                                "".concat(resultado.notificacionesEnviadas, " notificaciones enviadas"));
                            return [3 /*break*/, 49];
                        case 48:
                            err_12 = _g.sent();
                            resultado.errores.push("Paso 4: ".concat(err_12.message));
                            this.logger.error('[MORA] Error en Paso 4:', err_12.message);
                            return [3 /*break*/, 49];
                        case 49:
                            // ─── PASO 5: Broadcast WebSocket ─────────────────────────────────────────
                            try {
                                this.notificacionesGateway.broadcastPrestamosActualizados({ accion: 'MORA_PROCESADA' });
                                this.notificacionesGateway.broadcastDashboardsActualizados({ origen: 'MORA' });
                            }
                            catch (err) {
                                this.logger.warn('[MORA] Error broadcast WS:', err.message);
                            }
                            return [2 /*return*/, resultado];
                    }
                });
            });
        };
        /**
         * Calcula el resumen de mora de un cliente específico
         * (días en mora, nivel, etiqueta) sin modificar nada en DB.
         */
        MoraService_1.prototype.getResumenMoraCliente = function (clienteId) {
            return __awaiter(this, void 0, void 0, function () {
                var hoy, cliente, diasMoraMax, cuotasVencidasTotal, montoVencidoTotal, _i, _a, p, _b, _c, c, fechaVenc, dias, asignacion, ruta;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            hoy = new Date();
                            hoy.setHours(0, 0, 0, 0);
                            return [4 /*yield*/, this.prisma.cliente.findUnique({
                                    where: { id: clienteId },
                                    select: {
                                        id: true,
                                        nombres: true,
                                        apellidos: true,
                                        nivelRiesgo: true,
                                        asignacionesRuta: {
                                            where: { activa: true },
                                            take: 1,
                                            select: {
                                                ruta: {
                                                    select: {
                                                        nombre: true,
                                                        zona: true,
                                                        cobrador: { select: { nombres: true, apellidos: true } },
                                                    },
                                                },
                                            },
                                        },
                                        prestamos: {
                                            where: {
                                                estado: { in: ['ACTIVO', 'EN_MORA'] },
                                                eliminadoEn: null,
                                            },
                                            select: {
                                                numeroPrestamo: true,
                                                saldoPendiente: true,
                                                cuotas: {
                                                    where: { estado: 'VENCIDA' },
                                                    orderBy: { fechaVencimiento: 'asc' },
                                                    select: { fechaVencimiento: true, monto: true, montoPagado: true },
                                                },
                                            },
                                        },
                                    },
                                })];
                        case 1:
                            cliente = _d.sent();
                            if (!cliente)
                                return [2 /*return*/, null];
                            diasMoraMax = 0;
                            cuotasVencidasTotal = 0;
                            montoVencidoTotal = 0;
                            for (_i = 0, _a = cliente.prestamos; _i < _a.length; _i++) {
                                p = _a[_i];
                                cuotasVencidasTotal += p.cuotas.length;
                                for (_b = 0, _c = p.cuotas; _b < _c.length; _b++) {
                                    c = _c[_b];
                                    fechaVenc = new Date(c.fechaVencimiento);
                                    dias = Math.max(0, Math.floor((hoy.getTime() - fechaVenc.getTime()) / (1000 * 60 * 60 * 24)));
                                    if (dias > diasMoraMax)
                                        diasMoraMax = dias;
                                    montoVencidoTotal += Number(c.monto) - Number(c.montoPagado);
                                }
                            }
                            asignacion = cliente.asignacionesRuta[0];
                            ruta = asignacion === null || asignacion === void 0 ? void 0 : asignacion.ruta;
                            return [2 /*return*/, {
                                    clienteId: clienteId,
                                    clienteNombre: "".concat(cliente.nombres, " ").concat(cliente.apellidos),
                                    diasEnMora: diasMoraMax,
                                    nivelRiesgo: diasMoraMax > 0 ? nivelRiesgoPorDias(diasMoraMax) : 'VERDE',
                                    etiqueta: etiquetaMora(diasMoraMax),
                                    cuotasVencidas: cuotasVencidasTotal,
                                    montoVencido: montoVencidoTotal,
                                    ruta: ruta
                                        ? {
                                            nombre: ruta.nombre,
                                            zona: ruta.zona,
                                            cobrador: ruta.cobrador
                                                ? "".concat(ruta.cobrador.nombres, " ").concat(ruta.cobrador.apellidos)
                                                : 'Sin cobrador',
                                        }
                                        : null,
                                }];
                    }
                });
            });
        };
        return MoraService_1;
    }());
    __setFunctionName(_classThis, "MoraService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        MoraService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return MoraService = _classThis;
}();
exports.MoraService = MoraService;
