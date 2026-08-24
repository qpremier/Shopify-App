// @ts-check

// Shows the main fields for a single Shopify product.
/**
 * Formats one product into a Shopify-styled card.
 * @param {{ product: import("../types/product").Product }} props
 */
export function ProductCard({ product }) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack direction="block" gap="small">
        <s-heading>{product.title}</s-heading>
        <s-paragraph>
          <s-text>Handle: </s-text>
          {product.handle}
        </s-paragraph>
        <s-paragraph>
          <s-text>Status: </s-text>
          {product.status}
        </s-paragraph>
        <s-paragraph>
          <s-text>Created: </s-text>
          {new Date(product.createdAt).toLocaleString()}
        </s-paragraph>
      </s-stack>
    </s-box>
  );
}
