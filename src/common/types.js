"use strict";
/**
 * ============================================================
 * TIPOS COMPARTIDOS — Filtros de consultas Prisma
 * ============================================================
 *
 * Reemplaza el uso de `where: any` y `as any` en los servicios
 * de pagos, préstamos y actualización de datos.
 *
 * Al usar Prisma.XxxWhereInput TypeScript verifica en compilación
 * que los campos existan en el schema — evita bugs como el que
 * puso cuotas de otros clientes en 0.
 */
Object.defineProperty(exports, "__esModule", { value: true });
