-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "extra" JSONB;

-- CreateTable
CREATE TABLE "SecurityFlag" (
    "id" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "shiftId" TEXT,
    "checkinId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityFlag_guardId_createdAt_idx" ON "SecurityFlag"("guardId", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityFlag_shiftId_idx" ON "SecurityFlag"("shiftId");

-- CreateIndex
CREATE INDEX "SecurityFlag_createdAt_idx" ON "SecurityFlag"("createdAt");

-- CreateIndex
CREATE INDEX "SecurityFlag_severity_idx" ON "SecurityFlag"("severity");

-- AddForeignKey
ALTER TABLE "SecurityFlag" ADD CONSTRAINT "SecurityFlag_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityFlag" ADD CONSTRAINT "SecurityFlag_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
