-- AlterTable
ALTER TABLE "User" ALTER COLUMN "enabledDomains" SET DEFAULT ARRAY['MEDIA', 'BOOKS', 'GAMES', 'MUSIC']::"Domain"[];

-- Backfill: existing users get MUSIC enabled too, matching the new default.
UPDATE "User" SET "enabledDomains" = array_append("enabledDomains", 'MUSIC') WHERE NOT ('MUSIC' = ANY("enabledDomains"));
