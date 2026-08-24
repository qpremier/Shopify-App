// Purpose of this file is to fetch order previews from the Shopify Admin API.
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

/**
 * Fetches the newest orders for a merchant.
 * @param {import("@shopify/shopify-app-react-router/server").AdminApiContext} admin
 * @param {{ first?: number }} options
 */
export async function getOrders(admin, { first = 5 } = {}) {
  const data = await runAdminGraphql(admin, GET_ORDERS_QUERY, { first });

  return data.orders.nodes;
}
