-- Architecture pivot (2026-07-26, see PRD.md §1.1): Mixing sensors change from
-- kadar air/rasio C:N to pH/kekeruhan air; pH moves out of Pre-Conditioning into
-- Mixing; new ActuatorCommand audit trail for AI-driven valve/fan control.
--
-- Existing MixingReading rows are simulated/dev data under the old sensor schema
-- and have no equivalent under the new one, so they are cleared before adding the
-- new required columns (local dev database only, not production data).
DELETE FROM "MixingReading";

-- AlterTable
ALTER TABLE "MixingReading"
  DROP COLUMN "kadarAir",
  DROP COLUMN "rasioCN",
  ADD COLUMN "pH" DOUBLE PRECISION NOT NULL,
  ADD COLUMN "kekeruhanAir" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "SensorReading" DROP COLUMN "ph";

-- CreateEnum
CREATE TYPE "ActuatorAction" AS ENUM ('OPEN', 'CLOSE', 'ON', 'OFF');

-- CreateEnum
CREATE TYPE "ActuatorTrigger" AS ENUM ('AI', 'MANUAL');

-- CreateTable
CREATE TABLE "ActuatorCommand" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stage" "PipelineStage" NOT NULL,
    "target" TEXT NOT NULL,
    "action" "ActuatorAction" NOT NULL,
    "level" DOUBLE PRECISION,
    "triggeredBy" "ActuatorTrigger" NOT NULL,
    "reasoning" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,

    CONSTRAINT "ActuatorCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActuatorCommand_batchId_timestamp_idx" ON "ActuatorCommand"("batchId", "timestamp");

-- AddForeignKey
ALTER TABLE "ActuatorCommand" ADD CONSTRAINT "ActuatorCommand_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
