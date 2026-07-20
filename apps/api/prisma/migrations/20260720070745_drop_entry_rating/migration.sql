/*
  Warnings:

  - You are about to drop the column `rating` on the `BookEntry` table. All the data in the column will be lost.
  - You are about to drop the column `rating` on the `GameEntry` table. All the data in the column will be lost.
  - You are about to drop the column `rating` on the `LibraryEntry` table. All the data in the column will be lost.
  - You are about to drop the column `rating` on the `MusicEntry` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BookEntry" DROP COLUMN "rating";

-- AlterTable
ALTER TABLE "GameEntry" DROP COLUMN "rating";

-- AlterTable
ALTER TABLE "LibraryEntry" DROP COLUMN "rating";

-- AlterTable
ALTER TABLE "MusicEntry" DROP COLUMN "rating";
