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
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoansModule = void 0;
var common_1 = require("@nestjs/common");
var loans_controller_1 = require("./loans.controller");
var loans_service_1 = require("./loans.service");
var mora_service_1 = require("./mora.service");
var loans_scheduler_1 = require("./loans.scheduler");
var prisma_module_1 = require("../prisma/prisma.module");
var prisma_service_1 = require("../prisma/prisma.service");
var logger_middleware_1 = require("../common/middleware/logger.middleware");
var notificaciones_module_1 = require("../notificaciones/notificaciones.module");
var audit_module_1 = require("../audit/audit.module");
var push_module_1 = require("../push/push.module");
var configuracion_module_1 = require("../configuracion/configuracion.module");
var approvals_module_1 = require("../approvals/approvals.module");
var LoansModule = function () {
    var _classDecorators = [(0, common_1.Module)({
            imports: [prisma_module_1.PrismaModule, notificaciones_module_1.NotificacionesModule, audit_module_1.AuditModule, push_module_1.PushModule, configuracion_module_1.ConfiguracionModule, approvals_module_1.ApprovalsModule],
            controllers: [loans_controller_1.LoansController],
            providers: [loans_service_1.LoansService, mora_service_1.MoraService, prisma_service_1.PrismaService, loans_scheduler_1.LoansScheduler],
            exports: [loans_service_1.LoansService, mora_service_1.MoraService],
        })];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var LoansModule = _classThis = /** @class */ (function () {
        function LoansModule_1() {
        }
        LoansModule_1.prototype.configure = function (consumer) {
            consumer.apply(logger_middleware_1.LoggerMiddleware).forRoutes('loans');
        };
        return LoansModule_1;
    }());
    __setFunctionName(_classThis, "LoansModule");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        LoansModule = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return LoansModule = _classThis;
}();
exports.LoansModule = LoansModule;
