// Embedded app home page that loads and shows products from the Admin API.
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ProductList } from "../components/ProductList";
import { ProductPagination } from "../components/ProductPagination";
import { authenticate } from "../shopify.server";
import { getProducts } from "../services/products.server";

const PRODUCTS_PAGE_SIZE = 10;

// Authenticates the merchant and loads product data on the server.
export const loader = async ({ request }) => {
  // First It authenticate the admin API and then fetches a page of products from the Shopify Admin API. It also reads the `after` and `before` query parameters to determine which page of products to load.
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  // It gets after and before query parameters from the URL to determine which page of products to load. If the before parameter is present, it fetches the previous page of products; otherwise, it fetches the next page.
  const after = url.searchParams.get("after");
  const before = url.searchParams.get("before");
  const paginationOptions = before
    ? { last: PRODUCTS_PAGE_SIZE, before }
    : { first: PRODUCTS_PAGE_SIZE, after };

  return await getProducts(admin, paginationOptions);
};

// Renders the loaded products inside Shopify web components.
export default function Index() {
  const { products, pageInfo } = useLoaderData();

  return (
    <s-page heading="Products">
      <s-section heading="Products">
        <s-paragraph>
          Showing 10 products at a time from the Shopify Admin API.
        </s-paragraph>
        <s-stack direction="block" gap="base">
          {/* Here it renders Products and Pagination */}
          <ProductList products={products} />
          <ProductPagination pageInfo={pageInfo} />
        </s-stack>
      </s-section>
    </s-page>
  );
}

// Preserves headers Shopify needs on responses from this page.
export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
