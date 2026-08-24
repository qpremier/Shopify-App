// Purpose of this file is to fetch location previews from the Shopify Admin API.
import { runAdminGraphql } from "./admin-graphql.server";

const GET_LOCATIONS_QUERY = `#graphql
  query GetLocations($first: Int!) {
    locations(first: $first) {
      nodes {
        id
        name
        isActive
        address {
          formatted
        }
      }
    }
  }
`;

/**
 * Fetches shop locations used for inventory and fulfillment.
 * @param {import("@shopify/shopify-app-react-router/server").AdminApiContext} admin
 * @param {{ first?: number }} options
 */
export async function getLocations(admin, { first = 5 } = {}) {
  const data = await runAdminGraphql(admin, GET_LOCATIONS_QUERY, { first });

  return data.locations.nodes;
}
