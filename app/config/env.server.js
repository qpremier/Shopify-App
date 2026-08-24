// Reads environment variables once and exports them in a single object.
export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  shopifyApiKey: process.env.SHOPIFY_API_KEY || "",
  shopifyApiSecret: process.env.SHOPIFY_API_SECRET || "",
  shopifyAppUrl: process.env.SHOPIFY_APP_URL || "",
  shopifyScopes: process.env.SCOPES?.split(",") || [],
  shopCustomDomain: process.env.SHOP_CUSTOM_DOMAIN,
};
