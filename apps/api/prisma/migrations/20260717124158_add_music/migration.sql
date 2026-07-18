-- CreateEnum
CREATE TYPE "MusicSource" AS ENUM ('MUSICBRAINZ');

-- CreateEnum
CREATE TYPE "MusicStatus" AS ENUM ('TO_LISTEN', 'LISTENED');

-- CreateEnum
CREATE TYPE "MusicOwnershipStatus" AS ENUM ('NONE', 'PHYSICAL', 'DIGITAL', 'STREAMING', 'BORROWED');

-- CreateTable
CREATE TABLE "MusicItem" (
    "id" TEXT NOT NULL,
    "canonicalSource" "MusicSource" NOT NULL,
    "title" TEXT NOT NULL,
    "artists" TEXT[],
    "coverUrl" TEXT,
    "releaseDate" TIMESTAMP(3),
    "genres" TEXT[],
    "albumType" TEXT,
    "trackCount" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicExternalId" (
    "id" TEXT NOT NULL,
    "musicItemId" TEXT NOT NULL,
    "source" "MusicSource" NOT NULL,
    "externalId" TEXT NOT NULL,

    CONSTRAINT "MusicExternalId_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "musicItemId" TEXT NOT NULL,
    "status" "MusicStatus" NOT NULL DEFAULT 'TO_LISTEN',
    "rating" DOUBLE PRECISION,
    "notes" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "ownershipStatus" "MusicOwnershipStatus" NOT NULL DEFAULT 'NONE',
    "ownershipSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicReplay" (
    "id" TEXT NOT NULL,
    "musicEntryId" TEXT NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MusicReplay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MusicExternalId_musicItemId_idx" ON "MusicExternalId"("musicItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MusicExternalId_source_externalId_key" ON "MusicExternalId"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "MusicEntry_userId_musicItemId_key" ON "MusicEntry"("userId", "musicItemId");

-- CreateIndex
CREATE INDEX "MusicReplay_musicEntryId_idx" ON "MusicReplay"("musicEntryId");

-- AddForeignKey
ALTER TABLE "MusicExternalId" ADD CONSTRAINT "MusicExternalId_musicItemId_fkey" FOREIGN KEY ("musicItemId") REFERENCES "MusicItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicEntry" ADD CONSTRAINT "MusicEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicEntry" ADD CONSTRAINT "MusicEntry_musicItemId_fkey" FOREIGN KEY ("musicItemId") REFERENCES "MusicItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicReplay" ADD CONSTRAINT "MusicReplay_musicEntryId_fkey" FOREIGN KEY ("musicEntryId") REFERENCES "MusicEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
