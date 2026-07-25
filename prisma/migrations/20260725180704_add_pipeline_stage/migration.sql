-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('MIXING', 'PRE_CONDITIONING', 'INCUBATION');

-- AlterTable
ALTER TABLE "Batch" ADD COLUMN     "stage" "PipelineStage" NOT NULL DEFAULT 'PRE_CONDITIONING';

-- CreateIndex
CREATE INDEX "Batch_stage_idx" ON "Batch"("stage");
