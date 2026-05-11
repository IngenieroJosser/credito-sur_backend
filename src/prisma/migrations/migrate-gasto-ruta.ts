/**
 * Script de migración: actualiza categorías de tipo GASTO a GASTO_RUTA.
 * 
 * El GastoModal del cobrador ahora usa tipo="GASTO_RUTA" para separar las
 * categorías de gasto de campo (cobrador) de las categorías contables (admin).
 * Este script migra las categorías existentes para que sigan apareciendo
 * en el modal del cobrador.
 * 
 * Uso: ts-node -r tsconfig-paths/register src/prisma/migrations/migrate-gasto-ruta.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as any;


async function main() {
  // Tomar SOLO categorías que hayan sido usadas en gastos de ruta
  const usadosEnRuta = await prisma.gasto.findMany({
    where: {
      rutaId: { not: null },
      categoriaId: { not: null },
    },
    distinct: ['categoriaId'],
    select: { categoriaId: true },
  });

  const categoriaIds = usadosEnRuta
    .map((r: any) => r.categoriaId)
    .filter(Boolean);

  console.log(`\nCategorías referenciadas por gastos de ruta: ${categoriaIds.length}`);
  if (categoriaIds.length === 0) {
    console.log('Nada que migrar: no hay gastos de ruta con categoría asociada.');
    return;
  }

  // Ver qué hay antes de migrar
  const antes = await prisma.categoria.findMany({
    where: {
      id: { in: categoriaIds },
      tipo: 'GASTO',
      eliminadoEn: null,
    },
    select: { id: true, nombre: true, tipo: true, activa: true },
  });

  console.log(`\nCategorías (tipo='GASTO') a migrar a 'GASTO_RUTA': ${antes.length}`);
  if (antes.length > 0) console.table(antes);

  if (antes.length === 0) {
    console.log('Nada que migrar. Las categorías de ruta ya no están en tipo=GASTO.');
    return;
  }

  // Migrar solo las categorías usadas en ruta
  const resultado = await prisma.categoria.updateMany({
    where: {
      id: { in: antes.map((c: any) => c.id) },
      tipo: 'GASTO',
      eliminadoEn: null,
    },
    data: { tipo: 'GASTO_RUTA' },
  });

  console.log(`\n✔  ${resultado.count} categoría(s) actualizadas a tipo='GASTO_RUTA'.`);

  // Verificación post-migración
  const despues = await prisma.categoria.findMany({
    where: { tipo: 'GASTO_RUTA', eliminadoEn: null },
    select: { id: true, nombre: true, tipo: true, activa: true },
    orderBy: { nombre: 'asc' },
  });
  console.log(`\nEstado final — categorías GASTO_RUTA: ${despues.length}`);
  console.table(despues);
}

main()
  .catch((e) => {
    console.error('Error en la migración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
