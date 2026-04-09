-- This migration aligns Prisma migration history with the existing database schema.
-- It adds the enum value used by the application for payment transfer receipts.

ALTER TYPE "TipoContenidoMultimedia" ADD VALUE IF NOT EXISTS 'COMPROBANTE_TRANSFERENCIA';
