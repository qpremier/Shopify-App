-- CreateTable
CREATE TABLE "StoredOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME,
    "displayFinancialStatus" TEXT,
    "displayFulfillmentStatus" TEXT,
    "totalPrice" TEXT,
    "currencyCode" TEXT,
    "customerId" TEXT,
    "customerDisplayName" TEXT,
    "customerEmail" TEXT,
    "source" TEXT NOT NULL,
    "payload" TEXT,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "StoredOrder_shop_createdAt_idx" ON "StoredOrder"("shop", "createdAt");
