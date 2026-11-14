-- Cuantas unidades del articulo se financiaron en un prestamo.
--
-- Por que hacia falta: el monto ya se cobraba por N unidades —el formulario de
-- credito de articulo suma `precio x cantidad`, con sus botones de + y −— pero
-- del inventario salia UNA sola, porque el descuento estaba escrito
-- `stock: { decrement: 1 }` en siete sitios. Una venta de tres telefonos
-- cobraba tres y descontaba uno, y el descuadre no quedaba escrito en ninguna
-- parte: no hay tabla de movimientos de inventario, `Producto.stock` es un
-- entero suelto.
--
-- Tampoco se podia arreglar solo en el momento del descuento: la reversion
-- —cuando se rechaza o se anula un prestamo de articulo— devuelve el stock mas
-- tarde, desde `approvals.service.ts`, y sin este campo no tenia forma de saber
-- cuantas unidades devolver.
--
-- El DEFAULT 1 es el comportamiento de siempre, asi que las filas que ya
-- existen quedan correctas sin rellenar nada y sin suponer nada sobre ellas.
-- NOT NULL es seguro por eso mismo.

ALTER TABLE "Prestamo"
  ADD COLUMN IF NOT EXISTS "cantidadProducto" INTEGER NOT NULL DEFAULT 1;
