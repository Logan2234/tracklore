-- Disambiguate TMDB's separate movie/series numeric ID spaces: a movie and a
-- series can share the same externalId, so the unique constraint must also
-- carry the media's type. Nullable add + backfill + NOT NULL, since existing
-- rows have no value yet.
ALTER TABLE "MediaExternalId" ADD COLUMN "type" "MediaType";

UPDATE "MediaExternalId"
SET "type" = "MediaItem"."type"
FROM "MediaItem"
WHERE "MediaExternalId"."mediaItemId" = "MediaItem"."id";

ALTER TABLE "MediaExternalId" ALTER COLUMN "type" SET NOT NULL;

DROP INDEX "MediaExternalId_source_externalId_key";

CREATE UNIQUE INDEX "MediaExternalId_source_externalId_type_key" ON "MediaExternalId"("source", "externalId", "type");
