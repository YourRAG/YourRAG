/*
  Warnings:

  - A unique constraint covering the columns `[giteeId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "giteeId" TEXT,
ALTER COLUMN "githubId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_giteeId_key" ON "User"("giteeId");
