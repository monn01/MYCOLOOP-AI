-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE 'CONTAMINATION';

-- CreateTable
CREATE TABLE "MixingReading" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kadarAir" DOUBLE PRECISION NOT NULL,
    "rasioCN" DOUBLE PRECISION NOT NULL,
    "beratKg" DOUBLE PRECISION NOT NULL,
    "batchId" TEXT NOT NULL,

    CONSTRAINT "MixingReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncubationReading" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suhu" DOUBLE PRECISION NOT NULL,
    "kelembapan" DOUBLE PRECISION NOT NULL,
    "co2" DOUBLE PRECISION NOT NULL,
    "cahaya" DOUBLE PRECISION NOT NULL,
    "batchId" TEXT NOT NULL,

    CONSTRAINT "IncubationReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MixingReading_batchId_timestamp_idx" ON "MixingReading"("batchId", "timestamp");

-- CreateIndex
CREATE INDEX "IncubationReading_batchId_timestamp_idx" ON "IncubationReading"("batchId", "timestamp");

-- AddForeignKey
ALTER TABLE "MixingReading" ADD CONSTRAINT "MixingReading_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncubationReading" ADD CONSTRAINT "IncubationReading_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
