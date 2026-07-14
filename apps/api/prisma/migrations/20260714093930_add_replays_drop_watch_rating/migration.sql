-- AlterTable
ALTER TABLE "EpisodeWatch" DROP COLUMN "rating";

-- CreateTable
CREATE TABLE "GameReplay" (
    "id" TEXT NOT NULL,
    "gameEntryId" TEXT NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameReplay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookReplay" (
    "id" TEXT NOT NULL,
    "bookEntryId" TEXT NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookReplay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameReplay_gameEntryId_idx" ON "GameReplay"("gameEntryId");

-- CreateIndex
CREATE INDEX "BookReplay_bookEntryId_idx" ON "BookReplay"("bookEntryId");

-- AddForeignKey
ALTER TABLE "GameReplay" ADD CONSTRAINT "GameReplay_gameEntryId_fkey" FOREIGN KEY ("gameEntryId") REFERENCES "GameEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookReplay" ADD CONSTRAINT "BookReplay_bookEntryId_fkey" FOREIGN KEY ("bookEntryId") REFERENCES "BookEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

