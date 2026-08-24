// Product-related server helpers that talk to the Shopify Admin API.
import { runAdminGraphql } from "./admin-graphql.server";

const GET_PRODUCTS_QUERY = `#graphql
  query GetProducts($first: Int, $after: String, $last: Int, $before: String) {
    products(first: $first, after: $after, last: $last, before: $before) {
      nodes {
        id
        title
        handle
        status
        vendor
        productType
        totalInventory
        createdAt
        variants(first: 10) {
          nodes {
            id
          }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

// Fetches one cursor-based page of products for the embedded app home screen.
export async function getProducts(admin, { first, after, last, before } = {}) {
  const data = await runAdminGraphql(admin, GET_PRODUCTS_QUERY, {
    first,
    after,
    last,
    before,
  });
  const { nodes, pageInfo } = data.products;

  return {
    products: nodes,
    pageInfo,
  };
}
