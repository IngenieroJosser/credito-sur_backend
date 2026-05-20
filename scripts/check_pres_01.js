const { Client } = require('pg');
const connectionString = "postgresql://postgres:%23Erickmanuel238@127.0.0.1:5432/credito_sur?schema=public";
const client = new Client({ connectionString });

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT id, "numeroPrestamo", monto, "interesTotal", "totalPagado", 
           "capitalPagado", "interesPagado", "interesMoraPagado", 
           "saldoPendiente", estado
    FROM "Prestamo"
  `);
  console.log("=== LOANS ===");
  console.table(res.rows);
  if (res.rows.length === 0) {
    console.log("No loans found in the database!");
    await client.end();
    return;
  }
  const loanId = res.rows[0].id;

  const resCuotas = await client.query(`
    SELECT id, "numeroCuota", monto, "montoCapital", "montoInteres", "montoPagado", "montoInteresMora", estado
    FROM cuotas
    WHERE "prestamoId" = $1
    ORDER BY "numeroCuota" ASC
  `, [res.rows[0].id]);
  console.log("=== CUOTAS ===");
  console.table(resCuotas.rows);

  const resPagos = await client.query(`
    SELECT id, "montoTotal", "fechaPago"
    FROM "Pago"
    WHERE "prestamoId" = $1
  `, [res.rows[0].id]);
  console.log("=== PAGOS ===");
  console.table(resPagos.rows);

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
