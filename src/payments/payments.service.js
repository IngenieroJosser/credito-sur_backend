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
exports.PaymentsService = void 0;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var historial_pagos_template_1 = require("../templates/exports/historial-pagos.template");
var PaymentsService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var PaymentsService = _classThis = /** @class */ (function () {
        function PaymentsService_1(prisma, notificacionesService, auditService, notificacionesGateway, cloudinaryService) {
            this.prisma = prisma;
            this.notificacionesService = notificacionesService;
            this.auditService = auditService;
            this.notificacionesGateway = notificacionesGateway;
            this.cloudinaryService = cloudinaryService;
            this.logger = new common_1.Logger(PaymentsService.name);
        }
        PaymentsService_1.prototype.ensureCajaBanco = function (tx) {
            return __awaiter(this, void 0, void 0, function () {
                var existing, adminUser;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, tx.caja.findUnique({
                                where: { codigo: 'CAJA-BANCO' },
                                select: { id: true, nombre: true, saldoActual: true },
                            })];
                        case 1:
                            existing = _a.sent();
                            if (existing === null || existing === void 0 ? void 0 : existing.id)
                                return [2 /*return*/, existing];
                            return [4 /*yield*/, tx.usuario.findFirst({
                                    where: {
                                        rol: { in: ['SUPER_ADMINISTRADOR', 'ADMIN'] },
                                        estado: 'ACTIVO',
                                        eliminadoEn: null,
                                    },
                                    orderBy: { creadoEn: 'asc' },
                                    select: { id: true },
                                })];
                        case 2:
                            adminUser = _a.sent();
                            if (!(adminUser === null || adminUser === void 0 ? void 0 : adminUser.id)) {
                                throw new common_1.BadRequestException('No existe un usuario ADMIN/SUPER_ADMIN activo para asignar la Caja Banco. Cree uno e intente nuevamente.');
                            }
                            return [2 /*return*/, tx.caja.create({
                                    data: {
                                        codigo: 'CAJA-BANCO',
                                        nombre: 'Caja Banco',
                                        tipo: 'PRINCIPAL',
                                        responsableId: adminUser.id,
                                        saldoActual: 0,
                                        activa: true,
                                    },
                                    select: { id: true, nombre: true, saldoActual: true },
                                })];
                    }
                });
            });
        };
        /**
         * Descomponer un pago en capital e interés usando la fórmula del Excel:
         *
         *   paramDivision = (100 / tasaInteres) + 1          → M2
         *   paramInverso  = 100 / tasaInteres                → M3
         *   capitalRecuperado = montoPagado / paramDivision * paramInverso
         *   interesRecuperado = montoPagado / paramDivision
         *
         * Simplificado:
         *   capitalRecuperado = montoPagado * 100 / (100 + tasaInteres)
         *   interesRecuperado = montoPagado * tasaInteres / (100 + tasaInteres)
         */
        PaymentsService_1.prototype.descomponerPago = function (montoPagado, tasaInteres) {
            if (tasaInteres <= 0) {
                return { capital: montoPagado, interes: 0 };
            }
            var divisor = 100 + tasaInteres;
            var capital = (montoPagado * 100) / divisor;
            var interes = (montoPagado * tasaInteres) / divisor;
            return { capital: capital, interes: interes };
        };
        PaymentsService_1.prototype.create = function (dto, comprobante) {
            return __awaiter(this, void 0, void 0, function () {
                var prestamoIdVal, cobradorIdVal, prestamo, clienteId, montoTotal, tasaInteres, _a, capitalTotal, interesTotal, count, numeroPago, detallesPago, montoRestante, cuotasActualizar, _i, _b, cuota, montoCuota, yaPagado, pendienteCuota, montoAplicar, _c, capCuota, intCuota, nuevoMontoPagado, cuotaCompleta, nuevoEstadoCuota, resultado, sanitize, dni, dniLast4, nombres, apellidos, clientLabel, cloudResult, err_1, metodoPagoStr;
                var _this = this;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            // 1. Validar que se proporcione el prestamoId
                            if (!dto.prestamoId) {
                                throw new common_1.BadRequestException('El ID del préstamo es requerido');
                            }
                            // 2. Si el método es TRANSFERENCIA, el comprobante es OBLIGATORIO
                            if (dto.metodoPago === client_1.MetodoPago.TRANSFERENCIA && !comprobante) {
                                throw new common_1.BadRequestException('Para pagos por transferencia debe adjuntar el comprobante (imagen o PDF)');
                            }
                            // 3. Validar cobrador
                            if (!dto.cobradorId) {
                                throw new common_1.BadRequestException('El cobrador es requerido');
                            }
                            prestamoIdVal = dto.prestamoId;
                            cobradorIdVal = dto.cobradorId;
                            this.logger.log("Registrando pago: pr\u00E9stamo=".concat(prestamoIdVal, ", monto=").concat(dto.montoTotal));
                            return [4 /*yield*/, this.prisma.prestamo.findUnique({
                                    where: { id: prestamoIdVal, eliminadoEn: null },
                                    include: {
                                        cuotas: {
                                            where: {
                                                estado: { in: [client_1.EstadoCuota.PENDIENTE, client_1.EstadoCuota.PARCIAL, client_1.EstadoCuota.VENCIDA] },
                                            },
                                            orderBy: { numeroCuota: 'asc' },
                                        },
                                        cliente: {
                                            select: { id: true, dni: true, nombres: true, apellidos: true },
                                        },
                                    },
                                })];
                        case 1:
                            prestamo = _d.sent();
                            if (!prestamo) {
                                throw new common_1.NotFoundException('Préstamo no encontrado');
                            }
                            clienteId = dto.clienteId || prestamo.clienteId;
                            if (prestamo.estado !== client_1.EstadoPrestamo.ACTIVO &&
                                prestamo.estado !== client_1.EstadoPrestamo.EN_MORA) {
                                throw new common_1.BadRequestException("No se puede registrar pago: el pr\u00E9stamo est\u00E1 en estado ".concat(prestamo.estado));
                            }
                            if (clienteId && prestamo.clienteId !== clienteId) {
                                throw new common_1.BadRequestException('El cliente no corresponde al préstamo indicado');
                            }
                            montoTotal = dto.montoTotal;
                            tasaInteres = Number(prestamo.tasaInteres);
                            _a = this.descomponerPago(montoTotal, tasaInteres), capitalTotal = _a.capital, interesTotal = _a.interes;
                            return [4 /*yield*/, this.prisma.pago.count()];
                        case 2:
                            count = _d.sent();
                            numeroPago = "PAG-".concat(String(count + 1).padStart(6, '0'));
                            detallesPago = [];
                            montoRestante = montoTotal;
                            cuotasActualizar = [];
                            for (_i = 0, _b = prestamo.cuotas; _i < _b.length; _i++) {
                                cuota = _b[_i];
                                if (montoRestante <= 0)
                                    break;
                                montoCuota = Number(cuota.monto);
                                yaPagado = Number(cuota.montoPagado);
                                pendienteCuota = montoCuota - yaPagado;
                                if (pendienteCuota <= 0)
                                    continue;
                                montoAplicar = Math.min(montoRestante, pendienteCuota);
                                _c = this.descomponerPago(montoAplicar, tasaInteres), capCuota = _c.capital, intCuota = _c.interes;
                                detallesPago.push({
                                    cuotaId: cuota.id,
                                    monto: montoAplicar,
                                    montoCapital: capCuota,
                                    montoInteres: intCuota,
                                    montoInteresMora: 0,
                                });
                                nuevoMontoPagado = yaPagado + montoAplicar;
                                cuotaCompleta = nuevoMontoPagado >= montoCuota;
                                nuevoEstadoCuota = cuotaCompleta
                                    ? client_1.EstadoCuota.PAGADA
                                    : (cuota.estado === client_1.EstadoCuota.PENDIENTE ? client_1.EstadoCuota.PARCIAL : cuota.estado);
                                cuotasActualizar.push({
                                    id: cuota.id,
                                    montoPagado: nuevoMontoPagado,
                                    estado: nuevoEstadoCuota,
                                });
                                montoRestante -= montoAplicar;
                            }
                            // Validar cobrador
                            if (!dto.cobradorId) {
                                throw new common_1.BadRequestException('El cobrador es requerido');
                            }
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    var pago, _i, cuotasActualizar_1, cuotaUpd, nuevoTotalPagado, nuevoCapitalPagado, nuevoInteresPagado, nuevoSaldoPendiente, prestamoQuedaPagado, asignacion, esTransferencia, cajaIngreso, _a, numeroTransaccionCaja;
                                    return __generator(this, function (_b) {
                                        switch (_b.label) {
                                            case 0: return [4 /*yield*/, tx.pago.create({
                                                    data: {
                                                        numeroPago: numeroPago,
                                                        clienteId: clienteId,
                                                        prestamoId: prestamoIdVal,
                                                        cobradorId: cobradorIdVal,
                                                        fechaPago: dto.fechaPago ? new Date(dto.fechaPago) : new Date(),
                                                        montoTotal: montoTotal,
                                                        metodoPago: dto.metodoPago || client_1.MetodoPago.EFECTIVO,
                                                        numeroReferencia: dto.numeroReferencia,
                                                        notas: dto.notas,
                                                        detalles: {
                                                            create: detallesPago,
                                                        },
                                                    },
                                                    include: {
                                                        detalles: true,
                                                        cliente: {
                                                            select: { id: true, nombres: true, apellidos: true },
                                                        },
                                                    },
                                                })];
                                            case 1:
                                                pago = _b.sent();
                                                _i = 0, cuotasActualizar_1 = cuotasActualizar;
                                                _b.label = 2;
                                            case 2:
                                                if (!(_i < cuotasActualizar_1.length)) return [3 /*break*/, 5];
                                                cuotaUpd = cuotasActualizar_1[_i];
                                                return [4 /*yield*/, tx.cuota.update({
                                                        where: { id: cuotaUpd.id },
                                                        data: {
                                                            montoPagado: cuotaUpd.montoPagado,
                                                            estado: cuotaUpd.estado,
                                                            fechaPago: cuotaUpd.estado === client_1.EstadoCuota.PAGADA ? new Date() : undefined,
                                                        },
                                                    })];
                                            case 3:
                                                _b.sent();
                                                _b.label = 4;
                                            case 4:
                                                _i++;
                                                return [3 /*break*/, 2];
                                            case 5:
                                                nuevoTotalPagado = Number(prestamo.totalPagado) + montoTotal;
                                                nuevoCapitalPagado = Number(prestamo.capitalPagado) + capitalTotal;
                                                nuevoInteresPagado = Number(prestamo.interesPagado) + interesTotal;
                                                nuevoSaldoPendiente = Number(prestamo.saldoPendiente) - montoTotal;
                                                prestamoQuedaPagado = nuevoSaldoPendiente <= 0;
                                                return [4 /*yield*/, tx.prestamo.update({
                                                        where: { id: prestamoIdVal },
                                                        data: {
                                                            totalPagado: nuevoTotalPagado,
                                                            capitalPagado: nuevoCapitalPagado,
                                                            interesPagado: nuevoInteresPagado,
                                                            saldoPendiente: Math.max(0, nuevoSaldoPendiente),
                                                            estado: prestamoQuedaPagado
                                                                ? client_1.EstadoPrestamo.PAGADO
                                                                : prestamo.estado,
                                                            estadoSincronizacion: 'PENDIENTE',
                                                        },
                                                    })];
                                            case 6:
                                                _b.sent();
                                                return [4 /*yield*/, tx.asignacionRuta.findFirst({
                                                        where: { clienteId: clienteId, activa: true },
                                                        select: { rutaId: true },
                                                    })];
                                            case 7:
                                                asignacion = _b.sent();
                                                if (!(asignacion === null || asignacion === void 0 ? void 0 : asignacion.rutaId)) {
                                                    throw new common_1.BadRequestException('El cliente no tiene una ruta asignada activa para registrar el pago');
                                                }
                                                esTransferencia = dto.metodoPago === client_1.MetodoPago.TRANSFERENCIA;
                                                if (!esTransferencia) return [3 /*break*/, 9];
                                                return [4 /*yield*/, this.ensureCajaBanco(tx)];
                                            case 8:
                                                _a = _b.sent();
                                                return [3 /*break*/, 11];
                                            case 9: return [4 /*yield*/, tx.caja.findFirst({
                                                    where: { rutaId: asignacion.rutaId, tipo: 'RUTA', activa: true },
                                                    select: { id: true, nombre: true, saldoActual: true },
                                                })];
                                            case 10:
                                                _a = _b.sent();
                                                _b.label = 11;
                                            case 11:
                                                cajaIngreso = _a;
                                                if (!(cajaIngreso === null || cajaIngreso === void 0 ? void 0 : cajaIngreso.id)) {
                                                    throw new common_1.BadRequestException(esTransferencia
                                                        ? 'No existe la Caja Banco (CAJA-BANCO) y no se pudo crear automáticamente.'
                                                        : 'No existe una caja de ruta activa asociada a la ruta del cliente');
                                                }
                                                numeroTransaccionCaja = "TRX-IN-".concat(Date.now(), "-").concat(Math.floor(Math.random() * 1000));
                                                return [4 /*yield*/, tx.transaccion.create({
                                                        data: {
                                                            numeroTransaccion: numeroTransaccionCaja,
                                                            cajaId: cajaIngreso.id,
                                                            tipo: client_1.TipoTransaccion.INGRESO,
                                                            monto: montoTotal,
                                                            descripcion: "Cobranza ".concat(numeroPago),
                                                            creadoPorId: cobradorIdVal,
                                                            tipoReferencia: 'PAGO',
                                                            referenciaId: numeroPago,
                                                        },
                                                    })];
                                            case 12:
                                                _b.sent();
                                                return [4 /*yield*/, tx.caja.update({
                                                        where: { id: cajaIngreso.id },
                                                        data: { saldoActual: { increment: montoTotal } },
                                                    })];
                                            case 13:
                                                _b.sent();
                                                return [2 /*return*/, {
                                                        pago: pago,
                                                        descomposicion: {
                                                            montoTotal: montoTotal,
                                                            capitalRecuperado: capitalTotal,
                                                            interesRecuperado: interesTotal,
                                                            saldoAnterior: Number(prestamo.saldoPendiente),
                                                            saldoNuevo: Math.max(0, nuevoSaldoPendiente),
                                                            cuotasAfectadas: cuotasActualizar.length,
                                                            prestamoQuedaPagado: prestamoQuedaPagado,
                                                        },
                                                    }];
                                        }
                                    });
                                }); })];
                        case 3:
                            resultado = _d.sent();
                            // Auditoría
                            return [4 /*yield*/, this.auditService.create({
                                    usuarioId: dto.cobradorId,
                                    accion: 'REGISTRAR_PAGO',
                                    entidad: 'Pago',
                                    entidadId: resultado.pago.id,
                                    datosNuevos: {
                                        numeroPago: numeroPago,
                                        prestamoIdVal: prestamoIdVal,
                                        montoTotal: montoTotal,
                                        capitalRecuperado: capitalTotal,
                                        interesRecuperado: interesTotal,
                                    },
                                })];
                        case 4:
                            // Auditoría
                            _d.sent();
                            if (!(comprobante && dto.metodoPago === client_1.MetodoPago.TRANSFERENCIA)) return [3 /*break*/, 9];
                            _d.label = 5;
                        case 5:
                            _d.trys.push([5, 8, , 9]);
                            sanitize = function (v) {
                                return (v || '').toLowerCase()
                                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                                    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
                            };
                            dni = (prestamo.cliente.dni || '').replace(/\D/g, '');
                            dniLast4 = dni ? dni.slice(-4) : '';
                            nombres = sanitize(prestamo.cliente.nombres);
                            apellidos = sanitize(prestamo.cliente.apellidos);
                            clientLabel = ["cc-".concat(dni), nombres, apellidos, dniLast4].filter(Boolean).join('-');
                            return [4 /*yield*/, this.cloudinaryService.subirArchivo(comprobante, {
                                    folder: "clientes/".concat(clientLabel, "/comprobantes-transferencia"),
                                })];
                        case 6:
                            cloudResult = _d.sent();
                            return [4 /*yield*/, this.prisma.multimedia.create({
                                    data: {
                                        pagoId: resultado.pago.id,
                                        clienteId: prestamo.clienteId,
                                        tipoContenido: 'COMPROBANTE_TRANSFERENCIA',
                                        tipoArchivo: comprobante.mimetype,
                                        formato: cloudResult.formato,
                                        nombreOriginal: comprobante.originalname,
                                        nombreAlmacenamiento: cloudResult.publicId,
                                        ruta: cloudResult.publicId,
                                        url: cloudResult.url,
                                        tamanoBytes: cloudResult.tamanoBytes,
                                        esPublico: false,
                                        esPrincipal: true,
                                        subidoPorId: dto.cobradorId,
                                    },
                                })];
                        case 7:
                            _d.sent();
                            this.logger.log("Comprobante de transferencia guardado para pago ".concat(numeroPago, " \u2192 Cloudinary: ").concat(cloudResult.url));
                            return [3 /*break*/, 9];
                        case 8:
                            err_1 = _d.sent();
                            // El pago ya está guardado en BD; el fallo del comprobante se registra
                            // en el log para que el coordinador pueda solicitarlo manualmente.
                            this.logger.error("Pago ".concat(numeroPago, " creado, pero fall\u00F3 la subida del comprobante: ").concat(err_1.message));
                            return [3 /*break*/, 9];
                        case 9:
                            metodoPagoStr = dto.metodoPago === 'TRANSFERENCIA' ? 'Transferencia' : 'Efectivo';
                            return [4 /*yield*/, this.notificacionesService.notifyApprovers({
                                    titulo: "Pago Registrado \u2014 ".concat(metodoPagoStr),
                                    mensaje: "Se registr\u00F3 ".concat(numeroPago, " de ").concat(montoTotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }), " para ").concat(prestamo.cliente.nombres, " ").concat(prestamo.cliente.apellidos, " (").concat(prestamo.numeroPrestamo, ")"),
                                    tipo: 'EXITO',
                                    entidad: 'PAGO',
                                    entidadId: resultado.pago.id,
                                    metadata: {
                                        // Identificación del pago
                                        pagoId: resultado.pago.id,
                                        numeroPago: numeroPago,
                                        numeroPrestamo: prestamo.numeroPrestamo,
                                        prestamoId: prestamoIdVal,
                                        // Método y comprobante
                                        metodoPago: dto.metodoPago || 'EFECTIVO',
                                        numeroReferencia: dto.numeroReferencia || null,
                                        tieneComprobante: comprobante != null,
                                        // Cliente
                                        cliente: "".concat(prestamo.cliente.nombres, " ").concat(prestamo.cliente.apellidos),
                                        clienteId: prestamo.clienteId,
                                        clienteDni: prestamo.cliente.dni || null,
                                        // Montos
                                        monto: montoTotal,
                                        capitalRecuperado: capitalTotal,
                                        interesRecuperado: interesTotal,
                                        saldoNuevo: resultado.descomposicion.saldoNuevo,
                                        saldoAnterior: resultado.descomposicion.saldoAnterior,
                                        prestamoQuedaPagado: resultado.descomposicion.prestamoQuedaPagado,
                                        cuotasAfectadas: resultado.descomposicion.cuotasAfectadas,
                                    },
                                })];
                        case 10:
                            _d.sent();
                            this.logger.log("Pago ".concat(numeroPago, " registrado: capital=").concat(capitalTotal.toFixed(2), ", inter\u00E9s=").concat(interesTotal.toFixed(2), ", saldo=").concat(resultado.descomposicion.saldoNuevo.toFixed(2)));
                            this.notificacionesGateway.broadcastPagosActualizados({
                                accion: 'CREAR',
                                pagoId: resultado.pago.id,
                            });
                            this.notificacionesGateway.broadcastPrestamosActualizados({
                                accion: 'PAGO',
                                prestamoId: prestamoIdVal,
                            });
                            this.notificacionesGateway.broadcastRutasActualizadas({
                                accion: 'PAGO',
                            });
                            this.notificacionesGateway.broadcastDashboardsActualizados({});
                            return [2 /*return*/, resultado];
                    }
                });
            });
        };
        PaymentsService_1.prototype.findAll = function (filters) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, prestamoId, clienteId, _b, page, _c, limit, skip, where, _d, pagos, total;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            _a = filters || {}, prestamoId = _a.prestamoId, clienteId = _a.clienteId, _b = _a.page, page = _b === void 0 ? 1 : _b, _c = _a.limit, limit = _c === void 0 ? 20 : _c;
                            skip = (page - 1) * limit;
                            where = {};
                            if (prestamoId)
                                where.prestamoId = prestamoId;
                            if (clienteId)
                                where.clienteId = clienteId;
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.pago.findMany({
                                        where: where,
                                        include: {
                                            detalles: true,
                                            cliente: {
                                                select: { id: true, nombres: true, apellidos: true, dni: true },
                                            },
                                            prestamo: {
                                                select: {
                                                    id: true,
                                                    numeroPrestamo: true,
                                                    monto: true,
                                                    tasaInteres: true,
                                                    saldoPendiente: true,
                                                },
                                            },
                                            cobrador: {
                                                select: { id: true, nombres: true, apellidos: true },
                                            },
                                        },
                                        skip: skip,
                                        take: limit,
                                        orderBy: { fechaPago: 'desc' },
                                    }),
                                    this.prisma.pago.count({ where: where }),
                                ])];
                        case 1:
                            _d = _e.sent(), pagos = _d[0], total = _d[1];
                            return [2 /*return*/, {
                                    pagos: pagos,
                                    paginacion: {
                                        total: total,
                                        pagina: page,
                                        limite: limit,
                                        totalPaginas: Math.ceil(total / limit),
                                    },
                                }];
                    }
                });
            });
        };
        PaymentsService_1.prototype.findOne = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var pago;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.pago.findUnique({
                                where: { id: id },
                                include: {
                                    detalles: {
                                        include: {
                                            cuota: true,
                                        },
                                    },
                                    cliente: {
                                        select: { id: true, nombres: true, apellidos: true, dni: true },
                                    },
                                    prestamo: {
                                        select: {
                                            id: true,
                                            numeroPrestamo: true,
                                            monto: true,
                                            tasaInteres: true,
                                            saldoPendiente: true,
                                            interesTotal: true,
                                            totalPagado: true,
                                            capitalPagado: true,
                                            interesPagado: true,
                                        },
                                    },
                                    cobrador: {
                                        select: { id: true, nombres: true, apellidos: true },
                                    },
                                    // Incluir archivos multimedia (comprobantes de transferencia, etc.)
                                    archivos: {
                                        where: { estado: 'ACTIVO', eliminadoEn: null },
                                        select: {
                                            id: true,
                                            tipoContenido: true,
                                            tipoArchivo: true,
                                            nombreOriginal: true,
                                            url: true,
                                            ruta: true,
                                            formato: true,
                                            tamanoBytes: true,
                                            creadoEn: true,
                                        },
                                        orderBy: { creadoEn: 'asc' },
                                    },
                                    recibo: true,
                                },
                            })];
                        case 1:
                            pago = _a.sent();
                            if (!pago) {
                                throw new common_1.NotFoundException('Pago no encontrado');
                            }
                            return [2 /*return*/, pago];
                    }
                });
            });
        };
        PaymentsService_1.prototype.exportPayments = function (filters, format) {
            return __awaiter(this, void 0, void 0, function () {
                var where, pagos, fecha, filas, totales;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            where = {};
                            if (filters.prestamoId) {
                                where.prestamoId = filters.prestamoId;
                            }
                            if (filters.startDate || filters.endDate) {
                                where.fechaPago = {};
                                if (filters.startDate)
                                    where.fechaPago.gte = new Date(filters.startDate);
                                if (filters.endDate)
                                    where.fechaPago.lte = new Date(filters.endDate);
                            }
                            return [4 /*yield*/, this.prisma.pago.findMany({
                                    where: where,
                                    include: {
                                        cliente: { select: { nombres: true, apellidos: true, dni: true } },
                                        prestamo: { select: { numeroPrestamo: true } },
                                        cobrador: { select: { nombres: true, apellidos: true, rol: true } },
                                    },
                                    orderBy: { fechaPago: 'desc' },
                                    take: 10000,
                                })];
                        case 1:
                            pagos = _a.sent();
                            fecha = new Date().toISOString().split('T')[0];
                            filas = pagos.map(function (p) {
                                var _a, _b, _c;
                                return ({
                                    fecha: p.fechaPago,
                                    numeroPago: p.numeroPago || '',
                                    cliente: p.cliente ? "".concat(p.cliente.nombres, " ").concat(p.cliente.apellidos) : '',
                                    documento: ((_a = p.cliente) === null || _a === void 0 ? void 0 : _a.dni) || '',
                                    numeroPrestamo: ((_b = p.prestamo) === null || _b === void 0 ? void 0 : _b.numeroPrestamo) || '',
                                    montoTotal: Number(p.montoTotal),
                                    metodoPago: p.metodoPago || '',
                                    cobrador: p.cobrador ? "".concat(p.cobrador.nombres, " ").concat(p.cobrador.apellidos) : 'Admin',
                                    esAbono: (_c = p.esAbono) !== null && _c !== void 0 ? _c : false,
                                    capitalPagado: Number(p.capitalPagado || 0),
                                    interesPagado: Number(p.interesPagado || 0),
                                    moraPagada: Number(p.moraPagada || 0),
                                    comentario: p.notas || '',
                                    origenCaja: !p.cobrador ? 'Admin' : p.cobrador.rol === 'PUNTO_DE_VENTA' ? 'P.Venta' : 'Ruta',
                                });
                            });
                            totales = {
                                totalRecaudado: filas.reduce(function (s, p) { return s + p.montoTotal; }, 0),
                                totalPagos: filas.length,
                                totalCapital: filas.reduce(function (s, p) { return s + (p.capitalPagado || 0); }, 0),
                                totalIntereses: filas.reduce(function (s, p) { return s + (p.interesPagado || 0); }, 0),
                                totalMora: filas.reduce(function (s, p) { return s + (p.moraPagada || 0); }, 0),
                                cantidadAbonos: filas.filter(function (p) { return p.esAbono; }).length,
                                cantidadCuotasCompletas: filas.filter(function (p) { return !p.esAbono; }).length,
                            };
                            // 3. Delegamos al template
                            if (format === 'excel')
                                return [2 /*return*/, (0, historial_pagos_template_1.generarExcelPagos)(filas, totales, fecha)];
                            if (format === 'pdf')
                                return [2 /*return*/, (0, historial_pagos_template_1.generarPDFPagos)(filas, totales, fecha)];
                            throw new common_1.BadRequestException("Formato no soportado: ".concat(format));
                    }
                });
            });
        };
        return PaymentsService_1;
    }());
    __setFunctionName(_classThis, "PaymentsService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        PaymentsService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return PaymentsService = _classThis;
}();
exports.PaymentsService = PaymentsService;
