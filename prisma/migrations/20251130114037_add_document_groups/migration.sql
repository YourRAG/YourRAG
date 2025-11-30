-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "groupId" INTEGER;

-- CreateTable
CREATE TABLE "DocumentGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentGroup_userId_idx" ON "DocumentGroup"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentGroup_userId_name_key" ON "DocumentGroup"("userId", "name");

-- CreateIndex
CREATE INDEX "Document_groupId_idx" ON "Document"("groupId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "DocumentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentGroup" ADD CONSTRAINT "DocumentGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
