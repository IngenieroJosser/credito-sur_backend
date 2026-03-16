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
exports.UsersService = void 0;
var common_1 = require("@nestjs/common");
var argon2 = require("argon2");
var client_1 = require("@prisma/client");
var common_2 = require("@nestjs/common");
var UsersService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var UsersService = _classThis = /** @class */ (function () {
        function UsersService_1(prisma, auditService, notificacionesGateway) {
            this.prisma = prisma;
            this.auditService = auditService;
            this.notificacionesGateway = notificacionesGateway;
            this.logger = new common_1.Logger(UsersService.name);
        }
        UsersService_1.prototype.crear = function (usuarioDto, usuarioCreadorId) {
            return __awaiter(this, void 0, void 0, function () {
                var usuarioExistente, superadminsExistentes, usuarioCreador, password, datosUsuario, hashContrasena, rolDinamico, nuevoUsuario;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.usuario.findUnique({
                                where: { correo: usuarioDto.correo },
                            })];
                        case 1:
                            usuarioExistente = _a.sent();
                            if (usuarioExistente) {
                                throw new common_1.ConflictException('El correo ya está registrado');
                            }
                            if (!(usuarioDto.rol === client_1.RolUsuario.SUPER_ADMINISTRADOR)) return [3 /*break*/, 4];
                            return [4 /*yield*/, this.prisma.usuario.count({
                                    where: { rol: client_1.RolUsuario.SUPER_ADMINISTRADOR, estado: client_1.EstadoUsuario.ACTIVO }
                                })];
                        case 2:
                            superadminsExistentes = _a.sent();
                            if (!(superadminsExistentes > 0)) return [3 /*break*/, 4];
                            if (!usuarioCreadorId) {
                                throw new common_1.ForbiddenException('Se requiere autenticación para crear un Superadministrador adicional. Usa el token de un Superadmin.');
                            }
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: { id: usuarioCreadorId },
                                })];
                        case 3:
                            usuarioCreador = _a.sent();
                            if (!usuarioCreador || usuarioCreador.rol !== client_1.RolUsuario.SUPER_ADMINISTRADOR) {
                                throw new common_1.ForbiddenException('Solo un Superadministrador puede crear otro Superadministrador');
                            }
                            _a.label = 4;
                        case 4:
                            password = usuarioDto.password, datosUsuario = __rest(usuarioDto, ["password"]);
                            return [4 /*yield*/, argon2.hash(password)];
                        case 5:
                            hashContrasena = _a.sent();
                            return [4 /*yield*/, this.prisma.rol.findUnique({
                                    where: { nombre: usuarioDto.rol },
                                })];
                        case 6:
                            rolDinamico = _a.sent();
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    var totalUsuarios, esPrimerUsuario, nuevoUsuario;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, tx.usuario.count()];
                                            case 1:
                                                totalUsuarios = _a.sent();
                                                esPrimerUsuario = totalUsuarios === 0;
                                                return [4 /*yield*/, tx.usuario.create({
                                                        data: __assign({ nombres: datosUsuario.nombres, apellidos: datosUsuario.apellidos, correo: datosUsuario.correo, rol: datosUsuario.rol, telefono: datosUsuario.telefono, estado: datosUsuario.estado, hashContrasena: hashContrasena, esPrincipal: esPrimerUsuario && usuarioDto.rol === client_1.RolUsuario.SUPER_ADMINISTRADOR }, (usuarioCreadorId ? { creadoPor: { connect: { id: usuarioCreadorId } } } : {})),
                                                        select: {
                                                            id: true,
                                                            nombres: true,
                                                            apellidos: true,
                                                            correo: true,
                                                            rol: true,
                                                            esPrincipal: true,
                                                            estado: true,
                                                            telefono: true,
                                                            creadoEn: true,
                                                        },
                                                    })];
                                            case 2:
                                                nuevoUsuario = _a.sent();
                                                if (!rolDinamico) return [3 /*break*/, 4];
                                                return [4 /*yield*/, tx.asignacionRolUsuario.create({
                                                        data: {
                                                            usuarioId: nuevoUsuario.id,
                                                            rolId: rolDinamico.id,
                                                        },
                                                    })];
                                            case 3:
                                                _a.sent();
                                                _a.label = 4;
                                            case 4:
                                                if (!usuarioCreadorId) return [3 /*break*/, 6];
                                                return [4 /*yield*/, this.auditService.create({
                                                        usuarioId: usuarioCreadorId,
                                                        accion: 'CREAR_USUARIO',
                                                        entidad: 'Usuario',
                                                        entidadId: nuevoUsuario.id,
                                                        datosNuevos: {
                                                            nombres: nuevoUsuario.nombres,
                                                            apellidos: nuevoUsuario.apellidos,
                                                            correo: nuevoUsuario.correo,
                                                            rol: nuevoUsuario.rol,
                                                            estado: nuevoUsuario.estado,
                                                        },
                                                    })];
                                            case 5:
                                                _a.sent();
                                                _a.label = 6;
                                            case 6: return [2 /*return*/, nuevoUsuario];
                                        }
                                    });
                                }); })];
                        case 7:
                            nuevoUsuario = _a.sent();
                            this.notificacionesGateway.broadcastUsuariosActualizados({
                                accion: 'CREAR',
                                usuarioId: nuevoUsuario.id,
                            });
                            return [2 /*return*/, nuevoUsuario];
                    }
                });
            });
        };
        UsersService_1.prototype.obtenerTodos = function () {
            return __awaiter(this, void 0, void 0, function () {
                var usuarios;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.usuario.findMany({
                                where: {
                                    eliminadoEn: null,
                                },
                                select: {
                                    id: true,
                                    nombres: true,
                                    apellidos: true,
                                    correo: true,
                                    rol: true,
                                    esPrincipal: true,
                                    estado: true,
                                    telefono: true,
                                    creadoEn: true,
                                    ultimoIngreso: true,
                                    asignacionesRoles: {
                                        include: {
                                            rol: {
                                                include: {
                                                    permisos: {
                                                        include: {
                                                            permiso: true,
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    permisosPersonalizados: {
                                        include: {
                                            permiso: true,
                                        },
                                    },
                                },
                                // Prisma no soporta select + include anidados con tipos estáticos; cast necesario
                            })];
                        case 1:
                            usuarios = _a.sent();
                            return [2 /*return*/, usuarios.map(function (usuario) {
                                    // 1. Permisos del Rol (default)
                                    var permisosRol = usuario.asignacionesRoles.flatMap(function (asignacion) {
                                        return asignacion.rol.permisos.map(function (rp) { return rp.permiso.accion; });
                                    });
                                    // 2. Permisos Personalizados (overrides)
                                    var permisosCustom = usuario.permisosPersonalizados.map(function (p) { return p.permiso.accion; });
                                    // Si tiene permisos personalizados, tienen precedencia total.
                                    // Si no, se usan los del rol.
                                    var permisosFinales = permisosCustom.length > 0 ? permisosCustom : permisosRol;
                                    var asignacionesRoles = usuario.asignacionesRoles, permisosPersonalizados = usuario.permisosPersonalizados, userData = __rest(usuario, ["asignacionesRoles", "permisosPersonalizados"]);
                                    return __assign(__assign({}, userData), { permisos: __spreadArray([], new Set(permisosFinales), true) });
                                })];
                    }
                });
            });
        };
        UsersService_1.prototype.asignarPermisos = function (usuarioId, permisos) {
            return __awaiter(this, void 0, void 0, function () {
                var usuario, permisosDb;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.usuario.findUnique({
                                where: { id: usuarioId },
                            })];
                        case 1:
                            usuario = _a.sent();
                            if (!usuario) {
                                throw new common_1.NotFoundException("Usuario con ID ".concat(usuarioId, " no encontrado"));
                            }
                            return [4 /*yield*/, this.prisma.permiso.findMany({
                                    where: {
                                        accion: { in: permisos },
                                    },
                                })];
                        case 2:
                            permisosDb = _a.sent();
                            return [2 /*return*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: 
                                            // 3. Limpiar permisos personalizados existentes
                                            return [4 /*yield*/, tx.asignacionPermisoUsuario.deleteMany({
                                                    where: { usuarioId: usuarioId },
                                                })];
                                            case 1:
                                                // 3. Limpiar permisos personalizados existentes
                                                _a.sent();
                                                if (!(permisosDb.length > 0)) return [3 /*break*/, 3];
                                                return [4 /*yield*/, tx.asignacionPermisoUsuario.createMany({
                                                        data: permisosDb.map(function (p) { return ({
                                                            usuarioId: usuarioId,
                                                            permisoId: p.id,
                                                        }); }),
                                                    })];
                                            case 2:
                                                _a.sent();
                                                _a.label = 3;
                                            case 3: return [2 /*return*/, { mensaje: 'Permisos actualizados correctamente' }];
                                        }
                                    });
                                }); })];
                    }
                });
            });
        };
        UsersService_1.prototype.obtenerPorId = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var usuario;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.usuario.findUnique({
                                where: { id: id },
                                select: {
                                    id: true,
                                    nombres: true,
                                    apellidos: true,
                                    correo: true,
                                    rol: true,
                                    esPrincipal: true,
                                    estado: true,
                                    telefono: true,
                                    creadoEn: true,
                                    ultimoIngreso: true,
                                },
                            })];
                        case 1:
                            usuario = _a.sent();
                            if (!usuario) {
                                throw new common_1.NotFoundException("Usuario con ID ".concat(id, " no encontrado"));
                            }
                            return [2 /*return*/, usuario];
                    }
                });
            });
        };
        UsersService_1.prototype.obtenerPorNombres = function (nombres) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.prisma.usuario.findFirst({
                            where: {
                                nombres: {
                                    equals: nombres,
                                },
                                eliminadoEn: null,
                            },
                        })];
                });
            });
        };
        UsersService_1.prototype.obtenerPorCorreo = function (correo) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.prisma.usuario.findFirst({
                            where: {
                                correo: correo,
                                eliminadoEn: null,
                            },
                        })];
                });
            });
        };
        UsersService_1.prototype.actualizar = function (id, updateUserDto, usuarioModificadorId) {
            return __awaiter(this, void 0, void 0, function () {
                var usuario, esSelfEdit, esPrincipalModificando, modificador, hashContrasena, nuevoRol_1, password, datos, usuarioActualizado;
                var _this = this;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.prisma.usuario.findUnique({
                                where: { id: id },
                            })];
                        case 1:
                            usuario = _b.sent();
                            if (!usuario) {
                                throw new common_1.NotFoundException("Usuario con ID ".concat(id, " no encontrado"));
                            }
                            if (!(usuario.rol === client_1.RolUsuario.SUPER_ADMINISTRADOR)) return [3 /*break*/, 4];
                            esSelfEdit = usuarioModificadorId === id;
                            esPrincipalModificando = false;
                            if (!(usuarioModificadorId && !esSelfEdit)) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: { id: usuarioModificadorId },
                                    select: { rol: true, esPrincipal: true },
                                })];
                        case 2:
                            modificador = _b.sent();
                            esPrincipalModificando =
                                (modificador === null || modificador === void 0 ? void 0 : modificador.rol) === client_1.RolUsuario.SUPER_ADMINISTRADOR &&
                                    ((_a = modificador === null || modificador === void 0 ? void 0 : modificador.esPrincipal) !== null && _a !== void 0 ? _a : false);
                            _b.label = 3;
                        case 3:
                            if (!esSelfEdit && !esPrincipalModificando) {
                                throw new common_1.ForbiddenException('Un Superadministrador solo puede ser modificado por sí mismo o por el Superadministrador principal');
                            }
                            _b.label = 4;
                        case 4:
                            // PROTECCIÓN: No se puede cambiar el rol del Superadmin principal
                            if (usuario.esPrincipal && updateUserDto.rol && updateUserDto.rol !== client_1.RolUsuario.SUPER_ADMINISTRADOR) {
                                throw new common_1.ForbiddenException('No se puede cambiar el rol del Superadministrador principal');
                            }
                            if (!updateUserDto.password) return [3 /*break*/, 6];
                            return [4 /*yield*/, argon2.hash(updateUserDto.password)];
                        case 5:
                            hashContrasena = _b.sent();
                            _b.label = 6;
                        case 6:
                            if (!(updateUserDto.rol && updateUserDto.rol !== usuario.rol)) return [3 /*break*/, 9];
                            return [4 /*yield*/, this.prisma.rol.findUnique({
                                    where: { nombre: updateUserDto.rol }
                                })];
                        case 7:
                            nuevoRol_1 = _b.sent();
                            if (!nuevoRol_1) return [3 /*break*/, 9];
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: 
                                            // Eliminar asignación anterior
                                            return [4 /*yield*/, tx.asignacionRolUsuario.deleteMany({
                                                    where: { usuarioId: id }
                                                })];
                                            case 1:
                                                // Eliminar asignación anterior
                                                _a.sent();
                                                // Crear nueva
                                                return [4 /*yield*/, tx.asignacionRolUsuario.create({
                                                        data: {
                                                            usuarioId: id,
                                                            rolId: nuevoRol_1.id
                                                        }
                                                    })];
                                            case 2:
                                                // Crear nueva
                                                _a.sent();
                                                return [2 /*return*/];
                                        }
                                    });
                                }); })];
                        case 8:
                            _b.sent();
                            _b.label = 9;
                        case 9:
                            password = updateUserDto.password, datos = __rest(updateUserDto, ["password"]);
                            return [4 /*yield*/, this.prisma.usuario.update({
                                    where: { id: id },
                                    data: __assign(__assign({}, datos), (hashContrasena && { hashContrasena: hashContrasena })),
                                    select: {
                                        id: true,
                                        nombres: true,
                                        apellidos: true,
                                        correo: true,
                                        rol: true,
                                        esPrincipal: true,
                                        estado: true,
                                        telefono: true,
                                        creadoEn: true,
                                        ultimoIngreso: true,
                                    },
                                })];
                        case 10:
                            usuarioActualizado = _b.sent();
                            if (!usuarioModificadorId) return [3 /*break*/, 12];
                            return [4 /*yield*/, this.auditService.create({
                                    usuarioId: usuarioModificadorId,
                                    accion: 'ACTUALIZAR_USUARIO',
                                    entidad: 'Usuario',
                                    entidadId: id,
                                    datosAnteriores: {
                                        nombres: usuario.nombres,
                                        apellidos: usuario.apellidos,
                                        correo: usuario.correo,
                                        rol: usuario.rol,
                                        estado: usuario.estado,
                                        telefono: usuario.telefono,
                                    },
                                    datosNuevos: {
                                        nombres: usuarioActualizado.nombres,
                                        apellidos: usuarioActualizado.apellidos,
                                        correo: usuarioActualizado.correo,
                                        rol: usuarioActualizado.rol,
                                        estado: usuarioActualizado.estado,
                                        telefono: usuarioActualizado.telefono,
                                    },
                                })];
                        case 11:
                            _b.sent();
                            _b.label = 12;
                        case 12:
                            this.notificacionesGateway.broadcastUsuariosActualizados({
                                accion: 'ACTUALIZAR',
                                usuarioId: usuarioActualizado.id,
                            });
                            return [2 /*return*/, usuarioActualizado];
                    }
                });
            });
        };
        UsersService_1.prototype.eliminar = function (id, usuarioEliminadorId) {
            return __awaiter(this, void 0, void 0, function () {
                var usuario, eliminado_1, eliminado;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.usuario.findUnique({
                                where: { id: id },
                            })];
                        case 1:
                            usuario = _a.sent();
                            if (!usuario) {
                                throw new common_1.NotFoundException("Usuario con ID ".concat(id, " no encontrado"));
                            }
                            if (!usuario.esPrincipal) return [3 /*break*/, 3];
                            if (!usuarioEliminadorId || usuarioEliminadorId !== id) {
                                throw new common_1.ForbiddenException('El Superadministrador principal solo puede ser eliminado por sí mismo');
                            }
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    var nuevoSuperadminPrincipal;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, tx.usuario.findFirst({
                                                    where: {
                                                        rol: client_1.RolUsuario.SUPER_ADMINISTRADOR,
                                                        id: { not: id },
                                                        eliminadoEn: null,
                                                        estado: client_1.EstadoUsuario.ACTIVO,
                                                    },
                                                    orderBy: {
                                                        creadoEn: 'asc', // El más antiguo
                                                    },
                                                })];
                                            case 1:
                                                nuevoSuperadminPrincipal = _a.sent();
                                                if (!nuevoSuperadminPrincipal) return [3 /*break*/, 3];
                                                return [4 /*yield*/, tx.usuario.update({
                                                        where: { id: nuevoSuperadminPrincipal.id },
                                                        data: { esPrincipal: true },
                                                    })];
                                            case 2:
                                                _a.sent();
                                                _a.label = 3;
                                            case 3: 
                                            // Eliminar el usuario actual
                                            return [2 /*return*/, tx.usuario.update({
                                                    where: { id: id },
                                                    data: {
                                                        eliminadoEn: new Date(),
                                                        estado: client_1.EstadoUsuario.INACTIVO,
                                                        esPrincipal: false,
                                                    },
                                                })];
                                        }
                                    });
                                }); })];
                        case 2:
                            eliminado_1 = _a.sent();
                            this.notificacionesGateway.broadcastUsuariosActualizados({
                                accion: 'ELIMINAR',
                                usuarioId: id,
                            });
                            return [2 /*return*/, eliminado_1];
                        case 3: return [4 /*yield*/, this.prisma.usuario.update({
                                where: { id: id },
                                data: {
                                    eliminadoEn: new Date(),
                                    estado: client_1.EstadoUsuario.INACTIVO,
                                },
                            })];
                        case 4:
                            eliminado = _a.sent();
                            this.notificacionesGateway.broadcastUsuariosActualizados({
                                accion: 'ELIMINAR',
                                usuarioId: id,
                            });
                            return [2 /*return*/, eliminado];
                    }
                });
            });
        };
        UsersService_1.prototype.restaurar = function (id, usuarioRestauradorId) {
            return __awaiter(this, void 0, void 0, function () {
                var usuario, restaurado;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.usuario.findUnique({
                                where: { id: id },
                            })];
                        case 1:
                            usuario = _a.sent();
                            if (!usuario) {
                                throw new common_1.NotFoundException("Usuario con ID ".concat(id, " no encontrado"));
                            }
                            return [4 /*yield*/, this.prisma.usuario.update({
                                    where: { id: id },
                                    data: {
                                        eliminadoEn: null,
                                        estado: client_1.EstadoUsuario.ACTIVO,
                                    },
                                })];
                        case 2:
                            restaurado = _a.sent();
                            if (!usuarioRestauradorId) return [3 /*break*/, 4];
                            return [4 /*yield*/, this.auditService.create({
                                    usuarioId: usuarioRestauradorId,
                                    accion: 'RESTAURAR_USUARIO',
                                    entidad: 'Usuario',
                                    entidadId: id,
                                    datosAnteriores: { eliminadoEn: usuario.eliminadoEn },
                                    datosNuevos: { eliminadoEn: null },
                                })];
                        case 3:
                            _a.sent();
                            _a.label = 4;
                        case 4:
                            this.notificacionesGateway.broadcastUsuariosActualizados({
                                accion: 'RESTAURAR',
                                usuarioId: id,
                            });
                            return [2 /*return*/, restaurado];
                    }
                });
            });
        };
        UsersService_1.prototype.toggleEstado = function (id, nuevoEstado, usuarioModificadorId) {
            return __awaiter(this, void 0, void 0, function () {
                var usuario, usuarioActualizado;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.usuario.findUnique({
                                where: { id: id },
                            })];
                        case 1:
                            usuario = _a.sent();
                            if (!usuario) {
                                throw new common_1.NotFoundException("Usuario con ID ".concat(id, " no encontrado"));
                            }
                            // PROTECCIÓN: El Superadmin principal no puede ser desactivado por otros
                            if (usuario.esPrincipal && nuevoEstado !== client_1.EstadoUsuario.ACTIVO) {
                                if (!usuarioModificadorId || usuarioModificadorId !== id) {
                                    throw new common_1.ForbiddenException('El Superadministrador principal no puede ser desactivado por otros usuarios');
                                }
                            }
                            return [4 /*yield*/, this.prisma.usuario.update({
                                    where: { id: id },
                                    data: {
                                        estado: nuevoEstado,
                                    },
                                    select: {
                                        id: true,
                                        nombres: true,
                                        estado: true,
                                    },
                                })];
                        case 2:
                            usuarioActualizado = _a.sent();
                            this.notificacionesGateway.broadcastUsuariosActualizados({
                                accion: 'TOGGLE_ESTADO',
                                usuarioId: usuarioActualizado.id,
                            });
                            return [2 /*return*/, usuarioActualizado];
                    }
                });
            });
        };
        UsersService_1.prototype.changePassword = function (id, changePasswordDto) {
            return __awaiter(this, void 0, void 0, function () {
                var usuario, passwordValid, error_1, hashContrasena, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            // Validar que se tenga la nueva contraseña
                            if (!changePasswordDto.contrasenaNueva || changePasswordDto.contrasenaNueva.trim().length < 6) {
                                throw new common_1.BadRequestException('La nueva contraseña debe tener al menos 6 caracteres');
                            }
                            return [4 /*yield*/, this.prisma.usuario.findUnique({
                                    where: { id: id },
                                })];
                        case 1:
                            usuario = _a.sent();
                            if (!usuario) {
                                throw new common_1.NotFoundException('Usuario no encontrado');
                            }
                            if (!(changePasswordDto.contrasenaActual && changePasswordDto.contrasenaActual.trim() !== '')) return [3 /*break*/, 6];
                            _a.label = 2;
                        case 2:
                            _a.trys.push([2, 4, , 5]);
                            return [4 /*yield*/, argon2.verify(usuario.hashContrasena, changePasswordDto.contrasenaActual)];
                        case 3:
                            passwordValid = _a.sent();
                            if (!passwordValid) {
                                throw new common_2.UnauthorizedException('La contraseña actual es incorrecta');
                            }
                            return [3 /*break*/, 5];
                        case 4:
                            error_1 = _a.sent();
                            if (error_1 instanceof common_2.UnauthorizedException)
                                throw error_1;
                            this.logger.error("Error al verificar contrase\u00F1a actual para usuario ".concat(id), error_1 instanceof Error ? error_1.stack : error_1);
                            throw new common_1.BadRequestException('Error al validar la contraseña actual');
                        case 5: return [3 /*break*/, 7];
                        case 6:
                            this.logger.log("Cambio de contrase\u00F1a administrativo para usuario ".concat(id));
                            _a.label = 7;
                        case 7:
                            _a.trys.push([7, 10, , 11]);
                            return [4 /*yield*/, argon2.hash(changePasswordDto.contrasenaNueva)];
                        case 8:
                            hashContrasena = _a.sent();
                            return [4 /*yield*/, this.prisma.usuario.update({
                                    where: { id: id },
                                    data: { hashContrasena: hashContrasena },
                                })];
                        case 9:
                            _a.sent();
                            this.logger.log("Contrase\u00F1a actualizada para usuario ".concat(id));
                            return [2 /*return*/, { message: 'Contraseña actualizada correctamente' }];
                        case 10:
                            error_2 = _a.sent();
                            this.logger.error("Error al actualizar contrase\u00F1a para usuario ".concat(id), error_2 instanceof Error ? error_2.stack : error_2);
                            throw new common_1.BadRequestException('Error al actualizar la contraseña');
                        case 11: return [2 /*return*/];
                    }
                });
            });
        };
        return UsersService_1;
    }());
    __setFunctionName(_classThis, "UsersService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        UsersService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return UsersService = _classThis;
}();
exports.UsersService = UsersService;
