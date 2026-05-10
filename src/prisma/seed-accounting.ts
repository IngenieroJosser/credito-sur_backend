/**
 * seed-accounting.ts — Script auxiliar para poblar el catálogo contable.
 *
 * Este seed ya está integrado en el seed principal (seed.ts).
 * Úsalo SOLO si necesitas repoblar las cuentas contables de forma aislada.
 *
 * Ejecución:
 *   npx ts-node -r tsconfig-paths/register src/prisma/seed-accounting.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// Las cuentas se definen como literales para evitar dependencia de los enums
// generados (que pueden tener problemas de caché en TS al ejecutar ts-node).
const accounts = [
  // 1. ACTIVOS
  { code: '1',     name: 'ACTIVOS',                   type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Cuentas de activo general' },
  { code: '1.1',   name: 'Caja Principal',            type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Dinero en oficina y bancos' },
  { code: '1.1.1', name: 'Caja Oficina Central',      type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Efectivo físico en oficina' },
  { code: '1.1.2', name: 'Cuentas Bancarias',         type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Dinero en bancos (Nequi, Bancolombia, etc.)' },
  { code: '1.2',   name: 'Cajas de Ruta',             type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Efectivo en poder de cobradores' },
  { code: '1.2.1', name: 'Caja Ruta General',         type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Cuenta control para billeteras de cobradores' },
  { code: '1.2.1.E', name: 'Caja Ruta — Efectivo',      type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Recaudo en efectivo por cobrador' },
  { code: '1.2.1.T', name: 'Caja Ruta — Transferencia',  type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Recaudo por Nequi/Bancolombia pendiente de conciliación' },
  { code: '1.3',   name: 'Cartera de Préstamos',      type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Derechos de cobro sobre clientes' },
  { code: '1.3.1', name: 'Cartera Vigente',           type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Préstamos en estado activo' },
  { code: '1.3.2', name: 'Cartera en Mora',           type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Préstamos con cuotas vencidas' },
  { code: '1.4',   name: 'Cuentas Cobrar Cobradores', type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Deudas de empleados por descuadres o adelantos' },
  { code: '1.4.1', name: 'Deuda Cobrador General',    type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Subcuenta de control de deudas' },
  { code: '1.5',   name: 'Inventario de Artículos',    type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Costo de artículos disponibles para venta' },
  // 2. PATRIMONIO / PASIVO
  { code: '2',     name: 'PATRIMONIO Y PASIVOS',      type: 'PATRIMONIO', nature: 'ACREEDORA',  description: 'Obligaciones y capital' },
  { code: '2.1',   name: 'Capital del Propietario',   type: 'PATRIMONIO', nature: 'ACREEDORA',  description: 'Inversión inicial del dueño' },
  { code: '2.2',   name: 'Utilidades Retenidas',      type: 'PATRIMONIO', nature: 'ACREEDORA',  description: 'Ganancias de ejercicios anteriores' },
  { code: '2.3',   name: 'Utilidad del Periodo',      type: 'PATRIMONIO', nature: 'ACREEDORA',  description: 'Ganancia neta calculada' },
  { code: '2.4',   name: 'Ajustes Pendientes',        type: 'PASIVO',     nature: 'ACREEDORA',  description: 'Sobrantes de arqueo por identificar' },
  // 3. INGRESOS
  { code: '3',     name: 'INGRESOS',                  type: 'INGRESOS',   nature: 'ACREEDORA',  description: 'Aumentos en el patrimonio por actividad' },
  { code: '3.1',   name: 'Ingresos por Intereses',    type: 'INGRESOS',   nature: 'ACREEDORA',  description: 'Interés corriente de préstamos' },
  { code: '3.2',   name: 'Ingresos por Mora',         type: 'INGRESOS',   nature: 'ACREEDORA',  description: 'Interés por mora y penalidades' },
  { code: '3.3',   name: 'Otros Ingresos Oper.',      type: 'INGRESOS',   nature: 'ACREEDORA',  description: 'Margen de artículos u otros conceptos' },
  { code: '3.4',   name: 'Ingresos por Artículos',     type: 'INGRESOS',   nature: 'ACREEDORA',  description: 'Precio de venta de artículos financiados o de contado' },
  // 4. GASTOS
  { code: '4',     name: 'GASTOS',                    type: 'GASTOS',     nature: 'DEBITORA',   description: 'Disminuciones en el patrimonio por operación' },
  { code: '4.1',   name: 'Gastos de Ruta',            type: 'GASTOS',     nature: 'DEBITORA',   description: 'Gasolina, papelería, viáticos' },
  { code: '4.2',   name: 'Gastos Administrativos',    type: 'GASTOS',     nature: 'DEBITORA',   description: 'Nómina, servicios, arriendos' },
  { code: '4.3',   name: 'Pérdidas Incobrables',      type: 'GASTOS',     nature: 'DEBITORA',   description: 'Condonaciones o préstamos perdidos' },
  // 5. COSTOS
  { code: '5',     name: 'COSTOS',                     type: 'COSTOS',     nature: 'DEBITORA',   description: 'Costos directos asociados a ventas' },
  { code: '5.1',   name: 'Costo de Artículos Vendidos', type: 'COSTOS',    nature: 'DEBITORA',   description: 'Costo de inventario entregado en créditos de artículo' },
] as const;

async function main() {
  console.log('🌱 Iniciando seed del catálogo contable...');

  for (const acc of accounts) {
    await (prisma as any).account.upsert({
      where:  { code: acc.code },
      update: { name: acc.name, type: acc.type, nature: acc.nature, description: acc.description, isActive: true },
      create: acc,
    });
  }

  console.log('✅ Catálogo contable poblado exitosamente.');
}

main()
  .catch((e) => { console.error('❌ Error en el seed contable:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
