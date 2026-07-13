-- CreateEnum
CREATE TYPE "GameSource" AS ENUM ('IGDB', 'RAWG');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('BACKLOG', 'PLAYING', 'COMPLETED', 'DROPPED');

-- CreateTable
CREATE TABLE "GameItem" (
    "id" TEXT NOT NULL,
    "canonicalSource" "GameSource" NOT NULL,
    "title" TEXT NOT NULL,
    "coverUrl" TEXT,
    "backdropUrl" TEXT,
    "overview" TEXT,
    "releaseDate" TIMESTAMP(3),
    "genres" TEXT[],
    "platforms" TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameExternalId" (
    "id" TEXT NOT NULL,
    "gameItemId" TEXT NOT NULL,
    "source" "GameSource" NOT NULL,
    "externalId" TEXT NOT NULL,

    CONSTRAINT "GameExternalId_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameItemId" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'BACKLOG',
    "rating" DOUBLE PRECISION,
    "notes" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameExternalId_gameItemId_idx" ON "GameExternalId"("gameItemId");

-- CreateIndex
CREATE UNIQUE INDEX "GameExternalId_source_externalId_key" ON "GameExternalId"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "GameEntry_userId_gameItemId_key" ON "GameEntry"("userId", "gameItemId");

-- AddForeignKey
ALTER TABLE "GameExternalId" ADD CONSTRAINT "GameExternalId_gameItemId_fkey" FOREIGN KEY ("gameItemId") REFERENCES "GameItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEntry" ADD CONSTRAINT "GameEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEntry" ADD CONSTRAINT "GameEntry_gameItemId_fkey" FOREIGN KEY ("gameItemId") REFERENCES "GameItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
