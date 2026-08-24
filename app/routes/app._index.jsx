// Embedded app home page that loads and shows Shopify resources from the Admin API.
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ProductList } from "../components/ProductList";
import { ProductPagination } from "../components/ProductPagination";
import { CustomersList } from "../components/resources/CustomersList";
import { InventoryList } from "../components/resources/InventoryList";
import { LocationsList } from "../components/resources/LocationsList";
import { OrdersList } from "../components/resources/OrdersList";
import { ResourceSection } from "../components/resources/ResourceSection";
import { authenticate } from "../shopify.server";
import { getCustomers } from "../services/customers.server";
import { getInventoryItems } from "../services/inventory.server";
import { getLocations } from "../services/locations.server";
import { getOrders } from "../services/orders.server";
import { getProducts } from "../services/products.server";

const PRODUCTS_PAGE_SIZE = 10;
const RESOURCE_PREVIEW_SIZE = 5;

async function loadResource(fetcher) {
  try {
    return { items: await fetcher(), error: null };
  } catch (error) {
    return {
      items: [],
      error:
        error instanceof Error
          ? error.message
          : "Unable to load this Shopify resource.",
    };
  }
}

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

  const [productResult, orderResult, customerResult, inventoryResult, locationResult] =
    await Promise.all([
      loadResource(() => getProducts(admin, paginationOptions)),
      loadResource(() => getOrders(admin, { first: RESOURCE_PREVIEW_SIZE })),
      loadResource(() => getCustomers(admin, { first: RESOURCE_PREVIEW_SIZE })),
      loadResource(() => getInventoryItems(admin, { first: RESOURCE_PREVIEW_SIZE })),
      loadResource(() => getLocations(admin, { first: RESOURCE_PREVIEW_SIZE })),
    ]);

  return {
    products: productResult.items.products || [],
    productPageInfo: productResult.items.pageInfo || {
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: null,
      endCursor: null,
    },
    errors: {
      products: productResult.error,
      orders: orderResult.error,
      customers: customerResult.error,
      inventory: inventoryResult.error,
      locations: locationResult.error,
    },
    orders: orderResult.items,
    customers: customerResult.items,
    inventoryItems: inventoryResult.items,
    locations: locationResult.items,
  };
};

// Renders the loaded products inside Shopify web components.
export default function Index() {
  const {
    products,
    productPageInfo,
    errors,
    orders,
    customers,
    inventoryItems,
    locations,
  } = useLoaderData();

  return (
    <s-page heading="Shopify data">
      <ResourceSection
        title="Products"
        description="Showing 10 products at a time from the Shopify Admin API."
        items={products}
        error={errors.products}
      >
        <ProductList products={products} />
        <ProductPagination pageInfo={productPageInfo} />
      </ResourceSection>

      <ResourceSection
        title="Orders"
        description="Showing the newest orders from the Shopify Admin API."
        items={orders}
        error={errors.orders}
      >
        <OrdersList orders={orders} />
      </ResourceSection>

      <ResourceSection
        title="Customers"
        description="Showing recent customers from the Shopify Admin API."
        items={customers}
        error={errors.customers}
      >
        <CustomersList customers={customers} />
      </ResourceSection>

      <ResourceSection
        title="Inventory"
        description="Showing inventory items and their quantities by location."
        items={inventoryItems}
        error={errors.inventory}
      >
        <InventoryList inventoryItems={inventoryItems} />
      </ResourceSection>

      <ResourceSection
        title="Locations"
        description="Showing shop locations used for fulfillment and inventory."
        items={locations}
        error={errors.locations}
      >
        <LocationsList locations={locations} />
      </ResourceSection>
    </s-page>
  );
}

// Preserves headers Shopify needs on responses from this page.
export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
