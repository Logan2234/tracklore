-- CreateTable
CREATE TABLE "ApiCallCounter" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ApiCallCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiCallCounter_provider_idx" ON "ApiCallCounter"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "ApiCallCounter_provider_day_key" ON "ApiCallCounter"("provider", "day");
