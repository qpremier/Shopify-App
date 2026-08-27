// Purpose of this file is to provide shared Admin GraphQL helpers for Shopify resource services.

export class AdminGraphqlError extends Error {
  constructor(errors) {
    const message = errors
      .map((error) => error.message)
      .filter(Boolean)
      .join("; ");

    super(message || "Shopify Admin GraphQL request failed.");
    this.name = "AdminGraphqlError";
    this.errors = errors;
  }
}

function formatGraphqlErrors(errors) {
  return errors.map((error) => ({
    field: error.path || [],
    message: error.message || "Shopify Admin GraphQL request failed.",
    code: error.extensions?.code,
    documentation: error.extensions?.documentation,
  }));
}

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
    throw new AdminGraphqlError(formatGraphqlErrors(json.errors));
  }

  return json.data;
}
