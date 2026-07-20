-- CreateEnum
CREATE TYPE "ProfileAccess" AS ENUM ('PUBLIC', 'PRIVATE', 'GHOST');

-- CreateEnum
CREATE TYPE "VisibilityAudience" AS ENUM ('PUBLIC', 'FRIENDS', 'NONE');

-- CreateEnum
CREATE TYPE "VisibilityFacet" AS ENUM ('LIBRARY', 'ACTIVITY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "profileAccess" "ProfileAccess" NOT NULL DEFAULT 'PRIVATE';

-- CreateTable
CREATE TABLE "VisibilitySetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" "Domain" NOT NULL,
    "facet" "VisibilityFacet" NOT NULL,
    "audience" "VisibilityAudience" NOT NULL,

    CONSTRAINT "VisibilitySetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisibilitySetting_userId_domain_facet_key" ON "VisibilitySetting"("userId", "domain", "facet");

-- AddForeignKey
ALTER TABLE "VisibilitySetting" ADD CONSTRAINT "VisibilitySetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
