"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const dotenv = require("dotenv");
dotenv.config();
const connectionString = process.env.DATABASE_URL;
const pool = new pg_1.Pool({ connectionString });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
async function main() {
    console.log('🗑️ Iniciando limpieza de datos operativos...');
    try {
        console.log('Borrando Multimedia (prestamos, pagos, gastos, etc)...');
        await prisma.multimedia.deleteMany({
            where: {
                clienteId: null,
                usuarioId: null
            }
        });
        console.log('Borrando Detalles de Pago...');
        await prisma.detallePago.deleteMany({});
        console.log('Borrando Recibos...');
        await prisma.recibo.deleteMany({});
        console.log('Borrando Pagos...');
        await prisma.pago.deleteMany({});
        console.log('Borrando Extensiones de Pago...');
        await prisma.extensionPago.deleteMany({});
        console.log('Borrando Cuotas...');
        await prisma.cuota.deleteMany({});
        console.log('Borrando Préstamos...');
        await prisma.prestamo.deleteMany({});
        console.log('Borrando Transacciones...');
        await prisma.transaccion.deleteMany({});
        console.log('Borrando Gastos...');
        await prisma.gasto.deleteMany({});
        console.log('Borrando Precios de Productos...');
        await prisma.precioProducto.deleteMany({});
        console.log('Borrando Productos...');
        await prisma.producto.deleteMany({});
        console.log('Borrando Asignaciones de Ruta...');
        await prisma.asignacionRuta.deleteMany({});
        console.log('Borrando Cajas...');
        await prisma.caja.deleteMany({});
        console.log('Borrando Rutas...');
        await prisma.ruta.deleteMany({});
        console.log('Borrando Aprobaciones...');
        await prisma.aprobacion.deleteMany({});
        console.log('Borrando Cola de Sincronización...');
        await prisma.colaSincronizacion.deleteMany({});
        console.log('Borrando Auditoría...');
        await prisma.registroAuditoria.deleteMany({});
        console.log('Borrando Notificaciones...');
        await prisma.notificacion.deleteMany({});
        console.log('✅ Limpieza completada exitosamente.');
        console.log('ℹ️ Se han conservado Usuarios, Clientes y su Multimedia asociado.');
    }
    catch (error) {
        console.error('❌ Error durante la limpieza:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
//# sourceMappingURL=reset-data.js.map