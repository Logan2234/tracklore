-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('MOVIE', 'SERIES', 'ANIME');

-- CreateEnum
CREATE TYPE "Domain" AS ENUM ('MEDIA', 'BOOKS', 'GAMES', 'MUSIC');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "CatalogSource" AS ENUM ('TMDB', 'ANILIST');

-- CreateEnum
CREATE TYPE "ExternalSource" AS ENUM ('TMDB', 'ANILIST', 'TVDB', 'IMDB');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('WATCHING', 'COMPLETED', 'PLANNED', 'DROPPED', 'UP_TO_DATE');

-- CreateEnum
CREATE TYPE "MediaOwnershipStatus" AS ENUM ('NONE', 'PHYSICAL', 'DIGITAL', 'STREAMING', 'BORROWED');

-- CreateEnum
CREATE TYPE "GameSource" AS ENUM ('IGDB');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('BACKLOG', 'PLAYING', 'COMPLETED', 'DROPPED');

-- CreateEnum
CREATE TYPE "GameOwnershipStatus" AS ENUM ('NONE', 'PHYSICAL', 'DIGITAL', 'SUBSCRIPTION', 'BORROWED');

-- CreateEnum
CREATE TYPE "BookSource" AS ENUM ('GOOGLE_BOOKS');

-- CreateEnum
CREATE TYPE "BookStatus" AS ENUM ('TO_READ', 'READING', 'READ', 'DROPPED');

-- CreateEnum
CREATE TYPE "BookOwnershipStatus" AS ENUM ('NONE', 'PHYSICAL', 'DIGITAL', 'AUDIO', 'BORROWED');

-- CreateEnum
CREATE TYPE "MusicSource" AS ENUM ('MUSICBRAINZ');

-- CreateEnum
CREATE TYPE "MusicStatus" AS ENUM ('TO_LISTEN', 'LISTENED');

-- CreateEnum
CREATE TYPE "MusicOwnershipStatus" AS ENUM ('NONE', 'PHYSICAL', 'DIGITAL', 'STREAMING', 'BORROWED');

-- CreateEnum
CREATE TYPE "UserTokenType" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');

-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM ('USER_REGISTERED', 'USER_DELETED', 'EMAIL_CHANGED', 'PASSWORD_CHANGED', 'PASSWORD_RESET', 'LOGIN_FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "allowAdultContent" BOOLEAN NOT NULL DEFAULT false,
    "notifyInApp" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT false,
    "notifyPush" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "entitlements" JSONB NOT NULL DEFAULT '[]',
    "role" "Role" NOT NULL DEFAULT 'USER',
    "enabledDomains" "Domain"[] DEFAULT ARRAY['MEDIA', 'BOOKS', 'GAMES', 'MUSIC']::"Domain"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'NEW_EPISODE',
    "mediaTitle" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "episodeTitle" TEXT,
    "episodeId" TEXT NOT NULL,
    "airDate" TIMESTAMP(3) NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "jobKey" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT,
    "error" TEXT,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "UserTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "type" "SecurityEventType" NOT NULL,
    "userId" TEXT,
    "identifier" TEXT NOT NULL,
    "detail" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailChangeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaItem" (
    "id" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "canonicalSource" "CatalogSource" NOT NULL,
    "title" TEXT NOT NULL,
    "posterUrl" TEXT,
    "backdropUrl" TEXT,
    "overview" TEXT,
    "releaseDate" TIMESTAMP(3),
    "status" TEXT,
    "genres" TEXT[],
    "runtimeMin" INTEGER,
    "isAdult" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaExternalId" (
    "id" TEXT NOT NULL,
    "mediaItemId" TEXT NOT NULL,
    "source" "ExternalSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,

    CONSTRAINT "MediaExternalId_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "mediaItemId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT,
    "airDate" TIMESTAMP(3),

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaItemId" TEXT NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'PLANNED',
    "rating" DOUBLE PRECISION,
    "notes" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "ownershipStatus" "MediaOwnershipStatus" NOT NULL DEFAULT 'NONE',
    "ownershipSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpisodeWatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "watchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpisodeWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameItem" (
    "id" TEXT NOT NULL,
    "canonicalSource" "GameSource" NOT NULL,
    "title" TEXT NOT NULL,
    "coverUrl" TEXT,
    "backdropUrl" TEXT,
    "overview" TEXT,
    "releaseDate" TIMESTAMP(3),
    "genres" TEXT[],
    "platforms" TEXT[],
    "isAdult" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameExternalId" (
    "id" TEXT NOT NULL,
    "gameItemId" TEXT NOT NULL,
    "source" "GameSource" NOT NULL,
    "externalId" TEXT NOT NULL,

    CONSTRAINT "GameExternalId_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameItemId" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'BACKLOG',
    "rating" DOUBLE PRECISION,
    "notes" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "playtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "ownershipStatus" "GameOwnershipStatus" NOT NULL DEFAULT 'NONE',
    "ownershipSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameReplay" (
    "id" TEXT NOT NULL,
    "gameEntryId" TEXT NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameReplay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookItem" (
    "id" TEXT NOT NULL,
    "canonicalSource" "BookSource" NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT[],
    "coverUrl" TEXT,
    "overview" TEXT,
    "releaseDate" TIMESTAMP(3),
    "genres" TEXT[],
    "pageCount" INTEGER,
    "isAdult" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookExternalId" (
    "id" TEXT NOT NULL,
    "bookItemId" TEXT NOT NULL,
    "source" "BookSource" NOT NULL,
    "externalId" TEXT NOT NULL,

    CONSTRAINT "BookExternalId_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookItemId" TEXT NOT NULL,
    "status" "BookStatus" NOT NULL DEFAULT 'TO_READ',
    "rating" DOUBLE PRECISION,
    "notes" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "currentPage" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "ownershipStatus" "BookOwnershipStatus" NOT NULL DEFAULT 'NONE',
    "ownershipSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookReplay" (
    "id" TEXT NOT NULL,
    "bookEntryId" TEXT NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookReplay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicItem" (
    "id" TEXT NOT NULL,
    "canonicalSource" "MusicSource" NOT NULL,
    "title" TEXT NOT NULL,
    "artists" TEXT[],
    "coverUrl" TEXT,
    "releaseDate" TIMESTAMP(3),
    "genres" TEXT[],
    "albumType" TEXT,
    "trackCount" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicExternalId" (
    "id" TEXT NOT NULL,
    "musicItemId" TEXT NOT NULL,
    "source" "MusicSource" NOT NULL,
    "externalId" TEXT NOT NULL,

    CONSTRAINT "MusicExternalId_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "musicItemId" TEXT NOT NULL,
    "status" "MusicStatus" NOT NULL DEFAULT 'TO_LISTEN',
    "rating" DOUBLE PRECISION,
    "notes" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "ownershipStatus" "MusicOwnershipStatus" NOT NULL DEFAULT 'NONE',
    "ownershipSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_episodeId_key" ON "Notification"("userId", "episodeId");

-- CreateIndex
CREATE INDEX "JobRun_jobKey_startedAt_idx" ON "JobRun"("jobKey", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_jti_key" ON "RefreshToken"("jti");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserToken_tokenHash_key" ON "UserToken"("tokenHash");

-- CreateIndex
CREATE INDEX "UserToken_userId_type_idx" ON "UserToken"("userId", "type");

-- CreateIndex
CREATE INDEX "SecurityEvent_type_createdAt_idx" ON "SecurityEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_userId_idx" ON "SecurityEvent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailChangeRequest_codeHash_key" ON "EmailChangeRequest"("codeHash");

-- CreateIndex
CREATE INDEX "EmailChangeRequest_userId_idx" ON "EmailChangeRequest"("userId");

-- CreateIndex
CREATE INDEX "MediaExternalId_mediaItemId_idx" ON "MediaExternalId"("mediaItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaExternalId_source_externalId_type_key" ON "MediaExternalId"("source", "externalId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Season_mediaItemId_number_key" ON "Season"("mediaItemId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_seasonId_number_key" ON "Episode"("seasonId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryEntry_userId_mediaItemId_key" ON "LibraryEntry"("userId", "mediaItemId");

-- CreateIndex
CREATE INDEX "EpisodeWatch_userId_episodeId_idx" ON "EpisodeWatch"("userId", "episodeId");

-- CreateIndex
CREATE INDEX "GameExternalId_gameItemId_idx" ON "GameExternalId"("gameItemId");

-- CreateIndex
CREATE UNIQUE INDEX "GameExternalId_source_externalId_key" ON "GameExternalId"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "GameEntry_userId_gameItemId_key" ON "GameEntry"("userId", "gameItemId");

-- CreateIndex
CREATE INDEX "GameReplay_gameEntryId_idx" ON "GameReplay"("gameEntryId");

-- CreateIndex
CREATE INDEX "BookExternalId_bookItemId_idx" ON "BookExternalId"("bookItemId");

-- CreateIndex
CREATE UNIQUE INDEX "BookExternalId_source_externalId_key" ON "BookExternalId"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "BookEntry_userId_bookItemId_key" ON "BookEntry"("userId", "bookItemId");

-- CreateIndex
CREATE INDEX "BookReplay_bookEntryId_idx" ON "BookReplay"("bookEntryId");

-- CreateIndex
CREATE INDEX "MusicExternalId_musicItemId_idx" ON "MusicExternalId"("musicItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MusicExternalId_source_externalId_key" ON "MusicExternalId"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "MusicEntry_userId_musicItemId_key" ON "MusicEntry"("userId", "musicItemId");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserToken" ADD CONSTRAINT "UserToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailChangeRequest" ADD CONSTRAINT "EmailChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaExternalId" ADD CONSTRAINT "MediaExternalId_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryEntry" ADD CONSTRAINT "LibraryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryEntry" ADD CONSTRAINT "LibraryEntry_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeWatch" ADD CONSTRAINT "EpisodeWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeWatch" ADD CONSTRAINT "EpisodeWatch_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameExternalId" ADD CONSTRAINT "GameExternalId_gameItemId_fkey" FOREIGN KEY ("gameItemId") REFERENCES "GameItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEntry" ADD CONSTRAINT "GameEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEntry" ADD CONSTRAINT "GameEntry_gameItemId_fkey" FOREIGN KEY ("gameItemId") REFERENCES "GameItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameReplay" ADD CONSTRAINT "GameReplay_gameEntryId_fkey" FOREIGN KEY ("gameEntryId") REFERENCES "GameEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookExternalId" ADD CONSTRAINT "BookExternalId_bookItemId_fkey" FOREIGN KEY ("bookItemId") REFERENCES "BookItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookEntry" ADD CONSTRAINT "BookEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookEntry" ADD CONSTRAINT "BookEntry_bookItemId_fkey" FOREIGN KEY ("bookItemId") REFERENCES "BookItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookReplay" ADD CONSTRAINT "BookReplay_bookEntryId_fkey" FOREIGN KEY ("bookEntryId") REFERENCES "BookEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicExternalId" ADD CONSTRAINT "MusicExternalId_musicItemId_fkey" FOREIGN KEY ("musicItemId") REFERENCES "MusicItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicEntry" ADD CONSTRAINT "MusicEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicEntry" ADD CONSTRAINT "MusicEntry_musicItemId_fkey" FOREIGN KEY ("musicItemId") REFERENCES "MusicItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
