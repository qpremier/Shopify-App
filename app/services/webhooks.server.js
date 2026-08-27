// Small database helpers used by webhook route handlers.
import db from "../db.server";
import { pruneCachedOrders } from "./orders.server";

const ORDER_CACHE_SIZE = 50;

// Deletes every stored session for a shop after the app is uninstalled.
export async function deleteShopSessions(shop) {
  return db.session.deleteMany({ where: { shop } });
}

// Keeps the stored session scopes in sync when Shopify reports a scope change.
export async function updateSessionScopes(sessionId, scopes) {
  return db.session.update({
    where: {
      id: sessionId,
    },
    data: {
      scope: scopes.toString(),
    },
  });
}

export function extractOrderWebhookPayload(payload) {
  const totalPriceSet = payload.total_price_set?.shop_money;
  const firstName = payload.customer?.first_name || "";
  const lastName = payload.customer?.last_name || "";
  const customerDisplayName = `${firstName} ${lastName}`.trim() || null;

  return {
    id: payload.admin_graphql_api_id || String(payload.id || ""),
    name: payload.name || null,
    createdAt: payload.created_at || null,
    displayFinancialStatus: payload.financial_status || null,
    displayFulfillmentStatus: payload.fulfillment_status || null,
    totalPriceSet: {
      shopMoney: {
        amount: totalPriceSet?.amount || payload.total_price || null,
        currencyCode: totalPriceSet?.currency_code || payload.currency || null,
      },
    },
    customer: {
      displayName: customerDisplayName,
      email: payload.customer?.email || payload.email || null,
    },
  };
}

export async function shopHasSession(shop) {
  const session = await db.session.findFirst({
    where: {
      shop,
    },
    select: {
      id: true,
    },
  });

  return Boolean(session);
}

export async function recordOrderCreateWebhook({
  webhookId,
  shop,
  topic,
  apiVersion,
  payload,
}) {
  const order = extractOrderWebhookPayload(payload);
  const money = order.totalPriceSet.shopMoney;

  if (!order.id) {
    throw new Error("orders/create webhook payload did not include an order id.");
  }

  await db.$transaction([
    db.webhookReceipt.create({
      data: {
        id: webhookId,
        shop,
        topic,
        apiVersion,
      },
    }),
    db.cachedOrder.upsert({
      where: {
        shop_shopifyOrderId: {
          shop,
          shopifyOrderId: order.id,
        },
      },
      create: {
        shop,
        shopifyOrderId: order.id,
        name: order.name,
        createdAt: order.createdAt ? new Date(order.createdAt) : null,
        financialStatus: order.displayFinancialStatus,
        fulfillmentStatus: order.displayFulfillmentStatus,
        totalPrice: money.amount,
        currencyCode: money.currencyCode,
        customerDisplayName: order.customer.displayName,
        customerEmail: order.customer.email,
      },
      update: {
        name: order.name,
        createdAt: order.createdAt ? new Date(order.createdAt) : null,
        financialStatus: order.displayFinancialStatus,
        fulfillmentStatus: order.displayFulfillmentStatus,
        totalPrice: money.amount,
        currencyCode: money.currencyCode,
        customerDisplayName: order.customer.displayName,
        customerEmail: order.customer.email,
        cachedAt: new Date(),
      },
    }),
  ]);

  return pruneCachedOrders(shop, { keep: ORDER_CACHE_SIZE });
}
