-- Add foreign key constraints to existing registros_visitas table
DO $$
BEGIN
    -- Add foreign key for clienteId
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'registros_visitas_clienteId_fkey'
    ) THEN
        ALTER TABLE "registros_visitas" 
        ADD CONSTRAINT "registros_visitas_clienteId_fkey" 
        FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") 
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    -- Add foreign key for cobradorId
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'registros_visitas_cobradorId_fkey'
    ) THEN
        ALTER TABLE "registros_visitas" 
        ADD CONSTRAINT "registros_visitas_cobradorId_fkey" 
        FOREIGN KEY ("cobradorId") REFERENCES "Usuario"("id") 
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    -- Add foreign key for rutaId
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

-- Add unique constraint for rutaId, clienteId, fechaVisita
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'registros_visitas_rutaId_clienteId_fechaVisita_key'
    ) THEN
        ALTER TABLE "registros_visitas" 
        ADD CONSTRAINT "registros_visitas_rutaId_clienteId_fechaVisita_key" 
        UNIQUE ("rutaId", "clienteId", "fechaVisita");
    END IF;
END $$;

-- Add index for rutaId, fechaVisita
CREATE INDEX IF NOT EXISTS "registros_visitas_rutaId_fechaVisita_idx" 
ON "registros_visitas"("rutaId", "fechaVisita");
