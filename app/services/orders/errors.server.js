export class ShopifyOrderCreateError extends Error {
  constructor(errors) {
    super("Shopify rejected the order creation request.");
    this.name = "ShopifyOrderCreateError";
    this.errors = errors;
  }
}
