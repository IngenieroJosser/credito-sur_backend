"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Permisos = exports.CLAVE_PERMISOS = void 0;
var common_1 = require("@nestjs/common");
exports.CLAVE_PERMISOS = 'permisos';
var Permisos = function () {
    var permisos = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        permisos[_i] = arguments[_i];
    }
    return (0, common_1.SetMetadata)(exports.CLAVE_PERMISOS, permisos);
};
exports.Permisos = Permisos;
