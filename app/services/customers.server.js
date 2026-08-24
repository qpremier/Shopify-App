// Purpose of this file is to fetch customer previews from the Shopify Admin API.
import { runAdminGraphql } from "./admin-graphql.server";

const GET_CUSTOMERS_QUERY = `#graphql
  query GetCustomers($first: Int!) {
    customers(first: $first) {
      nodes {
        id
        displayName
        email
        phone
        numberOfOrders
        amountSpent {
          amount
          currencyCode
        }
        createdAt
      }
    }
  }
`;

/**
 * Fetches customers with contact and purchase summary fields.
 * @param {import("@shopify/shopify-app-react-router/server").AdminApiContext} admin
 * @param {{ first?: number }} options
 */
export async function getCustomers(admin, { first = 5 } = {}) {
  const data = await runAdminGraphql(admin, GET_CUSTOMERS_QUERY, { first });

  return data.customers.nodes;
}
