// Embedded app home page that loads and shows products from the Admin API.
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ProductList } from "../components/ProductList";
import { authenticate } from "../shopify.server";
import { getProducts } from "../services/products.server";

// Authenticates the merchant and loads product data on the server.
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  return {
    products: await getProducts(admin, { first: 10 }),
  };
};

// Renders the loaded products inside Shopify web components.
export default function Index() {
  const { products } = useLoaderData();

  return (
    <s-page heading="Products">
      <s-section heading="First 10 products">
        <s-paragraph>
          Showing the first 10 products returned by the Shopify Admin API.
        </s-paragraph>

        <ProductList products={products} />
      </s-section>
    </s-page>
  );
}

// Preserves headers Shopify needs on responses from this page.
export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
