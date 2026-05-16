CREATE TABLE IF NOT EXISTS "outbox_events" (
  "id" TEXT NOT NULL,
  "eventType" VARCHAR(100) NOT NULL,
  "aggregateType" VARCHAR(100) NOT NULL,
  "aggregateId" VARCHAR(100),
  "payload" JSONB NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "outbox_events_status_createdAt_idx"
  ON "outbox_events"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "outbox_events_aggregateType_aggregateId_idx"
  ON "outbox_events"("aggregateType", "aggregateId");
