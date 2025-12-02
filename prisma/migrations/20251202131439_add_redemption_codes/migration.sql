-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'DISABLED');

-- CreateTable
CREATE TABLE "RedemptionCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" INTEGER NOT NULL,
    "usedBy" INTEGER,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RedemptionCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RedemptionCode_code_key" ON "RedemptionCode"("code");

-- CreateIndex
CREATE INDEX "RedemptionCode_code_idx" ON "RedemptionCode"("code");

-- CreateIndex
CREATE INDEX "RedemptionCode_status_idx" ON "RedemptionCode"("status");

-- CreateIndex
CREATE INDEX "RedemptionCode_createdBy_idx" ON "RedemptionCode"("createdBy");

-- CreateIndex
CREATE INDEX "RedemptionCode_usedBy_idx" ON "RedemptionCode"("usedBy");

-- AddForeignKey
ALTER TABLE "RedemptionCode" ADD CONSTRAINT "RedemptionCode_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedemptionCode" ADD CONSTRAINT "RedemptionCode_usedBy_fkey" FOREIGN KEY ("usedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
