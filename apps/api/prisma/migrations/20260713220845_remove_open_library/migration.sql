-- AlterEnum
BEGIN;
CREATE TYPE "BookSource_new" AS ENUM ('GOOGLE_BOOKS');
ALTER TABLE "BookItem" ALTER COLUMN "canonicalSource" TYPE "BookSource_new" USING ("canonicalSource"::text::"BookSource_new");
ALTER TABLE "BookExternalId" ALTER COLUMN "source" TYPE "BookSource_new" USING ("source"::text::"BookSource_new");
ALTER TYPE "BookSource" RENAME TO "BookSource_old";
ALTER TYPE "BookSource_new" RENAME TO "BookSource";
DROP TYPE "BookSource_old";
COMMIT;

