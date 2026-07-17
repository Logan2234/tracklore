-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM ('USER_REGISTERED', 'USER_DELETED', 'EMAIL_CHANGED', 'PASSWORD_CHANGED', 'PASSWORD_RESET', 'LOGIN_FAILED');

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

-- CreateIndex
CREATE INDEX "SecurityEvent_type_createdAt_idx" ON "SecurityEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_userId_idx" ON "SecurityEvent"("userId");

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
