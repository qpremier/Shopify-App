// Product-related server helpers that talk to the Shopify Admin API.
const GET_PRODUCTS_QUERY = `#graphql
  query GetProducts($first: Int!) {
    products(first: $first) {
      nodes {
        id
        title
        handle
        status
        createdAt
      }
    }
  }
`;

// Fetches a small page of products for the embedded app home screen.
export async function getProducts(admin, { first = 10 } = {}) {
  const response = await admin.graphql(GET_PRODUCTS_QUERY, {
    variables: { first },
  });
  const json = await response.json();

  return json.data.products.nodes;
}
