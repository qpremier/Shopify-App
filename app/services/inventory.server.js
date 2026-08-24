// Purpose of this file is to fetch inventory item previews from the Shopify Admin API.
import { runAdminGraphql } from "./admin-graphql.server";

const GET_INVENTORY_ITEMS_QUERY = `#graphql
  query GetInventoryItems($first: Int!) {
    inventoryItems(first: $first) {
      nodes {
        id
        sku
        tracked
        variant {
          id
          title
          product {
            title
          }
        }
        inventoryLevels(first: 10) {
          nodes {
            id
            quantities(names: ["available", "on_hand", "committed"]) {
              name
              quantity
            }
            location {
              id
              name
            }
          }
        }
      }
    }
  }
`;

/**
 * Fetches inventory items with quantities grouped by location.
 * @param {import("@shopify/shopify-app-react-router/server").AdminApiContext} admin
 * @param {{ first?: number }} options
 */
export async function getInventoryItems(admin, { first = 5 } = {}) {
  const data = await runAdminGraphql(admin, GET_INVENTORY_ITEMS_QUERY, { first });

  return data.inventoryItems.nodes;
}
