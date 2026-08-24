// @ts-check

// Renders the list of products returned by the loader.
import { ProductCard } from "./ProductCard";

/**
 * Displays an empty state or a card for each product.
 * @param {{ products: import("../types/product").Product[] }} props
 */
export function ProductList({ products }) {
  if (products.length === 0) {
    return <s-paragraph>No products found in this store yet.</s-paragraph>;
  }

  return (
    <s-stack direction="block" gap="base">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </s-stack>
  );
}
