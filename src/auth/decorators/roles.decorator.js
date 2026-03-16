"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Roles = exports.CLAVE_ROLES = void 0;
var common_1 = require("@nestjs/common");
exports.CLAVE_ROLES = 'roles';
var Roles = function () {
    var roles = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        roles[_i] = arguments[_i];
    }
    return (0, common_1.SetMetadata)(exports.CLAVE_ROLES, roles);
};
exports.Roles = Roles;
