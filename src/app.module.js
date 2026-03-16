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
exports.AppModule = void 0;
var common_1 = require("@nestjs/common");
var config_1 = require("@nestjs/config");
var schedule_1 = require("@nestjs/schedule");
var auth_module_1 = require("./auth/auth.module");
var users_module_1 = require("./users/users.module");
var roles_module_1 = require("./roles/roles.module");
var permissions_module_1 = require("./permissions/permissions.module");
var clients_module_1 = require("./clients/clients.module");
var loans_module_1 = require("./loans/loans.module");
var payments_module_1 = require("./payments/payments.module");
var routes_module_1 = require("./routes/routes.module");
var approvals_module_1 = require("./approvals/approvals.module");
var inventory_module_1 = require("./inventory/inventory.module");
var accounting_module_1 = require("./accounting/accounting.module");
var reports_module_1 = require("./reports/reports.module");
var audit_module_1 = require("./audit/audit.module");
var backup_module_1 = require("./backup/backup.module");
var prisma_module_1 = require("./prisma/prisma.module");
var dashboard_module_1 = require("./dashboard/dashboard.module");
var upload_module_1 = require("./upload/upload.module");
var categorias_module_1 = require("./categorias/categorias.module");
var push_module_1 = require("./push/push.module");
var configuracion_module_1 = require("./configuracion/configuracion.module");
var sync_conflicts_module_1 = require("./sync-conflicts/sync-conflicts.module");
var mirror_sync_module_1 = require("./mirror-sync/mirror-sync.module");
var bullmq_1 = require("@nestjs/bullmq");
var event_emitter_1 = require("@nestjs/event-emitter");
var AppModule = function () {
    var _classDecorators = [(0, common_1.Module)({
            imports: [
                config_1.ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env',
                }),
                schedule_1.ScheduleModule.forRoot(),
                auth_module_1.AuthModule,
                users_module_1.UsersModule,
                roles_module_1.RolesModule,
                permissions_module_1.PermissionsModule,
                clients_module_1.ClientsModule,
                loans_module_1.LoansModule,
                payments_module_1.PaymentsModule,
                routes_module_1.RoutesModule,
                approvals_module_1.ApprovalsModule,
                inventory_module_1.InventoryModule,
                accounting_module_1.AccountingModule,
                reports_module_1.ReportsModule,
                audit_module_1.AuditModule,
                backup_module_1.BackupModule,
                prisma_module_1.PrismaModule,
                dashboard_module_1.DashboardModule,
                upload_module_1.UploadModule,
                categorias_module_1.CategoriasModule,
                push_module_1.PushModule,
                configuracion_module_1.ConfiguracionModule,
                sync_conflicts_module_1.SyncConflictsModule,
                event_emitter_1.EventEmitterModule.forRoot(),
                bullmq_1.BullModule.forRoot({
                    connection: {
                        host: process.env.REDIS_HOST || 'localhost',
                        port: parseInt(process.env.REDIS_PORT || '6379'),
                        password: process.env.REDIS_PASSWORD || undefined,
                    },
                }),
                mirror_sync_module_1.MirrorSyncModule,
            ],
            controllers: [],
            providers: [],
        })];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var AppModule = _classThis = /** @class */ (function () {
        function AppModule_1() {
        }
        return AppModule_1;
    }());
    __setFunctionName(_classThis, "AppModule");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AppModule = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AppModule = _classThis;
}();
exports.AppModule = AppModule;
