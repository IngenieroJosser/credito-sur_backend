-- Create registros_visitas table
CREATE TABLE IF NOT EXISTS "registros_visitas" (
    "id" TEXT NOT NULL,
    "rutaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "prestamoId" TEXT,
    "cobradorId" TEXT NOT NULL,
    "fechaVisita" VARCHAR(10) NOT NULL,
    "estadoVisita" VARCHAR(50) NOT NULL,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_visitas_pkey" PRIMARY KEY ("id")
);

-- Create foreign key constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'registros_visitas_clienteId_fkey'
    ) THEN
        ALTER TABLE "registros_visitas" 
        ADD CONSTRAINT "registros_visitas_clienteId_fkey" 
        FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") 
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'registros_visitas_cobradorId_fkey'
    ) THEN
        ALTER TABLE "registros_visitas" 
        ADD CONSTRAINT "registros_visitas_cobradorId_fkey" 
        FOREIGN KEY ("cobradorId") REFERENCES "Usuario"("id") 
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'registros_visitas_rutaId_fkey'
    ) THEN
        ALTER TABLE "registros_visitas" 
        ADD CONSTRAINT "registros_visitas_rutaId_fkey" 
        FOREIGN KEY ("rutaId") REFERENCES "rutas"("id") 
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- Create unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "registros_visitas_rutaId_clienteId_fechaVisita_key" ON "registros_visitas"("rutaId", "clienteId", "fechaVisita");

-- Create index
CREATE INDEX IF NOT EXISTS "registros_visitas_rutaId_fechaVisita_idx" ON "registros_visitas"("rutaId", "fechaVisita");
