-- Merge PasswordResetToken and EmailVerificationToken into a single UserToken
-- table (identical shape: userId + hashed token + expiry) discriminated by
-- `type`, so a new one-time-link kind never needs its own near-duplicate table.
CREATE TYPE "UserTokenType" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');

CREATE TABLE "UserToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "UserTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserToken_tokenHash_key" ON "UserToken"("tokenHash");

CREATE INDEX "UserToken_userId_type_idx" ON "UserToken"("userId", "type");

ALTER TABLE "UserToken" ADD CONSTRAINT "UserToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "UserToken" ("id", "userId", "type", "tokenHash", "expiresAt", "createdAt")
SELECT "id", "userId", 'PASSWORD_RESET', "tokenHash", "expiresAt", "createdAt" FROM "PasswordResetToken";

INSERT INTO "UserToken" ("id", "userId", "type", "tokenHash", "expiresAt", "createdAt")
SELECT "id", "userId", 'EMAIL_VERIFICATION', "tokenHash", "expiresAt", "createdAt" FROM "EmailVerificationToken";

DROP TABLE "PasswordResetToken";

DROP TABLE "EmailVerificationToken";
