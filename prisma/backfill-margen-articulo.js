/* eslint-disable no-console */

require('dotenv/config');

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const batchSize = Number(process.env.BATCH_SIZE || 200);

  console.log('[backfill-margen-articulo] start');
  console.log(`[backfill-margen-articulo] batchSize=${batchSize}`);

  let totalUpdated = 0;
  let lastId = null;

  while (true) {
    const prestamos = await prisma.prestamo.findMany({
      where: {
        eliminadoEn: null,
        tipoPrestamo: 'ARTICULO',
        margenArticulo: null,
        productoId: { not: null },
      },
      select: {
        id: true,
        monto: true,
        cuotaInicial: true,
        precioVentaArticulo: true,
        costoArticulo: true,
        margenArticulo: true,
        producto: { select: { costo: true } },
      },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(lastId
        ? {
            cursor: { id: lastId },
            skip: 1,
          }
        : {}),
    });

    if (prestamos.length === 0) break;

    for (const p of prestamos) {
      const montoFinanciado = Number(p.monto || 0);
      const cuotaInicial = Number(p.cuotaInicial || 0);

      // Precio de venta total del artículo, consistente con el modelo actual:
      // - `monto` en Prestamo para ARTICULO guarda el valor a financiar (precioTotal - cuotaInicial)
      // - `cuotaInicial` es el abono inicial
      // => precioVenta = monto + cuotaInicial
      const precioVentaArticulo = montoFinanciado + cuotaInicial;

      const costoArticulo = p.producto?.costo != null ? Number(p.producto.costo) : 0;
      const margenArticulo = precioVentaArticulo - costoArticulo;

      // Idempotencia: solo rellenar cuando el campo esté null.
      // No tocar `monto`, `cuotaInicial`, ni nada de pagos/cuotas.
      await prisma.prestamo.update({
        where: { id: p.id },
        data: {
          precioVentaArticulo: p.precioVentaArticulo == null ? precioVentaArticulo : undefined,
          costoArticulo: p.costoArticulo == null ? costoArticulo : undefined,
          margenArticulo: p.margenArticulo == null ? margenArticulo : undefined,
        },
      });

      totalUpdated += 1;
      if (totalUpdated % 50 === 0) {
        console.log(`[backfill-margen-articulo] updated=${totalUpdated}`);
      }
    }

    lastId = prestamos[prestamos.length - 1].id;
  }

  console.log(`[backfill-margen-articulo] done. updated=${totalUpdated}`);
}

main()
  .catch((err) => {
    console.error('[backfill-margen-articulo] error', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
