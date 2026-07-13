-- CreateEnum
CREATE TYPE "BookSource" AS ENUM ('OPENLIBRARY', 'GOOGLE_BOOKS');

-- CreateEnum
CREATE TYPE "BookStatus" AS ENUM ('TO_READ', 'READING', 'READ', 'DROPPED');

-- CreateTable
CREATE TABLE "BookItem" (
    "id" TEXT NOT NULL,
    "canonicalSource" "BookSource" NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT[],
    "coverUrl" TEXT,
    "overview" TEXT,
    "releaseDate" TIMESTAMP(3),
    "genres" TEXT[],
    "pageCount" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookExternalId" (
    "id" TEXT NOT NULL,
    "bookItemId" TEXT NOT NULL,
    "source" "BookSource" NOT NULL,
    "externalId" TEXT NOT NULL,

    CONSTRAINT "BookExternalId_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookItemId" TEXT NOT NULL,
    "status" "BookStatus" NOT NULL DEFAULT 'TO_READ',
    "rating" DOUBLE PRECISION,
    "notes" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "currentPage" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookExternalId_bookItemId_idx" ON "BookExternalId"("bookItemId");

-- CreateIndex
CREATE UNIQUE INDEX "BookExternalId_source_externalId_key" ON "BookExternalId"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "BookEntry_userId_bookItemId_key" ON "BookEntry"("userId", "bookItemId");

-- AddForeignKey
ALTER TABLE "BookExternalId" ADD CONSTRAINT "BookExternalId_bookItemId_fkey" FOREIGN KEY ("bookItemId") REFERENCES "BookItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookEntry" ADD CONSTRAINT "BookEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookEntry" ADD CONSTRAINT "BookEntry_bookItemId_fkey" FOREIGN KEY ("bookItemId") REFERENCES "BookItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
