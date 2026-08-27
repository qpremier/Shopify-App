-- CreateTable
CREATE TABLE "OrderCreateWebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "apiVersion" TEXT,
    "orderId" TEXT NOT NULL,
    "orderName" TEXT,
    "orderCreatedAt" DATETIME,
    "customerId" TEXT,
    "customerEmail" TEXT,
    "totalPrice" TEXT,
    "currencyCode" TEXT,
    "payload" TEXT NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "OrderCreateWebhookEvent_shop_idx" ON "OrderCreateWebhookEvent"("shop");

-- CreateIndex
CREATE INDEX "OrderCreateWebhookEvent_orderId_idx" ON "OrderCreateWebhookEvent"("orderId");
