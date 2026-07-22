-- CreateTable
CREATE TABLE "BackupFile" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackupFile_createdAt_idx" ON "BackupFile"("createdAt");
