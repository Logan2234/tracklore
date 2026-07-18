/*
  Warnings:

  - You are about to drop the `MusicReplay` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MusicReplay" DROP CONSTRAINT "MusicReplay_musicEntryId_fkey";

-- DropTable
DROP TABLE "MusicReplay";
