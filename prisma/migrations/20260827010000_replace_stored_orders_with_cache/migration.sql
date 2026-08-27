-- CreateTable
CREATE TABLE "WebhookReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "apiVersion" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CachedOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME,
    "financialStatus" TEXT,
    "fulfillmentStatus" TEXT,
    "totalPrice" TEXT,
    "currencyCode" TEXT,
    "customerDisplayName" TEXT,
    "customerEmail" TEXT,
    "cachedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Preserve lightweight webhook receipts from the previous event table.
INSERT INTO "WebhookReceipt" ("id", "shop", "topic", "apiVersion", "receivedAt")
SELECT "id", "shop", "topic", "apiVersion", "processedAt"
FROM "OrderCreateWebhookEvent";

-- Preserve existing local order previews, without copying raw payloads.
INSERT INTO "CachedOrder" (
    "id",
    "shop",
    "shopifyOrderId",
    "name",
    "createdAt",
    "financialStatus",
    "fulfillmentStatus",
    "totalPrice",
    "currencyCode",
    "customerDisplayName",
    "customerEmail",
    "cachedAt",
    "updatedAt"
)
SELECT
    "id",
    "shop",
    "id",
    "name",
    "createdAt",
    "displayFinancialStatus",
    "displayFulfillmentStatus",
    "totalPrice",
    "currencyCode",
    "customerDisplayName",
    "customerEmail",
    "firstSeenAt",
    "updatedAt"
FROM "StoredOrder";

-- Drop heavier previous tables after preserving useful preview metadata.
DROP TABLE "OrderCreateWebhookEvent";
DROP TABLE "StoredOrder";

-- CreateIndex
CREATE INDEX "WebhookReceipt_shop_topic_idx" ON "WebhookReceipt"("shop", "topic");

-- CreateIndex
CREATE INDEX "CachedOrder_shop_createdAt_idx" ON "CachedOrder"("shop", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CachedOrder_shop_shopifyOrderId_key" ON "CachedOrder"("shop", "shopifyOrderId");
