const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// 1. Obtener la cadena de conexión priorizando las variables de entorno de Render (producción)
let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/^DATABASE_URL=["']?([^"'\r\n]+)["']?/m);
      if (match && match[1]) {
        connectionString = match[1];
      }
    }
  } catch (err) {
    console.log("[Migration] No se pudo leer el archivo .env localmente.");
  }
}

if (!connectionString) {
  // Conexión fallback por defecto (desarrollo local)
  connectionString = "postgresql://postgres:%23Erickmanuel238@127.0.0.1:5432/credito_sur?schema=public";
}

console.log("[Migration] Iniciando regularización matemática de decimales...");
const client = new Client({ connectionString });

async function main() {
  await client.connect();
  console.log("[Migration] ✅ Conexión establecida a la base de datos.");

  // 1. Obtener todos los préstamos activos, en mora y pendientes de aprobación
  const loansRes = await client.query(`
    SELECT id, "numeroPrestamo", monto, "interesTotal", "totalPagado", 
           "capitalPagado", "interesPagado", "interesMoraPagado", 
           "saldoPendiente", "cuotaInicial", estado
    FROM "Prestamo"
    WHERE estado IN ('ACTIVO', 'EN_MORA', 'PENDIENTE_APROBACION')
      AND "eliminadoEn" IS NULL
  `);

  console.log(`[Migration] Encontrados ${loansRes.rows.length} préstamos activos/en mora/pendientes.`);

  let correctedCount = 0;

  for (const loan of loansRes.rows) {
    const loanId = loan.id;
    const numPrestamo = loan.numeroPrestamo;

    // Obtener las cuotas para este préstamo
    const cuotasRes = await client.query(`
      SELECT id, "numeroCuota", monto, "montoCapital", "montoInteres", "montoPagado", "montoInteresMora", estado
      FROM cuotas
      WHERE "prestamoId" = $1
      ORDER BY "numeroCuota" ASC
    `, [loanId]);

    const cuotas = cuotasRes.rows;
    if (cuotas.length === 0) {
      console.log(`[Migration] ⚠️ Préstamo ${numPrestamo} no tiene cuotas.`);
      continue;
    }

    // Iniciar transacción para este préstamo
    await client.query('BEGIN');

    try {
      const targetMonto = Math.round(Number(loan.monto));
      const targetInteresTotal = Math.round(Number(loan.interesTotal));
      const targetCuotaInicial = Math.round(Number(loan.cuotaInicial || 0));

      let sumCapitalExceptLast = 0;
      let sumInteresExceptLast = 0;
      let totalMontoPagado = 0;

      // 1. Redondear cuotas 1 a n-1
      for (let i = 0; i < cuotas.length; i++) {
        const c = cuotas[i];
        const esUltima = i === cuotas.length - 1;

        let targetCap, targetInt;

        if (!esUltima) {
          targetCap = Math.round(Number(c.montoCapital));
          targetInt = Math.round(Number(c.montoInteres));
          sumCapitalExceptLast += targetCap;
          sumInteresExceptLast += targetInt;
        } else {
          // Última cuota absorbe la diferencia exacta
          targetCap = Math.max(0, targetMonto - sumCapitalExceptLast);
          targetInt = Math.max(0, targetInteresTotal - sumInteresExceptLast);
        }

        const targetMontoCuota = targetCap + targetInt;
        const targetPagadoCuota = Math.round(Number(c.montoPagado));
        const targetMoraCuota = Math.round(Number(c.montoInteresMora || 0));

        totalMontoPagado += targetPagadoCuota;

        // Actualizar cuota en la base de datos
        await client.query(`
          UPDATE cuotas
          SET monto = $1, "montoCapital" = $2, "montoInteres" = $3, 
              "montoPagado" = $4, "montoInteresMora" = $5
          WHERE id = $6
        `, [targetMontoCuota, targetCap, targetInt, targetPagadoCuota, targetMoraCuota, c.id]);
      }

      // 2. Calcular los nuevos totales redondeados del préstamo
      const finalTotalPagado = totalMontoPagado;
      const finalSaldoPendiente = Math.max(0, (targetMonto + targetInteresTotal) - finalTotalPagado);

      const finalCapitalPagado = Math.round(Number(loan.capitalPagado));
      const finalInteresPagado = Math.round(Number(loan.interesPagado));
      const finalInteresMoraPagado = Math.round(Number(loan.interesMoraPagado));

      // Actualizar el préstamo en la base de datos
      await client.query(`
        UPDATE "Prestamo"
        SET monto = $1, "interesTotal" = $2, "saldoPendiente" = $3, 
            "totalPagado" = $4, "capitalPagado" = $5, "interesPagado" = $6, 
            "interesMoraPagado" = $7, "cuotaInicial" = $8
        WHERE id = $9
      `, [
        targetMonto, targetInteresTotal, finalSaldoPendiente, 
        finalTotalPagado, finalCapitalPagado, finalInteresPagado, 
        finalInteresMoraPagado, targetCuotaInicial, loanId
      ]);

      await client.query('COMMIT');
      correctedCount++;
      console.log(`[Migration] ✅ Préstamo ${numPrestamo} regularizado exitosamente. Saldo: ${finalSaldoPendiente}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[Migration] ❌ Error al procesar préstamo ${numPrestamo}:`, err);
    }
  }

  console.log(`[Migration] Proceso completado. Se corrigieron y validaron ${correctedCount} préstamos.`);
  await client.end();
}

main().catch(err => {
  console.error("[Migration] Error fatal en la migración de decimales:", err);
  client.end();
  process.exit(1);
});
