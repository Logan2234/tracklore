-- AlterEnum
BEGIN;
CREATE TYPE "GameSource_new" AS ENUM ('IGDB');
ALTER TABLE "GameItem" ALTER COLUMN "canonicalSource" TYPE "GameSource_new" USING ("canonicalSource"::text::"GameSource_new");
ALTER TABLE "GameExternalId" ALTER COLUMN "source" TYPE "GameSource_new" USING ("source"::text::"GameSource_new");
ALTER TYPE "GameSource" RENAME TO "GameSource_old";
ALTER TYPE "GameSource_new" RENAME TO "GameSource";
DROP TYPE "public"."GameSource_old";
COMMIT;
