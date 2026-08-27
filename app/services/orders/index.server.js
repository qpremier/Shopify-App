import { runAdminGraphql } from "../admin-graphql.server";
import {
  getCachedOrders,
  pruneCachedOrders,
  upsertCachedOrder,
  upsertCachedOrders,
} from "./cache.server";
import { ShopifyOrderCreateError } from "./errors.server";
import {
  CREATE_ORDER_MUTATION,
  GET_ORDERS_QUERY,
} from "./queries.server";
import {
  buildOrderCreateInput,
  OrderValidationError,
} from "./validation.server";

const SHOPIFY_GID_PATTERN = /^gid:\/\/shopify\/[A-Za-z]+\/\d+$/;

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
  await pruneCachedOrders(shop);

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

export {
  buildOrderCreateInput,
  getCachedOrders,
  OrderValidationError,
  pruneCachedOrders,
  ShopifyOrderCreateError,
  upsertCachedOrder,
};
