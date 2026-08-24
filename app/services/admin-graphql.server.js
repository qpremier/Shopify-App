// Purpose of this file is to provide shared Admin GraphQL helpers for Shopify resource services.

/**
 * Runs a Shopify Admin GraphQL query and returns the parsed data object.
 * @param {import("@shopify/shopify-app-react-router/server").AdminApiContext} admin
 * @param {string} query
 * @param {Record<string, unknown>} variables
 */
export async function runAdminGraphql(admin, query, variables = {}) {
  const response = await admin.graphql(query, { variables });
  const json = await response.json();

  if (json.errors?.length) {
    const message = json.errors
      .map((error) => error.message)
      .filter(Boolean)
      .join("; ");

    throw new Error(message || "Shopify Admin GraphQL request failed.");
  }

  return json.data;
}
