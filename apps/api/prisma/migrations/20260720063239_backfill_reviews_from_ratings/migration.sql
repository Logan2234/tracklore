-- Backfill: move existing per-entry /10 ratings into Review (the new single
-- source of truth). One review per (user, work); default audience FRIENDS
-- (nothing is exposed while SOCIAL_ENABLED is off). Idempotent via ON CONFLICT.
-- The entry `rating` columns are dropped in a later migration once every reader
-- has been switched over to Review.

INSERT INTO "Review" (id, "userId", "targetType", "targetId", rating, visibility, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "userId", 'MEDIA'::"ReviewTargetType", "mediaItemId", rating, 'FRIENDS'::"ReviewVisibility", now(), now()
FROM "LibraryEntry" WHERE rating IS NOT NULL
ON CONFLICT ("userId", "targetType", "targetId") DO NOTHING;

INSERT INTO "Review" (id, "userId", "targetType", "targetId", rating, visibility, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "userId", 'GAME'::"ReviewTargetType", "gameItemId", rating, 'FRIENDS'::"ReviewVisibility", now(), now()
FROM "GameEntry" WHERE rating IS NOT NULL
ON CONFLICT ("userId", "targetType", "targetId") DO NOTHING;

INSERT INTO "Review" (id, "userId", "targetType", "targetId", rating, visibility, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "userId", 'BOOK'::"ReviewTargetType", "bookItemId", rating, 'FRIENDS'::"ReviewVisibility", now(), now()
FROM "BookEntry" WHERE rating IS NOT NULL
ON CONFLICT ("userId", "targetType", "targetId") DO NOTHING;

INSERT INTO "Review" (id, "userId", "targetType", "targetId", rating, visibility, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "userId", 'MUSIC'::"ReviewTargetType", "musicItemId", rating, 'FRIENDS'::"ReviewVisibility", now(), now()
FROM "MusicEntry" WHERE rating IS NOT NULL
ON CONFLICT ("userId", "targetType", "targetId") DO NOTHING;

-- Seed an initial revision (V1) for every review that has none yet.
INSERT INTO "ReviewRevision" (id, "reviewId", rating, "createdAt")
SELECT gen_random_uuid()::text, r.id, r.rating, r."createdAt"
FROM "Review" r
WHERE NOT EXISTS (SELECT 1 FROM "ReviewRevision" rr WHERE rr."reviewId" = r.id);
