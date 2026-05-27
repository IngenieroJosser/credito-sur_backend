INSERT INTO "cuentas_contables" ("code", "name", "type", "nature", "description", "isActive")
VALUES
  ('1.5', 'Inventario de Artículos', 'ACTIVO', 'DEBITORA', 'Costo de artículos disponibles para venta', true),
  ('3.4', 'Ingresos por Artículos', 'INGRESOS', 'ACREEDORA', 'Precio de venta de artículos financiados o de contado', true),
  ('5', 'COSTOS', 'COSTOS', 'DEBITORA', 'Costos directos asociados a ventas', true),
  ('5.1', 'Costo de Artículos Vendidos', 'COSTOS', 'DEBITORA', 'Costo de inventario entregado en créditos de artículo', true)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "type" = EXCLUDED."type",
  "nature" = EXCLUDED."nature",
  "description" = EXCLUDED."description",
  "isActive" = true;
