// Purpose of this file is to fetch order previews and create orders through the Shopify Admin API.
import db from "../db.server";
import { runAdminGraphql } from "./admin-graphql.server";

const GET_ORDERS_QUERY = `#graphql
  query GetOrders($first: Int!) {
    orders(first: $first, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        name
        createdAt
        displayFinancialStatus
        displayFulfillmentStatus
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        customer {
          displayName
          email
        }
      }
    }
  }
`;

const CREATE_ORDER_MUTATION = `#graphql
  mutation CreateOrder($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
    orderCreate(order: $order, options: $options) {
      userErrors {
        field
        message
      }
      order {
        id
        name
        createdAt
        displayFinancialStatus
        displayFulfillmentStatus
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        customer {
          id
          displayName
          email
        }
        lineItems(first: 50) {
          nodes {
            id
            title
            quantity
            variant {
              id
            }
          }
        }
      }
    }
  }
`;

const SHOPIFY_GID_PATTERN = /^gid:\/\/shopify\/[A-Za-z]+\/\d+$/;
const CUSTOMER_GID_PATTERN = /^gid:\/\/shopify\/Customer\/\d+$/;
const PRODUCT_VARIANT_GID_PATTERN = /^gid:\/\/shopify\/ProductVariant\/\d+$/;
const DEFAULT_ORDER_CACHE_SIZE = 50;
const ALLOWED_ORDER_FIELDS = [
  "billingAddress",
  "buyerAcceptsMarketing",
  "currency",
  "customAttributes",
  "email",
  "financialStatus",
  "fulfillmentStatus",
  "note",
  "phone",
  "poNumber",
  "presentmentCurrency",
  "processedAt",
  "referringSite",
  "shippingAddress",
  "shippingLines",
  "sourceIdentifier",
  "sourceName",
  "sourceUrl",
  "tags",
  "taxesIncluded",
  "test",
];

export class OrderValidationError extends Error {
  constructor(errors) {
    super("Invalid order input.");
    this.name = "OrderValidationError";
    this.errors = errors;
  }
}

export class ShopifyOrderCreateError extends Error {
  constructor(errors) {
    super("Shopify rejected the order creation request.");
    this.name = "ShopifyOrderCreateError";
    this.errors = errors;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateShopifyGid(value, pattern) {
  return typeof value === "string" && pattern.test(value);
}

export function buildOrderCreateInput(input) {
  const errors = [];

  if (!isPlainObject(input)) {
    throw new OrderValidationError([
      { field: ["body"], message: "Request body must be a JSON object." },
    ]);
  }

  const { customerId, lineItems, options, ...orderFields } = input;

  if (
    customerId !== undefined &&
    !validateShopifyGid(customerId, CUSTOMER_GID_PATTERN)
  ) {
    errors.push({
      field: ["customerId"],
      message: "customerId must be a Shopify Customer GID.",
    });
  }

  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    errors.push({
      field: ["lineItems"],
      message: "At least one line item is required.",
    });
  } else if (lineItems.length > 50) {
    errors.push({
      field: ["lineItems"],
      message: "A maximum of 50 line items can be created at once.",
    });
  } else {
    lineItems.forEach((lineItem, index) => {
      if (!isPlainObject(lineItem)) {
        errors.push({
          field: ["lineItems", index],
          message: "Line item must be an object.",
        });
        return;
      }

      if (!validateShopifyGid(lineItem.variantId, PRODUCT_VARIANT_GID_PATTERN)) {
        errors.push({
          field: ["lineItems", index, "variantId"],
          message: "variantId must be a Shopify ProductVariant GID.",
        });
      }

      if (!Number.isSafeInteger(lineItem.quantity) || lineItem.quantity < 1) {
        errors.push({
          field: ["lineItems", index, "quantity"],
          message: "quantity must be a positive integer.",
        });
      }
    });
  }

  Object.keys(orderFields).forEach((field) => {
    if (!ALLOWED_ORDER_FIELDS.includes(field)) {
      errors.push({
        field: [field],
        message: "Field is not supported for order creation.",
      });
    }
  });

  if (options !== undefined && !isPlainObject(options)) {
    errors.push({
      field: ["options"],
      message: "options must be an object when provided.",
    });
  }

  if (errors.length > 0) {
    throw new OrderValidationError(errors);
  }

  const order = {
    lineItems: lineItems.map((lineItem) => ({
      variantId: lineItem.variantId,
      quantity: lineItem.quantity,
    })),
  };

  if (customerId) {
    order.customer = {
      toAssociate: {
        id: customerId,
      },
    };
  }

  ALLOWED_ORDER_FIELDS.forEach((field) => {
    if (orderFields[field] !== undefined) {
      order[field] = orderFields[field];
    }
  });

  return {
    order,
    options: options || undefined,
  };
}

function formatUserErrors(userErrors) {
  return userErrors.map((error) => ({
    field: error.field || [],
    message: error.message,
  }));
}

function assertValidOrderId(order) {
  if (!order?.id || !SHOPIFY_GID_PATTERN.test(order.id)) {
    throw new Error("Shopify did not return a valid created order.");
  }
}

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

async function upsertCachedOrders(shop, orders) {
  await Promise.all(
    orders.map((order) => upsertCachedOrder(shop, order)),
  );
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

/**
 * Fetches the newest orders for a merchant.
 * @param {import("@shopify/shopify-app-react-router/server").AdminApiContext} admin
 * @param {{ first?: number }} options
 */
export async function getOrders(admin, { first = 5 } = {}) {
  const data = await runAdminGraphql(admin, GET_ORDERS_QUERY, { first });

  return data.orders.nodes;
}

export async function syncRecentOrdersFromShopify(
  admin,
  shop,
  { first = 5 } = {},
) {
  const orders = await getOrders(admin, { first });
  await upsertCachedOrders(shop, orders);
  await pruneCachedOrders(shop, { keep: DEFAULT_ORDER_CACHE_SIZE });

  return getCachedOrders(shop, { first });
}

/**
 * Creates an order for a merchant through Admin GraphQL.
 * Requires the app to have `write_orders` and an authenticated offline session.
 * @param {import("@shopify/shopify-app-react-router/server").AdminApiContext} admin
 * @param {Record<string, unknown>} input
 */
export async function createOrder(admin, input) {
  const variables = buildOrderCreateInput(input);
  const data = await runAdminGraphql(admin, CREATE_ORDER_MUTATION, variables);
  const userErrors = data.orderCreate?.userErrors || [];

  if (userErrors.length > 0) {
    throw new ShopifyOrderCreateError(formatUserErrors(userErrors));
  }

  const order = data.orderCreate?.order;
  assertValidOrderId(order);

  return order;
}
