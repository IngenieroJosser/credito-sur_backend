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
exports.AuthService = void 0;
var common_1 = require("@nestjs/common");
var argon2 = require("argon2");
var nodemailer = require("nodemailer");
var AuthService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var AuthService = _classThis = /** @class */ (function () {
        function AuthService_1(usersService, jwtService, prisma) {
            this.usersService = usersService;
            this.jwtService = jwtService;
            this.prisma = prisma;
        }
        AuthService_1.prototype.validarUsuario = function (nombreUsuario, contrasena) {
            return __awaiter(this, void 0, void 0, function () {
                var usuario, matches, _hashContrasena, resultado, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.prisma.usuario.findFirst({
                                where: {
                                    OR: [
                                        { correo: { equals: nombreUsuario, mode: 'insensitive' } },
                                        { nombres: { equals: nombreUsuario, mode: 'insensitive' } },
                                    ],
                                },
                            })];
                        case 1:
                            usuario = _b.sent();
                            if (!usuario)
                                return [2 /*return*/, null];
                            _b.label = 2;
                        case 2:
                            _b.trys.push([2, 4, , 5]);
                            return [4 /*yield*/, argon2.verify(usuario.hashContrasena, contrasena)];
                        case 3:
                            matches = _b.sent();
                            if (matches) {
                                _hashContrasena = usuario.hashContrasena, resultado = __rest(usuario, ["hashContrasena"]);
                                return [2 /*return*/, resultado];
                            }
                            return [3 /*break*/, 5];
                        case 4:
                            _a = _b.sent();
                            return [3 /*break*/, 5];
                        case 5: return [2 /*return*/, null];
                    }
                });
            });
        };
        AuthService_1.prototype.login = function (loginAuthDto) {
            return __awaiter(this, void 0, void 0, function () {
                var usuario, asignaciones, rolDinamico, rutaDefault, permisosPersonalizados, rolPermisos, permisosEfectivos, uniquePermisos, permisosConMeta, permisosUnicos, modulosMap, _i, permisosUnicos_1, p, grupo, sidebar, payload;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.validarUsuario(loginAuthDto.nombres, loginAuthDto.contrasena)];
                        case 1:
                            usuario = _b.sent();
                            if (!usuario) {
                                throw new common_1.UnauthorizedException('Credenciales invalidas');
                            }
                            if (usuario.estado !== 'ACTIVO') {
                                throw new common_1.UnauthorizedException('Usuario inactivo o suspendido');
                            }
                            return [4 /*yield*/, this.prisma.usuario.update({
                                    where: { id: usuario.id },
                                    data: { ultimoIngreso: new Date() },
                                })];
                        case 2:
                            _b.sent();
                            return [4 /*yield*/, this.prisma.asignacionRolUsuario.findMany({
                                    where: { usuarioId: usuario.id },
                                    include: {
                                        rol: true,
                                    },
                                })];
                        case 3:
                            asignaciones = _b.sent();
                            rolDinamico = (_a = asignaciones[0]) === null || _a === void 0 ? void 0 : _a.rol;
                            rutaDefault = (rolDinamico === null || rolDinamico === void 0 ? void 0 : rolDinamico.rutaDefault) || '/admin';
                            return [4 /*yield*/, this.prisma.asignacionPermisoUsuario.findMany({
                                    where: { usuarioId: usuario.id },
                                    include: { permiso: true },
                                })];
                        case 4:
                            permisosPersonalizados = _b.sent();
                            return [4 /*yield*/, this.prisma.rolPermiso.findMany({
                                    where: {
                                        rolId: { in: asignaciones.map(function (a) { return a.rolId; }) },
                                    },
                                    include: {
                                        permiso: true,
                                    },
                                })];
                        case 5:
                            rolPermisos = _b.sent();
                            permisosEfectivos = permisosPersonalizados.length > 0
                                ? permisosPersonalizados.map(function (p) { return p.permiso; })
                                : rolPermisos.map(function (rp) { return rp.permiso; });
                            uniquePermisos = __spreadArray([], new Set(permisosEfectivos.map(function (p) { return p.accion; })), true);
                            permisosConMeta = permisosEfectivos;
                            permisosUnicos = permisosConMeta.filter(function (p, i, arr) { return arr.findIndex(function (x) { return x.id === p.id; }) === i; });
                            modulosMap = new Map();
                            for (_i = 0, permisosUnicos_1 = permisosUnicos; _i < permisosUnicos_1.length; _i++) {
                                p = permisosUnicos_1[_i];
                                if (!p.esNavegable)
                                    continue;
                                grupo = modulosMap.get(p.modulo) || {
                                    nombre: p.modulo,
                                    permisos: [],
                                };
                                grupo.permisos.push(p);
                                modulosMap.set(p.modulo, grupo);
                            }
                            sidebar = Array.from(modulosMap.entries()).map(function (_a) {
                                var modulo = _a[0], grupo = _a[1];
                                return ({
                                    modulo: modulo,
                                    items: grupo.permisos
                                        .sort(function (a, b) { return a.orden - b.orden; })
                                        .map(function (p) { return ({
                                        id: p.accion,
                                        nombre: p.nombre,
                                        icono: p.icono,
                                        ruta: p.ruta,
                                        orden: p.orden,
                                    }); }),
                                });
                            });
                            payload = {
                                sub: usuario.id,
                                nombres: usuario.nombres,
                                rol: usuario.rol,
                                permisos: uniquePermisos,
                            };
                            return [2 /*return*/, {
                                    access_token: this.jwtService.sign(payload),
                                    usuario: {
                                        id: usuario.id,
                                        nombres: usuario.nombres,
                                        apellidos: usuario.apellidos,
                                        correo: usuario.correo,
                                        rol: usuario.rol,
                                        permisos: uniquePermisos,
                                        rutaDefault: rutaDefault,
                                        sidebar: sidebar,
                                    },
                                }];
                    }
                });
            });
        };
        AuthService_1.prototype.registrarUsuario = function (dto) {
            return __awaiter(this, void 0, void 0, function () {
                var usuario, payload;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.usersService.crear({
                                nombres: dto.nombres,
                                apellidos: dto.apellidos,
                                correo: dto.correo,
                                password: dto.password,
                                rol: dto.rol,
                            })];
                        case 1:
                            usuario = _a.sent();
                            payload = {
                                sub: usuario.id,
                                nombres: usuario.nombres,
                                rol: usuario.rol,
                            };
                            return [2 /*return*/, {
                                    access_token: this.jwtService.sign(payload),
                                    usuario: usuario,
                                }];
                    }
                });
            });
        };
        AuthService_1.prototype.obtenerTodosLosUsuarios = function () {
            return __awaiter(this, void 0, void 0, function () {
                var mostrarUsuarios;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.usuario.findMany()];
                        case 1:
                            mostrarUsuarios = _a.sent();
                            return [2 /*return*/, mostrarUsuarios];
                    }
                });
            });
        };
        // ============================================================
        // RECUPERACION DE CONTRASENA — Flujo por correo electronico
        // ============================================================
        AuthService_1.prototype.solicitarRecuperacion = function (dto) {
            return __awaiter(this, void 0, void 0, function () {
                var usuario, codigo, expiracion, codigoHash;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.usuario.findFirst({
                                where: { correo: { equals: dto.correo, mode: 'insensitive' } },
                            })];
                        case 1:
                            usuario = _a.sent();
                            // Por seguridad, no revelamos si el correo existe o no
                            if (!usuario || usuario.estado !== 'ACTIVO') {
                                return [2 /*return*/, { mensaje: 'Si el correo existe y la cuenta está activa, recibirás un código en breve.' }];
                            }
                            // Solo superadmin puede usar este flujo (otros roles lo gestionan a traves del admin)
                            if (usuario.rol !== 'SUPER_ADMINISTRADOR') {
                                return [2 /*return*/, { mensaje: 'Si el correo existe y la cuenta está activa, recibirás un código en breve.' }];
                            }
                            codigo = Math.floor(100000 + Math.random() * 900000).toString();
                            expiracion = new Date(Date.now() + 15 * 60 * 1000);
                            return [4 /*yield*/, argon2.hash(codigo)];
                        case 2:
                            codigoHash = _a.sent();
                            // Guardar el código hasheado en la base de datos
                            return [4 /*yield*/, this.prisma.usuario.update({
                                    where: { id: usuario.id },
                                    data: {
                                        resetPasswordToken: codigoHash,
                                        resetPasswordExpires: expiracion,
                                    },
                                })];
                        case 3:
                            // Guardar el código hasheado en la base de datos
                            _a.sent();
                            // Enviar el correo con el código
                            return [4 /*yield*/, this.enviarCorreoRecuperacion(usuario.correo, usuario.nombres, codigo)];
                        case 4:
                            // Enviar el correo con el código
                            _a.sent();
                            return [2 /*return*/, { mensaje: 'Si el correo existe y la cuenta está activa, recibirás un código en breve.' }];
                    }
                });
            });
        };
        AuthService_1.prototype.verificarCodigoRecuperacion = function (dto) {
            return __awaiter(this, void 0, void 0, function () {
                var usuario, expires, token, codigoValido, _a, nuevoHash;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.prisma.usuario.findFirst({
                                where: { correo: { equals: dto.correo, mode: 'insensitive' } },
                            })];
                        case 1:
                            usuario = _b.sent();
                            if (!usuario) {
                                throw new common_1.BadRequestException('Código inválido o expirado');
                            }
                            expires = usuario.resetPasswordExpires;
                            if (!expires || new Date() > new Date(expires)) {
                                throw new common_1.BadRequestException('El código ha expirado. Solicita uno nuevo.');
                            }
                            token = usuario.resetPasswordToken;
                            if (!token) {
                                throw new common_1.BadRequestException('Código inválido o expirado');
                            }
                            codigoValido = false;
                            _b.label = 2;
                        case 2:
                            _b.trys.push([2, 4, , 5]);
                            return [4 /*yield*/, argon2.verify(token, dto.codigo)];
                        case 3:
                            codigoValido = _b.sent();
                            return [3 /*break*/, 5];
                        case 4:
                            _a = _b.sent();
                            throw new common_1.BadRequestException('Código inválido o expirado');
                        case 5:
                            if (!codigoValido) {
                                throw new common_1.BadRequestException('El código ingresado no es correcto');
                            }
                            return [4 /*yield*/, argon2.hash(dto.nuevaContrasena)];
                        case 6:
                            nuevoHash = _b.sent();
                            return [4 /*yield*/, this.prisma.usuario.update({
                                    where: { id: usuario.id },
                                    data: {
                                        hashContrasena: nuevoHash,
                                        resetPasswordToken: null,
                                        resetPasswordExpires: null,
                                    },
                                })];
                        case 7:
                            _b.sent();
                            return [2 /*return*/, { mensaje: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' }];
                    }
                });
            });
        };
        AuthService_1.prototype.enviarCorreoRecuperacion = function (correo, nombre, codigo) {
            return __awaiter(this, void 0, void 0, function () {
                var smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, transporter;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            smtpHost = process.env.SMTP_HOST;
                            smtpPort = parseInt(process.env.SMTP_PORT || '587');
                            smtpUser = process.env.SMTP_USER;
                            smtpPass = process.env.SMTP_PASS;
                            smtpFrom = process.env.SMTP_FROM || smtpUser;
                            if (!smtpHost || !smtpUser || !smtpPass) {
                                // En desarrollo o sin SMTP configurado, solo loguear el código
                                console.warn("[RECOVERY] Codigo de recuperacion para ".concat(correo, ": ").concat(codigo, " (SMTP no configurado)"));
                                return [2 /*return*/];
                            }
                            transporter = nodemailer.createTransport({
                                host: smtpHost,
                                port: smtpPort,
                                secure: smtpPort === 465,
                                auth: { user: smtpUser, pass: smtpPass },
                            });
                            return [4 /*yield*/, transporter.sendMail({
                                    from: "\"Cr\u00E9ditos del Sur\" <".concat(smtpFrom, ">"),
                                    to: correo,
                                    subject: 'Código de recuperación de contraseña',
                                    html: "\n        <div style=\"font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #f8fafc; border-radius: 12px;\">\n          <h2 style=\"color: #1e293b; margin-bottom: 8px;\">Recuperaci\u00F3n de contrase\u00F1a</h2>\n          <p style=\"color: #64748b;\">Hola <strong>".concat(nombre, "</strong>, recibimos una solicitud para restablecer tu contrase\u00F1a.</p>\n          <div style=\"background: #fff; border: 2px solid #e2e8f0; border-radius: 10px; padding: 24px; text-align: center; margin: 24px 0;\">\n            <p style=\"color: #64748b; font-size: 14px; margin: 0 0 8px 0;\">Tu c\u00F3digo de verificaci\u00F3n es:</p>\n            <div style=\"font-size: 42px; font-weight: 900; letter-spacing: 12px; color: #0f172a; font-family: monospace;\">").concat(codigo, "</div>\n          </div>\n          <p style=\"color: #64748b; font-size: 13px;\">Este c\u00F3digo expira en <strong>15 minutos</strong>. Si no solicitaste este cambio, ignora este correo.</p>\n          <hr style=\"border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;\">\n          <p style=\"color: #94a3b8; font-size: 12px; text-align: center;\">Cr\u00E9ditos del Sur \u2014 Sistema de Gesti\u00F3n</p>\n        </div>\n      "),
                                })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        return AuthService_1;
    }());
    __setFunctionName(_classThis, "AuthService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AuthService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AuthService = _classThis;
}();
exports.AuthService = AuthService;
