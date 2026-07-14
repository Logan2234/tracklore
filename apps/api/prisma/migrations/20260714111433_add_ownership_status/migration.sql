-- CreateEnum
CREATE TYPE "MediaOwnershipStatus" AS ENUM ('NONE', 'PHYSICAL', 'DIGITAL', 'STREAMING', 'BORROWED');

-- CreateEnum
CREATE TYPE "GameOwnershipStatus" AS ENUM ('NONE', 'PHYSICAL', 'DIGITAL', 'SUBSCRIPTION', 'BORROWED');

-- CreateEnum
CREATE TYPE "BookOwnershipStatus" AS ENUM ('NONE', 'PHYSICAL', 'DIGITAL', 'AUDIO', 'BORROWED');

-- AlterTable
ALTER TABLE "BookEntry" ADD COLUMN     "ownershipSource" TEXT,
ADD COLUMN     "ownershipStatus" "BookOwnershipStatus" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "GameEntry" ADD COLUMN     "ownershipSource" TEXT,
ADD COLUMN     "ownershipStatus" "GameOwnershipStatus" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "LibraryEntry" ADD COLUMN     "ownershipSource" TEXT,
ADD COLUMN     "ownershipStatus" "MediaOwnershipStatus" NOT NULL DEFAULT 'NONE';

