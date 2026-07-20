-- Generalise Notification: replace the episode-specific columns with a generic
-- shape (title/body/url/dedupeKey/data) so social kinds (FOLLOW, FOLLOW_REQUEST,
-- FOLLOW_ACCEPTED, …) can share the table. Existing NEW_EPISODE rows are
-- backfilled into the new columns before the old ones are dropped.

-- 1. Add the new columns (nullable/default first, so existing rows are valid).
ALTER TABLE "Notification" ADD COLUMN "title" TEXT;
ALTER TABLE "Notification" ADD COLUMN "body" TEXT;
ALTER TABLE "Notification" ADD COLUMN "url" TEXT;
ALTER TABLE "Notification" ADD COLUMN "dedupeKey" TEXT;
ALTER TABLE "Notification" ADD COLUMN "data" JSONB NOT NULL DEFAULT '{}';

-- 2. Backfill existing episode notifications into the generic columns.
UPDATE "Notification" SET
  "title" = "mediaTitle",
  "body" = 'S' || "seasonNumber" || 'E' || "episodeNumber"
    || CASE WHEN "episodeTitle" IS NOT NULL THEN ' · ' || "episodeTitle" ELSE '' END,
  "url" = '/media/' || lower("mediaType"::text) || '/' || "sourceId",
  "dedupeKey" = 'episode:' || "episodeId",
  "data" = jsonb_build_object('airDate', to_char("airDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));

-- 3. Enforce NOT NULL on title now that every row has one.
ALTER TABLE "Notification" ALTER COLUMN "title" SET NOT NULL;

-- 4. Drop the old unique (userId, episodeId) and the episode-specific columns.
DROP INDEX "Notification_userId_episodeId_key";
ALTER TABLE "Notification"
  DROP COLUMN "mediaTitle",
  DROP COLUMN "mediaType",
  DROP COLUMN "sourceId",
  DROP COLUMN "seasonNumber",
  DROP COLUMN "episodeNumber",
  DROP COLUMN "episodeTitle",
  DROP COLUMN "episodeId",
  DROP COLUMN "airDate";

-- 5. Add the new dedup uniqueness (NULL dedupeKey rows stay distinct in Postgres).
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");
