// Product-related server helpers that talk to the Shopify Admin API.
const GET_PRODUCTS_QUERY = `#graphql
  query GetProducts($first: Int, $after: String, $last: Int, $before: String) {
    products(first: $first, after: $after, last: $last, before: $before) {
      nodes {
        id
        title
        handle
        status
        createdAt
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
  const response = await admin.graphql(GET_PRODUCTS_QUERY, {
    variables: { first, after, last, before },
  });
  const json = await response.json();
  const { nodes, pageInfo } = json.data.products;

  return {
    products: nodes,
    pageInfo,
  };
}
