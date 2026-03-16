"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Publico = exports.CLAVE_PUBLICO = void 0;
var common_1 = require("@nestjs/common");
exports.CLAVE_PUBLICO = 'esPublico';
var Publico = function () { return (0, common_1.SetMetadata)(exports.CLAVE_PUBLICO, true); };
exports.Publico = Publico;
