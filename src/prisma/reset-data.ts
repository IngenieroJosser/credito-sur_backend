
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Inicializar Prisma con Adapter (igual que en el servicio)
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🗑️ Iniciando limpieza de datos operativos...');

  try {
    // 1. Multimedia (Solo lo que no es de Cliente ni Usuario)
    console.log('Borrando Multimedia (prestamos, pagos, gastos, etc)...');
    await prisma.multimedia.deleteMany({
      where: {
        clienteId: null,
        usuarioId: null
      }
    });

    // 2. Módulo Pagos
    console.log('Borrando Detalles de Pago...');
    await prisma.detallePago.deleteMany({});
    
    console.log('Borrando Recibos...');
    await prisma.recibo.deleteMany({});
    
    console.log('Borrando Pagos...');
    await prisma.pago.deleteMany({});

    // 3. Módulo Préstamos
    console.log('Borrando Extensiones de Pago...');
    await prisma.extensionPago.deleteMany({});
    
    console.log('Borrando Cuotas...');
    await prisma.cuota.deleteMany({});
    
    console.log('Borrando Préstamos...');
    await prisma.prestamo.deleteMany({});

    // 4. Contabilidad y Gastos
    console.log('Borrando Transacciones...');
    await prisma.transaccion.deleteMany({});
    
    console.log('Borrando Gastos...');
    await prisma.gasto.deleteMany({});

    // 5. Inventario
    console.log('Borrando Precios de Productos...');
    await prisma.precioProducto.deleteMany({});
    
    console.log('Borrando Productos...');
    await prisma.producto.deleteMany({});

    // 6. Rutas y Cajas
    console.log('Borrando Asignaciones de Ruta...');
    await prisma.asignacionRuta.deleteMany({});
    
    console.log('Borrando Cajas...');
    await prisma.caja.deleteMany({});
    
    console.log('Borrando Rutas...');
    await prisma.ruta.deleteMany({});

    // 7. Sistema y Soporte
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

  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
