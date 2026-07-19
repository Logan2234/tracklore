-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "identifier" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "overwrite" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportRun_sourceId_startedAt_idx" ON "ImportRun"("sourceId", "startedAt");

-- CreateIndex
CREATE INDEX "ImportRun_userId_idx" ON "ImportRun"("userId");

-- AddForeignKey
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
