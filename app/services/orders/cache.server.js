import db from "../../db.server";

const DEFAULT_ORDER_CACHE_SIZE = 50;

function assertCacheableOrder(order) {
  if (!order?.id) {
    throw new Error("Order cache requires a Shopify order id.");
  }
}

function moneyFromOrder(order) {
  return order?.totalPriceSet?.shopMoney || {};
}

function toCachedOrderData(order) {
  const money = moneyFromOrder(order);

  return {
    shopifyOrderId: order.id,
    name: order.name || null,
    createdAt: order.createdAt ? new Date(order.createdAt) : null,
    financialStatus: order.displayFinancialStatus || order.financialStatus || null,
    fulfillmentStatus:
      order.displayFulfillmentStatus || order.fulfillmentStatus || null,
    totalPrice: money.amount || null,
    currencyCode: money.currencyCode || null,
    customerDisplayName: order.customer?.displayName || null,
    customerEmail: order.customer?.email || null,
  };
}

function cachedOrderToOrderPreview(order) {
  return {
    id: order.shopifyOrderId,
    name: order.name,
    createdAt: order.createdAt?.toISOString() || null,
    displayFinancialStatus: order.financialStatus,
    displayFulfillmentStatus: order.fulfillmentStatus,
    totalPriceSet: {
      shopMoney: {
        amount: order.totalPrice,
        currencyCode: order.currencyCode,
      },
    },
    customer: {
      displayName: order.customerDisplayName,
      email: order.customerEmail,
    },
  };
}

export async function upsertCachedOrder(shop, orderPreview) {
  assertCacheableOrder(orderPreview);

  const data = toCachedOrderData(orderPreview);

  const order = await db.cachedOrder.upsert({
    where: {
      shop_shopifyOrderId: {
        shop,
        shopifyOrderId: data.shopifyOrderId,
      },
    },
    create: {
      ...data,
      shop,
    },
    update: {
      ...data,
      cachedAt: new Date(),
    },
  });

  await pruneCachedOrders(shop, { keep: DEFAULT_ORDER_CACHE_SIZE });

  return order;
}

export async function upsertCachedOrders(shop, orders) {
  await Promise.all(orders.map((order) => upsertCachedOrder(shop, order)));
}

export async function getCachedOrders(shop, { first = 5 } = {}) {
  const orders = await db.cachedOrder.findMany({
    where: {
      shop,
    },
    orderBy: [
      {
        createdAt: "desc",
      },
      {
        cachedAt: "desc",
      },
    ],
    take: first,
  });

  return orders.map(cachedOrderToOrderPreview);
}

export async function pruneCachedOrders(
  shop,
  { keep = DEFAULT_ORDER_CACHE_SIZE } = {},
) {
  const staleOrders = await db.cachedOrder.findMany({
    where: {
      shop,
    },
    orderBy: [
      {
        createdAt: "desc",
      },
      {
        cachedAt: "desc",
      },
    ],
    skip: keep,
    select: {
      id: true,
    },
  });

  if (staleOrders.length === 0) {
    return { count: 0 };
  }

  return db.cachedOrder.deleteMany({
    where: {
      id: {
        in: staleOrders.map((order) => order.id),
      },
    },
  });
}
